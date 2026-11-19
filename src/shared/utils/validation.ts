import {
  CARD_COLOR_META,
  DEFAULT_CANVAS_SETTINGS,
  type CanvasFlowEdge,
  type CanvasProject,
  type CardColor,
  type CardVariant,
  type EdgeCurveStyle,
  type GridVariant,
  type WebsiteFlowNode,
} from '@/shared/types/canvas';
import { createId } from '@/shared/utils/id';
import { extractDomain, normalizeExternalUrl, sanitizeFaviconUrl } from '@/shared/utils/url';

const VALID_COLORS = new Set<string>(Object.keys(CARD_COLOR_META));
const VALID_VARIANTS = new Set<CardVariant>(['standard', 'compact', 'featured']);
const VALID_CURVES = new Set<EdgeCurveStyle>(['smoothstep', 'bezier', 'straight']);
const VALID_GRIDS = new Set<GridVariant>(['dots', 'lines', 'cross', 'none']);

export interface ImportValidationResult {
  valid: boolean;
  canvases: CanvasProject[];
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown, fallback: string, maxLength = 500): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function sanitizeScreenshot(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('data:image/jpeg;base64,') || trimmed.startsWith('data:image/png;base64,') || trimmed.startsWith('data:image/webp;base64,')) {
    // Prevent overly massive corrupted payloads (> 2MB per card)
    if (trimmed.length <= 2_000_000) {
      return trimmed;
    }
  }
  return undefined;
}

function validateNode(raw: unknown, index: number, warnings: string[]): WebsiteFlowNode | null {
  if (!isRecord(raw) || !isRecord(raw.data)) {
    warnings.push(`Skipped node #${index + 1}: invalid structure.`);
    return null;
  }

  const rawUrl = typeof raw.data.url === 'string' ? raw.data.url : '';
  const normalizedUrl = normalizeExternalUrl(rawUrl);
  if (!normalizedUrl) {
    warnings.push(`Skipped node #${index + 1}: invalid or unsafe URL "${rawUrl.slice(0, 60)}".`);
    return null;
  }

  const rawPos = isRecord(raw.position) ? raw.position : {};
  const x = typeof rawPos.x === 'number' && Number.isFinite(rawPos.x) ? rawPos.x : index * 40;
  const y = typeof rawPos.y === 'number' && Number.isFinite(rawPos.y) ? rawPos.y : index * 40;

  const width =
    typeof raw.width === 'number' && Number.isFinite(raw.width) && raw.width >= 180 && raw.width <= 900
      ? raw.width
      : 280;
  const height =
    typeof raw.height === 'number' && Number.isFinite(raw.height) && raw.height >= 100 && raw.height <= 900
      ? raw.height
      : undefined;

  const rawTags = Array.isArray(raw.data.tags) ? raw.data.tags : [];
  const tags = rawTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, 12);

  const rawColor = typeof raw.data.color === 'string' && VALID_COLORS.has(raw.data.color)
    ? (raw.data.color as CardColor)
    : 'default';

  const rawVariant =
    typeof raw.data.variant === 'string' && VALID_VARIANTS.has(raw.data.variant as CardVariant)
      ? (raw.data.variant as CardVariant)
      : 'standard';

  const domain = extractDomain(normalizedUrl);
  const title = sanitizeString(raw.data.title, domain, 200) || domain;
  const description = sanitizeString(raw.data.description, '', 1000);
  const favicon = sanitizeFaviconUrl(typeof raw.data.favicon === 'string' ? raw.data.favicon : undefined);
  const capturedAt =
    typeof raw.data.capturedAt === 'string' && !Number.isNaN(Date.parse(raw.data.capturedAt))
      ? raw.data.capturedAt
      : new Date().toISOString();

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : createId('node'),
    type: 'website',
    position: { x, y },
    width,
    ...(height !== undefined ? { height } : {}),
    data: {
      title,
      url: normalizedUrl,
      domain,
      favicon,
      description,
      tags,
      screenshot: sanitizeScreenshot(raw.data.screenshot),
      capturedAt,
      color: rawColor,
      variant: rawVariant,
    },
  };
}

function validateEdge(
  raw: unknown,
  validNodeIds: Set<string>,
  warnings: string[]
): CanvasFlowEdge | null {
  if (!isRecord(raw)) return null;
  const source = typeof raw.source === 'string' ? raw.source : '';
  const target = typeof raw.target === 'string' ? raw.target : '';

  if (!source || !target || !validNodeIds.has(source) || !validNodeIds.has(target) || source === target) {
    warnings.push(`Skipped edge: references missing or invalid nodes.`);
    return null;
  }

  const rawData = isRecord(raw.data) ? raw.data : {};
  const label = sanitizeString(rawData.label ?? raw.label, '', 80);
  const curveStyle =
    typeof rawData.curveStyle === 'string' && VALID_CURVES.has(rawData.curveStyle as EdgeCurveStyle)
      ? (rawData.curveStyle as EdgeCurveStyle)
      : 'smoothstep';
  const animated = Boolean(rawData.animated ?? raw.animated);

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : createId('edge'),
    source,
    target,
    sourceHandle: typeof raw.sourceHandle === 'string' ? raw.sourceHandle : undefined,
    targetHandle: typeof raw.targetHandle === 'string' ? raw.targetHandle : undefined,
    type: 'canvasEdge',
    animated,
    data: {
      label: label || undefined,
      curveStyle,
      animated,
    },
  };
}

