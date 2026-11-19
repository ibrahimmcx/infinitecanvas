import {
  addWebsiteToCanvasInStorage,
  capturePageUniverseInStorage,
  loadWorkspaceState,
  type ExtractedPageSection,
} from '@/shared/storage/workspaceStorage';
import type {
  ExtensionMessage,
  ExtensionResponse,
  PageActionItem,
  PageSectionKind,
} from '@/shared/types/canvas';
import { extractDomain, isRestrictedUrl, normalizeExternalUrl } from '@/shared/utils/url';

const MENU_LAUNCH_SPATIAL = 'infinite-canvas-launch-spatial';
const MENU_ADD_LINK = 'infinite-canvas-add-link';
const MENU_OPEN_FULL_TAB = 'infinite-canvas-open-full-tab';
const MENU_OPEN_SIDEPANEL = 'infinite-canvas-open-sidepanel';

interface RawSectionWithRect extends ExtractedPageSection {
  docTop: number;
  docLeft: number;
  width: number;
  height: number;
}

interface ExtractedPageStructure {
  title: string;
  description: string;
  favicon: string;
  viewportWidth: number;
  viewportHeight: number;
  scrollHeight: number;
  originalScrollY: number;
  sections: RawSectionWithRect[];
}

function registerContextMenus(): void {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_LAUNCH_SPATIAL,
      title: 'Open Infinite Canvas on this page',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: MENU_ADD_LINK,
      title: 'Add link to Infinite Canvas',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_FULL_TAB,
      title: 'Open Infinite Canvas in full tab',
      contexts: ['action'],
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_SIDEPANEL,
      title: 'Open Infinite Canvas Side Panel',
      contexts: ['action'],
    });
  });
}

function flashBadge(text: string, color = '#6366f1'): void {
  if (!chrome.action) return;
  void chrome.action.setBadgeBackgroundColor({ color });
  void chrome.action.setBadgeText({ text });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openOrFocusCanvasTab(canvasId?: string): Promise<void> {
  const baseUrl = chrome.runtime.getURL('canvas.html');
  const targetUrl = canvasId ? `${baseUrl}?canvas=${encodeURIComponent(canvasId)}` : baseUrl;

  try {
    const existingTabs = await chrome.tabs.query({ url: `${baseUrl}*` });
    const existing = existingTabs[0];
    if (existing?.id !== undefined) {
      await chrome.tabs.update(existing.id, {
        active: true,
        ...(canvasId ? { url: targetUrl } : {}),
      });
      if (existing.windowId !== undefined) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      return;
    }
  } catch {
    // Fall through
  }

  await chrome.tabs.create({ url: targetUrl });
}

async function tryRemoveExistingOverlay(tabId: number): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const existing = document.getElementById('infinite-canvas-spatial-root');
        const hostStyle = document.getElementById('infinite-canvas-host-style');
        if (existing || hostStyle) {
          existing?.remove();
          hostStyle?.remove();
          return true;
        }
        return false;
      },
    });
    return Boolean(results[0]?.result);
  } catch {
    return false;
  }
}

async function setScanningIndicator(tabId: number, visible: boolean): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [visible],
      func: (show: boolean) => {
        const ID = 'infinite-canvas-scanning-pill';
        const existing = document.getElementById(ID);
        if (!show) {
          existing?.remove();
          return;
        }
        if (existing) return;
        const pill = document.createElement('div');
        pill.id = ID;
        pill.textContent = 'Infinite Canvas · Capturing sections...';
        Object.assign(pill.style, {
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: '2147483647',
          background: '#0d0f16',
          color: '#e6e8ec',
          border: '1px solid rgba(129, 140, 248, 0.45)',
          borderRadius: '9999px',
          padding: '8px 16px',
          fontSize: '12px',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        });
        document.documentElement.appendChild(pill);
      },
    });
  } catch {
    // Ignore
  }
}

