import './ConfirmationDialog.css';

interface ConfirmationDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title = '確認',
  message,
  confirmLabel = 'はい',
  cancelLabel = 'いいえ',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="confirmation-modal" role="dialog" aria-modal="true">
      <div className="confirmation-backdrop" onClick={onCancel} />
      <div className="confirmation-card">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirmation-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
