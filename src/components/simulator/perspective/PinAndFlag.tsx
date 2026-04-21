import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface PinAndFlagProps {
  x: number;
  y: number;
  scale: number;
}

export function PinAndFlag({ x, y, scale }: PinAndFlagProps) {
  const flagRef = useRef<THREE.Group>(null);

  // 旗のアニメーション（風による揺らぎ）
  useFrame(({ clock }) => {
    if (flagRef.current) {
      const time = clock.getElapsedTime();
      // 旗の揺らぎ
      flagRef.current.rotation.y = Math.sin(time * 2) * 0.1;
    }
  });

  // ピンの高さ（スケールに応じて調整）
  const pinHeight = 5 * scale;
  const flagSize = 1.5 * scale;

  return (
    <group position={[x, y, 0.05]}>
      {/* ホール（カップ） */}
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[0.6 * scale, 32]} />
        <meshStandardMaterial color={0x1f2937} roughness={0.8} />
      </mesh>

      {/* ホールの縁 */}
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[0.6 * scale, 0.8 * scale, 32]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.5} />
      </mesh>

      {/* ピンスティック */}
      <mesh position={[0, 0, pinHeight / 2]}>
        <cylinderGeometry args={[0.1 * scale, 0.1 * scale, pinHeight, 8]} />
        <meshStandardMaterial color={0x1f2937} roughness={0.6} metalness={0.2} />
      </mesh>

      {/* ピンのハイライト */}
      <mesh position={[-0.05 * scale, 0, pinHeight / 2]}>
        <cylinderGeometry args={[0.03 * scale, 0.03 * scale, pinHeight * 0.9, 8]} />
        <meshStandardMaterial color={0x4b5563} roughness={0.4} />
      </mesh>

      {/* 旗 */}
      <group ref={flagRef} position={[0, 0, pinHeight - 0.2 * scale]}>
        {/* ポールの頂点 */}
        <mesh>
          <sphereGeometry args={[0.15 * scale, 16, 16]} />
          <meshStandardMaterial color={0x1f2937} />
        </mesh>

        {/* 旗布 */}
        <mesh position={[flagSize * 0.75, 0, -flagSize * 0.25]}>
          <planeGeometry args={[flagSize * 1.5, flagSize, 8, 4]} />
          <meshStandardMaterial
            color={0xef4444}
            side={THREE.DoubleSide}
            roughness={0.8}
          />
        </mesh>

        {/* 旗のハイライト */}
        <mesh position={[flagSize * 0.75, 0.05 * scale, -flagSize * 0.25 + 0.01 * scale]}>
          <planeGeometry args={[flagSize, flagSize * 0.3, 8, 2]} />
          <meshStandardMaterial
            color={0xf87171}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
