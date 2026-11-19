import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import { create } from 'zustand';
import {
  createEmptyCanvas,
  loadWorkspaceState,
  saveWorkspaceState,
  subscribeWorkspaceChanges,
} from '@/shared/storage/workspaceStorage';
import {
  DEFAULT_CANVAS_SETTINGS,
  type Camera3DState,
  type CanvasEdgeData,
  type CanvasFlowEdge,
  type CanvasProject,
  type CanvasSettings,
  type CardColor,
  type CardVariant,
  type PersistedWorkspaceState,
  type Vec3Tuple,
  type WebsiteFlowNode,
  type WebsiteNodeData,
} from '@/shared/types/canvas';
import { createId } from '@/shared/utils/id';
import { extractDomain, normalizeExternalUrl, sanitizeFaviconUrl } from '@/shared/utils/url';
import { validateImportedJson, type ImportValidationResult } from '@/shared/utils/validation';

interface HistorySnapshot {
  nodes: WebsiteFlowNode[];
  edges: CanvasFlowEdge[];
}

const MAX_HISTORY = 50;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastLocalSaveSignature = '';

function cloneSnapshot(nodes: WebsiteFlowNode[], edges: CanvasFlowEdge[]): HistorySnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  };
}

function getActiveCanvasFromList(
  canvases: CanvasProject[],
  activeCanvasId: string
): CanvasProject | undefined {
  return canvases.find((c) => c.id === activeCanvasId) ?? canvases[0];
}

export interface AddCardInput {
  title: string;
  url: string;
  description?: string;
  tags?: string[];
  favicon?: string;
  screenshot?: string;
  color?: CardColor;
  variant?: CardVariant;
  position?: { x: number; y: number };
}

interface WorkspaceStoreState {
  hydrated: boolean;
  canvases: CanvasProject[];
  activeCanvasId: string;
  onboardingCompleted: boolean;
  showOnboarding: boolean;
  savingStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  toastMessage: string | null;

  past: HistorySnapshot[];
  future: HistorySnapshot[];

  hydrate: () => Promise<() => void>;
  saveNow: () => Promise<void>;
  notify: (message: string) => void;
  clearToast: () => void;

  // Canvas management
  selectCanvas: (canvasId: string) => void;
  createCanvas: (name: string, description?: string) => CanvasProject;
  updateCanvasMeta: (canvasId: string, name: string, description: string) => void;
  duplicateCanvas: (canvasId: string) => CanvasProject | null;
  deleteCanvas: (canvasId: string) => void;
  updateCanvasSettings: (patch: Partial<CanvasSettings>) => void;
  updateCanvasViewport: (viewport: Viewport) => void;
  updateCanvasCamera3D: (camera3d: Camera3DState) => void;
  addCustomCluster: (clusterName: string) => void;
  updateNodePosition3D: (nodeId: string, position3d: Vec3Tuple) => void;

