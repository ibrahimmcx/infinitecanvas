import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { AddWebsiteModal } from '@/canvas/components/AddWebsiteModal';
import { ImportExportModal } from '@/canvas/components/ImportExportModal';
import { selectActiveCanvas, useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import type { Vec3Tuple } from '@/shared/types/canvas';
import { CameraRig, type CameraCommand } from '@/spatial/camera/CameraRig';
import { SpatialDetailDrawer } from '@/spatial/components/SpatialDetailDrawer';
import { SpatialOverlayHUD } from '@/spatial/components/SpatialOverlayHUD';
import { AmbientSpace } from '@/spatial/effects/AmbientSpace';
import { ConnectionLines3D } from '@/spatial/objects/ConnectionLines3D';
import { WebsitePanel3D } from '@/spatial/objects/WebsitePanel3D';
import { resolveNodePosition3D } from '@/spatial/utils/layout3d';

interface WebGLErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

class WebGLErrorBoundary extends Component<WebGLErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.props.onError();
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export interface Spatial3DViewProps {
  isOverlayMode: boolean;
  onSwitchTo2D: () => void;
  onWebGLFailure: () => void;
  onCloseOverlay: () => void;
  onActivateElement: (icId: string, mode: 'click' | 'scroll') => void;
}

export default function Spatial3DView({
  isOverlayMode,
  onSwitchTo2D,
  onWebGLFailure,
  onCloseOverlay,
  onActivateElement,
}: Spatial3DViewProps) {
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const activeCanvas = useWorkspaceStore(selectActiveCanvas);
  const updateNodePosition3D = useWorkspaceStore((s) => s.updateNodePosition3D);
  const updateCanvasCamera3D = useWorkspaceStore((s) => s.updateCanvasCamera3D);

  // Dedicated stable portal root for drei <Html> prevents React 19 removeChild unmount race
  const htmlPortalRef = useRef<HTMLDivElement>(null!);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCluster, setActiveCluster] = useState('All');
  const [showParticles, setShowParticles] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);

  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const sendCameraCommand = useCallback((cmd: Omit<CameraCommand, 'id'>) => {
    setCameraCommand({ ...cmd, id: Date.now() + Math.random() });
  }, []);

  const positions = useMemo(() => {
    const map = new Map<string, Vec3Tuple>();
    if (!activeCanvas) return map;
    const total = activeCanvas.nodes.length;
    activeCanvas.nodes.forEach((node, index) => {
      map.set(node.id, resolveNodePosition3D(node, index, total));
    });
    return map;
  }, [activeCanvas]);

  const handleSelectAndFocusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      const pos = positions.get(nodeId);
      if (pos) {
        sendCameraCommand({ type: 'focus', target: pos, distance: 5.4 });
      }
    },
    [positions, sendCameraCommand]
  );

  const handleFitAll = useCallback(() => {
    if (!activeCanvas || activeCanvas.nodes.length === 0) {
      sendCameraCommand({ type: 'reset' });
      return;
    }
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;

    positions.forEach(([x, y, z]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 6);
    sendCameraCommand({
      type: 'fit',
      target: [cx, cy, cz],
      distance: Math.min(26, Math.max(9.5, span * 1.15)),
    });
  }, [activeCanvas, positions, sendCameraCommand]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;

      if (e.key === 'Escape') {
        if (selectedNodeId || selectedEdgeId) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        } else if (isOverlayMode) {
          onCloseOverlay();
        }
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        sendCameraCommand({ type: 'reset' });
        return;
      }

      if (e.key.toLowerCase() === 'f' && selectedNodeId) {
        const pos = positions.get(selectedNodeId);
        if (pos) sendCameraCommand({ type: 'focus', target: pos, distance: 5.0 });
        return;
      }

      if (e.key === '+' || e.key === '=') {
        sendCameraCommand({ type: 'zoomIn' });
        return;
      }

      if (e.key === '-' || e.key === '_') {
        sendCameraCommand({ type: 'zoomOut' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, selectedEdgeId, isOverlayMode, onCloseOverlay, positions, sendCameraCommand]);

  if (!hydrated || !activeCanvas) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#06070a] text-xs text-[#858fa4]">
        Initializing Spatial Universe...
      </div>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const selectedNode = activeCanvas.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const lowQuality = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 4) <= 2;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#06070a]">
      {/* Dedicated stable HTML portal mount container */}
      <div ref={htmlPortalRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />

      <WebGLErrorBoundary onError={onWebGLFailure}>
        <Canvas
          dpr={lowQuality ? [1, 1.25] : [1, 2]}
          camera={{ position: [0, 2.2, 11.5], fov: 46, near: 0.1, far: 160 }}
          gl={{ antialias: !lowQuality, powerPreference: 'high-performance' }}
          onPointerMissed={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
        >
          <AmbientSpace showParticles={showParticles} lowQuality={lowQuality} />

          <CameraRig
            enabled={!isDraggingPanel}
            initialCamera={activeCanvas.camera3d}
            command={cameraCommand}
            onZoomChange={setZoomPercent}
            onCameraCommit={updateCanvasCamera3D}
          />

          <ConnectionLines3D
            edges={activeCanvas.edges}
            positions={positions}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            portalRef={htmlPortalRef}
            onSelectEdge={(edgeId) => setSelectedEdgeId(edgeId)}
          />

          {activeCanvas.nodes.map((node) => {
            const pos = positions.get(node.id) ?? [0, 0, 0];
            const matchesCluster =
              activeCluster === 'All' || node.data.cluster === activeCluster;
            const matchesSearch =
              !normalizedQuery ||
              node.data.title.toLowerCase().includes(normalizedQuery) ||
              node.data.domain.toLowerCase().includes(normalizedQuery) ||
              node.data.description.toLowerCase().includes(normalizedQuery) ||
              node.data.tags.some((t) => t.toLowerCase().includes(normalizedQuery));

            return (
              <WebsitePanel3D
                key={node.id}
                node={node}
                position={pos}
                selected={node.id === selectedNodeId}
                dimmed={!matchesCluster || !matchesSearch}
                isOverlayMode={isOverlayMode}
                portalRef={htmlPortalRef}
                onSelect={handleSelectAndFocusNode}
                onActivateElement={onActivateElement}
                onDragStart={() => setIsDraggingPanel(true)}
                onDragPosition={updateNodePosition3D}
                onDragEnd={() => setIsDraggingPanel(false)}
              />
            );
          })}
        </Canvas>
      </WebGLErrorBoundary>

      <SpatialOverlayHUD
        isOverlayMode={isOverlayMode}
        zoomPercent={zoomPercent}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeCluster={activeCluster}
        onClusterChange={setActiveCluster}
        showParticles={showParticles}
        onToggleParticles={() => setShowParticles((v) => !v)}
        positions={positions}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectAndFocusNode}
        onResetCamera={() => sendCameraCommand({ type: 'reset' })}
        onFitAll={handleFitAll}
        onZoomIn={() => sendCameraCommand({ type: 'zoomIn' })}
        onZoomOut={() => sendCameraCommand({ type: 'zoomOut' })}
        onSwitchTo2D={onSwitchTo2D}
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenImportExport={() => setImportExportOpen(true)}
        onCloseOverlay={onCloseOverlay}
      />

      <SpatialDetailDrawer
        node={selectedNode}
        allNodes={activeCanvas.nodes}
        edges={activeCanvas.edges}
        customClusters={activeCanvas.customClusters ?? []}
        isOverlayMode={isOverlayMode}
        onClose={() => setSelectedNodeId(null)}
        onFocusNode={handleSelectAndFocusNode}
        onActivateElement={onActivateElement}
      />

      <AddWebsiteModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
      <ImportExportModal open={importExportOpen} onClose={() => setImportExportOpen(false)} />
    </div>
  );
}
