import { useMemo } from "react";
import * as THREE from "three";
import { createBallDimpleTexture } from "../utils/proceduralTextures";
import type { LieType } from "../../../types/game";

interface BallProps {
  x: number;
  y: number;
  scale: number;
  lie: LieType;
}

const LIE_COLORS: Record<LieType, number> = {
  tee: 0x10b981,
  fairway: 0x22c55e,
  semirough: 0x84cc16,
  rough: 0x22c55e,
  bareground: 0xa8a29e,
  bunker: 0xfbbf24,
  green: 0x34d399,
};

export function Ball({ x, y, scale, lie }: BallProps) {
  // ボールのテクスチャを生成
  const dimpleTexture = useMemo(() => createBallDimpleTexture(), []);

  const ballRadius = 0.4 * scale;

  return (
    <group position={[x, y, ballRadius]}>
      {/* ボールの影 */}
      <mesh position={[0.3 * scale, -0.3 * scale, -ballRadius + 0.01]} scale={[2, 1.2, 1]}>
        <circleGeometry args={[ballRadius, 32]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.25} />
      </mesh>

      {/* ボール本体 */}
      <mesh castShadow>
        <sphereGeometry args={[ballRadius, 32, 32]} />
        <meshStandardMaterial
          color={0xffffff}
          map={dimpleTexture}
          roughness={0.3}
          metalness={0.0}
        />
      </mesh>

      {/* ボールのハイライト（立体感） */}
      <mesh position={[-0.15 * scale, 0.15 * scale, ballRadius * 0.3]}>
        <sphereGeometry args={[ballRadius * 0.3, 16, 16]} />
        <meshStandardMaterial
          color={0xffffff}
          transparent
          opacity={0.6}
          roughness={0.1}
        />
      </mesh>

      {/* ライの色インジケーター */}
      <mesh position={[0, 0, ballRadius + 0.02]}>
        <ringGeometry args={[ballRadius * 0.7, ballRadius * 1.1, 32]} />
        <meshStandardMaterial
          color={LIE_COLORS[lie]}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 内側のライインジケーター */}
      <mesh position={[0, 0, ballRadius + 0.03]}>
        <circleGeometry args={[ballRadius * 0.6, 32]} />
        <meshStandardMaterial
          color={LIE_COLORS[lie]}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}
