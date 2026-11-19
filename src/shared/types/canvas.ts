import type { Edge, Node, Viewport } from '@xyflow/react';

export type CardColor =
  | 'default'
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'violet';

export type CardVariant = 'standard' | 'compact' | 'featured';

export type EdgeCurveStyle = 'smoothstep' | 'bezier' | 'straight';

export type GridVariant = 'dots' | 'lines' | 'cross' | 'none';

export type Vec3Tuple = [number, number, number];

export type PageSectionKind =
  | 'page'
  | 'header'
  | 'nav'
  | 'hero'
  | 'section'
  | 'aside'
  | 'form'
  | 'footer';

export interface PageActionItem {
  icId: string;
  label: string;
  kind: 'button' | 'link' | 'input';
  href?: string;
}

export const DEFAULT_CLUSTERS = [
  'Header',
  'Navigation',
  'Content',
  'Interactive',
  'Footer',
  'Resources',
] as const;

export interface WebsiteNodeData extends Record<string, unknown> {
  title: string;
  url: string;
  domain: string;
  favicon: string;
  description: string;
  tags: string[];
  screenshot?: string;
  capturedAt: string;
  color: CardColor;
  variant: CardVariant;
  cluster?: string;
  isCentral?: boolean;
  position3d?: Vec3Tuple;
  sectionKind?: PageSectionKind;
  icTargetId?: string;
  actions?: PageActionItem[];
}

export type WebsiteFlowNode = Node<WebsiteNodeData, 'website'>;

export interface CanvasEdgeData extends Record<string, unknown> {
  label?: string;
  curveStyle?: EdgeCurveStyle;
  animated?: boolean;
  strokeColor?: string;
}

export type CanvasFlowEdge = Edge<CanvasEdgeData>;

export interface CanvasSettings {
  gridVariant: GridVariant;
  snapToGrid: boolean;
  defaultEdgeStyle: EdgeCurveStyle;
  animatedEdges: boolean;
  showMinimap: boolean;
}

export interface Camera3DState {
  position: Vec3Tuple;
  target: Vec3Tuple;
}

export interface CanvasProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodes: WebsiteFlowNode[];
  edges: CanvasFlowEdge[];
  viewport: Viewport;
  settings: CanvasSettings;
  camera3d?: Camera3DState;
  customClusters?: string[];
}

export interface PersistedWorkspaceState {
  version: number;
  activeCanvasId: string;
  canvases: CanvasProject[];
  onboardingCompleted: boolean;
}

export interface CapturedPageInfo {
  title: string;
  url: string;
  domain: string;
  favicon: string;
  screenshot?: string;
}

export interface CaptureWebsitePayload {
  canvasId?: string;
  title: string;
  url: string;
  favicon?: string;
  description?: string;
  tags?: string[];
  screenshot?: string;
  color?: CardColor;
}

export type ExtensionMessage =
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'CAPTURE_VISIBLE_TAB' }
  | { type: 'ADD_WEBSITE_TO_CANVAS'; payload: CaptureWebsitePayload }
  | { type: 'OPEN_CANVAS'; payload?: { canvasId?: string } }
  | { type: 'OPEN_SIDEPANEL' };

export interface ExtensionResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  gridVariant: 'dots',
  snapToGrid: false,
  defaultEdgeStyle: 'smoothstep',
  animatedEdges: false,
  showMinimap: true,
};

export const CARD_COLOR_META: Record<
  CardColor,
  { label: string; border: string; accent: string; badgeBg: string; dot: string }
> = {
  default: {
    label: 'Charcoal',
    border: 'border-[#2a2f3b]',
    accent: '#64748b',
    badgeBg: 'bg-[#222630]',
    dot: '#64748b',
  },
  indigo: {
    label: 'Indigo',
    border: 'border-indigo-500/40',
    accent: '#818cf8',
    badgeBg: 'bg-indigo-500/15',
    dot: '#818cf8',
  },
  emerald: {
    label: 'Emerald',
    border: 'border-emerald-500/40',
    accent: '#34d399',
    badgeBg: 'bg-emerald-500/15',
    dot: '#34d399',
  },
  amber: {
    label: 'Amber',
    border: 'border-amber-500/40',
    accent: '#fbbf24',
    badgeBg: 'bg-amber-500/15',
    dot: '#fbbf24',
  },
  rose: {
    label: 'Rose',
    border: 'border-rose-500/40',
    accent: '#fb7185',
    badgeBg: 'bg-rose-500/15',
    dot: '#fb7185',
  },
  sky: {
    label: 'Sky',
    border: 'border-sky-500/40',
    accent: '#38bdf8',
    badgeBg: 'bg-sky-500/15',
    dot: '#38bdf8',
  },
  violet: {
    label: 'Violet',
    border: 'border-violet-500/40',
    accent: '#a78bfa',
    badgeBg: 'bg-violet-500/15',
    dot: '#a78bfa',
  },
};
