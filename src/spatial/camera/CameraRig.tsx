import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { Camera3DState, Vec3Tuple } from '@/shared/types/canvas';

export interface CameraCommand {
  id: number;
  type: 'focus' | 'reset' | 'fit' | 'zoomIn' | 'zoomOut';
  target?: Vec3Tuple;
  distance?: number;
}

interface CameraRigProps {
  enabled: boolean;
  initialCamera?: Camera3DState;
  command: CameraCommand | null;
  onZoomChange: (zoomPercent: number) => void;
  onCameraCommit: (state: Camera3DState) => void;
}

const DEFAULT_POS = new THREE.Vector3(0, 2.2, 11.5);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

export function CameraRig({
  enabled,
  initialCamera,
  command,
  onZoomChange,
  onCameraCommit,
}: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const keysRef = useRef<Set<string>>(new Set());
  const desiredPosRef = useRef<THREE.Vector3 | null>(null);
  const desiredTargetRef = useRef<THREE.Vector3 | null>(null);
  const lastZoomReportedRef = useRef<number>(100);

  // Restore saved camera state when switching canvases
  useEffect(() => {
    if (initialCamera) {
      camera.position.set(...initialCamera.position);
      if (controlsRef.current) {
        controlsRef.current.target.set(...initialCamera.target);
        controlsRef.current.update();
      }
    } else {
      camera.position.copy(DEFAULT_POS);
      if (controlsRef.current) {
        controlsRef.current.target.copy(DEFAULT_TARGET);
        controlsRef.current.update();
      }
    }
    desiredPosRef.current = null;
    desiredTargetRef.current = null;
  }, [camera, initialCamera]);

  // Execute smooth camera transition commands (focus, reset, fit, zoom)
  useEffect(() => {
    if (!command || !controlsRef.current) return;

    if (command.type === 'reset') {
      desiredPosRef.current = DEFAULT_POS.clone();
      desiredTargetRef.current = DEFAULT_TARGET.clone();
      return;
    }

    if (command.type === 'fit') {
      const dist = command.distance ?? 14;
      desiredTargetRef.current = new THREE.Vector3(...(command.target ?? [0, 0, 0]));
      desiredPosRef.current = desiredTargetRef.current
        .clone()
        .add(new THREE.Vector3(0, dist * 0.22, dist));
      return;
    }

    if (command.type === 'focus' && command.target) {
      const targetVec = new THREE.Vector3(...command.target);
      desiredTargetRef.current = targetVec;
      const offsetDir = camera.position.clone().sub(targetVec);
      if (offsetDir.lengthSq() < 0.01) {
        offsetDir.set(0, 0.4, 1);
      }
      offsetDir.normalize();
      desiredPosRef.current = targetVec.clone().add(offsetDir.multiplyScalar(command.distance ?? 5.4));
      return;
    }

    if (command.type === 'zoomIn' || command.type === 'zoomOut') {
      const target = controlsRef.current.target.clone();
      const offset = camera.position.clone().sub(target);
      const factor = command.type === 'zoomIn' ? 0.78 : 1.28;
      const nextDist = THREE.MathUtils.clamp(offset.length() * factor, 3.2, 32);
      offset.normalize().multiplyScalar(nextDist);
      desiredTargetRef.current = target;
      desiredPosRef.current = target.clone().add(offset);
    }
  }, [command, camera]);

  // WASD + Arrow keys spatial navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const code = e.code;
      if (
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        keysRef.current.add(code);
        desiredPosRef.current = null;
        desiredTargetRef.current = null;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onBlur = () => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dt = Math.min(delta, 0.05);

    // Smooth interpolated transition
    if (desiredPosRef.current && desiredTargetRef.current) {
      const alpha = 1 - Math.exp(-6.5 * dt);
      camera.position.lerp(desiredPosRef.current, alpha);
      controls.target.lerp(desiredTargetRef.current, alpha);
      if (
        camera.position.distanceTo(desiredPosRef.current) < 0.04 &&
        controls.target.distanceTo(desiredTargetRef.current) < 0.04
      ) {
        camera.position.copy(desiredPosRef.current);
        controls.target.copy(desiredTargetRef.current);
        desiredPosRef.current = null;
        desiredTargetRef.current = null;
      }
    }

    // Keyboard flight movement (WASD + Arrows)
    const keys = keysRef.current;
    if (keys.size > 0) {
      const moveSpeed = 9.5 * dt;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() > 0.0001) forward.normalize();

      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const move = new THREE.Vector3();

      if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(moveSpeed);
        camera.position.add(move);
        controls.target.add(move);
      }
    }

    controls.update();

    // Update zoom indicator cleanly (throttled by integer percent change)
    const distance = camera.position.distanceTo(controls.target);
    const zoomPct = Math.round(THREE.MathUtils.clamp((11.5 / Math.max(2.5, distance)) * 100, 25, 350));
    if (Math.abs(zoomPct - lastZoomReportedRef.current) >= 2) {
      lastZoomReportedRef.current = zoomPct;
      onZoomChange(zoomPct);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={enabled}
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.62}
      zoomSpeed={0.85}
      panSpeed={0.8}
      minDistance={3.2}
      maxDistance={32}
      onStart={() => {
        desiredPosRef.current = null;
        desiredTargetRef.current = null;
      }}
      onEnd={() => {
        if (!controlsRef.current) return;
        const p = camera.position;
        const t = controlsRef.current.target;
        onCameraCommit({
          position: [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
          target: [Number(t.x.toFixed(2)), Number(t.y.toFixed(2)), Number(t.z.toFixed(2))],
        });
      }}
    />
  );
}
