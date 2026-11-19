import { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
import { Activity, Pencil, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import type { CanvasFlowEdge } from '@/shared/types/canvas';

function CanvasEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  markerEnd,
}: EdgeProps<CanvasFlowEdge>) {
  const updateEdgeData = useWorkspaceStore((s) => s.updateEdgeData);
  const deleteEdge = useWorkspaceStore((s) => s.deleteEdge);

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(data?.label ?? '');

  const curveStyle = data?.curveStyle ?? 'bezier';
  const animated = Boolean(data?.animated);

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (curveStyle === 'bezier') {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else if (curveStyle === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 16,
    });
  }

  const commitLabel = () => {
    updateEdgeData(id, { label: draftLabel.trim() || undefined });
    setIsEditingLabel(false);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#4f46e5' : data?.strokeColor ?? '#3b63d6',
          strokeWidth: selected ? 2.4 : 1.75,
          opacity: selected ? 1 : 0.88,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {isEditingLabel ? (
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') setIsEditingLabel(false);
              }}
              autoFocus
              placeholder="Connection label..."
              className="w-32 rounded-md border border-indigo-400 bg-[#14161c] px-2 py-0.5 text-[11px] text-[#eceef2] shadow-lg outline-none"
            />
          ) : (
            <>
              {data?.label && (
                <button
                  type="button"
                  onDoubleClick={() => {
                    setDraftLabel(data.label ?? '');
                    setIsEditingLabel(true);
                  }}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-colors cursor-pointer ${
                    selected
                      ? 'border-indigo-400/70 bg-[#1a1d27] text-indigo-200'
                      : 'border-[#2d3240] bg-[#15171d] text-[#a7b0c2] hover:border-[#42495c]'
                  }`}
                >
                  {data.label}
                </button>
              )}

              {selected && (
                <div className="flex items-center gap-0.5 rounded-md border border-[#303645] bg-[#161921] p-0.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftLabel(data?.label ?? '');
                      setIsEditingLabel(true);
                    }}
                    title="Edit edge label"
                    className="rounded p-1 text-[#9aa2b1] hover:bg-[#252a35] hover:text-white cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateEdgeData(id, { animated: !animated })}
                    title={animated ? 'Disable animation' : 'Animate connection'}
                    className={`rounded p-1 cursor-pointer ${
                      animated
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-[#9aa2b1] hover:bg-[#252a35] hover:text-white'
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEdge(id)}
                    title="Delete connection"
                    className="rounded p-1 text-[#9aa2b1] hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const CanvasEdge = memo(CanvasEdgeComponent);
