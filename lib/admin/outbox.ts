// The editor's unsent edits, kept in IndexedDB so they outlive a reload, a crash or a lost connection. Without
// IndexedDB (some private windows) they live only in memory; saving still works.
export interface OutboxRecord {
  key: string;
  entry: unknown;
}

const DB_NAME = "cwe-admin";
const STORE = "outbox";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let database: Promise<IDBDatabase | null> | null = null;
const db = () => (database ??= open());

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return db().then(
    (handle) =>
      new Promise((resolve) => {
        if (!handle) return resolve(null);
        try {
          const request = action(handle.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

export async function outboxLoad(): Promise<OutboxRecord[]> {
  return ((await run("readonly", (store) => store.getAll())) as OutboxRecord[] | null) ?? [];
}

export async function outboxPut(record: OutboxRecord): Promise<void> {
  await run("readwrite", (store) => store.put(record));
}

export async function outboxDelete(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key));
}
