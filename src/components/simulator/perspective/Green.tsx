import { useMemo } from "react";
import * as THREE from "three";
import { createGreenTexture } from "../utils/proceduralTextures";

interface GreenProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function Green({ x, y, width, height }: GreenProps) {
  // グリーンのテクスチャを生成
  const greenTexture = useMemo(() => createGreenTexture(), []);

  // グリーンのジオメトリ（楕円形）
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    
    // 楕円形を描画
    const centerX = x;
    const centerY = y;
    const radiusX = width / 2;
    const radiusY = height / 2;
    
    shape.ellipse(centerX, centerY, radiusX, radiusY, 0, Math.PI * 2, false, 0);
    
    const geometry = new THREE.ShapeGeometry(shape);
    
    // UVマッピング
    const uvAttribute = geometry.attributes.uv;
    const posAttribute = geometry.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
      const px = posAttribute.getX(i);
      const py = posAttribute.getY(i);
      // グリーンのローカル座標に変換してUVを計算
      const localX = (px - centerX) / radiusX;
      const localY = (py - centerY) / radiusY;
      uvAttribute.setXY(i, localX * 0.5 + 0.5, localY * 0.5 + 0.5);
    }
    
    return geometry;
  }, [x, y, width, height]);

  // フリンジ（グリーンの縁）のジオメトリ
  const fringeGeometry = useMemo(() => {
    const outerShape = new THREE.Shape();
    const innerShape = new THREE.Path();
    
    const centerX = x;
    const centerY = y;
    const outerRadiusX = width / 2 + 1.5;
    const outerRadiusY = height / 2 + 0.8;
    const innerRadiusX = width / 2;
    const innerRadiusY = height / 2;
    
    outerShape.ellipse(centerX, centerY, outerRadiusX, outerRadiusY, 0, Math.PI * 2, false, 0);
    innerShape.ellipse(centerX, centerY, innerRadiusX, innerRadiusY, 0, Math.PI * 2, false, 0);
    outerShape.holes.push(innerShape);
    
    return new THREE.ShapeGeometry(outerShape);
  }, [x, y, width, height]);

  return (
    <group position={[0, 0, 0.02]}>
      {/* フリンジ */}
      <mesh geometry={fringeGeometry} receiveShadow castShadow>
        <meshStandardMaterial
          color={0x065f46}
          roughness={ 0.9}
          metalness={0.0}
        />
      </mesh>

      {/* グリーン本体 */}
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          map={greenTexture}
          color={0x34d399}
          roughness={0.4}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}
