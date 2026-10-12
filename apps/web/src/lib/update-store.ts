"use client";
import { useSyncExternalStore } from "react";
import { CANONICAL_URL, THIS_BUILD, canCheck, decide, versionUrl, type BuildInfo, type UpdateDecision } from "./update";

export interface UpdateState {
  status: "idle" | "checking" | "current" | "available" | "error";
  decision: UpdateDecision | null;
  latest: BuildInfo | null;
  /** The banner was dismissed for this build. */
  dismissed: boolean;
}

const DISMISS_KEY = "hh.update.dismissed";
let state: UpdateState = { status: "idle", decision: null, latest: null, dismissed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const wasDismissed = (build: string) => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === build;
  } catch {
    return false;
  }
};

/** Ask the live app which build is newest, and decide whether this copy is out of date. Safe to call often. */
export async function checkForUpdate(): Promise<UpdateState["status"]> {
  if (!canCheck()) {
    set({ status: "current" });
    return "current";
  }
  if (state.status === "checking") return "checking";
  set({ status: "checking" });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(versionUrl(), { cache: "no-store", signal: ctl.signal, credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const latest = (await res.json()) as BuildInfo;
    if (typeof latest?.build !== "string" || typeof latest?.builtAt !== "string") throw new Error("unexpected answer");
    const decision = decide(THIS_BUILD, latest, { origin: location.origin, path: location.pathname + location.search + location.hash }, CANONICAL_URL);
    set({ status: decision.available ? "available" : "current", decision: decision.available ? decision : null, latest, dismissed: decision.available ? wasDismissed(latest.build) : false });
    return decision.available ? "available" : "current";
  } catch {
    set({ status: "error" });
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export function dismissUpdate() {
  try {
    if (state.latest) sessionStorage.setItem(DISMISS_KEY, state.latest.build);
  } catch {
    /* ignore */
  }
  set({ dismissed: true });
}

/** Drop this copy's cached files and load the newest one. */
export async function reloadFresh() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* reload anyway */
  }
  location.reload();
}

export function openLatest() {
  if (state.decision?.target) location.assign(state.decision.target);
}

export const useUpdate = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
