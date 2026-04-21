import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createSandTexture, createWaterNormalMap } from "../utils/proceduralTextures";
import type { HazardType } from "../../../types/game";

interface Hazard {
  type: HazardType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface HazardsProps {
  hazards: Hazard[];
}

export function Hazards({ hazards }: HazardsProps) {
  // プロシージャルテクスチャを生成
  const sandTexture = useMemo(() => createSandTexture(), []);
  const waterNormalMap = useMemo(() => createWaterNormalMap(), []);

  // ウォーターのアニメーション用
  const waterMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame(({ clock }) => {
    if (waterMaterialRef.current) {
      // 時間経過でノーマルマップを移動させて波紋を表現
      waterMaterialRef.current.normalMap!.offset.x = clock.getElapsedTime() * 0.05;
      waterMaterialRef.current.normalMap!.offset.y = clock.getElapsedTime() * 0.03;
    }
  });

  return (
    <group>
      {hazards.map((hazard, index) => {
        if (hazard.type === "water") {
          return (
            <WaterHazard
              key={`water-${index}`}
              hazard={hazard}
              normalMap={waterNormalMap}
              materialRef={index === 0 ? waterMaterialRef : undefined}
            />
          );
        } else if (hazard.type === "bunker") {
          return (
            <BunkerHazard
              key={`bunker-${index}`}
              hazard={hazard}
              texture={sandTexture}
            />
          );
        }
        return null;
      })}
    </group>
  );
}

interface WaterHazardProps {
  hazard: Hazard;
  normalMap: THREE.CanvasTexture;
  materialRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
}

function WaterHazard({ hazard, normalMap, materialRef }: WaterHazardProps) {
  const { x, y, width, height } = hazard;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // 楕円形のウォーター
    shape.ellipse(x, y, width / 2, height / 2, 0, Math.PI * 2, false, 0);
    return new THREE.ShapeGeometry(shape);
  }, [x, y, width, height]);

  return (
    <mesh geometry={geometry} position={[0, 0, 0.03]}>
      <meshStandardMaterial
        ref={materialRef}
        color={0x3b82f6}
        transparent
        opacity={0.85}
        roughness={0.1}
        metalness={0.3}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.5, 0.5)}
      />
    </mesh>
  );
}

interface BunkerHazardProps {
  hazard: Hazard;
  texture: THREE.CanvasTexture;
}

function BunkerHazard({ hazard, texture }: BunkerHazardProps) {
  const { x, y, width, height } = hazard;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // バンカーはやや不規則な形状
    shape.ellipse(x, y, width / 2, height / 2, 0, Math.PI * 2, false, 0);
    return new THREE.ShapeGeometry(shape);
  }, [x, y, width, height]);

  return (
    <mesh geometry={geometry} position={[0, 0, 0.04]}>
      <meshStandardMaterial
        map={texture}
        color={0xfbbf24}
        roughness={1.0}
        metalness={0.0}
      />
    </mesh>
  );
}
