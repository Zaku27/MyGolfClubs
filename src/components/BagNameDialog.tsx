import { useEffect, useRef, useState } from 'react';
import './BagNameDialog.css';

interface BagNameDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  defaultValue: string;
  defaultImageData?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (bagName: string, imageData?: string) => void | Promise<void>;
}

export function BagNameDialog({
  open,
  title = '新しいバッグを追加',
  message = 'バッグ名を入力してください。あとから変更できます。',
  defaultValue,
  defaultImageData,
  confirmLabel = '追加する',
  cancelLabel = 'キャンセル',
  isSubmitting = false,
  onCancel,
  onConfirm,
}: BagNameDialogProps) {
  const [bagName, setBagName] = useState(defaultValue);
  const [imageData, setImageData] = useState(defaultImageData ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setBagName(defaultValue);
    setImageData(defaultImageData ?? '');
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [defaultValue, defaultImageData, open]);

  if (!open) {
    return null;
  }

  const trimmedName = bagName.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedName || isSubmitting) {
      return;
    }
    await onConfirm(trimmedName, imageData || undefined);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setImageData(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bag-name-modal" role="dialog" aria-modal="true" aria-labelledby="bag-name-dialog-title">
      <div className="bag-name-backdrop" onClick={onCancel} />
      <form className="bag-name-card" onSubmit={(event) => void handleSubmit(event)}>
        <h3 id="bag-name-dialog-title">{title}</h3>
        <p>{message}</p>
        <label className="bag-name-input-label" htmlFor="bag-name-input">
          バッグ名
        </label>
        <input
          id="bag-name-input"
          ref={inputRef}
          type="text"
          value={bagName}
          onChange={(event) => setBagName(event.target.value)}
          maxLength={40}
          placeholder="例: メインバッグ"
          className="bag-name-input"
        />

        <label className="bag-name-input-label">
          画像
        </label>
        <div className="bag-image-upload-area">
          {imageData ? (
            <div className="bag-image-with-controls">
              <img src={imageData} alt="バッグ画像" className="bag-image-preview" />
              <div className="bag-image-controls">
                <button
                  type="button"
                  className="bag-change-image-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  画像を変更
                </button>
                <button
                  type="button"
                  className="bag-remove-image-btn"
                  onClick={() => setImageData('')}
                >
                  画像を削除
                </button>
              </div>
            </div>
          ) : (
            <div className="bag-upload-placeholder">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="bag-file-input"
              />
              <div className="bag-upload-content">
                <div className="bag-upload-icon">📷</div>
                <span>画像を選択</span>
              </div>
            </div>
          )}
        </div>
        <div className="bag-name-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </button>
          <button type="submit" className="btn-primary" disabled={!trimmedName || isSubmitting}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
