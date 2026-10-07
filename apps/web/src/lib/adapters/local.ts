import { emptyData } from "../seed";
import { clearPersona, getPersona, setPersona } from "../persona";
import type { Data, RowOf, TableName } from "../types";
import { TABLES } from "../types";
import type { Adapter, SyncState } from "./types";

const KEY = "hh.data.v1";

/**
 * Demo / offline-first adapter: everything lives in this browser's
 * localStorage, so the app runs with no accounts or keys. Two tabs act as the
 * two buyers (they share storage and sync through the `storage` event).
 */
export class LocalAdapter implements Adapter {
  mode = "local" as const;
  private data!: Data;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Parameters<Adapter["subscribe"]>[0]>();
  private syncListeners = new Set<(s: SyncState) => void>();
  private suppress = false;

  async init() {
    let data: Data | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw) as Data;
    } catch {
      /* corrupted or unavailable: start fresh */
    }
    // A clean slate: sample homes only appear if you ask for them in Settings.
    this.data = data ?? emptyData();
    if (!data) this.flush();
    let me = getPersona();
    if (me && !this.data.members.some((m) => m.id === me)) me = null;
    window.addEventListener("storage", this.onStorage);
    // Don't lose the last edit if the tab closes or navigates inside the debounce window.
    const flushNow = () => {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
        this.flush();
      }
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushNow());
    return { data: this.data, me };
  }

  static chooseMe(id: string) {
    setPersona(id);
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key !== KEY || !e.newValue || this.suppress) return;
    try {
      const next = JSON.parse(e.newValue) as Data;
      for (const t of TABLES) {
        const before = new Map((this.data[t] as Array<{ id: string }>).map((r) => [r.id, JSON.stringify(r)]));
        for (const row of next[t] as Array<{ id: string }>) {
          if (before.get(row.id) !== JSON.stringify(row)) this.listeners.forEach((cb) => cb(t, "upsert", row as never));
          before.delete(row.id);
        }
        for (const id of before.keys()) this.listeners.forEach((cb) => cb(t, "delete", { id }));
      }
      this.data = next;
    } catch {
      /* ignore */
    }
  };

  private flush() {
    this.suppress = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      this.syncListeners.forEach((cb) => cb("saved-local"));
    } catch {
      /* storage full or blocked */
    }
    this.suppress = false;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 120);
  }

  async upsert<T extends TableName>(table: T, row: RowOf<T>) {
    const rows = this.data[table] as Array<{ id: string }>;
    const i = rows.findIndex((r) => r.id === (row as { id: string }).id);
    if (i >= 0) rows[i] = row as never;
    else rows.push(row as never);
    this.schedule();
  }

  async remove(table: TableName, id: string) {
    const rows = this.data[table] as Array<{ id: string }>;
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows.splice(i, 1);
    this.schedule();
  }

  async replaceAll(data: Data) {
    this.data = data;
    this.flush();
  }

  subscribe(cb: Parameters<Adapter["subscribe"]>[0]) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  pending() {
    return 0;
  }
  onSync(cb: (s: SyncState) => void) {
    this.syncListeners.add(cb);
    return () => this.syncListeners.delete(cb);
  }
  async signOut() {
    clearPersona();
  }
}

export const freshData = emptyData;