async function extractPageStructure(tabId: number): Promise<ExtractedPageStructure | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (): ExtractedPageStructure => {
        const metaDesc =
          document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ||
          document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ||
          '';

        const iconEl =
          document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
          document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]') ||
          document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');

        const isVisible = (el: Element): boolean => {
          const rect = el.getBoundingClientRect();
          if (rect.width < 12 || rect.height < 12) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        };

        const cleanText = (raw: string | null | undefined, max = 60): string =>
          (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

        let idCounter = 1;
        const tagElement = (el: Element, prefix: string): string => {
          const existing = el.getAttribute('data-ic-id');
          if (existing) return existing;
          const id = `ic-${prefix}-${idCounter++}`;
          el.setAttribute('data-ic-id', id);
          return id;
        };

        const assignedControls = new WeakSet<Element>();

        const extractControlsFrom = (container: Element, limit = 10): PageActionItem[] => {
          const selector =
            'button, [role="button"], a[href], input[type="submit"], input[type="button"], input[type="search"], input[type="text"]';
          const candidates = Array.from(container.querySelectorAll(selector));
          const items: PageActionItem[] = [];
          const seenLabels = new Set<string>();

          for (const el of candidates) {
            if (items.length >= limit) break;
            if (assignedControls.has(el) || !isVisible(el)) continue;

            const tag = el.tagName.toLowerCase();
            let kind: 'button' | 'link' | 'input' = 'button';
            let label = '';
            let href: string | undefined;

            if (tag === 'input') {
              const inputEl = el as HTMLInputElement;
              const type = (inputEl.type || 'text').toLowerCase();
              kind = type === 'submit' || type === 'button' ? 'button' : 'input';
              label = cleanText(
                inputEl.value || inputEl.placeholder || inputEl.getAttribute('aria-label') || type,
                40
              );
            } else if (tag === 'a') {
              const anchor = el as HTMLAnchorElement;
              kind = anchor.getAttribute('role') === 'button' ? 'button' : 'link';
              label = cleanText(
                anchor.innerText || anchor.getAttribute('aria-label') || anchor.title,
                42
              );
              href = anchor.href;
            } else {
              kind = 'button';
              label = cleanText(
                (el as HTMLElement).innerText ||
                  el.getAttribute('aria-label') ||
                  el.getAttribute('title'),
                42
              );
            }

            if (label.length < 2) continue;
            const key = `${kind}:${label.toLowerCase()}`;
            if (seenLabels.has(key)) continue;

            seenLabels.add(key);
            assignedControls.add(el);
            items.push({
              icId: tagElement(el, 'el'),
              label,
              kind,
              ...(href ? { href } : {}),
            });
          }

          return items;
        };

        const inferSectionTitle = (
          el: Element,
          kind: PageSectionKind,
          index: number
        ): string => {
          const aria = cleanText(el.getAttribute('aria-label'), 48);
          if (aria) return aria;
          const heading = el.querySelector('h1, h2, h3');
          const headingText = cleanText(heading?.textContent, 48);
          if (headingText) return headingText;

          const fallbacks: Record<PageSectionKind, string> = {
            page: 'Main Page',
            header: 'Header & Top Bar',
            nav: 'Navigation Menu',
            hero: 'Hero & Overview',
            section: `Section ${index + 1}`,
            aside: 'Sidebar & Extras',
            form: 'Search & Forms',
            footer: 'Footer & Links',
          };
          return fallbacks[kind];
        };

        const inferSummary = (el: Element): string => {
          const p = el.querySelector('p');
          const pText = cleanText(p?.textContent, 110);
          if (pText.length >= 16) return pText;
          return cleanText(el.textContent, 110);
        };

        const sections: RawSectionWithRect[] = [];
        const pickedContainers = new Set<Element>();

        const addSection = (el: Element, kind: PageSectionKind) => {
          if (sections.length >= 12) return;
          if (pickedContainers.has(el) || !isVisible(el)) return;
          for (const already of pickedContainers) {
            if (already.contains(el) && kind === 'section') return;
          }

          const rect = el.getBoundingClientRect();
          const actions = extractControlsFrom(el, 10);
          const title = inferSectionTitle(el, kind, sections.length);
          const summary = inferSummary(el);

          if (actions.length === 0 && summary.length < 20) return;

          pickedContainers.add(el);
          sections.push({
            title,
            sectionKind: kind,
            summary: summary || `${actions.length} interactive controls inside ${title}`,
            icTargetId: tagElement(el, 'sec'),
            actions,
            docTop: Math.max(0, Math.round(rect.top + window.scrollY)),
            docLeft: Math.max(0, Math.round(rect.left + window.scrollX)),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        };

        const header = document.querySelector('header, [role="banner"]');
        if (header) addSection(header, 'header');

        const navs = Array.from(document.querySelectorAll('nav, [role="navigation"]')).slice(0, 2);
        navs.forEach((nav) => addSection(nav, 'nav'));

        const semanticSections = Array.from(
          document.querySelectorAll('main section, main article, section, article')
        );
        semanticSections.forEach((sec, i) => {
          addSection(sec, i === 0 ? 'hero' : 'section');
        });

        const forms = Array.from(document.querySelectorAll('form')).slice(0, 2);
        forms.forEach((form) => addSection(form, 'form'));

        const aside = document.querySelector('aside, [role="complementary"]');
        if (aside) addSection(aside, 'aside');

        const footer = document.querySelector('footer, [role="contentinfo"]');
        if (footer) addSection(footer, 'footer');

        if (sections.length < 4) {
          const headings = Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 8);
          for (const h of headings) {
            if (sections.length >= 10) break;
            const container = h.closest('div, main') ?? h.parentElement;
            if (container && container !== document.body) {
              addSection(container, sections.length === 0 ? 'hero' : 'section');
            }
          }
        }

        if (sections.length < 2) {
          const remainingActions = extractControlsFrom(document.body, 12);
          if (remainingActions.length > 0) {
            sections.push({
              title: 'Page Controls & Buttons',
              sectionKind: 'section',
              summary: `Interactive buttons and links on ${window.location.hostname}`,
              icTargetId: tagElement(document.body, 'sec'),
              actions: remainingActions,
              docTop: 0,
              docLeft: 0,
              width: window.innerWidth,
              height: window.innerHeight,
            });
          }
        }

        return {
          title: document.title || window.location.hostname,
          description: metaDesc.trim().slice(0, 280),
          favicon: iconEl?.href || '',
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
          originalScrollY: window.scrollY,
          sections,
        };
      },
    });
    return (results[0]?.result as ExtractedPageStructure | undefined) ?? null;
  } catch {
    return null;
  }
}

