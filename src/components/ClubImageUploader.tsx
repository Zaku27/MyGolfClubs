import React, { useEffect, useRef, useState } from 'react';
import './ClubForm.css';

type ClubImageUploaderProps = {
  imageData: string[];
  onImageDataChange: (nextImages: string[]) => void;
  onError?: (message: string) => void;
};

type CropPosition = { x: number; y: number };

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('画像の読み込みに失敗しました'));
      }
    };
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
};

const createSourceCanvas = async (source: string, angle: number) => {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const normalizedRotation = ((angle % 360) + 360) % 360;
      const canvas = document.createElement('canvas');
      const shouldSwap = normalizedRotation === 90 || normalizedRotation === 270;
      canvas.width = shouldSwap ? img.naturalHeight : img.naturalWidth;
      canvas.height = shouldSwap ? img.naturalWidth : img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas コンテキストを取得できませんでした'));
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (normalizedRotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((normalizedRotation * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      } else {
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = source;
  });
};

const rotateImageDataUrl = async (source: string, angle: number) => {
  const rotatedCanvas = await createSourceCanvas(source, angle);
  return rotatedCanvas.toDataURL('image/jpeg', 0.9);
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
) => {
  const sourceWidth = source instanceof HTMLImageElement
    ? source.naturalWidth
    : source instanceof HTMLCanvasElement
    ? source.width
    : source instanceof HTMLVideoElement
    ? source.videoWidth
    : 0;
  const sourceHeight = source instanceof HTMLImageElement
    ? source.naturalHeight
    : source instanceof HTMLCanvasElement
    ? source.height
    : source instanceof HTMLVideoElement
    ? source.videoHeight
    : 0;

  const ratio = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * ratio;
  const drawHeight = sourceHeight * ratio;
  ctx.drawImage(
    source,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
};

const rotateCropPosition = (prevPosition: CropPosition, wrapperRect: DOMRect, cropSize: number, deltaDeg: number) => {
  const centerX = wrapperRect.width / 2;
  const centerY = wrapperRect.height / 2;
  const currentCenterX = prevPosition.x + cropSize / 2;
  const currentCenterY = prevPosition.y + cropSize / 2;
  const dx = currentCenterX - centerX;
  const dy = currentCenterY - centerY;
  const rad = (deltaDeg * Math.PI) / 180;
  const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
  const nextCenterX = centerX + rotatedX;
  const nextCenterY = centerY + rotatedY;
  const nextX = nextCenterX - cropSize / 2;
  const nextY = nextCenterY - cropSize / 2;

  return {
    x: Math.max(0, Math.min(nextX, wrapperRect.width - cropSize)),
    y: Math.max(0, Math.min(nextY, wrapperRect.height - cropSize)),
  };
};

const createCroppedImageDataUrl = async (
  source: string,
  cropRect: { x: number; y: number; size: number },
  cropRotation: number,
  previewCanvas: HTMLCanvasElement,
) => {
  const sourceCanvas = await createSourceCanvas(source, cropRotation);
  const outputSize = 800;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas コンテキストを取得できませんでした');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const previewWidth = previewCanvas.width;
  const previewHeight = previewCanvas.height;
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const ratio = Math.max(previewWidth / sourceWidth, previewHeight / sourceHeight);
  const drawWidth = sourceWidth * ratio;
  const drawHeight = sourceHeight * ratio;
  const offsetX = (previewWidth - drawWidth) / 2;
  const offsetY = (previewHeight - drawHeight) / 2;

  const sourceCropX = (cropRect.x - offsetX) / ratio;
  const sourceCropY = (cropRect.y - offsetY) / ratio;
  const sourceCropSize = cropRect.size / ratio;

  ctx.drawImage(
    sourceCanvas,
    sourceCropX,
    sourceCropY,
    sourceCropSize,
    sourceCropSize,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/jpeg', 0.9);
};

export function ClubImageUploader({ imageData, onImageDataChange, onError }: ClubImageUploaderProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [pendingCropIndex, setPendingCropIndex] = useState<number | null>(null);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropPosition, setCropPosition] = useState<CropPosition>({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(0);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState<CropPosition | null>(null);
  const cropPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropWrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const closeCropModal = () => {
    setCropModalOpen(false);
    setCropRotation(0);
    setPendingImageSrc(null);
    setPendingCropIndex(null);
  };

  const setErrorMessage = (message: string) => {
    onError?.(message);
  };

  const initializeCropArea = () => {
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const maxSize = Math.min(rect.width, rect.height);
    // Start with a reasonable default size (70% of the available space)
    const defaultSize = Math.max(200, Math.floor(maxSize * 0.7));
    setCropSize(defaultSize);
    // Center the crop area
    const x = Math.max(0, (rect.width - defaultSize) / 2);
    const y = Math.max(0, (rect.height - defaultSize) / 2);
    setCropPosition({ x, y });
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    try {
      const dataUrls = await Promise.all(files.map(readFileAsDataURL));
      if (dataUrls.length === 1) {
        setPendingImageSrc(dataUrls[0]);
        setPendingCropIndex(imageData.length);
        setCropRotation(0);
        setCropModalOpen(true);
      } else {
        const nextImages = [...imageData, ...dataUrls];
        setSelectedImageIndex(imageData.length);
        onImageDataChange(nextImages);
      }
      setErrorMessage('');
    } catch {
      setErrorMessage('画像を読み込めませんでした');
    }
  };

  const handleRemoveImage = (index: number) => {
    const nextImages = [...imageData];
    nextImages.splice(index, 1);
    setSelectedImageIndex((prevIndex) => {
      const newLength = nextImages.length;
      if (newLength === 0) {
        return 0;
      }
      if (prevIndex >= newLength) {
        return newLength - 1;
      }
      return prevIndex;
    });
    onImageDataChange(nextImages);
  };

  const moveSelectedImage = (direction: -1 | 1) => {
    const currentIndex = selectedImageIndex;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= imageData.length) {
      return;
    }
    const nextImages = [...imageData];
    [nextImages[currentIndex], nextImages[targetIndex]] = [nextImages[targetIndex], nextImages[currentIndex]];
    setSelectedImageIndex(targetIndex);
    onImageDataChange(nextImages);
  };

  const handleCropStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;

    setDragStart({ x: startX, y: startY });
    setIsDraggingCrop(true);
  };

  const rotateCropBy = (deltaDeg: number) => {
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      setCropRotation((prev) => ((prev + deltaDeg + 360) % 360));
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    setCropPosition((prevPos) => rotateCropPosition(prevPos, rect, cropSize, deltaDeg));
    setCropRotation((prev) => ((prev + deltaDeg + 360) % 360));
  };

  const handleCropMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !dragStart) {
      return;
    }

    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const moveX = event.clientX - rect.left;
    const moveY = event.clientY - rect.top;
    const deltaX = moveX - dragStart.x;
    const deltaY = moveY - dragStart.y;

    const nextX = Math.max(0, Math.min(cropPosition.x + deltaX, rect.width - cropSize));
    const nextY = Math.max(0, Math.min(cropPosition.y + deltaY, rect.height - cropSize));

    setCropPosition({ x: nextX, y: nextY });
    setDragStart({ x: moveX, y: moveY });
  };

  const handleCropEnd = () => {
    setIsDraggingCrop(false);
    setDragStart(null);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    setDragStart({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
    setIsDraggingCrop(true);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !dragStart) {
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }
    event.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const moveX = touch.clientX - rect.left;
    const moveY = touch.clientY - rect.top;
    const deltaX = moveX - dragStart.x;
    const deltaY = moveY - dragStart.y;
    const nextX = Math.max(0, Math.min(cropPosition.x + deltaX, rect.width - cropSize));
    const nextY = Math.max(0, Math.min(cropPosition.y + deltaY, rect.height - cropSize));
    setCropPosition({ x: nextX, y: nextY });
    setDragStart({ x: moveX, y: moveY });
  };

  const handleCropSizeChange = (value: number) => {
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const maxSize = Math.min(wrapper.clientWidth, wrapper.clientHeight);
    const nextSize = Math.max(50, Math.min(maxSize, value));
    setCropPosition((prev) => ({
      x: Math.min(prev.x, wrapper.clientWidth - nextSize),
      y: Math.min(prev.y, wrapper.clientHeight - nextSize),
    }));
    setCropSize(nextSize);
  };

  const drawCropPreviewCanvas = async (source: string) => {
    const canvas = cropPreviewCanvasRef.current;
    const wrapper = cropWrapperRef.current;
    if (!canvas || !wrapper) {
      return;
    }

    const sourceCanvas = await createSourceCanvas(source, cropRotation);
    const rect = wrapper.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    drawImageCover(ctx, sourceCanvas, width, height);
  };

  const handleConfirmCrop = async () => {
    const source = pendingImageSrc;
    if (!source || pendingCropIndex == null) {
      closeCropModal();
      return;
    }

    try {
      const canvas = cropPreviewCanvasRef.current;
      if (!canvas) {
        throw new Error('プレビューキャンバスが見つかりません');
      }
      const cropped = await createCroppedImageDataUrl(source, {
        x: cropPosition.x,
        y: cropPosition.y,
        size: cropSize,
      }, cropRotation, canvas);
      const nextImages = [...imageData];
      if (pendingCropIndex >= 0 && pendingCropIndex < nextImages.length) {
        nextImages[pendingCropIndex] = cropped;
      } else {
        nextImages.push(cropped);
      }
      onImageDataChange(nextImages);
      setSelectedImageIndex(pendingCropIndex);
      closeCropModal();
    } catch {
      setErrorMessage('画像のトリミングに失敗しました');
    }
  };

  const handleConfirmRotateOnly = async () => {
    const source = pendingImageSrc ?? imageData[selectedImageIndex];
    if (!source || pendingCropIndex == null) {
      closeCropModal();
      return;
    }

    try {
      const rotated = await rotateImageDataUrl(source, cropRotation);
      const nextImages = [...imageData];
      if (pendingCropIndex >= 0 && pendingCropIndex < nextImages.length) {
        nextImages[pendingCropIndex] = rotated;
      } else {
        nextImages.push(rotated);
      }
      onImageDataChange(nextImages);
      setSelectedImageIndex(pendingCropIndex);
      closeCropModal();
    } catch {
      setErrorMessage('画像の回転に失敗しました');
    }
  };

  useEffect(() => {
    if (!cropModalOpen) {
      return;
    }

    const source = pendingImageSrc ?? imageData[selectedImageIndex] ?? '';
    if (source) {
      void (async () => {
        await drawCropPreviewCanvas(source);
        initializeCropArea();
      })();
    } else {
      initializeCropArea();
    }
  }, [cropModalOpen, pendingImageSrc, selectedImageIndex]);

  useEffect(() => {
    if (!cropModalOpen) {
      return;
    }

    const source = pendingImageSrc ?? imageData[selectedImageIndex] ?? '';
    if (source) {
      void (async () => {
        await drawCropPreviewCanvas(source);
      })();
    }
  }, [cropRotation, cropModalOpen, pendingImageSrc, selectedImageIndex]);

  return (
    <div className="w-full bg-white rounded shadow p-4">
      <label className="club-image-upload-label">クラブ画像</label>
      <div className="club-image-upload">
        {imageData.length > 0 ? (
          <>
            <div className="club-image-preview">
              <img
                src={imageData[selectedImageIndex]}
                alt={`クラブ画像プレビュー ${selectedImageIndex + 1}`}
              />
            </div>
            {imageData.length > 1 && (
              <div className="club-image-thumbnails">
                {imageData.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`club-image-thumb ${index === selectedImageIndex ? 'active' : ''}`}
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`画像 ${index + 1}`}
                  >
                    <img src={src} alt={`サムネイル ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            className="club-image-placeholder"
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            クラブ画像を追加できます
          </div>
        )}
        <div className="club-image-actions">
          <label className="club-image-upload-button">
            画像を追加
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFileChange}
            />
          </label>
          <button
            type="button"
            className="btn-secondary btn-move-image"
            onClick={() => moveSelectedImage(-1)}
            disabled={selectedImageIndex <= 0}
          >
            前に移動
          </button>
          <button
            type="button"
            className="btn-secondary btn-move-image"
            onClick={() => moveSelectedImage(1)}
            disabled={selectedImageIndex >= imageData.length - 1}
          >
            後ろに移動
          </button>
          {imageData.length > 0 && (
            <button
              type="button"
              className="btn-secondary btn-remove-image"
              onClick={() => handleRemoveImage(selectedImageIndex)}
            >
              画像を削除
            </button>
          )}
        </div>
        <span className="form-help-text">画像は追加時にトリミングできます。正方形に切り抜かれます。</span>
      </div>

      {cropModalOpen && (
        <div className="club-image-crop-modal" role="dialog" aria-modal="true">
          <div className="club-image-crop-backdrop" onClick={closeCropModal} />
          <div className="club-image-crop-card">
            <div className="club-image-crop-header">
              <h3>画像をトリミング</h3>
              <button type="button" className="club-image-crop-close" onClick={closeCropModal}>
                ×
              </button>
            </div>
            <div className="club-image-crop-body">
              <div
                className="club-image-crop-frame"
                ref={cropWrapperRef}
                onMouseDown={handleCropStart}
                onMouseMove={handleCropMove}
                onMouseUp={handleCropEnd}
                onMouseLeave={handleCropEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleCropEnd}
              >
                <canvas ref={cropPreviewCanvasRef} className="club-image-crop-preview" />
                <div
                  className="club-image-crop-overlay"
                  style={{
                    left: `${cropPosition.x}px`,
                    top: `${cropPosition.y}px`,
                    width: `${cropSize}px`,
                    height: `${cropSize}px`,
                  }}
                >
                  <span className="club-image-crop-center" aria-hidden="true" />
                </div>
              </div>
              <div className="club-image-crop-hint">クロスがクラブの中心になるように合わせてください。</div>
              <div className="club-image-rotate-controls">
                <span>回転: {cropRotation}°</span>
                <button type="button" className="btn-secondary btn-rotate" onClick={() => rotateCropBy(270)}>
                  ⟲
                </button>
                <button type="button" className="btn-secondary btn-rotate" onClick={() => rotateCropBy(90)}>
                  ⟳
                </button>
              </div>
              <div className="club-image-crop-controls">
                <label htmlFor="cropSize">トリミングサイズ</label>
                <input
                  id="cropSize"
                  type="range"
                  min="50"
                  max="800"
                  value={cropSize}
                  onChange={(e) => handleCropSizeChange(parseInt(e.target.value, 10))}
                />
              </div>
            </div>
            <div className="club-image-crop-actions">
              <button type="button" className="btn-primary" onClick={handleConfirmCrop}>
                保存する
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleConfirmRotateOnly}
                disabled={cropRotation === 0}
              >
                回転のみ適用
              </button>
              <button type="button" className="btn-secondary" onClick={closeCropModal}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
