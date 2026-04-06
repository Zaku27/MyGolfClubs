import { useEffect, useRef, useState } from 'react';
import './BagNameDialog.css';

interface BagNameDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  defaultValue: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (bagName: string) => void | Promise<void>;
}

export function BagNameDialog({
  open,
  title = '新しいバッグを追加',
  message = 'バッグ名を入力してください。あとから変更できます。',
  defaultValue,
  confirmLabel = '追加する',
  cancelLabel = 'キャンセル',
  isSubmitting = false,
  onCancel,
  onConfirm,
}: BagNameDialogProps) {
  const [bagName, setBagName] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setBagName(defaultValue);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [defaultValue, open]);

  if (!open) {
    return null;
  }

  const trimmedName = bagName.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedName || isSubmitting) {
      return;
    }
    await onConfirm(trimmedName);
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
