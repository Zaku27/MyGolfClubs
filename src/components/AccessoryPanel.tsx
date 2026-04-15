import { useState, useRef } from 'react';
import type { AccessoryItem } from '../types/golf';
import './AccessoryPanel.css';

type AccessoryPanelProps = {
  accessories: AccessoryItem[];
  onAddAccessory: (accessory: Omit<AccessoryItem, 'id' | 'createdAt'>) => void;
  onUpdateAccessory: (accessory: AccessoryItem) => void;
  onDeleteAccessory: (id: string) => void;
};

type AccessoryFormState = {
  id: string | null;
  name: string;
  note: string;
  imageData: string;
};

const initialFormState: AccessoryFormState = {
  id: null,
  name: '',
  note: '',
  imageData: '',
};

export const AccessoryPanel = ({
  accessories,
  onAddAccessory,
  onUpdateAccessory,
  onDeleteAccessory,
}: AccessoryPanelProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState<AccessoryFormState>(initialFormState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAddDialog = () => {
    setFormState(initialFormState);
    setIsDialogOpen(true);
  };

  const openEditDialog = (accessory: AccessoryItem) => {
    setFormState({
      id: accessory.id,
      name: accessory.name,
      note: accessory.note ?? '',
      imageData: accessory.imageData ?? '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setFormState(initialFormState);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // ファイルが選択されなかった場合は既存の画像を保持
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setFormState((prev) => ({ ...prev, imageData: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      return;
    }

    if (formState.id) {
      const accessory = accessories.find((item) => item.id === formState.id);
      if (accessory) {
        onUpdateAccessory({
          ...accessory,
          name: trimmedName,
          note: formState.note.trim(),
          imageData: formState.imageData || undefined,
        });
      }
    } else {
      onAddAccessory({
        name: trimmedName,
        note: formState.note.trim(),
        imageData: formState.imageData || undefined,
      });
    }

    closeDialog();
  };

  return (
    <section className="accessory-panel" aria-label="アクセサリー">
      <div className="accessory-panel-content">
        <div className="accessory-badge-list">
          {accessories.map((accessory) => (
            <div key={accessory.id} className="accessory-item-row">
              <div className="accessory-item-image-group">
                <button
                  type="button"
                  className="accessory-item-image-button"
                  onClick={() => openEditDialog(accessory)}
                  aria-label={`編集 ${accessory.name}`}
                  title="編集"
                >
                  {accessory.imageData ? (
                    <img
                      src={accessory.imageData}
                      alt={accessory.name}
                      className="accessory-badge-image"
                    />
                  ) : (
                    <div className="accessory-badge-placeholder" aria-hidden="true" />
                  )}
                </button>
                <div className="accessory-item-actions">
                  <button
                    type="button"
                    className="btn-icon btn-edit"
                    onClick={() => openEditDialog(accessory)}
                    title="編集"
                    aria-label="編集"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="btn-icon btn-delete"
                    onClick={() => onDeleteAccessory(accessory.id)}
                    title="削除"
                    aria-label="削除"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="accessory-panel-actions">
          <button
            type="button"
            className="accessory-add-card accessory-add-button"
            onClick={openAddDialog}
            aria-label="新しいアイテムを追加"
          >
            <span className="accessory-add-label">アイテムを追加</span>
          </button>
        </div>
      </div>

      {isDialogOpen && (
        <div className="accessory-modal" role="dialog" aria-modal="true" aria-labelledby="accessory-dialog-title">
          <div className="accessory-modal-backdrop" onClick={closeDialog} />
          <div className="accessory-modal-card">
            <h3 id="accessory-dialog-title">{formState.id ? 'アイテムを編集' : 'アイテムを追加'}</h3>
            <form className="accessory-form" onSubmit={handleSubmit}>
              <label className="accessory-label">
                <span>名称</span>
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="例: TaylorMade TP5/TP5x STRIPE"
                />
              </label>

              <label className="accessory-label">
                <span>画像</span>
                <div className="accessory-image-upload-area">
                  {formState.imageData ? (
                    <div className="accessory-image-with-controls">
                      <img src={formState.imageData} alt="選択したアクセサリー" className="accessory-image-preview" />
                      <div className="accessory-image-controls">
                        <button
                          type="button"
                          className="accessory-change-image-btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          画像を変更
                        </button>
                        <button
                          type="button"
                          className="accessory-remove-image-btn"
                          onClick={() => setFormState((prev) => ({ ...prev, imageData: '' }))}
                        >
                          画像を削除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="accessory-upload-placeholder">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="accessory-file-input"
                      />
                      <div className="accessory-upload-content">
                        <div className="accessory-upload-icon">📷</div>
                        <span>画像を選択</span>
                      </div>
                    </div>
                  )}
                </div>
              </label>

              <label className="accessory-label">
                <span>メモ</span>
                <textarea
                  value={formState.note}
                  onChange={(event) => setFormState((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="例: 練習用ボール、雨天用など"
                  rows={4}
                />
              </label>

              <div className="accessory-dialog-actions">
                <button type="button" className="secondary" onClick={closeDialog}>
                  キャンセル
                </button>
                <button type="submit" className="primary">
                  {formState.id ? '保存' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};