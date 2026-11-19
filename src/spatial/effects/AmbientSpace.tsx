import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

interface AmbientSpaceProps {
  showParticles: boolean;
  lowQuality?: boolean;
}

export function AmbientSpace({ showParticles, lowQuality = false }: AmbientSpaceProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const elapsedRef = useRef(0);
  const particleCount = lowQuality ? 90 : 180;

  const { particles, dummy } = useMemo(() => {
    const list = Array.from({ length: particleCount }, (_, i) => {
      // Deterministic pseudo-random distribution for consistent atmospheric feel
      const seed = (i + 1) * 12.9898;
      const rand = (offset: number) => {
        const x = Math.sin(seed + offset * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      return {
        x: (rand(1) - 0.5) * 44,
        y: (rand(2) - 0.5) * 24,
        z: (rand(3) - 0.5) * 44,
        speed: 0.12 + rand(4) * 0.28,
        phase: rand(5) * Math.PI * 2,
        scale: 0.02 + rand(6) * 0.045,
      };
    });
    return { particles: list, dummy: new THREE.Object3D() };
  }, [particleCount]);

  useFrame((_, delta) => {
    if (!showParticles || !meshRef.current) return;
    elapsedRef.current += Math.min(delta, 0.05);
    const t = elapsedRef.current;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.phase) * 0.35,
        p.y + Math.cos(t * p.speed * 0.8 + p.phase) * 0.35,
        p.z
      );
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <color attach="background" args={['#06070a']} />
      <fogExp2 attach="fog" args={['#06070a', 0.022]} />

      {/* Soft atmospheric studio lighting */}
      <ambientLight intensity={0.55} color="#cbd5f5" />
      <directionalLight position={[10, 14, 12]} intensity={0.95} color="#e0e7ff" />
      <pointLight position={[-10, 4, -8]} intensity={0.7} color="#6366f1" distance={34} />
      <pointLight position={[8, -5, 6]} intensity={0.45} color="#38bdf8" distance={28} />

      {/* Subtle distant starfield */}
      <Stars
        radius={55}
        depth={35}
        count={lowQuality ? 900 : 2000}
        factor={2.4}
        saturation={0.15}
        fade
        speed={0.4}
      />

      {/* Instanced ambient space particles */}
      {showParticles && (
        <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.38} depthWrite={false} />
        </instancedMesh>
      )}

      {/* Subtle orbital depth rings below the universe */}
      <group position={[0, -4.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[4.5, 8.5, 13.5].map((radius) => (
          <mesh key={radius}>
            <ringGeometry args={[radius - 0.015, radius + 0.015, 96]} />
            <meshBasicMaterial
              color="#334155"
              transparent
              opacity={0.22}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
