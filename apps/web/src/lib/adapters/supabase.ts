import type { SupabaseClient } from "@supabase/supabase-js";
import { idb, outbox } from "../offline";
import { supabaseBrowser } from "../supabase";
import type { Data, RowOf, TableName } from "../types";
import { TABLES } from "../types";
import type { Adapter, SyncState } from "./types";

const CACHE_KEY = "data";

/**
 * Supabase adapter: Postgres with row-level security, magic-link sessions and
 * Realtime. Writes that fail while offline wait in an IndexedDB outbox and are
 * replayed, in order, when the connection returns (FR-R4).
 */
export class SupabaseAdapter implements Adapter {
  mode = "supabase" as const;
  private sb: SupabaseClient = supabaseBrowser();
  private data!: Data;
  private count = 0;
  private flushing = false;
  private syncListeners = new Set<(s: SyncState) => void>();
  private listeners = new Set<Parameters<Adapter["subscribe"]>[0]>();

  private emit(s: SyncState) {
    this.syncListeners.forEach((cb) => cb(s));
  }

  async init() {
    const { data: sess } = await this.sb.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return { data: {} as Data, me: null, needsAuth: true };
    let data: Data | null = null;
    try {
      data = await this.loadAll();
      idb.put("cache", data, CACHE_KEY).catch(() => {});
    } catch {
      // Offline: fall back to the last snapshot so the schedule and assessments still open.
      data = (await idb.get<Data>("cache", CACHE_KEY).catch(() => undefined)) ?? null;
      if (!data) throw new Error("You're offline and nothing is saved on this phone yet.");
      this.emit("offline");
    }
    this.data = data;
    const me = data.members.find((m) => m.user_id === uid)?.id ?? null;
    this.count = (await outbox.all().catch(() => [])).length;
    window.addEventListener("online", () => void this.flush());
    window.addEventListener("offline", () => this.emit("offline"));
    void this.flush();
    this.listenRealtime();
    return { data, me, needsAuth: false };
  }

  private async loadAll(): Promise<Data> {
    const [h, ...rest] = await Promise.all([
      this.sb.from("households").select("*").limit(1).maybeSingle(),
      ...TABLES.map((t) => this.sb.from(t).select("*").limit(5000)),
    ]);
    if (h.error) throw h.error;
    const out: Record<string, unknown> = { household: h.data ?? { id: "", name: "", created_at: "" } };
    TABLES.forEach((t, i) => {
      const r = rest[i];
      if (r.error) throw r.error;
      out[t] = r.data ?? [];
    });
    return out as unknown as Data;
  }

  private listenRealtime() {
    const ch = this.sb.channel("homehunt");
    for (const t of TABLES) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => {
        const ev = p.eventType === "DELETE" ? "delete" : "upsert";
        const row = (ev === "delete" ? p.old : p.new) as { id: string };
        if (row?.id) this.listeners.forEach((cb) => cb(t, ev, row as never));
      });
    }
    ch.subscribe();
  }

  private async send(op: { table: string; op: "upsert" | "delete"; row?: Record<string, unknown>; id?: string }) {
    const q = this.sb.from(op.table);
    // Members are provisioned once by bootstrap_household(); the app may only edit them, never insert.
    if (op.table === "members" && op.op === "upsert") {
      const { display_name, colour } = op.row as { display_name: string; colour: string };
      const r = await q.update({ display_name, colour }).eq("id", (op.row as { id: string }).id);
      if (r.error) throw r.error;
      return;
    }
    const res = op.op === "upsert" ? await q.upsert(op.row!) : await q.delete().eq("id", op.id!);
    if (res.error) throw res.error;
  }

  /** Network failures queue; permission or constraint errors are real and surface. */
  private async write(op: { table: string; op: "upsert" | "delete"; row?: Record<string, unknown>; id?: string }) {
    this.emit("syncing");
    try {
      if (this.count > 0) throw new TypeError("queue first, keep order");
      await this.send(op);
      this.emit("synced");
    } catch (e) {
      const offline = e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
      if (!offline) {
        this.emit("synced");
        throw e;
      }
      await outbox.add({ ...op, at: new Date().toISOString() });
      this.count++;
      this.emit("offline");
    }
  }

  async flush() {
    if (this.flushing || typeof navigator === "undefined" || !navigator.onLine) return;
    this.flushing = true;
    try {
      const ops = await outbox.all();
      if (!ops.length) return;
      this.emit("syncing");
      for (const op of ops) {
        try {
          await this.send(op);
        } catch (e) {
          if (e instanceof TypeError) return void this.emit("offline");
          // A rejected write (for example a deleted parent row) must not block the queue.
          console.warn("Dropping unsyncable write", op, e);
        }
        await outbox.remove(op.seq!);
        this.count = Math.max(0, this.count - 1);
      }
      this.emit("synced");
    } finally {
      this.flushing = false;
    }
  }

  async upsert<T extends TableName>(table: T, row: RowOf<T>) {
    await this.write({ table, op: "upsert", row: row as unknown as Record<string, unknown> });
  }
  async remove(table: TableName, id: string) {
    await this.write({ table, op: "delete", id });
  }
  subscribe(cb: Parameters<Adapter["subscribe"]>[0]) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  pending() {
    return this.count;
  }
  onSync(cb: (s: SyncState) => void) {
    this.syncListeners.add(cb);
    return () => this.syncListeners.delete(cb);
  }
  async signOut() {
    await this.sb.auth.signOut();
    await idb.del("cache", CACHE_KEY).catch(() => {});
  }
}
