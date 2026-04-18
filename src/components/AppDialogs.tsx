import { ConfirmationDialog } from './ConfirmationDialog';
import { BagNameDialog } from './BagNameDialog';
import type { GolfBag } from '../types/golf';

export type AppDialogsProps = {
  error?: string | null;
  confirmDialog: ConfirmDialogState | null;
  onCloseConfirmDialog: () => void;
  onConfirmDialogConfirm: () => Promise<void>;
  showCreateBagDialog: boolean;
  showRenameBagDialog: boolean;
  renameBagDefaultName: string;
  renameBagDefaultImageData?: string;
  bags: GolfBag[];
  loading: boolean;
  onCreateBagConfirm: (bagName: string, imageData?: string) => Promise<void>;
  onCancelCreateBag: () => void;
  onRenameBagConfirm: (bagName: string, imageData?: string) => Promise<void>;
  onCancelRenameBag: () => void;
};

type ConfirmDialogState = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function AppDialogs({
  error,
  confirmDialog,
  onCloseConfirmDialog,
  onConfirmDialogConfirm,
  showCreateBagDialog,
  showRenameBagDialog,
  renameBagDefaultName,
  renameBagDefaultImageData,
  bags,
  loading,
  onCreateBagConfirm,
  onCancelCreateBag,
  onRenameBagConfirm,
  onCancelRenameBag,
}: AppDialogsProps) {
  return (
    <>
      {error && <div className="error-message">{error}</div>}

      <ConfirmationDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        cancelLabel={confirmDialog?.cancelLabel}
        onCancel={onCloseConfirmDialog}
        onConfirm={onConfirmDialogConfirm}
      />

      <BagNameDialog
        open={showCreateBagDialog}
        title="新しいバッグを追加"
        message="新しいゴルフバッグ名を入力してください。"
        defaultValue={`バッグ ${bags.length + 1}`}
        confirmLabel="追加する"
        cancelLabel="キャンセル"
        isSubmitting={loading}
        onCancel={onCancelCreateBag}
        onConfirm={onCreateBagConfirm}
      />

      <BagNameDialog
        open={showRenameBagDialog}
        title="バッグ名を変更"
        message="新しいバッグ名を入力してください。"
        defaultValue={renameBagDefaultName}
        defaultImageData={renameBagDefaultImageData}
        confirmLabel="保存する"
        cancelLabel="キャンセル"
        isSubmitting={loading}
        onCancel={onCancelRenameBag}
        onConfirm={onRenameBagConfirm}
      />
    </>
  );
}
