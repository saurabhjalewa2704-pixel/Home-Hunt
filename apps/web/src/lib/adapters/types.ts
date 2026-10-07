import type { Data, RowOf, TableName } from "../types";

export type SyncState = "saved-local" | "syncing" | "synced" | "offline";

export interface InitResult {
  data: Data;
  /** The buyer who picked themselves on this device, or null while they still have to choose. */
  me: string | null;
}

export interface Adapter {
  mode: "local" | "supabase";
  init(): Promise<InitResult>;
  upsert<T extends TableName>(table: T, row: RowOf<T>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** Remote changes (other buyer, other tab). Returns an unsubscribe function. */
  subscribe(cb: (table: TableName, event: "upsert" | "delete", row: { id: string } & Record<string, unknown>) => void): () => void;
  /** Number of writes waiting to sync. */
  pending(): number;
  onSync(cb: (s: SyncState) => void): () => void;
  /** Replace everything (demo reset, import). */
  replaceAll?(data: Data): Promise<void>;
  /** Forget which buyer this device is. */
  signOut?(): Promise<void>;
}
