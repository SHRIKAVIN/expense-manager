const DB_NAME = "em-badge";
const STORE = "kv";
const COUNT_KEY = "count";
const LAST_ID_KEY = "lastNotificationId";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const get = tx.objectStore(STORE).get(key);
        get.onsuccess = () => resolve(get.result as T | undefined);
        get.onerror = () => reject(get.error);
      }),
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export async function readBadgeCount(): Promise<number> {
  try {
    const value = await idbGet<number>(COUNT_KEY);
    return Math.max(0, Number(value ?? 0));
  } catch {
    return 0;
  }
}

export async function writeBadgeCount(count: number): Promise<void> {
  await idbPut(COUNT_KEY, Math.max(0, count));
}

export async function readLastBadgeNotificationId(): Promise<string | undefined> {
  try {
    return await idbGet<string>(LAST_ID_KEY);
  } catch {
    return undefined;
  }
}

export async function writeLastBadgeNotificationId(id: string): Promise<void> {
  await idbPut(LAST_ID_KEY, id);
}
