import { ChromeStorageAdapter } from '@/shared/storage/chromeStorageAdapter';
import type { IStorageAdapter } from '@/shared/storage/types';
import {
  DEFAULT_CANVAS_SETTINGS,
  type CanvasFlowEdge,
  type CanvasProject,
  type CaptureWebsitePayload,
  type CardColor,
  type PageActionItem,
  type PageSectionKind,
  type PersistedWorkspaceState,
  type WebsiteFlowNode,
} from '@/shared/types/canvas';
import { createId } from '@/shared/utils/id';
import { extractDomain, normalizeExternalUrl, sanitizeFaviconUrl } from '@/shared/utils/url';

export const WORKSPACE_STORAGE_KEY = 'infinite_canvas_workspace_v1';
export const CURRENT_SCHEMA_VERSION = 1;

let activeAdapter: IStorageAdapter = new ChromeStorageAdapter();

export function setStorageAdapter(adapter: IStorageAdapter): void {
  activeAdapter = adapter;
}

export function getStorageAdapter(): IStorageAdapter {
  return activeAdapter;
}

export function createEmptyCanvas(name: string, description = ''): CanvasProject {
  const now = new Date().toISOString();
  return {
    id: createId('canvas'),
    name: name.trim() || 'Untitled Canvas',
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: { ...DEFAULT_CANVAS_SETTINGS },
  };
}

export function createInitialWorkspaceState(): PersistedWorkspaceState {
  const starterCanvas = createEmptyCanvas(
    'My First Canvas',
    'Capture websites from your browser and organize them spatially.'
  );
  return {
    version: CURRENT_SCHEMA_VERSION,
    activeCanvasId: starterCanvas.id,
    canvases: [starterCanvas],
    onboardingCompleted: false,
  };
}

export async function loadWorkspaceState(): Promise<PersistedWorkspaceState> {
  const stored = await activeAdapter.get<PersistedWorkspaceState>(WORKSPACE_STORAGE_KEY);
  if (!stored || !Array.isArray(stored.canvases) || stored.canvases.length === 0) {
    const initial = createInitialWorkspaceState();
    await saveWorkspaceState(initial);
    return initial;
  }

  const activeExists = stored.canvases.some((c) => c.id === stored.activeCanvasId);
  const firstCanvas = stored.canvases[0];
  return {
    version: stored.version ?? CURRENT_SCHEMA_VERSION,
    activeCanvasId: activeExists && stored.activeCanvasId ? stored.activeCanvasId : firstCanvas!.id,
    canvases: stored.canvases.map((canvas) => ({
      ...canvas,
      settings: { ...DEFAULT_CANVAS_SETTINGS, ...(canvas.settings ?? {}) },
      viewport: canvas.viewport ?? { x: 0, y: 0, zoom: 1 },
      nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
      edges: Array.isArray(canvas.edges) ? canvas.edges : [],
    })),
    onboardingCompleted: Boolean(stored.onboardingCompleted),
  };
}

export async function saveWorkspaceState(state: PersistedWorkspaceState): Promise<void> {
  await activeAdapter.set<PersistedWorkspaceState>(WORKSPACE_STORAGE_KEY, {
    ...state,
    version: CURRENT_SCHEMA_VERSION,
  });
}

export function subscribeWorkspaceChanges(
  listener: (state: PersistedWorkspaceState) => void
): () => void {
  if (!activeAdapter.subscribe) {
    return () => {};
  }
  return activeAdapter.subscribe(WORKSPACE_STORAGE_KEY, (newValue) => {
    if (
      newValue &&
      typeof newValue === 'object' &&
      'canvases' in newValue &&
      Array.isArray((newValue as PersistedWorkspaceState).canvases)
    ) {
      listener(newValue as PersistedWorkspaceState);
    }
  });
}

