import { useState, type FormEvent } from 'react';
import {
  Box,
  Download,
  ExternalLink,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { selectActiveCanvas, useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import {
  CARD_COLOR_META,
  DEFAULT_CLUSTERS,
  type Vec3Tuple,
  type WebsiteFlowNode,
} from '@/shared/types/canvas';
import { openCanvasWorkspaceTab } from '@/shared/utils/chromeService';

interface SpatialOverlayHUDProps {
  isOverlayMode: boolean;
  zoomPercent: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCluster: string;
  onClusterChange: (cluster: string) => void;
  showParticles: boolean;
  onToggleParticles: () => void;
  positions: Map<string, Vec3Tuple>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onResetCamera: () => void;
  onFitAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSwitchTo2D: () => void;
  onOpenAddModal: () => void;
  onOpenImportExport: () => void;
  onCloseOverlay: () => void;
}

export function SpatialOverlayHUD({
  isOverlayMode,
  zoomPercent,
  searchQuery,
  onSearchChange,
  activeCluster,
  onClusterChange,
  showParticles,
  onToggleParticles,
  positions,
  selectedNodeId,
  onSelectNode,
  onResetCamera,
  onFitAll,
  onZoomIn,
  onZoomOut,
  onSwitchTo2D,
  onOpenAddModal,
  onOpenImportExport,
  onCloseOverlay,
}: SpatialOverlayHUDProps) {
  const canvases = useWorkspaceStore((s) => s.canvases);
  const activeCanvas = useWorkspaceStore(selectActiveCanvas);
  const selectCanvas = useWorkspaceStore((s) => s.selectCanvas);
  const addCustomCluster = useWorkspaceStore((s) => s.addCustomCluster);

  const [showSettings, setShowSettings] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');

  if (!activeCanvas) return null;

  const availableClusters = Array.from(
    new Set([
      ...DEFAULT_CLUSTERS,
      ...(activeCanvas.customClusters ?? []),
      ...activeCanvas.nodes.map((n) => n.data.cluster).filter((c): c is string => Boolean(c)),
    ])
  );

  const handleAddCluster = (e: FormEvent) => {
    e.preventDefault();
    if (!newClusterName.trim()) return;
    addCustomCluster(newClusterName);
    setNewClusterName('');
  };

  // Compute minimap normalization bounds
  const nodes: WebsiteFlowNode[] = activeCanvas.nodes;
  let maxExtent = 9;
  positions.forEach(([x, , z]) => {
    maxExtent = Math.max(maxExtent, Math.abs(x) + 2, Math.abs(z) + 2);
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Top-Left: Logo, Universe Selector & Cluster Pills */}
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-[#252b3a] bg-[#0e1017]/88 px-3 py-2 shadow-xl backdrop-blur-md">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-indigo-400/35 bg-indigo-500/20 text-indigo-300">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-[#eceef2] uppercase">
            Infinite Canvas
          </span>
          <div className="h-3.5 w-px bg-[#282e3e]" />
          <select
            value={activeCanvas.id}
            onChange={(e) => selectCanvas(e.target.value)}
            aria-label="Select spatial universe"
            className="max-w-[170px] truncate rounded bg-transparent text-xs font-medium text-indigo-200 outline-none cursor-pointer"
          >
            {canvases.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#12151e] text-[#eceef2]">
                {c.name} ({c.nodes.length})
              </option>
            ))}
          </select>
        </div>

        {/* Spatial Cluster Filters */}
        <div className="flex max-w-[440px] flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onClusterChange('All')}
            className={`rounded-lg border px-2 py-1 text-[10px] font-medium backdrop-blur-md transition-colors cursor-pointer ${
              activeCluster === 'All'
                ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                : 'border-[#252b3a] bg-[#0e1017]/80 text-[#8d96ab] hover:text-white'
            }`}
          >
            All ({nodes.length})
          </button>
          {availableClusters.map((cluster) => {
            const count = nodes.filter((n) => n.data.cluster === cluster).length;
            if (count === 0 && activeCluster !== cluster) return null;
            return (
              <button
                key={cluster}
                type="button"
                onClick={() => onClusterChange(cluster)}
                className={`rounded-lg border px-2 py-1 text-[10px] font-medium backdrop-blur-md transition-colors cursor-pointer ${
                  activeCluster === cluster
                    ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                    : 'border-[#252b3a] bg-[#0e1017]/80 text-[#8d96ab] hover:text-white'
                }`}
              >
                {cluster} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Top-Right: Search, Add URL, Settings, Close Overlay */}
      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6e778b]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search universe..."
            className="w-48 rounded-xl border border-[#252b3a] bg-[#0e1017]/88 py-1.5 pl-8 pr-3 text-xs text-[#eceef2] placeholder-[#656f84] shadow-xl backdrop-blur-md outline-none focus:border-indigo-400/80"
          />
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-xl hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Site
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            title="Spatial settings"
            className="rounded-xl border border-[#252b3a] bg-[#0e1017]/88 p-2 text-[#9ca5b8] shadow-xl backdrop-blur-md hover:text-white cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-[#282f40] bg-[#10131c]/95 p-3.5 shadow-2xl backdrop-blur-md">
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#7d869b]">
                Universe Settings
              </div>

              <label className="mb-2.5 flex items-center justify-between rounded-lg border border-[#222836] bg-[#151925] px-2.5 py-2 text-xs text-[#cfd5e2] cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  Ambient Particles
                </span>
                <input
                  type="checkbox"
                  checked={showParticles}
                  onChange={onToggleParticles}
                  className="accent-indigo-500 cursor-pointer"
                />
              </label>

              <form onSubmit={handleAddCluster} className="mb-2.5 flex gap-1.5">
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="New custom cluster..."
                  className="flex-1 rounded-lg border border-[#2a3040] bg-[#0c0e14] px-2 py-1 text-[11px] text-[#eceef2] outline-none focus:border-indigo-400"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#232838] px-2 py-1 text-[11px] text-[#dfe4ee] hover:bg-indigo-500 hover:text-white cursor-pointer"
                >
                  Add
                </button>
              </form>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    onOpenImportExport();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-[#252b3a] bg-[#151924] px-2.5 py-1.5 text-xs text-[#cfd5e2] hover:bg-[#1e2434] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-300" />
                  Import / Export JSON
                </button>

                {isOverlayMode && (
                  <button
                    type="button"
                    onClick={() => void openCanvasWorkspaceTab(activeCanvas.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-[#252b3a] bg-[#151924] px-2.5 py-1.5 text-xs text-[#cfd5e2] hover:bg-[#1e2434] cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-sky-300" />
                    Open in Full Tab
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isOverlayMode && (
          <button
            type="button"
            onClick={onCloseOverlay}
            title="Exit Spatial Universe & return to website"
            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-[#19121a]/90 px-2.5 py-1.5 text-xs font-medium text-rose-200 shadow-xl backdrop-blur-md hover:bg-rose-500/25 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Exit
          </button>
        )}
      </div>

      {/* Bottom-Left: Spatial Radar Minimap */}
      <div className="pointer-events-auto absolute bottom-4 left-4 hidden sm:flex flex-col rounded-xl border border-[#252b3a] bg-[#0e1017]/88 p-2 shadow-xl backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between px-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#6d768a]">
          <span>Spatial Map</span>
          <span>{nodes.length} nodes</span>
        </div>
        <div className="relative h-24 w-32 overflow-hidden rounded-lg border border-[#1f2432] bg-[#080a0f]">
          {/* Subtle radar crosshair */}
          <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-[#1c2130]" />
          <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-px bg-[#1c2130]" />

          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const leftPct = 50 + (pos[0] / maxExtent) * 44;
            const topPct = 50 + (pos[2] / maxExtent) * 44;
            const selected = node.id === selectedNodeId;
            const dotColor =
              CARD_COLOR_META[node.data.color ?? 'default']?.dot ?? '#818cf8';
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                title={node.data.title}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  backgroundColor: selected ? '#ffffff' : dotColor,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform cursor-pointer ${
                  node.data.isCentral
                    ? 'h-2.5 w-2.5 ring-2 ring-indigo-400/60'
                    : selected
                      ? 'h-2.5 w-2.5 scale-125'
                      : 'h-1.5 w-1.5 hover:scale-150'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom-Center: Controls, Zoom, Reset, Mode Toggle & Hints */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-xl border border-[#252b3a] bg-[#0e1017]/90 px-2 py-1.5 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={onZoomOut}
            title="Zoom out (-)"
            className="rounded-lg p-1.5 text-[#9aa4ba] hover:bg-[#1e2332] hover:text-white cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[42px] text-center text-[11px] font-medium tabular-nums text-[#d6dce8]">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            title="Zoom in (+)"
            className="rounded-lg p-1.5 text-[#9aa4ba] hover:bg-[#1e2332] hover:text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="mx-1 h-4 w-px bg-[#262c3b]" />

          <button
            type="button"
            onClick={onResetCamera}
            title="Reset camera (R)"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#9aa4ba] hover:bg-[#1e2332] hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={onFitAll}
            title="Fit all panels"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#9aa4ba] hover:bg-[#1e2332] hover:text-white cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Fit All</span>
          </button>

          <div className="mx-1 h-4 w-px bg-[#262c3b]" />

          <button
            type="button"
            onClick={onSwitchTo2D}
            title="Switch to 2D Canvas Fallback Mode"
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/25 cursor-pointer"
          >
            <Box className="w-3.5 h-3.5" />
            3D · Switch to 2D
          </button>
        </div>

        <div className="hidden lg:block text-[10px] text-[#6d768a]">
          Drag: Orbit · Scroll: Zoom · WASD: Navigate · Shift + Drag: Move Panel · Double-Click:
          Open Site · R: Reset
        </div>
      </div>
    </div>
  );
}
