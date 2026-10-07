"use client";
import { useSyncExternalStore } from "react";
import { DEFAULT_CONFIG, type CriterionKey, type ScoringConfig } from "@homehunt/scoring";
import { LocalAdapter } from "./adapters/local";
import { SupabaseAdapter } from "./adapters/supabase";
import type { Adapter, SyncState } from "./adapters/types";
import { EVERYONE, activeConfig, deriveAll } from "./derive";
import { nowIso, uid } from "./format";
import { emptyData, sampleData } from "./seed";
import { hasSupabase } from "./supabase";
import {
  ACTIVE_STATUSES,
  type Agent,
  type Assessment,
  type Data,
  type Note,
  type Offer,
  type Photo,
  type ProCon,
  type Property,
  type Proximity,
  type RowOf,
  type Status,
  type TableName,
  type Viewing,
} from "./types";

export type StoreStatus = "loading" | "ready" | "needs-auth" | "choose" | "denied" | "error";

export interface StoreState {
  status: StoreStatus;
  data: Data;
  me: string | null;
  mode: "local" | "supabase";
  sync: SyncState;
  pending: number;
  error: string | null;
  /** Bumps on every change so memoised selectors can key off it. */
  rev: number;
}

const blank = emptyData();

class Store {
  private state: StoreState = {
    status: "loading",
    data: blank,
    me: null,
    mode: hasSupabase ? "supabase" : "local",
    sync: "saved-local",
    pending: 0,
    error: null,
    rev: 0,
  };
  private listeners = new Set<() => void>();
  private adapter: Adapter | null = null;
  private started = false;
  private snapTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getState = () => this.state;
  getServerState = () => this.state;

  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch, rev: this.state.rev + 1 };
    this.listeners.forEach((l) => l());
  }

  async start() {
    if (this.started) return;
    this.started = true;
    try {
      this.adapter = hasSupabase ? new SupabaseAdapter() : new LocalAdapter();
      const res = await this.adapter.init();
      this.adapter.onSync((sync) => this.set({ sync, pending: this.adapter!.pending() }));
      this.adapter.subscribe((table, ev, row) => this.applyRemote(table, ev, row));
      if (res.needsAuth) return this.set({ status: "needs-auth" });
      if (!res.me) return this.set({ data: res.data, status: this.state.mode === "local" ? "choose" : "denied" });
      this.set({ data: res.data, me: res.me, status: "ready" });
    } catch (e) {
      this.set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  chooseMe(id: string) {
    LocalAdapter.chooseMe(id);
    this.set({ me: id, status: "ready" });
  }

  async signOut() {
    await this.adapter?.signOut?.();
    this.started = false;
    this.set({ me: null, status: this.state.mode === "local" ? "choose" : "needs-auth" });
    if (this.state.mode === "supabase") window.location.assign("/login");
  }

  private applyRemote(table: TableName, ev: "upsert" | "delete", row: { id: string } & Record<string, unknown>) {
    const data = { ...this.state.data };
    const rows = [...(data[table] as Array<{ id: string }>)];
    const i = rows.findIndex((r) => r.id === row.id);
    if (ev === "delete") {
      if (i >= 0) rows.splice(i, 1);
    } else if (i >= 0) rows[i] = row;
    else rows.push(row);
    (data[table] as unknown) = rows;
    this.set({ data });
  }

  /** Optimistic write: update memory, then persist. */
  async put<T extends TableName>(table: T, row: RowOf<T>) {
    const data = { ...this.state.data };
    const rows = [...(data[table] as Array<{ id: string }>)];
    const id = (row as { id: string }).id;
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows[i] = row as never;
    else rows.push(row as never);
    (data[table] as unknown) = rows;
    this.set({ data });
    try {
      await this.adapter!.upsert(table, row);
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : "Couldn't save" });
      throw e;
    }
    this.queueSnapshot();
  }

  async del(table: TableName, id: string) {
    const data = { ...this.state.data };
    (data[table] as unknown) = (data[table] as Array<{ id: string }>).filter((r) => r.id !== id);
    this.set({ data });
    await this.adapter!.remove(table, id);
    this.queueSnapshot();
  }

  clearError() {
    this.set({ error: null });
  }

  // ---- Score snapshots (FR-S4): one row whenever a home's score or tier changes ----
  private queueSnapshot() {
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => void this.writeSnapshots(), 400);
  }
  private async writeSnapshots() {
    const { data } = this.state;
    if (!this.state.me) return;
    const { version } = activeConfig(data);
    for (const d of deriveAll(data, EVERYONE)) {
      const last = [...data.score_snapshots].filter((s) => s.property_id === d.property.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const combined = Math.round(d.result.combined * 100) / 100;
      if (last && last.combined === combined && last.tier === d.tier && last.provisional === d.provisional && last.rank === d.rank) continue;
      const member_scores: Record<string, number> = {};
      for (const [id, m] of Object.entries(d.result.memberScores)) member_scores[id] = Math.round(m.score * 100) / 100;
      await this.put("score_snapshots", {
        id: uid(),
        property_id: d.property.id,
        config_version: version,
        combined,
        provisional: d.provisional,
        tier: d.tier,
        rank: d.rank,
        member_scores,
        created_at: nowIso(),
      }).catch(() => {});
    }
  }

  // ---- Actions ----
  private get me() {
    return this.state.me!;
  }
  private get hid() {
    return this.state.data.household.id;
  }

  async saveProperty(p: Property) {
    await this.put("properties", { ...p, updated_at: nowIso() });
  }

  async createProperty(input: Partial<Property> & Pick<Property, "address" | "asking_price">, opts: { agent?: Partial<Agent> | null; viewingAt?: string | null; status?: Status } = {}) {
    const id = uid();
    const t = nowIso();
    let agentId = input.default_agent_id ?? null;
    if (opts.agent?.name) {
      const existing = this.state.data.agents.find((a) => a.name.toLowerCase() === opts.agent!.name!.toLowerCase() && (a.agency ?? "") === (opts.agent!.agency ?? ""));
      agentId = existing?.id ?? (await this.saveAgent(opts.agent)).id;
    }
    const status: Status = opts.status ?? (opts.viewingAt ? "viewing_booked" : "shortlisted");
    const prop: Property = {
      id,
      household_id: this.hid,
      status,
      portal: null,
      listing_url: null,
      listing_id: null,
      price_qualifier: "guide",
      property_type: null,
      beds: null,
      baths: null,
      receptions: null,
      floor_area_sqft: null,
      tenure: null,
      lease_years: null,
      service_charge: null,
      ground_rent: null,
      council_tax_band: null,
      epc: null,
      postcode: null,
      lat: null,
      lng: null,
      address_precision: "exact",
      key_features: [],
      description: null,
      cover_image_path: null,
      image_urls: [],
      field_sources: {},
      pinned_by: null,
      pin_reason: null,
      ruled_out_reason: null,
      archived_at: null,
      tint: null,
      ...input,
      default_agent_id: agentId,
      created_at: t,
      updated_at: t,
    };
    await this.put("properties", prop);
    await this.put("status_events", { id: uid(), property_id: id, from_status: null, to_status: status, member_id: this.me, at: t });
    if (opts.viewingAt) await this.saveViewing({ property_id: id, agent_id: agentId, starts_at: opts.viewingAt, kind: "first" });
    return prop;
  }

  async setStatus(id: string, to: Status, reason?: string) {
    const p = this.state.data.properties.find((x) => x.id === id);
    if (!p || p.status === to) return;
    const t = nowIso();
    await this.put("properties", {
      ...p,
      status: to,
      ruled_out_reason: to === "ruled_out" ? (reason ?? p.ruled_out_reason ?? "Ruled out") : ACTIVE_STATUSES.includes(to) ? null : p.ruled_out_reason,
      updated_at: t,
    });
    await this.put("status_events", { id: uid(), property_id: id, from_status: p.status, to_status: to, member_id: this.me, at: t });
  }

  async archive(id: string, on = true) {
    const p = this.state.data.properties.find((x) => x.id === id);
    if (p) await this.put("properties", { ...p, archived_at: on ? nowIso() : null, updated_at: nowIso() });
  }

  async hardDelete(id: string) {
    const d = this.state.data;
    for (const t of ["viewings", "assessments", "pro_cons", "proximity", "offers", "notes", "photos", "status_events", "score_snapshots"] as const) {
      for (const r of d[t] as Array<{ id: string; property_id: string }>) if (r.property_id === id) await this.del(t, r.id);
    }
    await this.del("properties", id);
  }

  async pin(id: string, reason: string | null) {
    const p = this.state.data.properties.find((x) => x.id === id);
    if (p) await this.saveProperty({ ...p, pinned_by: reason === null ? null : this.me, pin_reason: reason });
  }

  async saveAgent(a: Partial<Agent>): Promise<Agent> {
    const row: Agent = {
      id: a.id ?? uid(),
      household_id: this.hid,
      name: a.name ?? "Agent",
      agency: a.agency ?? null,
      branch: a.branch ?? null,
      phone: a.phone ?? null,
      mobile: a.mobile ?? null,
      email: a.email ?? null,
      notes: a.notes ?? null,
    };
    await this.put("agents", row);
    return row;
  }

  async saveViewing(v: Partial<Viewing> & Pick<Viewing, "property_id" | "starts_at">): Promise<Viewing> {
    const row: Viewing = {
      id: v.id ?? uid(),
      agent_id: null,
      duration_min: 30,
      status: "booked",
      attendees: this.state.data.members.map((m) => m.id),
      notes: null,
      kind: "first",
      ...v,
    };
    await this.put("viewings", row);
    const p = this.state.data.properties.find((x) => x.id === row.property_id);
    if (p && row.status === "booked" && ["shortlisted", "viewed"].includes(p.status)) {
      await this.setStatus(p.id, row.kind === "second" ? "second_viewing" : "viewing_booked");
    }
    return row;
  }

  /** Mark a past viewing done once rated, and move the home to Viewed. */
  async completeViewing(viewingId: string) {
    const v = this.state.data.viewings.find((x) => x.id === viewingId);
    if (v && v.status === "booked") await this.put("viewings", { ...v, status: "done" });
    const p = v && this.state.data.properties.find((x) => x.id === v.property_id);
    if (p && ["shortlisted", "viewing_booked"].includes(p.status)) await this.setStatus(p.id, "viewed");
  }

  myAssessment(propertyId: string): Assessment | undefined {
    return this.state.data.assessments.find((a) => a.property_id === propertyId && a.member_id === this.me);
  }

  /** Autosave: the draft is a normal row with `submitted_at` null, kept locally and in the outbox until synced. */
  async saveAssessment(propertyId: string, patch: Partial<Assessment>, viewingId?: string | null): Promise<Assessment> {
    const cur = this.myAssessment(propertyId);
    const row: Assessment = {
      id: cur?.id ?? uid(),
      property_id: propertyId,
      viewing_id: cur?.viewing_id ?? viewingId ?? null,
      member_id: this.me,
      ratings: {},
      space_living: null,
      space_kitchen: null,
      gut_feel: null,
      note: null,
      submitted_at: null,
      ...cur,
      ...patch,
      updated_at: nowIso(),
    };
    await this.put("assessments", row);
    return row;
  }

  async submitAssessment(propertyId: string) {
    const a = this.myAssessment(propertyId);
    if (!a) return;
    await this.put("assessments", { ...a, submitted_at: a.submitted_at ?? nowIso(), updated_at: nowIso() });
    if (a.viewing_id) await this.completeViewing(a.viewing_id);
    else {
      const p = this.state.data.properties.find((x) => x.id === propertyId);
      if (p && ["shortlisted", "viewing_booked"].includes(p.status)) await this.setStatus(p.id, "viewed");
    }
  }

  async saveProCon(c: Partial<ProCon> & Pick<ProCon, "property_id" | "kind" | "text">): Promise<ProCon> {
    const mine = this.state.data.pro_cons.filter((x) => x.property_id === c.property_id && x.member_id === this.me);
    const row: ProCon = {
      id: uid(),
      member_id: this.me,
      impact: "moderate",
      criterion: null,
      deal_breaker: false,
      position: mine.length ? Math.max(...mine.map((x) => x.position)) + 1 : 0,
      agreed_from_id: null,
      ...c,
    };
    await this.put("pro_cons", row);
    return row;
  }

  /** The other buyer taps Agree: copy the item into their own list (FR-C4). */
  async agree(c: ProCon) {
    if (c.member_id === this.me) return;
    if (this.state.data.pro_cons.some((x) => x.member_id === this.me && x.agreed_from_id === c.id)) return;
    await this.saveProCon({ property_id: c.property_id, kind: c.kind, text: c.text, impact: c.impact, criterion: c.criterion, agreed_from_id: c.id });
  }

  async setOverride(propertyId: string, category: Proximity["category"], place: string, minutes: number) {
    const cur = this.state.data.proximity.find((x) => x.property_id === propertyId && x.category === category);
    await this.put("proximity", {
      id: cur?.id ?? uid(),
      property_id: propertyId,
      category,
      place_name: place || cur?.place_name || "Entered by hand",
      place_lat: cur?.place_lat ?? null,
      place_lng: cur?.place_lng ?? null,
      walk_min: minutes,
      walk_m: Math.round(minutes * 80),
      source: "manual",
      edited_by: this.me,
      calculated_at: nowIso(),
      method: null,
    });
  }

  /** Apply calculated rows; manual overrides are never overwritten (FR-L5). */
  async applyProximity(
    propertyId: string,
    rows: Array<Pick<Proximity, "category" | "place_name" | "walk_min"> & Partial<Pick<Proximity, "place_lat" | "place_lng" | "walk_m" | "method">>>,
    reset = false,
  ) {
    for (const r of rows) {
      const cur = this.state.data.proximity.find((x) => x.property_id === propertyId && x.category === r.category);
      if (cur?.source === "manual" && !reset) continue;
      await this.put("proximity", {
        id: cur?.id ?? uid(),
        property_id: propertyId,
        category: r.category,
        place_name: r.place_name,
        place_lat: r.place_lat ?? null,
        place_lng: r.place_lng ?? null,
        walk_min: r.walk_min,
        walk_m: r.walk_m ?? null,
        source: "auto",
        edited_by: null,
        calculated_at: nowIso(),
        method: r.method ?? null,
      });
    }
  }

  async saveOffer(o: Partial<Offer> & Pick<Offer, "property_id" | "amount">) {
    const row: Offer = { id: uid(), made_at: nowIso(), conditions: null, response: null, responded_at: null, outcome: "pending", ...o };
    await this.put("offers", row);
    const p = this.state.data.properties.find((x) => x.id === row.property_id);
    if (p && ACTIVE_STATUSES.includes(p.status)) {
      if (row.outcome === "accepted") await this.setStatus(p.id, "offer_accepted");
      else if (!["offer_made", "offer_accepted"].includes(p.status)) await this.setStatus(p.id, "offer_made");
    }
    return row;
  }

  async addNote(propertyId: string, text: string) {
    const n: Note = { id: uid(), property_id: propertyId, member_id: this.me, text, created_at: nowIso() };
    await this.put("notes", n);
  }

  async addPhoto(propertyId: string, storagePath: string) {
    const ph: Photo = { id: uid(), property_id: propertyId, member_id: this.me, storage_path: storagePath, created_at: nowIso() };
    await this.put("photos", ph);
    return ph;
  }

  async saveConfig(config: ScoringConfig, buyerType?: "first_time" | "standard") {
    const cur = [...this.state.data.scoring_config].sort((a, b) => b.version - a.version)[0];
    const version = (cur?.version ?? 0) + 1;
    await this.put("scoring_config", {
      id: uid(),
      household_id: this.hid,
      version,
      config: { ...config, version },
      buyer_type: buyerType ?? cur?.buyer_type ?? "first_time",
    });
  }

  async resetConfig() {
    await this.saveConfig(DEFAULT_CONFIG);
  }

  async renameMember(id: string, display_name: string) {
    const m = this.state.data.members.find((x) => x.id === id);
    if (m) await this.put("members", { ...m, display_name });
  }

  // ---- Demo-mode helpers (local adapter only) ----
  async loadSample() {
    await this.replace(sampleData());
  }
  async startEmpty() {
    await this.replace(emptyData());
  }
  private async replace(data: Data) {
    await this.adapter?.replaceAll?.(data);
    this.set({ data });
  }
}

export const store = new Store();

export function useStore(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getServerState);
}

export type { CriterionKey };