function computeNextCardPosition(existingNodes: WebsiteFlowNode[]): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: 120, y: 120 };
  }
  const cols = 4;
  const col = existingNodes.length % cols;
  const row = Math.floor(existingNodes.length / cols);
  const baseX = 120 + col * 330;
  const baseY = 120 + row * 260;

  const isOccupied = (x: number, y: number) =>
    existingNodes.some(
      (n) => Math.abs(n.position.x - x) < 40 && Math.abs(n.position.y - y) < 40
    );

  let x = baseX;
  let y = baseY;
  let attempts = 0;
  while (isOccupied(x, y) && attempts < 20) {
    x += 36;
    y += 36;
    attempts += 1;
  }
  return { x, y };
}

export async function addWebsiteToCanvasInStorage(
  payload: CaptureWebsitePayload
): Promise<{ canvas: CanvasProject; node: WebsiteFlowNode }> {
  const normalizedUrl = normalizeExternalUrl(payload.url);
  if (!normalizedUrl) {
    throw new Error('Please provide a valid http:// or https:// URL.');
  }

  const state = await loadWorkspaceState();
  const targetId = payload.canvasId ?? state.activeCanvasId;
  const canvasIndex = state.canvases.findIndex((c) => c.id === targetId);
  const resolvedIndex = canvasIndex >= 0 ? canvasIndex : 0;
  const targetCanvas = state.canvases[resolvedIndex]!;

  const domain = extractDomain(normalizedUrl);
  const position = computeNextCardPosition(targetCanvas.nodes);
  const now = new Date().toISOString();

  const newNode: WebsiteFlowNode = {
    id: createId('node'),
    type: 'website',
    position,
    width: 288,
    data: {
      title: payload.title.trim() || domain,
      url: normalizedUrl,
      domain,
      favicon: sanitizeFaviconUrl(payload.favicon),
      description: (payload.description ?? '').trim(),
      tags: (payload.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
      screenshot: payload.screenshot,
      capturedAt: now,
      color: payload.color ?? 'default',
      variant: payload.screenshot ? 'featured' : 'standard',
    },
  };

  const updatedCanvas: CanvasProject = {
    ...targetCanvas,
    updatedAt: now,
    nodes: [...targetCanvas.nodes, newNode],
  };

  const updatedCanvases = [...state.canvases];
  updatedCanvases[resolvedIndex] = updatedCanvas;

  await saveWorkspaceState({
    ...state,
    activeCanvasId: updatedCanvas.id,
    canvases: updatedCanvases,
  });

  return { canvas: updatedCanvas, node: newNode };
}

export interface ExtractedPageSection {
  title: string;
  sectionKind: PageSectionKind;
  summary: string;
  icTargetId: string;
  actions: PageActionItem[];
  screenshot?: string;
}

export interface CaptureUniverseInput {
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  screenshot?: string;
  sections: ExtractedPageSection[];
}

const SECTION_STYLE_MAP: Record<
  PageSectionKind,
  { color: CardColor; cluster: string; edgeLabel: string }
> = {
  page: { color: 'indigo', cluster: 'Header', edgeLabel: 'Page' },
  header: { color: 'sky', cluster: 'Header', edgeLabel: 'Header' },
  nav: { color: 'violet', cluster: 'Navigation', edgeLabel: 'Navigation' },
  hero: { color: 'indigo', cluster: 'Content', edgeLabel: 'Hero' },
  section: { color: 'sky', cluster: 'Content', edgeLabel: 'Section' },
  aside: { color: 'amber', cluster: 'Resources', edgeLabel: 'Sidebar' },
  form: { color: 'amber', cluster: 'Interactive', edgeLabel: 'Controls' },
  footer: { color: 'default', cluster: 'Footer', edgeLabel: 'Footer' },
};

export async function capturePageUniverseInStorage(
  input: CaptureUniverseInput
): Promise<{ canvas: CanvasProject; centralNode: WebsiteFlowNode }> {
  const normalizedUrl = normalizeExternalUrl(input.url);
  if (!normalizedUrl) {
    throw new Error('Invalid URL for spatial universe capture.');
  }

  const state = await loadWorkspaceState();
  const domain = extractDomain(normalizedUrl);
  const now = new Date().toISOString();

  const sections = input.sections.slice(0, 12);
  const totalButtons = sections.reduce((acc, s) => acc + s.actions.length, 0);

  // Separate structural/control sections (Header, Nav, Form, Aside) from visual content sections (Hero, Section, Footer)
  const controlSections = sections.filter(
    (s) =>
      s.sectionKind === 'header' ||
      s.sectionKind === 'nav' ||
      s.sectionKind === 'form' ||
      s.sectionKind === 'aside'
  );
  const visualSections = sections.filter(
    (s) =>
      s.sectionKind === 'hero' ||
      s.sectionKind === 'section' ||
      s.sectionKind === 'footer'
  );

  // Column 1 (Left): Page Overview Hub Card
  const centralId = createId('node');
  const centralNode: WebsiteFlowNode = {
    id: centralId,
    type: 'website',
    position: { x: 60, y: 140 },
    width: 310,
    data: {
      title: input.title.trim() || domain,
      url: normalizedUrl,
      domain,
      favicon: sanitizeFaviconUrl(input.favicon),
      description:
        (input.description ?? '').trim() ||
        `${sections.length} page sections · ${totalButtons} interactive controls mapped live from ${domain}.`,
      tags: [`${sections.length} Sections`, `${totalButtons} Controls`],
      screenshot: input.screenshot,
      capturedAt: now,
      color: 'indigo',
      variant: 'featured',
      cluster: 'Header',
      isCentral: true,
      sectionKind: 'page',
      position3d: [0, 0, 0],
      actions: sections.slice(0, 8).map((s) => ({
        icId: s.icTargetId,
        label: s.title,
        kind: 'button' as const,
      })),
    },
  };

  const nodes: WebsiteFlowNode[] = [centralNode];
  const edges: CanvasFlowEdge[] = [];

  const controlNodeIds: string[] = [];

  // Column 2 (Middle): Header / Navigation / Interactive Control cards
  controlSections.forEach((sec, idx) => {
    const style = SECTION_STYLE_MAP[sec.sectionKind] ?? SECTION_STYLE_MAP.nav;
    const nodeId = createId('node');
    controlNodeIds.push(nodeId);

    const btnCount = sec.actions.filter((a) => a.kind === 'button').length;
    const linkCount = sec.actions.filter((a) => a.kind === 'link').length;
    const tags: string[] = [];
    if (btnCount > 0) tags.push(`${btnCount} btn`);
    if (linkCount > 0) tags.push(`${linkCount} link`);
    if (tags.length === 0) tags.push(style.edgeLabel);

    nodes.push({
      id: nodeId,
      type: 'website',
      position: {
        x: 470,
        y: 60 + idx * 255,
      },
      width: 300,
      data: {
        title: sec.title,
        url: normalizedUrl,
        domain,
        favicon: sanitizeFaviconUrl(input.favicon),
        description: sec.summary,
        tags,
        screenshot: sec.screenshot,
        capturedAt: now,
        color: style.color,
        variant: sec.screenshot ? 'standard' : 'compact',
        cluster: style.cluster,
        isCentral: false,
        sectionKind: sec.sectionKind,
        icTargetId: sec.icTargetId,
        actions: sec.actions,
        position3d: [-4.5, 1.8 - idx * 1.6, -1.5],
      },
    });

    edges.push({
      id: createId('edge'),
      source: centralId,
      target: nodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'canvasEdge',
      animated: false,
      data: {
        label: style.edgeLabel,
        curveStyle: 'bezier',
        animated: false,
        strokeColor: '#4f7cff',
      },
    });
  });

  // Column 3 & 4 (Right): Visual Section Preview Cards with real cropped section screenshots!
  const hasMiddleCol = controlSections.length > 0;
  const visualStartX = hasMiddleCol ? 900 : 490;

  visualSections.forEach((sec, idx) => {
    const style = SECTION_STYLE_MAP[sec.sectionKind] ?? SECTION_STYLE_MAP.section;
    const nodeId = createId('node');

    const col = idx < 4 ? 0 : 1;
    const row = idx < 4 ? idx : idx - 4;
    const xPos = visualStartX + col * 490;
    const yPos = 30 + row * 445;

    const btnCount = sec.actions.filter((a) => a.kind === 'button').length;
    const linkCount = sec.actions.filter((a) => a.kind === 'link').length;
    const tags: string[] = [];
    if (btnCount > 0) tags.push(`${btnCount} btn`);
    if (linkCount > 0) tags.push(`${linkCount} link`);
    if (tags.length === 0) tags.push(style.edgeLabel);

    const angle = (idx / Math.max(1, visualSections.length)) * Math.PI * 2;
    nodes.push({
      id: nodeId,
      type: 'website',
      position: { x: xPos, y: yPos },
      width: 390,
      data: {
        title: sec.title,
        url: normalizedUrl,
        domain,
        favicon: sanitizeFaviconUrl(input.favicon),
        description: sec.summary,
        tags,
        screenshot: sec.screenshot,
        capturedAt: now,
        color: style.color,
        variant: 'featured',
        cluster: style.cluster,
        isCentral: false,
        sectionKind: sec.sectionKind,
        icTargetId: sec.icTargetId,
        actions: sec.actions,
        position3d: [
          Number((Math.cos(angle) * 5.8).toFixed(2)),
          Number((Math.sin(angle) * 2.2).toFixed(2)),
          Number((Math.sin(angle) * 3.5 - 1).toFixed(2)),
        ],
      },
    });

    // Connect from middle control card (warm amber curve) or directly from hub (blue curve)
    const parentId =
      col === 0 && controlNodeIds.length > 0
        ? controlNodeIds[idx % controlNodeIds.length]!
        : col === 1 && visualSections.length > 0
          ? nodes[nodes.length - 1 - Math.min(4, idx)]?.id ?? centralId
          : centralId;

    const isAmberCurve = col === 0 && controlNodeIds.length > 0;

    edges.push({
      id: createId('edge'),
      source: parentId,
      target: nodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'canvasEdge',
      animated: false,
      data: {
        label: undefined,
        curveStyle: 'bezier',
        animated: false,
        strokeColor: isAmberCurve ? '#d99b43' : '#4f7cff',
      },
    });
  });

  const existingIdx = state.canvases.findIndex((c) =>
    c.nodes.some((n) => n.data.isCentral && n.data.url === normalizedUrl)
  );

  const universeCanvas: CanvasProject = {
    id: existingIdx >= 0 ? state.canvases[existingIdx]!.id : createId('canvas'),
    name: domain,
    description: `Live spatial map of ${input.title.trim() || domain}`,
    createdAt: existingIdx >= 0 ? state.canvases[existingIdx]!.createdAt : now,
    updatedAt: now,
    nodes,
    edges,
    viewport: { x: 40, y: 40, zoom: 0.72 },
    settings: {
      ...DEFAULT_CANVAS_SETTINGS,
      defaultEdgeStyle: 'bezier',
      animatedEdges: false,
      gridVariant: 'none',
      showMinimap: true,
    },
    camera3d: {
      position: [0, 1.8, 12.2],
      target: [0, 0, 0],
    },
  };

  const nextCanvases =
    existingIdx >= 0
      ? state.canvases.map((c, i) => (i === existingIdx ? universeCanvas : c))
      : [
          universeCanvas,
          ...state.canvases.filter(
            (c) => !(c.name === 'My First Canvas' && c.nodes.length === 0)
          ),
        ];

  await saveWorkspaceState({
    ...state,
    activeCanvasId: universeCanvas.id,
    canvases: nextCanvases,
    onboardingCompleted: true,
  });

  return { canvas: universeCanvas, centralNode };
}