async function scrollTabTo(tabId: number, y: number): Promise<number> {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      args: [y],
      func: (targetY: number) => {
        window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
        return window.scrollY;
      },
    });
    return typeof res[0]?.result === 'number' ? res[0].result : y;
  } catch {
    return y;
  }
}

async function captureTabScreenshot(windowId: number): Promise<string | undefined> {
  try {
    return await new Promise<string | undefined>((resolve) => {
      chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 68 }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          resolve(undefined);
          return;
        }
        resolve(dataUrl);
      });
    });
  } catch {
    return undefined;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function setFixedElementsHidden(tabId: number, hidden: boolean): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [hidden],
      func: (shouldHide: boolean) => {
        const ATTR = 'data-ic-hidden-fixed';
        if (!shouldHide) {
          document.querySelectorAll<HTMLElement>(`[${ATTR}]`).forEach((el) => {
            el.style.visibility = el.getAttribute(ATTR) ?? '';
            el.removeAttribute(ATTR);
          });
          return;
        }
        const all = document.querySelectorAll<HTMLElement>('header, nav, [style*="fixed"], [style*="sticky"]');
        all.forEach((el) => {
          const pos = window.getComputedStyle(el).position;
          if (pos === 'fixed' || pos === 'sticky') {
            if (!el.hasAttribute(ATTR)) {
              el.setAttribute(ATTR, el.style.visibility);
              el.style.visibility = 'hidden';
            }
          }
        });
      },
    });
  } catch {
    // Ignore
  }
}

