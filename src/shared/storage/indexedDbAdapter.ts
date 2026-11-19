import type { IStorageAdapter } from '@/shared/storage/types';

const DB_NAME = 'infinite-canvas-db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

/**
 * Modular IndexedDB storage adapter implementing IStorageAdapter.
 * Designed as a drop-in replacement when workspaces exceed Chrome Storage local quotas
 * (e.g., high-resolution screenshot archives or very large multi-canvas datasets).
 */
export class IndexedDBAdapter implements IStorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    });

    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.openDb();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result !== undefined ? (request.result as T) : null);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'));
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed.'));
    });
  }
}
