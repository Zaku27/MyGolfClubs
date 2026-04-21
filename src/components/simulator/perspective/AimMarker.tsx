import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface AimMarkerProps {
  x: number;
  y: number;
  scale: number;
}

export function AimMarker({ x, y, scale }: AimMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 脈動アニメーション
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.1;
      groupRef.current.scale.setScalar(pulse);
    }
  });

  const size = 3 * scale;
  const thickness = 0.15 * scale;

  return (
    <group ref={groupRef} position={[x, y, 0.1]}>
      {/* 外側リング */}
      <mesh position={[0, 0, 0]}>
        <ringGeometry args={[size * 0.9, size, 32]} />
        <meshStandardMaterial
          color={0xef4444}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 十字マーカー - 横線 */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[size * 1.6, thickness]} />
        <meshStandardMaterial
          color={0xef4444}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* 十字マーカー - 縦線 */}
      <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[size * 1.6, thickness]} />
        <meshStandardMaterial
          color={0xef4444}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* 中心ドット */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[size * 0.2, 16]} />
        <meshStandardMaterial color={0xef4444} />
      </mesh>

      {/* インナーリング（破線風） */}
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[size * 0.55, size * 0.6, 32, 1, 0, Math.PI * 1.5]} />
        <meshStandardMaterial
          color={0xf87171}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