async function cropSectionFromBitmap(
  bitmap: ImageBitmap,
  viewportWidth: number,
  viewportHeight: number,
  scrollY: number,
  sec: RawSectionWithRect
): Promise<string | undefined> {
  if (typeof OffscreenCanvas === 'undefined') return undefined;
  try {
    // Only crop if this section actually intersects the captured viewport band!
    const secTopInView = sec.docTop - scrollY;
    const secBottomInView = sec.docTop + sec.height - scrollY;
    if (secBottomInView < 40 || secTopInView > viewportHeight - 40) {
      return undefined;
    }

    const scaleX = bitmap.width / Math.max(1, viewportWidth);
    const scaleY = bitmap.height / Math.max(1, viewportHeight);

    const relTop = Math.max(0, secTopInView);
    const relLeft = Math.max(0, sec.docLeft);
    const visH = Math.min(viewportHeight - relTop, Math.max(120, Math.min(sec.height, viewportHeight - relTop)));
    const visW = Math.min(viewportWidth - relLeft, Math.max(240, sec.width));

    if (visH < 45 || visW < 80) return undefined;

    const sx = Math.max(0, Math.round(relLeft * scaleX));
    const sy = Math.max(0, Math.round(relTop * scaleY));
    const sw = Math.min(bitmap.width - sx, Math.round(visW * scaleX));
    const sh = Math.min(bitmap.height - sy, Math.round(visH * scaleY));
    if (sw < 30 || sh < 30) return undefined;

    const maxOutW = 540;
    const outScale = Math.min(1, maxOutW / sw);
    const dw = Math.max(1, Math.round(sw * outScale));
    const dh = Math.max(1, Math.round(sh * outScale));

    const canvas = new OffscreenCanvas(dw, dh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
}

/**
 * Captures unique viewport bands covering every visual section of the page (respecting Chrome's
 * 2 captures/sec limit), temporarily hiding fixed/sticky headers on lower bands so each section
 * receives its own distinct, accurate visual crop with zero duplicate screenshots.
 */
async function captureSectionThumbnails(
  tabId: number,
  windowId: number,
  structure: ExtractedPageStructure
): Promise<{ heroScreenshot?: string; sections: ExtractedPageSection[] }> {
  const { viewportWidth, viewportHeight, scrollHeight, originalScrollY, sections } = structure;

  // Deduplicate overlapping sections that sit at nearly the same vertical position
  const uniqueSections: RawSectionWithRect[] = [];
  for (const sec of sections) {
    const isVisual =
      sec.sectionKind === 'hero' || sec.sectionKind === 'section' || sec.sectionKind === 'footer';
    if (
      isVisual &&
      uniqueSections.some(
        (u) =>
          (u.sectionKind === 'hero' || u.sectionKind === 'section' || u.sectionKind === 'footer') &&
          Math.abs(u.docTop - sec.docTop) < 55
      )
    ) {
      continue;
    }
    uniqueSections.push(sec);
  }

  // Compute minimal distinct scroll stops covering all visual sections (up to 7 bands)
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  const stops: number[] = [0];
  const visualOnes = uniqueSections
    .filter((s) => s.sectionKind === 'hero' || s.sectionKind === 'section' || s.sectionKind === 'footer')
    .sort((a, b) => a.docTop - b.docTop);

  for (const sec of visualOnes) {
    const coveredByExisting = stops.some(
      (stop) => sec.docTop >= stop - 20 && sec.docTop <= stop + viewportHeight * 0.45
    );
    if (!coveredByExisting && stops.length < 12) {
      stops.push(Math.min(maxScroll, Math.max(0, sec.docTop - 24)));
    }
  }
  if (maxScroll > 0 && stops.length < 12 && !stops.some((s) => Math.abs(s - maxScroll) < 120)) {
    stops.push(maxScroll);
  }

  const bands: Array<{ scrollY: number; dataUrl: string; bitmap: ImageBitmap | null }> = [];

  for (let i = 0; i < stops.length; i++) {
    if (i === 1) {
      await setFixedElementsHidden(tabId, true);
    }
    const actualY = await scrollTabTo(tabId, stops[i]!);
    await sleep(i === 0 ? 80 : 540);
    const dataUrl = await captureTabScreenshot(windowId);
    if (dataUrl) {
      let bitmap: ImageBitmap | null = null;
      try {
        const resp = await fetch(dataUrl);
        const blob = await resp.blob();
        bitmap = await createImageBitmap(blob);
      } catch {
        bitmap = null;
      }
      bands.push({ scrollY: actualY, dataUrl, bitmap });
    }
  }

  await setFixedElementsHidden(tabId, false);
  await scrollTabTo(tabId, originalScrollY);

  // Downscale top viewport for central overview card
  let heroScreenshot = bands[0]?.dataUrl;
  if (bands[0]?.bitmap && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bm = bands[0].bitmap;
      const scale = Math.min(1, 560 / bm.width);
      const c = new OffscreenCanvas(Math.round(bm.width * scale), Math.round(bm.height * scale));
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(bm, 0, 0, c.width, c.height);
        heroScreenshot = await blobToDataUrl(await c.convertToBlob({ type: 'image/jpeg', quality: 0.7 }));
      }
    } catch {
      // Keep raw
    }
  }

  // Crop each visual section ONLY from a band that genuinely contains it (never duplicate heroScreenshot!)
  const usedCropFingerprints = new Set<string>();
  const enriched: ExtractedPageSection[] = [];

  for (const sec of uniqueSections) {
    const isVisual =
      sec.sectionKind === 'hero' || sec.sectionKind === 'section' || sec.sectionKind === 'footer';

    let cropped: string | undefined;

    if (isVisual) {
      // Find the band whose viewport best frames sec.docTop
      let bestBand: (typeof bands)[number] | undefined;
      let bestScore = Infinity;

      for (const band of bands) {
        const topInBand = sec.docTop - band.scrollY;
        if (topInBand >= -30 && topInBand <= viewportHeight - 100) {
          const score = Math.abs(topInBand);
          if (score < bestScore) {
            bestScore = score;
            bestBand = band;
          }
        }
      }

      if (bestBand?.bitmap) {
        const candidate = await cropSectionFromBitmap(
          bestBand.bitmap,
          viewportWidth,
          viewportHeight,
          bestBand.scrollY,
          sec
        );
        if (candidate) {
          const fp = `${candidate.length}:${candidate.slice(64, 140)}`;
          if (!usedCropFingerprints.has(fp)) {
            usedCropFingerprints.add(fp);
            cropped = candidate;
          }
        }
      }
    }

    enriched.push({
      title: sec.title,
      sectionKind: sec.sectionKind,
      summary: sec.summary,
      icTargetId: sec.icTargetId,
      actions: sec.actions,
      screenshot: cropped,
    });
  }

  bands.forEach((b) => b.bitmap?.close());

  return { heroScreenshot, sections: enriched };
}

