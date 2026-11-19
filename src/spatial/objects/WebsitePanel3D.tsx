import { memo, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  Crosshair,
  ExternalLink,
  Link2,
  MousePointerClick,
  Sparkles,
  TextCursorInput,
} from 'lucide-react';
import * as THREE from 'three';
import { Favicon } from '@/shared/components/Favicon';
import { CARD_COLOR_META, type Vec3Tuple, type WebsiteFlowNode } from '@/shared/types/canvas';
import { openExternalUrl } from '@/shared/utils/chromeService';

interface WebsitePanel3DProps {
  node: WebsiteFlowNode;
  position: Vec3Tuple;
  selected: boolean;
  dimmed: boolean;
  isOverlayMode: boolean;
  portalRef?: RefObject<HTMLElement>;
  onSelect: (nodeId: string) => void;
  onActivateElement: (icId: string, mode: 'click' | 'scroll') => void;
  onDragStart: () => void;
  onDragPosition: (nodeId: string, pos: Vec3Tuple) => void;
  onDragEnd: () => void;
}

function WebsitePanel3DComponent({
  node,
  position,
  selected,
  dimmed,
  isOverlayMode,
  portalRef,
  onSelect,
  onActivateElement,
  onDragStart,
  onDragPosition,
  onDragEnd,
}: WebsitePanel3DProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const elapsedRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const draggingRef = useRef(false);
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const dragOffsetRef = useRef(new THREE.Vector3());
  const intersectPointRef = useRef(new THREE.Vector3());

  const isCentral = Boolean(node.data.isCentral);
  const actions = node.data.actions ?? [];
  const hasActions = actions.length > 0;

  const width = isCentral ? 3.8 : 2.95;
  const height = isCentral ? 2.45 : hasActions ? 2.15 : 1.75;
  const colorMeta = CARD_COLOR_META[node.data.color ?? 'default'] ?? CARD_COLOR_META.default;

  const rimColor = useMemo(() => {
    if (selected) return '#818cf8';
    if (hovered) return '#a5b4fc';
    if (isCentral) return '#6366f1';
    return colorMeta.accent;
  }, [selected, hovered, isCentral, colorMeta.accent]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    elapsedRef.current += Math.min(delta, 0.05);
    const t = elapsedRef.current;
    const bob = draggingRef.current
      ? 0
      : Math.sin(t * 0.85 + position[0] * 0.7 + position[2] * 0.5) * (isCentral ? 0.05 : 0.07);
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(node.id);

    if (e.shiftKey) {
      draggingRef.current = true;
      onDragStart();
      const cameraDir = new THREE.Vector3();
      e.camera.getWorldDirection(cameraDir);
      const panelPos = new THREE.Vector3(...position);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDir.negate(), panelPos);
      if (e.ray.intersectPlane(dragPlaneRef.current, intersectPointRef.current)) {
        dragOffsetRef.current.copy(panelPos).sub(intersectPointRef.current);
      }
      (e.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(dragPlaneRef.current, intersectPointRef.current)) {
      const next = intersectPointRef.current.clone().add(dragOffsetRef.current);
      onDragPosition(node.id, [
        Number(next.x.toFixed(2)),
        Number(next.y.toFixed(2)),
        Number(next.z.toFixed(2)),
      ]);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = false;
    onDragEnd();
  };

  const handlePrimaryDoubleClick = () => {
    if (isOverlayMode && node.data.icTargetId) {
      onActivateElement(node.data.icTargetId, 'scroll');
      return;
    }
    void openExternalUrl(node.data.url);
  };

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handlePrimaryDoubleClick();
      }}
    >
      {/* 3D Dark Metallic Backing Slab */}
      <mesh>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial
          color="#10131a"
          metalness={0.35}
          roughness={0.45}
          transparent
          opacity={dimmed ? 0.28 : 0.96}
        />
      </mesh>

      {/* Luminous Rim Border */}
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[width + 0.055, height + 0.055, 0.04]} />
        <meshBasicMaterial
          color={rimColor}
          transparent
          opacity={dimmed ? 0.1 : selected ? 0.92 : hovered || isCentral ? 0.6 : 0.28}
        />
      </mesh>

      {/* Crisp Interactive Website & Buttons Surface */}
      <Html
        transform
        portal={portalRef}
        distanceFactor={5.2}
        position={[0, 0, 0.052]}
        style={{
          width: isCentral ? '374px' : '290px',
          height: isCentral ? '240px' : hasActions ? '210px' : '170px',
          pointerEvents: 'auto',
          opacity: dimmed ? 0.22 : 1,
          transition: 'opacity 180ms ease',
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handlePrimaryDoubleClick();
          }}
          className={`flex h-full w-full select-none flex-col overflow-hidden rounded-xl border bg-[#11141c] text-[#eceef2] shadow-2xl cursor-pointer transition-colors ${
            selected
              ? 'border-indigo-400/90'
              : hovered
                ? 'border-indigo-300/55'
                : 'border-[#282e3d]'
          }`}
        >
          {/* Central Website Screenshot Header */}
          {isCentral && node.data.screenshot ? (
            <div className="relative h-[116px] w-full shrink-0 overflow-hidden border-b border-[#232836] bg-[#0a0c11]">
              <img
                src={node.data.screenshot}
                alt={node.data.title}
                draggable={false}
                className="h-full w-full object-cover object-top"
              />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-indigo-400/45 bg-[#0d1018]/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-200">
                <Sparkles className="h-2.5 w-2.5" />
                Live Page Hub
              </span>
            </div>
          ) : (
            <div
              className="h-1.5 w-full shrink-0"
              style={{ backgroundColor: colorMeta.accent }}
            />
          )}

          {/* Panel Body */}
          <div className="flex flex-1 flex-col justify-between overflow-hidden p-3">
            <div className="min-h-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Favicon
                    src={node.data.favicon}
                    url={node.data.url}
                    domain={node.data.domain}
                    size={15}
                  />
                  <span className="truncate text-[10px] font-medium text-[#8b95ab]">
                    {isCentral ? node.data.domain : node.data.sectionKind?.toUpperCase() ?? 'SECTION'}
                  </span>
                </div>

                {node.data.cluster && (
                  <span className="shrink-0 rounded bg-[#1d2230] px-1.5 py-0.5 text-[9px] font-medium text-[#a8b2c7]">
                    {node.data.cluster}
                  </span>
                )}
              </div>

              <div
                className={`font-semibold leading-snug text-[#f1f3f8] line-clamp-1 ${
                  isCentral ? 'text-[13px]' : 'text-[12px]'
                }`}
              >
                {node.data.title}
              </div>

              {/* Interactive Buttons & Controls Grid directly on the 3D Panel */}
              {hasActions ? (
                <div className="mt-2 flex flex-wrap gap-1 overflow-hidden">
                  {actions.slice(0, isCentral ? 5 : 6).map((action) => (
                    <button
                      key={action.icId}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOverlayMode) {
                          onActivateElement(action.icId, isCentral ? 'scroll' : 'click');
                        } else if (action.href) {
                          void openExternalUrl(action.href);
                        }
                      }}
                      title={
                        isOverlayMode
                          ? isCentral
                            ? `Jump to "${action.label}" on page`
                            : `Click "${action.label}" on live page`
                          : action.label
                      }
                      className={`inline-flex max-w-[126px] items-center gap-1 rounded-md border px-2 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
                        action.kind === 'button'
                          ? 'border-indigo-400/35 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500 hover:text-white'
                          : action.kind === 'input'
                            ? 'border-amber-400/35 bg-amber-500/12 text-amber-100 hover:bg-amber-500/30'
                            : 'border-[#2f3649] bg-[#181d29] text-[#c7cfe0] hover:border-sky-400/60 hover:bg-sky-500/20 hover:text-white'
                      }`}
                    >
                      {action.kind === 'button' ? (
                        <MousePointerClick className="h-2.5 w-2.5 shrink-0 opacity-80" />
                      ) : action.kind === 'input' ? (
                        <TextCursorInput className="h-2.5 w-2.5 shrink-0 opacity-80" />
                      ) : (
                        <Link2 className="h-2.5 w-2.5 shrink-0 opacity-80" />
                      )}
                      <span className="truncate">{action.label}</span>
                    </button>
                  ))}
                  {actions.length > (isCentral ? 5 : 6) && (
                    <span className="inline-flex items-center rounded-md bg-[#1a1f2b] px-1.5 py-1 text-[9px] text-[#8f99ae]">
                      +{actions.length - (isCentral ? 5 : 6)} more
                    </span>
                  )}
                </div>
              ) : (
                node.data.description && (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-[#8a93a8] line-clamp-3">
                    {node.data.description}
                  </p>
                )
              )}
            </div>

            {/* Footer Bar */}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#1e2330] pt-1.5">
              <div className="flex items-center gap-1 overflow-hidden">
                {node.data.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="truncate rounded bg-[#1a1f2b] px-1.5 py-0.5 text-[9px] text-[#98a2b8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {isOverlayMode && node.data.icTargetId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onActivateElement(node.data.icTargetId!, 'scroll');
                  }}
                  title="Jump to this section on the live page"
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-[#1e2332] px-1.5 py-0.5 text-[9px] font-medium text-indigo-300 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Crosshair className="h-2.5 w-2.5" />
                  Focus Page
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openExternalUrl(node.data.url);
                  }}
                  title="Open website"
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-[#1e2332] px-1.5 py-0.5 text-[9px] font-medium text-indigo-300 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer"
                >
                  Open
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

export const WebsitePanel3D = memo(WebsitePanel3DComponent);
