import { useMemo } from "react";
import * as THREE from "three";
import { createGrassTexture, createRoughTexture } from "../utils/proceduralTextures";

interface TerrainProps {
  fairwayPath: THREE.Vector2[]; // フェアウェイの輪郭（台形）
  targetDistance: number; // グリーンまでの距離
}

export function Terrain({ fairwayPath, targetDistance }: TerrainProps) {
  // プロシージャルテクスチャを生成（一度だけ）
  const grassTexture = useMemo(() => createGrassTexture(), []);
  const roughTexture = useMemo(() => createRoughTexture(), []);

  // フェアウェイのジオメトリを作成
  const fairwayGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    if (fairwayPath.length >= 4) {
      shape.moveTo(fairwayPath[0].x, fairwayPath[0].y);
      for (let i = 1; i < fairwayPath.length; i++) {
        shape.lineTo(fairwayPath[i].x, fairwayPath[i].y);
      }
      shape.closePath();
    }

    const geometry = new THREE.ShapeGeometry(shape);
    // UVマッピングを調整
    const uvAttribute = geometry.attributes.uv;
    const positionAttribute = geometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      // フェアウェイの範囲に応じてUVをスケーリング
      uvAttribute.setXY(i, x / 50, y / targetDistance);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [fairwayPath, targetDistance]);

  // ラフエリアのジオメトリ（フェアウェイの外側）
  const roughGeometry = useMemo(() => {
    // フェアウェイより広い領域を定義
    const shape = new THREE.Shape();
    const roughWidth = 80; // ラフの幅
    
    shape.moveTo(-roughWidth / 2, 0);
    shape.lineTo(roughWidth / 2, 0);
    shape.lineTo(roughWidth / 4, targetDistance);
    shape.lineTo(-roughWidth / 4, targetDistance);
    shape.closePath();

    // フェアウェイ部分を除外する穴を開ける
    if (fairwayPath.length >= 4) {
      const hole = new THREE.Path();
      hole.moveTo(fairwayPath[0].x, fairwayPath[0].y);
      for (let i = 1; i < fairwayPath.length; i++) {
        hole.lineTo(fairwayPath[i].x, fairwayPath[i].y);
      }
      hole.closePath();
      shape.holes.push(hole);
    }

    const geometry = new THREE.ShapeGeometry(shape);
    // UVマッピング
    const uvAttribute = geometry.attributes.uv;
    const positionAttribute = geometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      uvAttribute.setXY(i, (x + roughWidth / 2) / roughWidth, y / targetDistance);
    }
    return geometry;
  }, [fairwayPath, targetDistance]);

  // マテリアル
  const fairwayMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: grassTexture,
      color: 0x4ade80,
      roughness: 0.8,
      metalness: 0.0,
    });
  }, [grassTexture]);

  const roughMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: roughTexture,
      color: 0x65a30d,
      roughness: 1.0,
      metalness: 0.0,
    });
  }, [roughTexture]);

  return (
    <group>
      {/* フェアウェイ */}
      <mesh geometry={fairwayGeometry} material={fairwayMaterial} receiveShadow castShadow>
        <meshStandardMaterial
          map={grassTexture}
          color={0x4ade80}
          roughness={0.8}
          metalness={0.0}
        />
      </mesh>

      {/* ラフエリア */}
      <mesh geometry={roughGeometry} material={roughMaterial} receiveShadow position={[0, 0, 0.01]}>
        <meshStandardMaterial
          map={roughTexture}
          color={0x65a30d}
          roughness={1.0}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}
