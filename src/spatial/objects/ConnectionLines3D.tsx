import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { CanvasFlowEdge, Vec3Tuple } from '@/shared/types/canvas';

interface ConnectionLines3DProps {
  edges: CanvasFlowEdge[];
  positions: Map<string, Vec3Tuple>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  portalRef?: RefObject<HTMLElement>;
  onSelectEdge: (edgeId: string) => void;
}

interface SingleEdgeProps {
  edge: CanvasFlowEdge;
  start: Vec3Tuple;
  end: Vec3Tuple;
  highlighted: boolean;
  selected: boolean;
  portalRef?: RefObject<HTMLElement>;
  onSelect: () => void;
}

function SpatialEdgeLine({
  edge,
  start,
  end,
  highlighted,
  selected,
  portalRef,
  onSelect,
}: SingleEdgeProps) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const elapsedRef = useRef(0);

  const { curve, points, midpoint } = useMemo(() => {
    const p0 = new THREE.Vector3(...start);
    const p2 = new THREE.Vector3(...end);
    const mid = p0.clone().add(p2).multiplyScalar(0.5);
    mid.y += 0.65;
    const bezier = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const pts = bezier.getPoints(28);
    const center = bezier.getPoint(0.5);
    return { curve: bezier, points: pts, midpoint: center };
  }, [start, end]);

  useFrame((_, delta) => {
    if (!pulseRef.current) return;
    elapsedRef.current += Math.min(delta, 0.05);
    const speed = edge.animated || edge.data?.animated ? 0.28 : 0.14;
    const t = (elapsedRef.current * speed) % 1;
    const pos = curve.getPoint(t);
    pulseRef.current.position.copy(pos);
  });

  const lineColor = selected
    ? '#a5b4fc'
    : highlighted
      ? '#818cf8'
      : '#3b4560';

  return (
    <group>
      <Line
        points={points}
        color={lineColor}
        lineWidth={selected ? 2.2 : highlighted ? 1.6 : 1.0}
        transparent
        opacity={selected ? 0.95 : highlighted ? 0.72 : 0.35}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />

      {/* Subtle traveling light node along connection */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[selected || highlighted ? 0.065 : 0.04, 8, 8]} />
        <meshBasicMaterial color={selected ? '#c7d2fe' : '#818cf8'} transparent opacity={0.85} />
      </mesh>

      {/* Reveal label when edge is selected or highlighted */}
      {(selected || highlighted) && edge.data?.label && (
        <Html portal={portalRef} position={[midpoint.x, midpoint.y + 0.15, midpoint.z]} center>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-medium shadow-lg backdrop-blur-sm cursor-pointer ${
              selected
                ? 'border-indigo-400/80 bg-[#171b28]/95 text-indigo-200'
                : 'border-[#2f3649] bg-[#12151e]/90 text-[#b4bdd1]'
            }`}
          >
            {edge.data.label}
          </button>
        </Html>
      )}
    </group>
  );
}

export function ConnectionLines3D({
  edges,
  positions,
  selectedNodeId,
  selectedEdgeId,
  portalRef,
  onSelectEdge,
}: ConnectionLines3DProps) {
  return (
    <group>
      {edges.map((edge) => {
        const start = positions.get(edge.source);
        const end = positions.get(edge.target);
        if (!start || !end) return null;

        const highlighted =
          selectedNodeId !== null &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const selected = selectedEdgeId === edge.id;

        return (
          <SpatialEdgeLine
            key={edge.id}
            edge={edge}
            start={start}
            end={end}
            highlighted={highlighted}
            selected={selected}
            portalRef={portalRef}
            onSelect={() => onSelectEdge(edge.id)}
          />
        );
      })}
    </group>
  );
}