  // React Flow handlers
  onNodesChange: (changes: NodeChange<WebsiteFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasFlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  recordHistoryCheckpoint: () => void;

  // Node & Edge operations
  addWebsiteCard: (input: AddCardInput) => WebsiteFlowNode | null;
  updateWebsiteCard: (nodeId: string, patch: Partial<WebsiteNodeData>) => void;
  duplicateWebsiteCard: (nodeId: string) => void;
  deleteWebsiteCard: (nodeId: string) => void;
  deleteSelectedElements: () => void;
  selectAllNodes: () => void;
  updateEdgeData: (edgeId: string, patch: Partial<CanvasEdgeData>) => void;
  deleteEdge: (edgeId: string) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Import / Export
  exportActiveCanvasJson: () => string;
  exportAllCanvasesJson: () => string;
  importFromJson: (rawJson: string) => ImportValidationResult;

  // Onboarding
  setShowOnboarding: (open: boolean) => void;
  completeOnboarding: () => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => {
  const schedulePersist = (immediate = false) => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    const doSave = async () => {
      const { canvases, activeCanvasId, onboardingCompleted, hydrated } = get();
      if (!hydrated) return;
      set({ savingStatus: 'saving' });
      const payload: PersistedWorkspaceState = {
        version: 1,
        activeCanvasId,
        canvases,
        onboardingCompleted,
      };
      try {
        lastLocalSaveSignature = JSON.stringify({
          activeCanvasId,
          updatedAts: canvases.map((c) => `${c.id}:${c.updatedAt}:${c.nodes.length}:${c.edges.length}`),
          onboardingCompleted,
        });
        await saveWorkspaceState(payload);
        set({ savingStatus: 'saved', lastSavedAt: new Date().toISOString() });
      } catch {
        set({ savingStatus: 'error' });
      }
    };

    if (immediate) {
      void doSave();
    } else {
      persistTimer = setTimeout(() => {
        void doSave();
      }, 350);
    }
  };

  const mutateActiveCanvas = (
    updater: (canvas: CanvasProject) => CanvasProject,
    options?: { recordHistory?: boolean; immediateSave?: boolean }
  ) => {
    const state = get();
    const active = getActiveCanvasFromList(state.canvases, state.activeCanvasId);
    if (!active) return;

    const past = options?.recordHistory
      ? [...state.past.slice(-(MAX_HISTORY - 1)), cloneSnapshot(active.nodes, active.edges)]
      : state.past;
    const future = options?.recordHistory ? [] : state.future;

    const updatedCanvas: CanvasProject = {
      ...updater(active),
      updatedAt: new Date().toISOString(),
    };

    const canvases = state.canvases.map((c) => (c.id === active.id ? updatedCanvas : c));
    set({ canvases, past, future });
    schedulePersist(options?.immediateSave);
  };

  return {
    hydrated: false,
    canvases: [],
    activeCanvasId: '',
    onboardingCompleted: false,
    showOnboarding: false,
    savingStatus: 'idle',
    lastSavedAt: null,
    toastMessage: null,
    past: [],
    future: [],

    hydrate: async () => {
      const stored = await loadWorkspaceState();

      // Check URL query param (?canvas=...)
      let preferredId = stored.activeCanvasId;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const requestedCanvas = params.get('canvas');
        if (requestedCanvas && stored.canvases.some((c) => c.id === requestedCanvas)) {
          preferredId = requestedCanvas;
        }
      }

      set({
        hydrated: true,
        canvases: stored.canvases,
        activeCanvasId: preferredId,
        onboardingCompleted: stored.onboardingCompleted,
        showOnboarding: !stored.onboardingCompleted,
        savingStatus: 'saved',
      });

      const unsubscribe = subscribeWorkspaceChanges((incoming) => {
        const signature = JSON.stringify({
          activeCanvasId: incoming.activeCanvasId,
          updatedAts: incoming.canvases.map(
            (c) => `${c.id}:${c.updatedAt}:${c.nodes.length}:${c.edges.length}`
          ),
          onboardingCompleted: incoming.onboardingCompleted,
        });
        if (signature === lastLocalSaveSignature) {
          return;
        }
        const currentActiveId = get().activeCanvasId;
        const stillExists = incoming.canvases.some((c) => c.id === currentActiveId);
        set({
          canvases: incoming.canvases,
          activeCanvasId: stillExists ? currentActiveId : incoming.activeCanvasId,
          onboardingCompleted: incoming.onboardingCompleted,
        });
      });

      return unsubscribe;
    },

    saveNow: async () => {
      schedulePersist(true);
      get().notify('Project saved');
    },

    notify: (message: string) => {
      set({ toastMessage: message });
    },

    clearToast: () => {
      set({ toastMessage: null });
    },

    selectCanvas: (canvasId: string) => {
      const exists = get().canvases.some((c) => c.id === canvasId);
      if (!exists) return;
      set({ activeCanvasId: canvasId, past: [], future: [] });
      schedulePersist(true);
    },

    createCanvas: (name: string, description = '') => {
      const next = createEmptyCanvas(name, description);
      set((state) => ({
        canvases: [next, ...state.canvases],
        activeCanvasId: next.id,
        past: [],
        future: [],
      }));
      schedulePersist(true);
      get().notify(`Created "${next.name}"`);
      return next;
    },

    updateCanvasMeta: (canvasId: string, name: string, description: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      set((state) => ({
        canvases: state.canvases.map((c) =>
          c.id === canvasId
            ? {
                ...c,
                name: trimmedName,
                description: description.trim(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
      }));
      schedulePersist(true);
    },

    duplicateCanvas: (canvasId: string) => {
      const source = get().canvases.find((c) => c.id === canvasId);
      if (!source) return null;
      const now = new Date().toISOString();
      const copy: CanvasProject = {
        ...structuredClone(source),
        id: createId('canvas'),
        name: `${source.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        canvases: [copy, ...state.canvases],
        activeCanvasId: copy.id,
        past: [],
        future: [],
      }));
      schedulePersist(true);
      get().notify(`Duplicated "${source.name}"`);
      return copy;
    },

    deleteCanvas: (canvasId: string) => {
      const state = get();
      if (state.canvases.length <= 1) {
        get().notify('Cannot delete the only remaining canvas');
        return;
      }
      const remaining = state.canvases.filter((c) => c.id !== canvasId);
      const nextActiveId =
        state.activeCanvasId === canvasId ? remaining[0]!.id : state.activeCanvasId;
      set({
        canvases: remaining,
        activeCanvasId: nextActiveId,
        past: [],
        future: [],
      });
      schedulePersist(true);
      get().notify('Canvas deleted');
    },

    updateCanvasSettings: (patch: Partial<CanvasSettings>) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          settings: { ...DEFAULT_CANVAS_SETTINGS, ...canvas.settings, ...patch },
        }),
        { recordHistory: false }
      );
    },

    updateCanvasViewport: (viewport: Viewport) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          viewport,
        }),
        { recordHistory: false }
      );
    },

    updateCanvasCamera3D: (camera3d: Camera3DState) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          camera3d,
        }),
        { recordHistory: false }
      );
    },

    addCustomCluster: (clusterName: string) => {
      const clean = clusterName.trim().slice(0, 28);
      if (!clean) return;
      mutateActiveCanvas(
        (canvas) => {
          const existing = canvas.customClusters ?? [];
          if (existing.includes(clean)) return canvas;
          return {
            ...canvas,
            customClusters: [...existing, clean],
          };
        },
        { recordHistory: false, immediateSave: true }
      );
    },

    updateNodePosition3D: (nodeId: string, position3d: Vec3Tuple) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: canvas.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, position3d } } : n
          ),
        }),
        { recordHistory: false }
      );
    },

    recordHistoryCheckpoint: () => {
      const state = get();
      const active = getActiveCanvasFromList(state.canvases, state.activeCanvasId);
      if (!active) return;
      set({
        past: [...state.past.slice(-(MAX_HISTORY - 1)), cloneSnapshot(active.nodes, active.edges)],
        future: [],
      });
    },

    onNodesChange: (changes) => {
      const hasRemoval = changes.some((c) => c.type === 'remove');
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: applyNodeChanges(changes, canvas.nodes),
        }),
        { recordHistory: hasRemoval }
      );
    },

    onEdgesChange: (changes) => {
      const hasRemoval = changes.some((c) => c.type === 'remove');
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          edges: applyEdgeChanges(changes, canvas.edges),
        }),
        { recordHistory: hasRemoval }
      );
    },

    onConnect: (connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }
      mutateActiveCanvas(
        (canvas) => {
          const newEdge: CanvasFlowEdge = {
            id: createId('edge'),
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
            type: 'canvasEdge',
            animated: canvas.settings.animatedEdges,
            data: {
              curveStyle: canvas.settings.defaultEdgeStyle,
              animated: canvas.settings.animatedEdges,
            },
          };
          return {
            ...canvas,
            edges: addEdge(newEdge, canvas.edges),
          };
        },
        { recordHistory: true }
      );
    },

    addWebsiteCard: (input) => {
      const normalizedUrl = normalizeExternalUrl(input.url);
      if (!normalizedUrl) return null;

      const active = getActiveCanvasFromList(get().canvases, get().activeCanvasId);
      if (!active) return null;

      const domain = extractDomain(normalizedUrl);
      const count = active.nodes.length;
      const defaultPos = {
        x: 120 + (count % 4) * 330,
        y: 120 + Math.floor(count / 4) * 250,
      };

      const newNode: WebsiteFlowNode = {
        id: createId('node'),
        type: 'website',
        position: input.position ?? defaultPos,
        width: 288,
        data: {
          title: input.title.trim() || domain,
          url: normalizedUrl,
          domain,
          favicon: sanitizeFaviconUrl(input.favicon),
          description: (input.description ?? '').trim(),
          tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
          screenshot: input.screenshot,
          capturedAt: new Date().toISOString(),
          color: input.color ?? 'default',
          variant: input.variant ?? (input.screenshot ? 'featured' : 'standard'),
        },
      };

      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: [...canvas.nodes, newNode],
        }),
        { recordHistory: true, immediateSave: true }
      );
      return newNode;
    },

    updateWebsiteCard: (nodeId, patch) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: canvas.nodes.map((node) => {
            if (node.id !== nodeId) return node;
            return {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            };
          }),
        }),
        { recordHistory: true }
      );
    },

    duplicateWebsiteCard: (nodeId) => {
      const active = getActiveCanvasFromList(get().canvases, get().activeCanvasId);
      const source = active?.nodes.find((n) => n.id === nodeId);
      if (!source) return;

      const copy: WebsiteFlowNode = {
        ...structuredClone(source),
        id: createId('node'),
        selected: false,
        position: {
          x: source.position.x + 36,
          y: source.position.y + 36,
        },
        data: {
          ...structuredClone(source.data),
          capturedAt: new Date().toISOString(),
        },
      };

      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: [...canvas.nodes, copy],
        }),
        { recordHistory: true }
      );
      get().notify('Card duplicated');
    },

    deleteWebsiteCard: (nodeId) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: canvas.nodes.filter((n) => n.id !== nodeId),
          edges: canvas.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        }),
        { recordHistory: true }
      );
    },

    deleteSelectedElements: () => {
      const active = getActiveCanvasFromList(get().canvases, get().activeCanvasId);
      if (!active) return;

      const selectedNodeIds = new Set(active.nodes.filter((n) => n.selected).map((n) => n.id));
      const selectedEdgeIds = new Set(active.edges.filter((e) => e.selected).map((e) => e.id));

      if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: canvas.nodes.filter((n) => !selectedNodeIds.has(n.id)),
          edges: canvas.edges.filter(
            (e) =>
              !selectedEdgeIds.has(e.id) &&
              !selectedNodeIds.has(e.source) &&
              !selectedNodeIds.has(e.target)
          ),
        }),
        { recordHistory: true }
      );
    },

    selectAllNodes: () => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          nodes: canvas.nodes.map((n) => ({ ...n, selected: true })),
        }),
        { recordHistory: false }
      );
    },

    updateEdgeData: (edgeId, patch) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          edges: canvas.edges.map((edge) => {
            if (edge.id !== edgeId) return edge;
            const nextAnimated = patch.animated ?? edge.data?.animated ?? edge.animated;
            return {
              ...edge,
              animated: Boolean(nextAnimated),
              data: {
                ...edge.data,
                ...patch,
                animated: Boolean(nextAnimated),
              },
            };
          }),
        }),
        { recordHistory: true }
      );
    },

    deleteEdge: (edgeId) => {
      mutateActiveCanvas(
        (canvas) => ({
          ...canvas,
          edges: canvas.edges.filter((e) => e.id !== edgeId),
        }),
        { recordHistory: true }
      );
    },

    undo: () => {
      const state = get();
      if (state.past.length === 0) return;
      const active = getActiveCanvasFromList(state.canvases, state.activeCanvasId);
      if (!active) return;

      const previous = state.past[state.past.length - 1]!;
      const nextPast = state.past.slice(0, -1);
      const nextFuture = [
        cloneSnapshot(active.nodes, active.edges),
        ...state.future.slice(0, MAX_HISTORY - 1),
      ];

      const updatedCanvas: CanvasProject = {
        ...active,
        nodes: previous.nodes,
        edges: previous.edges,
        updatedAt: new Date().toISOString(),
      };

      set({
        canvases: state.canvases.map((c) => (c.id === active.id ? updatedCanvas : c)),
        past: nextPast,
        future: nextFuture,
      });
      schedulePersist();
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;
      const active = getActiveCanvasFromList(state.canvases, state.activeCanvasId);
      if (!active) return;

      const next = state.future[0]!;
      const nextFuture = state.future.slice(1);
      const nextPast = [
        ...state.past.slice(-(MAX_HISTORY - 1)),
        cloneSnapshot(active.nodes, active.edges),
      ];

      const updatedCanvas: CanvasProject = {
        ...active,
        nodes: next.nodes,
        edges: next.edges,
        updatedAt: new Date().toISOString(),
      };

      set({
        canvases: state.canvases.map((c) => (c.id === active.id ? updatedCanvas : c)),
        past: nextPast,
        future: nextFuture,
      });
      schedulePersist();
    },

    exportActiveCanvasJson: () => {
      const active = getActiveCanvasFromList(get().canvases, get().activeCanvasId);
      return JSON.stringify(
        {
          app: 'Infinite Canvas',
          version: 1,
          exportedAt: new Date().toISOString(),
          canvas: active,
        },
        null,
        2
      );
    },

    exportAllCanvasesJson: () => {
      return JSON.stringify(
        {
          app: 'Infinite Canvas',
          version: 1,
          exportedAt: new Date().toISOString(),
          canvases: get().canvases,
        },
        null,
        2
      );
    },

    importFromJson: (rawJson: string) => {
      const result = validateImportedJson(rawJson);
      if (!result.valid || result.canvases.length === 0) {
        return result;
      }

      set((state) => ({
        canvases: [...result.canvases, ...state.canvases],
        activeCanvasId: result.canvases[0]!.id,
        past: [],
        future: [],
      }));
      schedulePersist(true);
      get().notify(
        result.canvases.length === 1
          ? `Imported "${result.canvases[0]!.name}"`
          : `Imported ${result.canvases.length} canvases`
      );
      return result;
    },

    setShowOnboarding: (open: boolean) => {
      set({ showOnboarding: open });
    },

    completeOnboarding: () => {
      set({ onboardingCompleted: true, showOnboarding: false });
      schedulePersist(true);
    },
  };
});

export function selectActiveCanvas(state: WorkspaceStoreState): CanvasProject | undefined {
  return getActiveCanvasFromList(state.canvases, state.activeCanvasId);
}
