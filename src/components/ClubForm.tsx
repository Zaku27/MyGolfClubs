import React, { useEffect, useRef, useState } from 'react';
import type { GolfClub, ClubCategory } from '../types/golf';
import {
  buildClubDefaults,
  buildClubDefaultsByTypeAndNumber,
  CLUB_NUMBER_DEFAULT,
  CLUB_NUMBER_OPTIONS,
  CLUB_TYPE_OPTIONS,
  inferNumberPreset,
  normalizeClubNumberForPreset,
  normalizeSwingWeightInput,
} from '../utils/clubFormUtils';
import './ClubForm.css';

interface ClubFormProps {
  club?: GolfClub;
  onSubmit: (club: Omit<GolfClub, 'id'> | Partial<GolfClub>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type ClubFormData = Omit<GolfClub, 'id' | 'clubType' | 'lengthStandard' | 'lengthAdjustment' | 'lieStandard' | 'lieAdjustment'> & {
  clubType: ClubCategory | '';
  lengthStandard: number;
  lengthAdjustment: number;
  lieStandard: number;
  lieAdjustment: number;
  imageData: string[];
};

const EMPTY_FORM_DATA: ClubFormData = {
  clubType: '',
  name: '',
  number: '',
  length: 0,
  lengthStandard: 0,
  lengthAdjustment: 0,
  lieStandard: 0,
  lieAdjustment: 0,
  weight: 0,
  swingWeight: '',
  lieAngle: 0,
  loftAngle: 0,
  bounceAngle: undefined,
  shaftType: '',
  torque: 0,
  flex: 'S',
  distance: 0,
  notes: '',
  imageData: [],
};

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

const normalizeImageData = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }
  return [];
};

const toFormData = (source?: GolfClub): ClubFormData => {
  if (!source) {
    return { ...EMPTY_FORM_DATA };
  }

  const derivedStandard = source.lengthStandard ?? source.length;
  const derivedAdjustment = source.lengthAdjustment ?? (source.length - derivedStandard);
  const derivedLieStandard = source.lieStandard ?? source.lieAngle;
  const derivedLieAdjustment = source.lieAdjustment ?? (source.lieAngle - derivedLieStandard);

  return {
    clubType: source.clubType,
    name: source.name,
    number: source.number,
    length: source.length,
    lengthStandard: derivedStandard,
    lengthAdjustment: derivedAdjustment,
    lieStandard: derivedLieStandard,
    lieAdjustment: derivedLieAdjustment,
    weight: source.weight,
    swingWeight: source.swingWeight,
    lieAngle: source.lieAngle,
    loftAngle: source.loftAngle,
    bounceAngle: source.clubType === 'Wedge' ? source.bounceAngle : undefined,
    shaftType: source.shaftType,
    torque: source.torque,
    flex: source.flex,
    distance: source.distance,
    notes: source.notes,
    imageData: normalizeImageData(source.imageData),
  };
};

