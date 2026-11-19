import type {
  CapturedPageInfo,
  CaptureWebsitePayload,
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/canvas';
import { extractDomain, isRestrictedUrl, sanitizeFaviconUrl } from '@/shared/utils/url';

export function isExtensionEnvironment(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

export async function sendExtensionMessage<T = unknown>(
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  if (!isExtensionEnvironment()) {
    return { ok: false, error: 'Running outside Chrome extension context.' };
  }
  return new Promise<ExtensionResponse<T>>((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: ExtensionResponse<T> | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response ?? { ok: false, error: 'No response from background service worker.' });
      });
    } catch (error) {
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to communicate with background.',
      });
    }
  });
}

export async function getActiveTabInfo(): Promise<CapturedPageInfo | null> {
  if (!isExtensionEnvironment() || !chrome.tabs) {
    return null;
  }

  return new Promise<CapturedPageInfo | null>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      const tab = tabs[0];
      if (!tab?.url) {
        resolve(null);
        return;
      }
      resolve({
        title: tab.title?.trim() || extractDomain(tab.url),
        url: tab.url,
        domain: extractDomain(tab.url),
        favicon: sanitizeFaviconUrl(tab.favIconUrl),
      });
    });
  });
}

/**
 * Downscales a captured JPEG data URL to a lightweight thumbnail (max 480px wide)
 * so Chrome Storage remains fast and well within quota limits.
 */
async function compressDataUrl(dataUrl: string, maxWidth = 480, quality = 0.65): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function captureVisibleTabThumbnail(): Promise<string | undefined> {
  if (!isExtensionEnvironment() || !chrome.tabs?.captureVisibleTab) {
    return undefined;
  }

  try {
    const activeTab = await getActiveTabInfo();
    if (!activeTab || isRestrictedUrl(activeTab.url)) {
      return undefined;
    }

    const rawDataUrl = await new Promise<string | undefined>((resolve) => {
      chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 60 }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          resolve(undefined);
          return;
        }
        resolve(dataUrl);
      });
    });

    if (!rawDataUrl) return undefined;
    return await compressDataUrl(rawDataUrl, 480, 0.65);
  } catch {
    return undefined;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isExtensionEnvironment() && chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openCanvasWorkspaceTab(canvasId?: string): Promise<void> {
  if (isExtensionEnvironment()) {
    const response = await sendExtensionMessage({
      type: 'OPEN_CANVAS',
      payload: canvasId ? { canvasId } : undefined,
    });
    if (response.ok) return;

    const baseUrl = chrome.runtime.getURL('canvas.html');
    const url = canvasId ? `${baseUrl}?canvas=${encodeURIComponent(canvasId)}` : baseUrl;
    chrome.tabs.create({ url });
    return;
  }
  window.open('/canvas.html', '_blank');
}

export async function openExtensionSidePanel(): Promise<void> {
  if (!isExtensionEnvironment()) return;

  try {
    if (chrome.sidePanel?.open && chrome.tabs?.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const windowId = tabs[0]?.windowId;
      if (windowId !== undefined) {
        await chrome.sidePanel.open({ windowId });
        return;
      }
    }
  } catch {
    // Fallback to background message
  }

  await sendExtensionMessage({ type: 'OPEN_SIDEPANEL' });
}

export async function captureWebsiteViaBackground(
  payload: CaptureWebsitePayload
): Promise<ExtensionResponse<{ canvasId: string; nodeId: string }>> {
  return sendExtensionMessage<{ canvasId: string; nodeId: string }>({
    type: 'ADD_WEBSITE_TO_CANVAS',
    payload,
  });
}
