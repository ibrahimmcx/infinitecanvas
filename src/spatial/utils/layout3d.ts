import type { Vec3Tuple, WebsiteFlowNode } from '@/shared/types/canvas';

export function resolveNodePosition3D(node: WebsiteFlowNode, index: number, total: number): Vec3Tuple {
  if (
    Array.isArray(node.data.position3d) &&
    node.data.position3d.length === 3 &&
    node.data.position3d.every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    return node.data.position3d;
  }

  if (node.data.isCentral || index === 0) {
    return [0, 0, 0];
  }

  const ringIndex = index - 1;
  const ringCount = Math.max(1, total - 1);
  const angle = (ringIndex / ringCount) * Math.PI * 2 + 0.35;
  const radius = 5.5 + (ringIndex % 2) * 1.4 + Math.floor(ringIndex / 8) * 2.2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius - 0.6;
  const y = ((ringIndex % 3) - 1) * 1.4 + Math.sin(angle * 2) * 0.4;
  return [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))];
}

export function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}
