import type { GameState, SerializedState } from "./GameState";

export interface SaveData {
  version: number;
  savedAt: number;
  time: { hour: number; day: number };
  state: SerializedState;
}

const DB_NAME = "sanctuary-mainframe";
const STORE = "saves";
const KEY = "slot-1";
const VERSION = 1;

export class SaveSystem {
  private memory: SaveData | null = null;

  async save(data: SaveData): Promise<boolean> {
    this.memory = data;
    try {
      const db = await openDb();
      await request(db, "readwrite", (store) => store.put(data, KEY));
      db.close();
      return true;
    } catch (error) {
      console.warn("IndexedDB save failed, kept in memory", error);
      return false;
    }
  }

  async load(): Promise<SaveData | null> {
    try {
      const db = await openDb();
      const result = await request<SaveData | undefined>(db, "readonly", (store) =>
        store.get(KEY),
      );
      db.close();
      if (result && result.version === VERSION) return result;
      return this.memory;
    } catch (error) {
      console.warn("IndexedDB load failed", error);
      return this.memory;
    }
  }

  async clear(): Promise<void> {
    this.memory = null;
    try {
      const db = await openDb();
      await request(db, "readwrite", (store) => store.delete(KEY));
      db.close();
    } catch (error) {
      console.warn("IndexedDB clear failed", error);
    }
  }

  async hasSave(): Promise<boolean> {
    return (await this.load()) !== null;
  }
}

export function buildSaveData(state: GameState, hour: number, day: number): SaveData {
  return {
    version: VERSION,
    savedAt: Date.now(),
    time: { hour, day },
    state: state.serialize(),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function request<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const req = action(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}
