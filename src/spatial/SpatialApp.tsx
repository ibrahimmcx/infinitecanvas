import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { CanvasApp } from '@/canvas/CanvasApp';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import { detectWebGLSupport } from '@/spatial/utils/layout3d';

const Spatial3DView = lazy(() => import('@/spatial/Spatial3DView'));

export function SpatialApp() {
  const hydrate = useWorkspaceStore((s) => s.hydrate);

  const isOverlayMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'overlay';
  }, []);

  const [webglSupported, setWebglSupported] = useState<boolean>(() => detectWebGLSupport());
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('2d');

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void hydrate().then((unsub) => {
      cleanup = unsub;
    });
    return () => {
      cleanup?.();
    };
  }, [hydrate]);

  const closeOverlay = useCallback(() => {
    if (isOverlayMode && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'INFINITE_CANVAS_CLOSE_OVERLAY' }, '*');
    }
  }, [isOverlayMode]);

  const activateLiveElement = useCallback(
    (icId: string, mode: 'click' | 'scroll') => {
      if (isOverlayMode && window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'INFINITE_CANVAS_ACTIVATE_ELEMENT', icId, mode },
          '*'
        );
      }
    },
    [isOverlayMode]
  );

  if (viewMode === '2d' || !webglSupported) {
    return (
      <CanvasApp
        isOverlayMode={isOverlayMode}
        canSwitchTo3D={webglSupported}
        onSwitchTo3D={() => setViewMode('3d')}
        onCloseOverlay={closeOverlay}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#06070a] text-xs text-[#858fa4]">
          Loading 3D Spatial Universe...
        </div>
      }
    >
      <Spatial3DView
        isOverlayMode={isOverlayMode}
        onSwitchTo2D={() => setViewMode('2d')}
        onWebGLFailure={() => {
          setWebglSupported(false);
          setViewMode('2d');
        }}
        onCloseOverlay={closeOverlay}
        onActivateElement={activateLiveElement}
      />
    </Suspense>
  );
}
