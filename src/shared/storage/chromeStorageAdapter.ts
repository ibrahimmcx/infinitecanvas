import type { IStorageAdapter } from '@/shared/storage/types';

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export class ChromeStorageAdapter implements IStorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    if (hasChromeStorage()) {
      return new Promise<T | null>((resolve, reject) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          const value = result[key];
          resolve(value !== undefined ? (value as T) : null);
        });
      });
    }

    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (hasChromeStorage()) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
    }

    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error(
        `Failed to persist data to localStorage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async remove(key: string): Promise<void> {
    if (hasChromeStorage()) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove([key], () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
    }

    globalThis.localStorage?.removeItem(key);
  }

  subscribe(key: string, listener: (newValue: unknown) => void): () => void {
    if (hasChromeStorage() && chrome.storage.onChanged) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
      ) => {
        if (areaName !== 'local') return;
        const change = changes[key];
        if (change && change.newValue !== undefined) {
          listener(change.newValue);
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }

    if (typeof window !== 'undefined') {
      const handler = (event: StorageEvent) => {
        if (event.key !== key || !event.newValue) return;
        try {
          listener(JSON.parse(event.newValue));
        } catch {
          // Ignore malformed external storage events
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }

    return () => {};
  }
}
