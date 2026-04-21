import * as THREE from "three";

// 草のテクスチャを生成
export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // ベースカラー（緑色のグラデーション背景）
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#4ade80");
  gradient.addColorStop(1, "#22c55e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // ノイズパターン
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 1 + Math.random() * 3;
    const alpha = 0.1 + Math.random() * 0.2;
    
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 2, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(34, 197, 94, ${alpha})` : `rgba(74, 222, 128, ${alpha})`;
    ctx.fill();
  }

  // 小さな草の束
  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 4 - 2, y + 3 + Math.random() * 4);
    ctx.strokeStyle = `rgba(21, 128, 61, ${0.1 + Math.random() * 0.2})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

// ラフ（長い草）のテクスチャを生成
export function createRoughTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // 濃い緑のベース
  ctx.fillStyle = "#65a30d";
  ctx.fillRect(0, 0, 512, 512);

  // ラフのノイズパターン
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 1.5, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(101, 163, 13, 0.3)" : "rgba(132, 204, 22, 0.2)";
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

// 砂テクスチャを生成
export function createSandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // ベージュのベース
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(0, 0, 512, 512);

  // 砂粒のノイズ
  for (let i = 0; i < 10000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    const alpha = 0.2 + Math.random() * 0.3;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(217, 119, 6, ${alpha})` : `rgba(180, 83, 9, ${alpha})`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// ウォーターのノーマルマップを生成
export function createWaterNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // 中間灰（ノーマルマップのベース）
  ctx.fillStyle = "rgb(128, 128, 255)";
  ctx.fillRect(0, 0, 256, 256);

  // 波紋パターン
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = 10 + Math.random() * 30;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(150, 150, 255, 0.3)");
    gradient.addColorStop(0.5, "rgba(128, 128, 255, 0.1)");
    gradient.addColorStop(1, "rgba(128, 128, 255, 0)");
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

// ボールのディンプルテクスチャを生成
export function createBallDimpleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // 白い背景
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);

  // ディンプル（小さな点）
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const size = 2 + Math.random() * 3;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// グリーンのテクスチャを生成
export function createGreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // 明るい緑のベース
  ctx.fillStyle = "#34d399";
  ctx.fillRect(0, 0, 512, 512);

  // ショートグラスのパターン
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 0.5 + Math.random() * 2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(16, 185, 129, 0.3)" : "rgba(52, 211, 153, 0.2)";
    ctx.fill();
  }

  // マウンドのパターン（中心に向かって濃く）
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, "rgba(16, 185, 129, 0.1)");
  gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.05)");
  gradient.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