export const ClubForm: React.FC<ClubFormProps> = ({
  club,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [numberPreset, setNumberPreset] = useState<string>(() => (
    club ? inferNumberPreset(club.clubType, club.number) : 'Custom'
  ));
  const [formData, setFormData] = useState<ClubFormData>(() => toFormData(club));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLengthBreakdown, setShowLengthBreakdown] = useState<boolean>(() =>
    club !== undefined && (club.lengthStandard != null || club.lengthAdjustment != null)
  );
  const [showLieBreakdown, setShowLieBreakdown] = useState<boolean>(() =>
    club !== undefined && (club.lieStandard != null || club.lieAdjustment != null)
  );
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [pendingCropIndex, setPendingCropIndex] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(0);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const cropPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropWrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleLengthBreakdown = () => {
    setShowLengthBreakdown((prev) => {
      if (!prev) {
        // 内訳を開く: 現在の長さを標準長さに初期値として設定
        setFormData((fd) => {
          if (fd.lengthStandard === 0 && fd.lengthAdjustment === 0 && fd.length > 0) {
            return { ...fd, lengthStandard: fd.length, lengthAdjustment: 0 };
          }
          return fd;
        });
      }
      return !prev;
    });
  };

  const toggleLieBreakdown = () => {
    setShowLieBreakdown((prev) => {
      if (!prev) {
        setFormData((fd) => {
          if (fd.lieStandard === 0 && fd.lieAdjustment === 0 && fd.lieAngle > 0) {
            return { ...fd, lieStandard: fd.lieAngle, lieAdjustment: 0 };
          }
          return fd;
        });
      }
      return !prev;
    });
  };

  const applyClubTypeChange = (clubType: ClubCategory) => {
    const nextNumber = CLUB_NUMBER_DEFAULT[clubType];
    if (club) {
      setFormData((prev) => ({
        ...prev,
        clubType,
        number: nextNumber,
        bounceAngle: clubType === 'Wedge' ? prev.bounceAngle : undefined,
        swingWeight: clubType === 'Putter' ? '' : prev.swingWeight,
      }));
    } else {
      const defaults = buildClubDefaults(clubType);
      setFormData((prev) => ({
        ...defaults,
        lengthStandard: defaults.length,
        lengthAdjustment: 0,
        lieStandard: defaults.lieAngle,
        lieAdjustment: 0,
        name: prev.name,
        swingWeight: clubType === 'Putter' ? '' : defaults.swingWeight,
        imageData: prev.imageData,
      }));
    }
    setNumberPreset(clubType === 'Putter' ? 'Putter' : inferNumberPreset(clubType, nextNumber));
    setErrors((prev) => ({ ...prev, clubType: '', number: '' }));
  };

  const clearClubTypeSelection = () => {
    setFormData((prev) => ({
      ...prev,
      clubType: '',
      number: '',
      bounceAngle: undefined,
    }));
    setNumberPreset('Custom');
    setErrors((prev) => ({ ...prev, clubType: '', number: '' }));
  };

  const initializeCropArea = () => {
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    setCropSize(size);
    setCropPosition({
      x: 0,
      y: 0,
    });
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // 同じファイルを再選択できるようリセット
    if (files.length === 0) {
      return;
    }

    try {
      const dataUrls = await Promise.all(files.map(readFileAsDataURL));
      if (dataUrls.length === 1) {
        setPendingImageSrc(dataUrls[0]);
        setPendingCropIndex(formData.imageData.length);
        setCropRotation(0);
        setCropModalOpen(true);
      } else {
        setFormData((prev) => {
          const nextImages = [...prev.imageData, ...dataUrls];
          setSelectedImageIndex(prev.imageData.length);
          return {
            ...prev,
            imageData: nextImages,
          };
        });
      }
      setErrors((prev) => ({ ...prev, imageData: '' }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, imageData: '画像を読み込めませんでした' }));
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => {
      const nextImages = [...prev.imageData];
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
      return {
        ...prev,
        imageData: nextImages,
      };
    });
  };

  const moveSelectedImage = (direction: -1 | 1) => {
    setFormData((prev) => {
      const currentIndex = selectedImageIndex;
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= prev.imageData.length) {
        return prev;
      }
      const nextImages = [...prev.imageData];
      [nextImages[currentIndex], nextImages[targetIndex]] = [nextImages[targetIndex], nextImages[currentIndex]];
      setSelectedImageIndex(targetIndex);
      return {
        ...prev,
        imageData: nextImages,
      };
    });
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

  const rotateCropPosition = (prevPosition: { x: number; y: number }, wrapperRect: DOMRect, deltaDeg: number) => {
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

  const rotateCropBy = (deltaDeg: number) => {
    const wrapper = cropWrapperRef.current;
    if (!wrapper) {
      setCropRotation((prev) => ((prev + deltaDeg + 360) % 360));
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    setCropPosition((prevPos) => rotateCropPosition(prevPos, rect, deltaDeg));
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
    const nextSize = Math.max(80, Math.min(maxSize, value));
    setCropPosition((prev) => ({
      x: Math.min(prev.x, wrapper.clientWidth - nextSize),
      y: Math.min(prev.y, wrapper.clientHeight - nextSize),
    }));
    setCropSize(nextSize);
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
          reject(new Error('Canvas コンテキストを取得できませんでした')); return;
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

  const createCroppedImageDataUrl = async (_source: string, cropRect: { x: number; y: number; size: number }) => {
    const sourceCanvas = await createSourceCanvas(_source, cropRotation);
    const previewCanvas = cropPreviewCanvasRef.current;
    if (!previewCanvas) {
      throw new Error('プレビューキャンバスが見つかりません');
    }

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

  const closeCropModal = () => {
    setCropModalOpen(false);
    setCropRotation(0);
    setPendingImageSrc(null);
    setPendingCropIndex(null);
  };

  const handleConfirmCrop = async () => {
    const source = pendingImageSrc;
    if (!source || pendingCropIndex == null) {
      closeCropModal();
      return;
    }

    try {
      const cropped = await createCroppedImageDataUrl(source, {
        x: cropPosition.x,
        y: cropPosition.y,
        size: cropSize,
      });
      setFormData((prev) => {
        const nextImages = [...prev.imageData];
        if (pendingCropIndex >= 0 && pendingCropIndex < nextImages.length) {
          nextImages[pendingCropIndex] = cropped;
        } else {
          nextImages.push(cropped);
        }
        return {
          ...prev,
          imageData: nextImages,
        };
      });
      setSelectedImageIndex(pendingCropIndex);
      closeCropModal();
    } catch {
      setErrors((prev) => ({ ...prev, imageData: '画像のトリミングに失敗しました' }));
    }
  };

  const handleConfirmRotateOnly = async () => {
    const source = pendingImageSrc ?? formData.imageData[selectedImageIndex];
    if (!source || pendingCropIndex == null) {
      closeCropModal();
      return;
    }

    try {
      const rotated = await rotateImageDataUrl(source, cropRotation);
      setFormData((prev) => {
        const nextImages = [...prev.imageData];
        if (pendingCropIndex >= 0 && pendingCropIndex < nextImages.length) {
          nextImages[pendingCropIndex] = rotated;
        } else {
          nextImages.push(rotated);
        }
        return {
          ...prev,
          imageData: nextImages,
        };
      });
      setSelectedImageIndex(pendingCropIndex);
      closeCropModal();
    } catch {
      setErrors((prev) => ({ ...prev, imageData: '画像の回転に失敗しました' }));
    }
  };

  // モーダルを開いたとき・画像ソース変更時: 描画完了後に枠位置を初期化
  useEffect(() => {
    if (!cropModalOpen) {
      return;
    }

    const source = pendingImageSrc ?? formData.imageData[selectedImageIndex] ?? '';
    if (source) {
      void (async () => {
        await drawCropPreviewCanvas(source);
        initializeCropArea();
      })();
    } else {
      initializeCropArea();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropModalOpen, pendingImageSrc, selectedImageIndex]);

  // 回転時: 枠位置はリセットせず再描画のみ
  useEffect(() => {
    if (!cropModalOpen) {
      return;
    }

    const source = pendingImageSrc ?? formData.imageData[selectedImageIndex] ?? '';
    if (source) {
      void (async () => {
        await drawCropPreviewCanvas(source);
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropRotation]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: '' }));

    setFormData((prev) => {
      if (name === 'lengthStandard' || name === 'lengthAdjustment') {
        const val = parseFloat(value) || 0;
        const std = name === 'lengthStandard' ? val : prev.lengthStandard;
        const adj = name === 'lengthAdjustment' ? val : prev.lengthAdjustment;
        return { ...prev, [name]: val, length: std + adj };
      }
      if (name === 'lieStandard' || name === 'lieAdjustment') {
        const val = parseFloat(value) || 0;
        const std = name === 'lieStandard' ? val : prev.lieStandard;
        const adj = name === 'lieAdjustment' ? val : prev.lieAdjustment;
        return { ...prev, [name]: val, lieAngle: std + adj };
      }
      if (name === 'torque') {
        return { ...prev, [name]: parseFloat(value) || 0 };
      }
      if (name === 'distance') {
        return { ...prev, [name]: parseInt(value) || 0 };
      }
      if (name === 'flex') {
        return { ...prev, [name]: value as GolfClub['flex'] };
      }
      if (name === 'clubType') {
        return prev;
      }
      if (name.includes('Angle') || name === 'length' || name === 'weight') {
        return { ...prev, [name]: parseFloat(value) || 0 };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleNumberTextChange = (value: string) => {
    setFormData((prev) => ({ ...prev, number: value }));
    setErrors((prev) => ({ ...prev, number: '' }));
  };

  const handleNumberPresetChange = (value: string) => {
    setNumberPreset(value);
    if (value !== 'Custom') {
      setFormData((prev) => {
        if (!prev.clubType) {
          return { ...prev, number: value };
        }

        if (club) {
          return { ...prev, number: value };
        }

        const defaults = buildClubDefaultsByTypeAndNumber(prev.clubType, value);
        return {
          ...defaults,
          lengthStandard: defaults.length,
          lengthAdjustment: 0,
          lieStandard: defaults.lieAngle,
          lieAdjustment: 0,
          clubType: prev.clubType,
          name: prev.name,
          number: value,
          imageData: prev.imageData,
        };
      });
    } else {
      setFormData((prev) => {
        if (prev.clubType === 'Wedge') {
          return { ...prev, number: '' };
        }
        return prev;
      });
    }
    setErrors((prev) => ({ ...prev, number: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.clubType) {
      newErrors.clubType = 'クラブの種類を選択してください';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'クラブ名を入力してください';
    }
    if (!formData.number.trim()) {
      newErrors.number = 'クラブ番号を入力してください';
    }
    if (!formData.loftAngle) {
      newErrors.loftAngle = 'ロフト角を入力してください';
    } else {
      const times10 = Math.round(formData.loftAngle * 10);
      if (Math.abs(times10 / 10 - formData.loftAngle) > 0.001) {
        newErrors.loftAngle = '0.1刻みで入力してください（例: 10.5, 11.0）';
      } else if (formData.loftAngle < 0 || formData.loftAngle > 60) {
        newErrors.loftAngle = '0°〜60°の範囲で入力してください';
      }
    }
    if (formData.clubType && formData.clubType !== 'Putter') {
      const swingWeight = formData.swingWeight.trim();
      if (swingWeight) {
        const normalizedSwingWeight = normalizeSwingWeightInput(swingWeight);
        if (!/^[A-F][0-9](?:\.[0-9])?$/.test(normalizedSwingWeight)) {
          newErrors.swingWeight = 'バランスは A0〜F9.9 形式で入力してください（例: C9, D0, D1.1, E1）';
        }
      }
    }
    if (formData.clubType === 'Wedge' && formData.bounceAngle != null) {
      const times10 = Math.round(formData.bounceAngle * 10);
      if (Math.abs(times10 / 10 - formData.bounceAngle) > 0.001) {
        newErrors.bounceAngle = '0.1刻みで入力してください（例: 8.0, 10.5）';
      } else if (formData.bounceAngle < 0 || formData.bounceAngle > 20) {
        newErrors.bounceAngle = '0°〜20°の範囲で入力してください';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const selectedClubType = formData.clubType as ClubCategory;
      onSubmit({
        ...formData,
        clubType: selectedClubType,
        number: normalizeClubNumberForPreset(selectedClubType, formData.number),
        bounceAngle: selectedClubType === 'Wedge' ? formData.bounceAngle : undefined,
        swingWeight: selectedClubType === 'Putter' ? '' : formData.swingWeight.trim(),
        torque: selectedClubType === 'Putter' ? 0 : formData.torque,
      });
    }
  };

  const renderClubNumberField = () => {
    if (!formData.clubType) {
      return null;
    }

    if (formData.clubType === 'Putter') {
      return null;
    }

    if (formData.clubType === 'Driver') {
      return (
        <div className="form-group">
          <label htmlFor="driverNumber">クラブ番号 *</label>
          <select
            id="driverNumber"
            value={formData.number || CLUB_NUMBER_DEFAULT.Driver}
            onChange={(e) => handleNumberPresetChange(e.target.value)}
            required
            className={errors.number ? 'error' : ''}
          >
            {(CLUB_NUMBER_OPTIONS.Driver ?? []).map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
          {errors.number && <span className="error-message">{errors.number}</span>}
        </div>
      );
    }

    const suggestions = CLUB_NUMBER_OPTIONS[formData.clubType] ?? [];

    return (
      <div className="form-group">
        <label htmlFor="number">
          クラブ番号 *
          {formData.clubType === 'Wedge' && (
            <span className="field-help-wrap wedge-help-trigger" aria-label="Pingウェッジ表記のヒント">
              <span className="wedge-help-icon" aria-hidden="true">?</span>
              <span className="field-help-panel wedge-help-panel" role="note">
                Pingのクラブ表記では、WはGW、UはAW、SはSWの目安です。
              </span>
            </span>
          )}
        </label>
        <div className="club-number-stack">
          <select
            id="numberSuggestion"
            value={numberPreset}
            onChange={(e) => handleNumberPresetChange(e.target.value)}
          >
            {suggestions.map((num) => {
              const label = formData.clubType === 'Iron' && num === '1'
                ? '1 (Rare 1I)'
                : formData.clubType === 'Iron' && num === '2'
                ? '2 (Rare 2I)'
                : num;
              return (
                <option key={num} value={num}>
                  {label}
                </option>
              );
            })}
            <option value="Custom">Custom (free text)</option>
          </select>
          {numberPreset === 'Custom' && (
            <input
              type="text"
              id="number"
              name="number"
              value={formData.number}
              onChange={(e) => handleNumberTextChange(e.target.value)}
              placeholder={formData.clubType === 'Wedge' ? '例: 52, 58' : '例: 7, PW, 3W, 4H'}
              required
              className={errors.number ? 'error' : ''}
            />
          )}
        </div>
        {errors.number && <span className="error-message">{errors.number}</span>}
      </div>
    );
  };

  return (
    <form className="club-form" onSubmit={handleSubmit}>
      <h2>{club ? 'クラブ編集' : 'クラブ追加'}</h2>

      {/* Section 1: Basic Information */}
      <div className="form-section">
        <h3 className="form-section-title">基本情報</h3>
        
        {/* Club Type */}
        <div className="form-group">
          <label htmlFor="clubType">クラブの種類 *</label>
          <div className="club-type-select-wrap">
            <select
              id="clubType"
              name="clubType"
              value={formData.clubType}
              onChange={(e) => {
                const selected = e.target.value;
                if (!selected) {
                  clearClubTypeSelection();
                  return;
                }
                applyClubTypeChange(selected as ClubCategory);
              }}
              required
              className={errors.clubType ? 'error' : ''}
            >
              <option value="">種類を選択してください</option>
              {CLUB_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.clubType && (
            <span className="error-message">{errors.clubType}</span>
          )}
          {!formData.clubType && !errors.clubType && (
            <span className="form-help-text">種類を選択すると、クラブ名以外の項目にデフォルト値を読み込みます。</span>
          )}
        </div>
        
        {/* Club Name */}
        <div className="form-group">
          <label htmlFor="name">クラブ名 *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="例: Ping G430、Titleist T150"
            required
            className={errors.name ? 'error' : ''}
          />
          {errors.name && (
            <span className="error-message">{errors.name}</span>
          )}
        </div>

        <div className="form-group">
          <label>クラブ画像</label>
          <div className="club-image-upload">
            {formData.imageData.length > 0 ? (
              <>
                <div className="club-image-preview">
                  <img
                    src={formData.imageData[selectedImageIndex]}
                    alt={`クラブ画像プレビュー ${selectedImageIndex + 1}`}
                  />
                </div>
                {formData.imageData.length > 1 && (
                  <div className="club-image-thumbnails">
                    {formData.imageData.map((src, index) => (
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
                クラブ画像をアップロードできます
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
                className="btn-secondary"
                onClick={() => {
                  if (formData.imageData.length > 0) {
                    setPendingImageSrc(formData.imageData[selectedImageIndex]);
                    setPendingCropIndex(selectedImageIndex);
                    setCropRotation(0);
                    setCropModalOpen(true);
                  }
                }}
                disabled={formData.imageData.length === 0}
              >
                編集/トリミング
              </button>
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
                disabled={selectedImageIndex >= formData.imageData.length - 1}
              >
                後ろに移動
              </button>
              {formData.imageData.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary btn-remove-image"
                  onClick={() => handleRemoveImage(selectedImageIndex)}
                >
                  画像を削除
                </button>
              )}
            </div>
            <span className="form-help-text">アップロード後にトリミングできます。正方形に切り抜かれます。</span>
            {errors.imageData && (
              <span className="error-message">{errors.imageData}</span>
            )}
          </div>
        </div>

        {/* Club Number */}
        {renderClubNumberField()}
      </div>

      {/* Section 2: Specifications */}
      <div className="form-section">
        <h3 className="form-section-title">スペック</h3>
        
        {/* Loft Row (alone) */}
        <div className="form-group">
          <label htmlFor="loftAngle">ロフト角(度数) *</label>
          <input
            type="number"
            id="loftAngle"
            name="loftAngle"
            value={formData.loftAngle || ''}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="60"
            required
            className={errors.loftAngle ? 'error' : ''}
          />
          {errors.loftAngle && (
            <span className="error-message">{errors.loftAngle}</span>
          )}
        </div>

        {formData.clubType === 'Wedge' && (
          <div className="form-group">
            <label htmlFor="bounceAngle">バウンス角(度数)</label>
            <input
              type="number"
              id="bounceAngle"
              name="bounceAngle"
              value={formData.bounceAngle ?? ''}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="20"
              className={errors.bounceAngle ? 'error' : ''}
            />
            {errors.bounceAngle && (
              <span className="error-message">{errors.bounceAngle}</span>
            )}
          </div>
        )}

        {/* Length field with optional breakdown */}
        <div className="form-group">
          <label htmlFor="length">
            長さ(インチ)
            <button
              type="button"
              className="length-breakdown-toggle"
              onClick={toggleLengthBreakdown}
            >
              {showLengthBreakdown ? '▲ 内訳を隠す' : '▼ 内訳を入力'}
            </button>
          </label>
          {showLengthBreakdown ? (
            <div className="length-breakdown-inputs">
              <div className="length-breakdown-field">
                <span className="length-breakdown-label">標準長さ(カタログ)</span>
                <input
                  type="number"
                  name="lengthStandard"
                  value={formData.lengthStandard || ''}
                  onChange={handleChange}
                  step="0.25"
                  min="0"
                  placeholder="例: 44.0"
                />
              </div>
              <span className="length-op">+</span>
              <div className="length-breakdown-field">
                <span className="length-breakdown-label">調整</span>
                <input
                  type="number"
                  name="lengthAdjustment"
                  value={formData.lengthAdjustment || ''}
                  onChange={handleChange}
                  step="0.25"
                  placeholder="例: 0.5"
                />
              </div>
              <span className="length-op">=</span>
              <div className="length-total">
                <span className="length-total-label">合計</span>
                <div className="length-total-value">{formData.length || 0}</div>
              </div>
              <span className="form-help-text length-breakdown-note">標準長さに対する調整値を入力すると、合計が長さとして保存されます。</span>
            </div>
          ) : (
            <input
              type="number"
              id="length"
              name="length"
              value={formData.length || ''}
              onChange={handleChange}
              step="0.25"
              className={errors.length ? 'error' : ''}
            />
          )}
          {errors.length && <span className="error-message">{errors.length}</span>}
        </div>

        {/* Lie angle field with optional breakdown */}
        <div className="form-group">
          <label htmlFor="lieAngle">
            ライ角(度数)
            <button
              type="button"
              className="lie-breakdown-toggle"
              onClick={toggleLieBreakdown}
            >
              {showLieBreakdown ? '▲ 内訳を隠す' : '▼ 内訳を入力'}
            </button>
          </label>
          {showLieBreakdown ? (
            <div className="lie-breakdown-inputs">
              <div className="lie-breakdown-field">
                <span className="lie-breakdown-label">標準ライ角(カタログ)</span>
                <input
                  type="number"
                  name="lieStandard"
                  value={formData.lieStandard || ''}
                  onChange={handleChange}
                  step="0.5"
                  min="0"
                  placeholder="例: 62.0"
                />
              </div>
              <span className="lie-op">+</span>
              <div className="lie-breakdown-field">
                <span className="lie-breakdown-label">調整</span>
                <input
                  type="number"
                  name="lieAdjustment"
                  value={formData.lieAdjustment || ''}
                  onChange={handleChange}
                  step="0.5"
                  placeholder="例: 1.0"
                />
              </div>
              <span className="lie-op">=</span>
              <div className="lie-total">
                <span className="lie-total-label">合計</span>
                <div className="lie-total-value">{formData.lieAngle || 0}</div>
              </div>
              <span className="form-help-text lie-breakdown-note">標準ライ角に対する調整値を入力すると、合計がライ角として保存されます。</span>
            </div>
          ) : (
            <input
              type="number"
              id="lieAngle"
              name="lieAngle"
              value={formData.lieAngle || ''}
              onChange={handleChange}
              step="0.5"
            />
          )}
        </div>

        {/* Weight, Swing Weight Row */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="weight">重さ(グラム)</label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight || ''}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="999"
            />
          </div>
          {formData.clubType !== 'Putter' && (
            <div className="form-group">
              <label htmlFor="swingWeight">バランス</label>
              <input
                type="text"
                id="swingWeight"
                name="swingWeight"
                value={formData.swingWeight}
                onChange={handleChange}
                placeholder="例: C9, D0.5, E1"
                className={errors.swingWeight ? 'error' : ''}
              />
              {errors.swingWeight && <span className="error-message">{errors.swingWeight}</span>}
            </div>
          )}
        </div>

      {/* Shaft, Torque, Flex Row */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="shaftType">シャフト名</label>
          <input
            type="text"
            id="shaftType"
            name="shaftType"
            value={formData.shaftType}
            onChange={handleChange}
            placeholder="例: VENTUS TR"
          />
        </div>
        <div className="form-group">
          <label htmlFor="flex">フレックス</label>
          <select
            id="flex"
            name="flex"
            value={formData.flex}
            onChange={handleChange}
          >
            <option value="S">S</option>
            <option value="SR">SR</option>
            <option value="R">R</option>
            <option value="A">A</option>
            <option value="L">L</option>
          </select>
        </div>
        {formData.clubType !== 'Putter' && (
          <div className="form-group">
            <label htmlFor="torque">トルク</label>
            <input
              type="number"
              id="torque"
              name="torque"
              value={formData.torque || ''}
              onChange={handleChange}
              step="0.1"
              min="0"
            />
          </div>
        )}
      </div>

      </div>

      <div className="form-section">
        <h3 className="form-section-title">追加情報</h3>
        <p className="form-section-description">飛距離やノートなど、プレー時の記録をまとめます。</p>

        <div className="form-group">
          <label htmlFor="distance">飛距離</label>
          <input
            type="number"
            id="distance"
            name="distance"
            value={formData.distance || ''}
            onChange={handleChange}
            min="0"
          />
        </div>

        {/* Notes */}
        <div className="form-group">
          <label htmlFor="notes">ノート</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="このクラブについての簡単なメモを入力できます。"
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? '保存中...' : club ? 'クラブ更新' : 'クラブ追加'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          キャンセル
        </button>
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
                <canvas
                  ref={cropPreviewCanvasRef}
                  className="club-image-crop-preview"
                />
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
              <div className="club-image-crop-hint">
                クロスがクラブの中心になるように合わせてください。
              </div>
              <div className="club-image-rotate-controls">
                <span>回転: {cropRotation}°</span>
                <button
                  type="button"
                  className="btn-secondary btn-rotate"
                  onClick={() => rotateCropBy(270)}
                >
                  ⟲
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-rotate"
                  onClick={() => rotateCropBy(90)}
                >
                  ⟳
                </button>
              </div>
              <div className="club-image-crop-controls">
                <label htmlFor="cropSize">トリミングサイズ</label>
                <input
                  id="cropSize"
                  type="range"
                  min="80"
                  max="500"
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
    </form>
  );
};
