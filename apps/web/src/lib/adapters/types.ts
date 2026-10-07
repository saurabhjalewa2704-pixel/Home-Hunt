import type { Data, RowOf, TableName } from "../types";

export type SyncState = "saved-local" | "syncing" | "synced" | "offline";

export interface InitResult {
  data: Data;
  /** The signed-in buyer's member id, or null when someone still has to choose or sign in. */
  me: string | null;
  needsAuth?: boolean;
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
  signOut?(): Promise<void>;
}
