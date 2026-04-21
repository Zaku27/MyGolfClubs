interface LightingProps {
  targetDistance: number; // グリーンまでの距離（シーン全体の明るさ調整用）
}

export function Lighting({ }: LightingProps) {
  // 太陽の位置（右上から照らす）
  const sunPosition: [number, number, number] = [50, 50, 30];

  return (
    <>
      {/* 環境光 - 全体の明るさを確保 */}
      <ambientLight intensity={0.6} color={0xffffff} />

      {/* 半球光 - 空と地面の反射光 */}
      <hemisphereLight
        args={[0x87ceeb, 0x228b22, 0.4]}
        position={[0, 50, 0]}
      />

      {/* 平行光（太陽）- 主光源、影を生成 */}
      <directionalLight
        position={sunPosition}
        intensity={1.2}
        color={0xfffff0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />

      {/* 補助光 - 影の部分を明るく */}
      <directionalLight
        position={[-30, 20, 20]}
        intensity={0.3}
        color={0xaaccff}
        castShadow={false}
      />
    </>
  );
}