/**
 * Replaces the open website's visible viewport in-place by hiding all original body children
 * via a reversible host stylesheet and mounting Infinite Canvas as the sole visible root
 * inside the website's own document.body — zero new tabs, zero leaked page elements.
 */
async function mountSpatialOverlay(tabId: number, canvasId: string): Promise<boolean> {
  const overlayUrl = chrome.runtime.getURL(
    `canvas.html?mode=overlay&canvas=${encodeURIComponent(canvasId)}`
  );

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [overlayUrl],
      func: (iframeSrc: string) => {
        const ROOT_ID = 'infinite-canvas-spatial-root';
        const STYLE_ID = 'infinite-canvas-host-style';

        document.getElementById(ROOT_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();

        // Hide all original page components cleanly while preserving their live DOM & event handlers
        const hostStyle = document.createElement('style');
        hostStyle.id = STYLE_ID;
        hostStyle.textContent = `
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;
            background: #e8d1bd !important;
          }
          body > :not(#${ROOT_ID}) {
            display: none !important;
          }
          #${ROOT_ID} {
            display: block !important;
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483647 !important;
            background: #e8d1bd !important;
          }
        `;
        document.head.appendChild(hostStyle);

        const container = document.createElement('div');
        container.id = ROOT_ID;
        container.style.opacity = '0';
        container.style.transition = 'opacity 180ms ease-out';

        const iframe = document.createElement('iframe');
        iframe.src = iframeSrc;
        iframe.allow = 'fullscreen';
        Object.assign(iframe.style, {
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          backgroundColor: '#e8d1bd',
        });

        const restoreOriginalPage = (afterRestore?: () => void) => {
          container.style.opacity = '0';
          window.removeEventListener('message', onMessage);
          setTimeout(() => {
            container.remove();
            hostStyle.remove();
            afterRestore?.();
          }, 140);
        };

        const highlightAndActivate = (icId: string, mode: 'click' | 'scroll') => {
          const target = document.querySelector<HTMLElement>(`[data-ic-id="${CSS.escape(icId)}"]`);
          if (!target) return;

          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

          const prevOutline = target.style.outline;
          const prevOutlineOffset = target.style.outlineOffset;
          const prevTransition = target.style.transition;
          target.style.transition = 'outline-color 200ms ease';
          target.style.outline = '2px solid #818cf8';
          target.style.outlineOffset = '4px';

          setTimeout(() => {
            target.style.outline = prevOutline;
            target.style.outlineOffset = prevOutlineOffset;
            target.style.transition = prevTransition;
          }, 1800);

          if (mode === 'click') {
            setTimeout(() => {
              if (target.tagName.toLowerCase() === 'input') {
                target.focus();
              } else {
                target.click();
              }
            }, 220);
          }
        };

        const onMessage = (event: MessageEvent) => {
          const data = event.data as
            | { type?: string; icId?: string; mode?: 'click' | 'scroll' }
            | undefined;
          if (!data || typeof data !== 'object') return;

          if (data.type === 'INFINITE_CANVAS_CLOSE_OVERLAY') {
            restoreOriginalPage();
          } else if (data.type === 'INFINITE_CANVAS_ACTIVATE_ELEMENT' && data.icId) {
            const targetId = data.icId;
            const mode = data.mode ?? 'click';
            restoreOriginalPage(() => highlightAndActivate(targetId, mode));
          }
        };

        window.addEventListener('message', onMessage);
        container.appendChild(iframe);
        document.body.appendChild(container);

        requestAnimationFrame(() => {
          container.style.opacity = '1';
          iframe.focus();
        });
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function launchSpatialOnTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url || isRestrictedUrl(tab.url)) {
    await openOrFocusCanvasTab();
    return;
  }

  const wasRemoved = await tryRemoveExistingOverlay(tab.id);
  if (wasRemoved) {
    return;
  }

  const normalizedUrl = normalizeExternalUrl(tab.url);
  if (!normalizedUrl) {
    await openOrFocusCanvasTab();
    return;
  }

  await setScanningIndicator(tab.id, true);
  try {
    const structure = await extractPageStructure(tab.id);
    let heroScreenshot: string | undefined;
    let sections: ExtractedPageSection[] = [];

    if (structure && tab.windowId !== undefined) {
      // Hide pill briefly before capturing so it never appears in screenshots
      await setScanningIndicator(tab.id, false);
      const captured = await captureSectionThumbnails(tab.id, tab.windowId, structure);
      heroScreenshot = captured.heroScreenshot;
      sections = captured.sections;
    } else if (tab.windowId !== undefined) {
      await setScanningIndicator(tab.id, false);
      heroScreenshot = await captureTabScreenshot(tab.windowId);
    }

    const { canvas } = await capturePageUniverseInStorage({
      url: normalizedUrl,
      title: structure?.title || tab.title?.trim() || extractDomain(normalizedUrl),
      description: structure?.description || '',
      favicon: structure?.favicon || tab.favIconUrl || '',
      screenshot: heroScreenshot,
      sections,
    });

    const mounted = await mountSpatialOverlay(tab.id, canvas.id);
    if (!mounted) {
      await openOrFocusCanvasTab(canvas.id);
    }
  } finally {
    await setScanningIndicator(tab.id, false);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void launchSpatialOnTab(tab);
});

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenus();
  void loadWorkspaceState();

  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  registerContextMenus();
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_OPEN_FULL_TAB) {
    void openOrFocusCanvasTab();
    return;
  }

  if (info.menuItemId === MENU_OPEN_SIDEPANEL) {
    if (tab?.windowId !== undefined && chrome.sidePanel?.open) {
      void chrome.sidePanel.open({ windowId: tab.windowId });
    }
    return;
  }

  if (info.menuItemId === MENU_LAUNCH_SPATIAL && tab) {
    void launchSpatialOnTab(tab);
    return;
  }

  if (info.menuItemId === MENU_ADD_LINK && info.linkUrl) {
    const normalized = normalizeExternalUrl(info.linkUrl);
    if (!normalized) {
      flashBadge('!', '#e11d48');
      return;
    }

    void addWebsiteToCanvasInStorage({
      url: normalized,
      title: info.selectionText?.trim() || extractDomain(normalized),
    })
      .then(() => flashBadge('+1', '#6366f1'))
      .catch(() => flashBadge('!', '#e11d48'));
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    const handle = async (): Promise<ExtensionResponse> => {
      switch (message.type) {
        case 'GET_ACTIVE_TAB': {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          if (!tab?.url) {
            return { ok: false, error: 'No active tab found.' };
          }
          return {
            ok: true,
            data: {
              title: tab.title?.trim() || extractDomain(tab.url),
              url: tab.url,
              domain: extractDomain(tab.url),
              favicon: tab.favIconUrl ?? '',
            },
          };
        }

        case 'ADD_WEBSITE_TO_CANVAS': {
          const { canvas, node } = await addWebsiteToCanvasInStorage(message.payload);
          flashBadge('+1', '#6366f1');
          return {
            ok: true,
            data: { canvasId: canvas.id, nodeId: node.id },
          };
        }

        case 'OPEN_CANVAS': {
          await openOrFocusCanvasTab(message.payload?.canvasId);
          return { ok: true };
        }

        case 'OPEN_SIDEPANEL': {
          if (!chrome.sidePanel?.open) {
            return { ok: false, error: 'Side Panel API is unavailable in this browser.' };
          }
          let windowId = sender.tab?.windowId;
          if (windowId === undefined) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            windowId = tabs[0]?.windowId;
          }
          if (windowId === undefined) {
            return { ok: false, error: 'Could not determine active browser window.' };
          }
          await chrome.sidePanel.open({ windowId });
          return { ok: true };
        }

        default:
          return { ok: false, error: 'Unknown extension message type.' };
      }
    };

    void handle()
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unexpected background error.',
        });
      });

    return true;
  }
);
