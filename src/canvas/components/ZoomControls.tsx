import { useReactFlow, useViewport } from '@xyflow/react';
import { Maximize2, Minus, Plus } from 'lucide-react';

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const percentage = Math.round(zoom * 100);

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-0.5 rounded-xl border border-[#262b36] bg-[#14161c]/95 p-1 shadow-lg">
      <button
        type="button"
        onClick={() => void zoomOut({ duration: 150 })}
        title="Zoom out"
        className="rounded-lg p-1.5 text-[#a1a9b8] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <span className="min-w-[44px] text-center text-[11px] font-medium tabular-nums text-[#cfd5e2]">
        {percentage}%
      </span>

      <button
        type="button"
        onClick={() => void zoomIn({ duration: 150 })}
        title="Zoom in"
        className="rounded-lg p-1.5 text-[#a1a9b8] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-[#262b36]" />

      <button
        type="button"
        onClick={() => void fitView({ padding: 0.22, duration: 250 })}
        title="Fit all cards to view"
        className="rounded-lg p-1.5 text-[#a1a9b8] hover:bg-[#222632] hover:text-white transition-colors cursor-pointer"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
