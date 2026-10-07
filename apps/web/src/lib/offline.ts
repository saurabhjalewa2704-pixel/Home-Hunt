/** Tiny IndexedDB wrapper: write outbox, cached data snapshot and photo blobs. */
const DB = "homehunt";
const STORES = ["outbox", "cache", "blobs"] as const;
type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      db.createObjectStore("cache");
      db.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}

async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const idb = {
  get: <T>(store: StoreName, key: IDBValidKey) => tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  put: (store: StoreName, value: unknown, key?: IDBValidKey) => tx(store, "readwrite", (s) => s.put(value, key)),
  del: (store: StoreName, key: IDBValidKey) => tx(store, "readwrite", (s) => s.delete(key)),
  all: <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
};

export interface OutboxOp {
  seq?: number;
  table: string;
  op: "upsert" | "delete";
  row?: Record<string, unknown>;
  id?: string;
  at: string;
}

export const outbox = {
  add: (op: Omit<OutboxOp, "seq">) => idb.put("outbox", op),
  all: () => idb.all<OutboxOp>("outbox"),
  remove: (seq: number) => idb.del("outbox", seq),
};

/** Photos taken on the phone are kept as blobs until they are uploaded. */
export const blobs = {
  put: (key: string, blob: Blob) => idb.put("blobs", blob, key),
  get: (key: string) => idb.get<Blob>("blobs", key),
  del: (key: string) => idb.del("blobs", key),
};

/** Downscale an image file to at most `max` px wide, as JPEG. */
export async function resizeImage(file: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", quality));
}
