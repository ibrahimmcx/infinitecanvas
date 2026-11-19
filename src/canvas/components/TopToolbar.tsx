import {
  Activity,
  Grid2x2,
  HelpCircle,
  Magnet,
  Map as MapIcon,
  PanelLeft,
  Plus,
  Redo2,
  Save,
  Spline,
  Undo2,
} from 'lucide-react';
import { selectActiveCanvas, useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import type { EdgeCurveStyle, GridVariant } from '@/shared/types/canvas';

interface TopToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenAddModal: () => void;
}

const GRID_ORDER: GridVariant[] = ['dots', 'lines', 'cross', 'none'];
const EDGE_ORDER: EdgeCurveStyle[] = ['smoothstep', 'bezier', 'straight'];

export function TopToolbar({
  sidebarOpen,
  onToggleSidebar,
  onOpenAddModal,
}: TopToolbarProps) {
  const activeCanvas = useWorkspaceStore(selectActiveCanvas);
  const pastCount = useWorkspaceStore((s) => s.past.length);
  const futureCount = useWorkspaceStore((s) => s.future.length);
  const savingStatus = useWorkspaceStore((s) => s.savingStatus);
  const undo = useWorkspaceStore((s) => s.undo);
  const redo = useWorkspaceStore((s) => s.redo);
  const saveNow = useWorkspaceStore((s) => s.saveNow);
  const updateCanvasSettings = useWorkspaceStore((s) => s.updateCanvasSettings);
  const setShowOnboarding = useWorkspaceStore((s) => s.setShowOnboarding);

  if (!activeCanvas) return null;

  const { settings } = activeCanvas;

  const cycleGrid = () => {
    const idx = GRID_ORDER.indexOf(settings.gridVariant);
    const next = GRID_ORDER[(idx + 1) % GRID_ORDER.length]!;
    updateCanvasSettings({ gridVariant: next });
  };

  const cycleEdgeStyle = () => {
    const idx = EDGE_ORDER.indexOf(settings.defaultEdgeStyle);
    const next = EDGE_ORDER[(idx + 1) % EDGE_ORDER.length]!;
    updateCanvasSettings({ defaultEdgeStyle: next });
  };

  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3">
      {/* Left pill: Sidebar toggle + Active Canvas Info */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-[#262b36] bg-[#14161c]/95 px-2.5 py-1.5 shadow-lg">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Open workspaces sidebar"
            className="rounded-lg p-1.5 text-[#9aa2b1] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 px-1">
          <h1 className="max-w-[200px] truncate text-xs font-semibold text-[#eceef2]">
            {activeCanvas.name}
          </h1>
          <span className="rounded bg-[#20242e] px-1.5 py-0.5 text-[10px] text-[#8891a5]">
            {activeCanvas.nodes.length} cards
          </span>
        </div>

        <div className="h-4 w-px bg-[#262b36]" />

        <button
          type="button"
          onClick={() => void saveNow()}
          title="Save project (Ctrl/Cmd + S)"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#8c95a8] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>
            {savingStatus === 'saving'
              ? 'Saving...'
              : savingStatus === 'error'
                ? 'Error'
                : 'Saved'}
          </span>
        </button>
      </div>

      {/* Center pill: Primary Canvas Tools */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#262b36] bg-[#14161c]/95 px-2 py-1.5 shadow-lg">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add URL
        </button>

        <div className="mx-1 h-4 w-px bg-[#262b36]" />

        <button
          type="button"
          onClick={undo}
          disabled={pastCount === 0}
          title="Undo (Ctrl/Cmd + Z)"
          className="rounded-lg p-1.5 text-[#a1a9b8] hover:bg-[#222632] hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={futureCount === 0}
          title="Redo (Ctrl/Cmd + Shift + Z)"
          className="rounded-lg p-1.5 text-[#a1a9b8] hover:bg-[#222632] hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-[#262b36]" />

        <button
          type="button"
          onClick={cycleGrid}
          title={`Background grid: ${settings.gridVariant} (click to cycle)`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-[#a1a9b8] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
        >
          <Grid2x2 className="w-3.5 h-3.5" />
          <span className="capitalize hidden sm:inline">{settings.gridVariant}</span>
        </button>

        <button
          type="button"
          onClick={() => updateCanvasSettings({ snapToGrid: !settings.snapToGrid })}
          title={settings.snapToGrid ? 'Snap to grid: ON' : 'Snap to grid: OFF'}
          className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
            settings.snapToGrid
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-[#a1a9b8] hover:bg-[#222632] hover:text-white'
          }`}
        >
          <Magnet className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={cycleEdgeStyle}
          title={`Default edge style: ${settings.defaultEdgeStyle} (click to cycle)`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-[#a1a9b8] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
        >
          <Spline className="w-3.5 h-3.5" />
          <span className="capitalize hidden md:inline">{settings.defaultEdgeStyle}</span>
        </button>

        <button
          type="button"
          onClick={() => updateCanvasSettings({ animatedEdges: !settings.animatedEdges })}
          title={
            settings.animatedEdges ? 'New edges animated: ON' : 'New edges animated: OFF'
          }
          className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
            settings.animatedEdges
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-[#a1a9b8] hover:bg-[#222632] hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => updateCanvasSettings({ showMinimap: !settings.showMinimap })}
          title={settings.showMinimap ? 'Hide minimap' : 'Show minimap'}
          className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
            settings.showMinimap
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-[#a1a9b8] hover:bg-[#222632] hover:text-white'
          }`}
        >
          <MapIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Right pill: Help / Onboarding */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#262b36] bg-[#14161c]/95 p-1.5 shadow-lg">
        <button
          type="button"
          onClick={() => setShowOnboarding(true)}
          title="Quick guide & shortcuts"
          className="rounded-lg p-1.5 text-[#9aa2b1] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
