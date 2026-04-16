import { ConfirmationDialog } from './ConfirmationDialog';
import { BagNameDialog } from './BagNameDialog';
import type { GolfClub, GolfBag } from '../types/golf';

export type AppDialogsProps = {
  error?: string | null;
  showImagePropagationConfirm: boolean;
  pendingClubData: Omit<GolfClub, 'id'> | Partial<GolfClub> | null;
  onCancelImagePropagation: () => void;
  onConfirmPropagation: () => Promise<void>;
  confirmDialog: ConfirmDialogState | null;
  onCloseConfirmDialog: () => void;
  onConfirmDialogConfirm: () => Promise<void>;
  showCreateBagDialog: boolean;
  showRenameBagDialog: boolean;
  renameBagDefaultName: string;
  bags: GolfBag[];
  loading: boolean;
  onCreateBagConfirm: (bagName: string) => Promise<void>;
  onCancelCreateBag: () => void;
  onRenameBagConfirm: (bagName: string) => Promise<void>;
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
  showImagePropagationConfirm,
  pendingClubData,
  onCancelImagePropagation,
  onConfirmPropagation,
  confirmDialog,
  onCloseConfirmDialog,
  onConfirmDialogConfirm,
  showCreateBagDialog,
  showRenameBagDialog,
  renameBagDefaultName,
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

      {showImagePropagationConfirm && pendingClubData && (
        <div className="image-propagation-modal" role="dialog" aria-modal="true">
          <div
            className="image-propagation-backdrop"
            onClick={() => {
              onCancelImagePropagation();
            }}
          />
          <div className="image-propagation-card">
            <h3>同じクラブ名称の他のクラブにも画像を反映しますか？</h3>
            <p>
              同じクラブ名を持つ他のクラブにも、今回追加した画像を適用します。
              反映したくない場合は「いいえ」を選択してください。
            </p>
            <div className="image-propagation-actions">
              <button type="button" className="btn-secondary" onClick={() => void onConfirmPropagation()}>
                いいえ
              </button>
              <button type="button" className="btn-primary" onClick={() => void onConfirmPropagation()}>
                はい
              </button>
            </div>
          </div>
        </div>
      )}

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
        confirmLabel="保存する"
        cancelLabel="キャンセル"
        isSubmitting={loading}
        onCancel={onCancelRenameBag}
        onConfirm={onRenameBagConfirm}
      />
    </>
  );
}