function validateCanvasObject(raw: unknown, warnings: string[]): CanvasProject | null {
  if (!isRecord(raw)) return null;

  const name = sanitizeString(raw.name, 'Imported Canvas', 120) || 'Imported Canvas';
  const description = sanitizeString(raw.description, '', 500);
  const now = new Date().toISOString();
  const createdAt =
    typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : now;
  const updatedAt =
    typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : now;

  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes: WebsiteFlowNode[] = [];
  const nodeIdMap = new Map<string, string>();
  const validNodeIds = new Set<string>();

  rawNodes.forEach((rawNode, index) => {
    const validated = validateNode(rawNode, index, warnings);
    if (validated) {
      const oldId = validated.id;
      const newId = createId('node');
      nodeIdMap.set(oldId, newId);
      validated.id = newId;
      validNodeIds.add(newId);
      nodes.push(validated);
    }
  });

  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];
  const edges: CanvasFlowEdge[] = [];
  rawEdges.forEach((rawEdge) => {
    if (!isRecord(rawEdge)) return;
    const remapped = {
      ...rawEdge,
      id: createId('edge'),
      source: typeof rawEdge.source === 'string' ? nodeIdMap.get(rawEdge.source) ?? '' : '',
      target: typeof rawEdge.target === 'string' ? nodeIdMap.get(rawEdge.target) ?? '' : '',
    };
    const validated = validateEdge(remapped, validNodeIds, warnings);
    if (validated) {
      edges.push(validated);
    }
  });

  const rawViewport = isRecord(raw.viewport) ? raw.viewport : {};
  const viewport = {
    x: typeof rawViewport.x === 'number' && Number.isFinite(rawViewport.x) ? rawViewport.x : 0,
    y: typeof rawViewport.y === 'number' && Number.isFinite(rawViewport.y) ? rawViewport.y : 0,
    zoom:
      typeof rawViewport.zoom === 'number' &&
      Number.isFinite(rawViewport.zoom) &&
      rawViewport.zoom >= 0.1 &&
      rawViewport.zoom <= 4
        ? rawViewport.zoom
        : 1,
  };

  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  const settings = {
    gridVariant:
      typeof rawSettings.gridVariant === 'string' && VALID_GRIDS.has(rawSettings.gridVariant as GridVariant)
        ? (rawSettings.gridVariant as GridVariant)
        : DEFAULT_CANVAS_SETTINGS.gridVariant,
    snapToGrid:
      typeof rawSettings.snapToGrid === 'boolean'
        ? rawSettings.snapToGrid
        : DEFAULT_CANVAS_SETTINGS.snapToGrid,
    defaultEdgeStyle:
      typeof rawSettings.defaultEdgeStyle === 'string' &&
      VALID_CURVES.has(rawSettings.defaultEdgeStyle as EdgeCurveStyle)
        ? (rawSettings.defaultEdgeStyle as EdgeCurveStyle)
        : DEFAULT_CANVAS_SETTINGS.defaultEdgeStyle,
    animatedEdges:
      typeof rawSettings.animatedEdges === 'boolean'
        ? rawSettings.animatedEdges
        : DEFAULT_CANVAS_SETTINGS.animatedEdges,
    showMinimap:
      typeof rawSettings.showMinimap === 'boolean'
        ? rawSettings.showMinimap
        : DEFAULT_CANVAS_SETTINGS.showMinimap,
  };

  return {
    id: createId('canvas'),
    name,
    description,
    createdAt,
    updatedAt,
    nodes,
    edges,
    viewport,
    settings,
  };
}

export function validateImportedJson(rawText: string): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawText.trim()) {
    return { valid: false, canvases: [], errors: ['The imported file is empty.'], warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      canvases: [],
      errors: ['Invalid JSON format. Please select a valid Infinite Canvas export file.'],
      warnings,
    };
  }

  if (!isRecord(parsed)) {
    return {
      valid: false,
      canvases: [],
      errors: ['Expected a JSON object at the root of the export file.'],
      warnings,
    };
  }

  const canvases: CanvasProject[] = [];

  if (Array.isArray(parsed.canvases)) {
    parsed.canvases.forEach((item) => {
      const validated = validateCanvasObject(item, warnings);
      if (validated) canvases.push(validated);
    });
  } else if (isRecord(parsed.canvas)) {
    const validated = validateCanvasObject(parsed.canvas, warnings);
    if (validated) canvases.push(validated);
  } else if (Array.isArray(parsed.nodes)) {
    const validated = validateCanvasObject(parsed, warnings);
    if (validated) canvases.push(validated);
  } else {
    errors.push('Unrecognized schema: expected "canvases", "canvas", or a canvas object with "nodes".');
  }

  if (canvases.length === 0 && errors.length === 0) {
    errors.push('No valid canvases were found in the imported JSON.');
  }

  return {
    valid: errors.length === 0 && canvases.length > 0,
    canvases,
    errors,
    warnings,
  };
}
