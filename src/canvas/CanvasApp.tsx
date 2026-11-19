import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Viewport,
} from '@xyflow/react';
import { ArrowUp, Box, Plus, Search, Sparkles, X } from 'lucide-react';
import { AddWebsiteModal } from '@/canvas/components/AddWebsiteModal';
import { CanvasSidebar } from '@/canvas/components/CanvasSidebar';
import { CosmicBokehBackground } from '@/canvas/components/CosmicBokehBackground';
import { ImportExportModal } from '@/canvas/components/ImportExportModal';
import { TopToolbar } from '@/canvas/components/TopToolbar';
import { ZoomControls } from '@/canvas/components/ZoomControls';
import { CanvasEdge } from '@/canvas/edges/CanvasEdge';
import { useCanvasShortcuts } from '@/canvas/hooks/useCanvasShortcuts';
import { WebsiteNode } from '@/canvas/nodes/WebsiteNode';
import { selectActiveCanvas, useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import { OnboardingModal } from '@/onboarding/OnboardingModal';
import { CARD_COLOR_META } from '@/shared/types/canvas';

const NODE_TYPES = {
  website: WebsiteNode,
};

const EDGE_TYPES = {
  canvasEdge: CanvasEdge,
};

export interface CanvasAppProps {
  isOverlayMode?: boolean;
  canSwitchTo3D?: boolean;
  onSwitchTo3D?: () => void;
  onCloseOverlay?: () => void;
}

function CanvasViewport({
  isOverlayMode = false,
  canSwitchTo3D = false,
  onSwitchTo3D,
  onCloseOverlay,
}: CanvasAppProps) {
  const activeCanvas = useWorkspaceStore(selectActiveCanvas);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const onNodesChange = useWorkspaceStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkspaceStore((s) => s.onEdgesChange);
  const onConnect = useWorkspaceStore((s) => s.onConnect);
  const recordHistoryCheckpoint = useWorkspaceStore((s) => s.recordHistoryCheckpoint);
  const updateCanvasViewport = useWorkspaceStore((s) => s.updateCanvasViewport);
  const toastMessage = useWorkspaceStore((s) => s.toastMessage);
  const clearToast = useWorkspaceStore((s) => s.clearToast);

  const { fitView, screenToFlowPosition, setCenter } = useReactFlow();
  const { isSpacePanning } = useCanvasShortcuts();

  // Start clean & full-bleed in overlay mode (matching Image 2!)
  const [sidebarOpen, setSidebarOpen] = useState(!isOverlayMode);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  const lastFittedCanvasRef = useRef<string | null>(null);

  // Frame the entire spatial flow cleanly when a canvas loads
  useEffect(() => {
    if (!hydrated || !activeCanvas) return;
    const key = `${activeCanvas.id}:${activeCanvas.nodes.length}`;
    if (lastFittedCanvasRef.current !== key && activeCanvas.nodes.length > 0) {
      lastFittedCanvasRef.current = key;
      const timer = setTimeout(() => {
        void fitView({ padding: 0.14, duration: 280 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [hydrated, activeCanvas, fitView]);

  // '/' focuses command bar, 'Escape' closes overlay when not typing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        commandInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (isInput && target === commandInputRef.current) {
          setCommandQuery('');
          commandInputRef.current?.blur();
        } else if (!isInput && isOverlayMode && onCloseOverlay) {
          onCloseOverlay();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOverlayMode, onCloseOverlay]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(clearToast, 2600);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      updateCanvasViewport(viewport);
    },
    [updateCanvasViewport]
  );

  const getViewportCenterFlowPosition = useCallback(() => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const pos = screenToFlowPosition({ x: centerX, y: centerY });
    return { x: Math.round(pos.x - 160), y: Math.round(pos.y - 100) };
  }, [screenToFlowPosition]);

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const target = activeCanvas?.nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const w = target.width ?? 320;
      const h = target.height ?? 200;
      void setCenter(target.position.x + w / 2, target.position.y + h / 2, {
        zoom: 1.0,
        duration: 320,
      });
    },
    [activeCanvas, setCenter]
  );

  const handleCommandSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = commandQuery.trim().toLowerCase();
    if (!q || !activeCanvas) return;

    const match = activeCanvas.nodes.find(
      (n) =>
        n.data.title.toLowerCase().includes(q) ||
        n.data.description.toLowerCase().includes(q) ||
        n.data.actions?.some((a) => a.label.toLowerCase().includes(q)) ||
        n.data.tags.some((t) => t.toLowerCase().includes(q))
    );
    if (match) {
      handleFocusNode(match.id);
    }
  };

  const bgVariant = useMemo(() => {
    const grid = activeCanvas?.settings.gridVariant ?? 'none';
    if (grid === 'lines') return BackgroundVariant.Lines;
    if (grid === 'cross') return BackgroundVariant.Cross;
    return BackgroundVariant.Dots;
  }, [activeCanvas?.settings.gridVariant]);

  const styledEdges = useMemo(() => {
    if (!activeCanvas) return [];
    return activeCanvas.edges.map((edge) => {
      const color = edge.data?.strokeColor ?? '#4f7cff';
      return {
        ...edge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color,
        },
      };
    });
  }, [activeCanvas]);

  const visibleNodes = useMemo(() => {
    if (!activeCanvas) return [];
    const q = commandQuery.trim().toLowerCase();
    if (!q) return activeCanvas.nodes;
    return activeCanvas.nodes.map((node) => {
      const matches =
        node.data.title.toLowerCase().includes(q) ||
        node.data.description.toLowerCase().includes(q) ||
        node.data.actions?.some((a) => a.label.toLowerCase().includes(q)) ||
        node.data.tags.some((t) => t.toLowerCase().includes(q));
      return {
        ...node,
        style: {
          ...node.style,
          opacity: matches ? 1 : 0.22,
          transition: 'opacity 180ms ease',
        },
      };
    });
  }, [activeCanvas, commandQuery]);

  if (!hydrated || !activeCanvas) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#e8d1bd] text-xs text-[#5e4838]">
        Loading Infinite Canvas...
      </div>
    );
  }

  const { settings } = activeCanvas;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#e8d1bd]">
      <CanvasSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenImportExport={() => setImportExportOpen(true)}
        onFocusNode={handleFocusNode}
      />

      <main className="relative flex-1 h-full w-full overflow-hidden">
        <CosmicBokehBackground />

        <TopToolbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onOpenAddModal={() => setAddModalOpen(true)}
        />

        {/* Top-right Overlay Actions: 3D Mode Switch + Exit Overlay */}
        {(canSwitchTo3D || isOverlayMode) && (
          <div className="pointer-events-auto absolute right-16 top-3 z-30 flex items-center gap-1.5">
            {canSwitchTo3D && onSwitchTo3D && (
              <button
                type="button"
                onClick={onSwitchTo3D}
                title="Switch to 3D Orbital Space"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a3142] bg-[#131620]/92 px-3 py-1.5 text-xs font-medium text-[#cfd6e6] shadow-lg hover:border-indigo-400/60 hover:text-white transition-colors cursor-pointer"
              >
                <Box className="w-3.5 h-3.5 text-indigo-300" />
                3D Space
              </button>
            )}
            {isOverlayMode && onCloseOverlay && (
              <button
                type="button"
                onClick={onCloseOverlay}
                title="Return to live website (Esc)"
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-[#1b131c]/92 px-3 py-1.5 text-xs font-medium text-rose-200 shadow-lg hover:bg-rose-500/25 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Exit
              </button>
            )}
          </div>
        )}

        <ReactFlow
          nodes={visibleNodes}
          edges={styledEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={recordHistoryCheckpoint}
          onMoveEnd={handleMoveEnd}
          connectionMode={ConnectionMode.Loose}
          snapToGrid={settings.snapToGrid}
          snapGrid={[16, 16]}
          minZoom={0.15}
          maxZoom={2.5}
          panOnDrag={isSpacePanning ? true : [1, 2]}
          selectionOnDrag={!isSpacePanning}
          selectionMode={SelectionMode.Partial}
          panOnScroll
          zoomOnPinch
          deleteKeyCode={null}
          defaultEdgeOptions={{
            type: 'canvasEdge',
            animated: settings.animatedEdges,
          }}
          proOptions={{ hideAttribution: true }}
          className={isSpacePanning ? 'cursor-grab active:cursor-grabbing' : ''}
        >
          {settings.gridVariant !== 'none' && (
            <Background
              variant={bgVariant}
              gap={24}
              size={settings.gridVariant === 'dots' ? 1.1 : 1}
              color={settings.gridVariant === 'lines' ? '#1a1e27' : '#252a36'}
            />
          )}

          {settings.showMinimap && (
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              maskColor="rgba(8, 9, 14, 0.72)"
              nodeColor={(node) => {
                const colorKey = (node.data as { color?: keyof typeof CARD_COLOR_META })?.color;
                return colorKey && CARD_COLOR_META[colorKey]
                  ? CARD_COLOR_META[colorKey].dot
                  : '#4f7cff';
              }}
            />
          )}

          <ZoomControls />
        </ReactFlow>

        {/* Bottom-Center Floating Command / Search Bar (matching Image 2!) */}
        <form
          onSubmit={handleCommandSubmit}
          className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex w-[min(420px,calc(100vw-240px))] -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#2c3140] bg-[#13151d]/92 px-3.5 py-2 shadow-2xl backdrop-blur-md"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-[#c99d4c]" />
          <input
            ref={commandInputRef}
            type="text"
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            placeholder="Find section or button... (/ to focus)"
            className="flex-1 bg-transparent text-xs text-[#eceef2] placeholder-[#6c7589] outline-none"
          />
          {commandQuery && (
            <button
              type="button"
              onClick={() => setCommandQuery('')}
              className="rounded p-0.5 text-[#7a8396] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            title="Jump to matching section"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#c89643]/85 text-[#0d0f14] hover:bg-[#dca74e] transition-colors cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Empty Canvas Prompt */}
        {activeCanvas.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto flex max-w-sm flex-col items-center rounded-2xl border border-[#252a35] bg-[#13161d]/92 px-6 py-7 text-center shadow-2xl">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="mb-1.5 text-sm font-semibold text-[#eceef2]">
                {activeCanvas.name} is empty
              </h2>
              <p className="mb-4 text-xs leading-relaxed text-[#868fa3]">
                Click the Infinite Canvas extension icon on any webpage to map its sections and
                buttons visually, or add a URL manually.
              </p>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Website
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="pointer-events-none absolute bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-[#303647] bg-[#181c26] px-3.5 py-2 text-xs font-medium text-[#e6e9f0] shadow-xl">
            {toastMessage}
          </div>
        )}
      </main>

      <AddWebsiteModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        getPlacementPosition={getViewportCenterFlowPosition}
      />

      <ImportExportModal
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
      />

      <OnboardingModal />
    </div>
  );
}

export function CanvasApp(props: CanvasAppProps = {}) {
  const hydrate = useWorkspaceStore((s) => s.hydrate);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void hydrate().then((unsub) => {
      cleanup = unsub;
    });
    return () => {
      cleanup?.();
    };
  }, [hydrate]);

  return (
    <ReactFlowProvider>
      <CanvasViewport {...props} />
    </ReactFlowProvider>
  );
}
