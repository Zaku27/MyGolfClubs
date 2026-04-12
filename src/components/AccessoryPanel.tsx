import { useState } from 'react';
import type { AccessoryItem } from '../types/golf';
import './AccessoryPanel.css';

type AccessoryPanelProps = {
  accessories: AccessoryItem[];
  onAddAccessory: (accessory: Omit<AccessoryItem, 'id' | 'createdAt'>) => void;
  onUpdateAccessory: (accessory: AccessoryItem) => void;
  onDeleteAccessory: (id: string) => void;
};

export const AccessoryPanel = ({
  accessories,
  onAddAccessory,
  onUpdateAccessory,
  onDeleteAccessory,
}: AccessoryPanelProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [imageData, setImageData] = useState('');

  const resetForm = () => {
    setEditingAccessoryId(null);
    setName('');
    setMemo('');
    setImageData('');
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (accessory: AccessoryItem) => {
    setEditingAccessoryId(accessory.id);
    setName(accessory.name);
    setMemo(accessory.note ?? '');
    setImageData(accessory.imageData ?? '');
    setIsDialogOpen(true);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageData('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (id: string) => {
    onDeleteAccessory(id);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    if (editingAccessoryId) {
      const existingAccessory = accessories.find((item) => item.id === editingAccessoryId);
      if (existingAccessory) {
        onUpdateAccessory({
          ...existingAccessory,
          name: trimmedName,
          note: memo.trim(),
          imageData: imageData || undefined,
        });
      }
    } else {
      onAddAccessory({
        name: trimmedName,
        note: memo.trim(),
        imageData: imageData || undefined,
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
                    onClick={() => handleDelete(accessory.id)}
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
            ))}

            <button
              type="button"
              className="accessory-add-card"
              onClick={openAddDialog}
              aria-label="新しいアクセサリーを追加"
            >
              <span className="accessory-add-icon">+</span>
              <span className="accessory-add-label">アイテムを追加</span>
            </button>
        </div>
      </div>

      {isDialogOpen && (
        <div className="accessory-modal" role="dialog" aria-modal="true" aria-labelledby="accessory-dialog-title">
          <div className="accessory-modal-backdrop" onClick={closeDialog} />
          <div className="accessory-modal-card">
            <h3 id="accessory-dialog-title">
              {editingAccessoryId ? 'アクセサリーを編集' : 'アクセサリーを追加'}
            </h3>
            <form className="accessory-form" onSubmit={handleSubmit}>
              <label className="accessory-label">
                <span>名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例: ボール"
                />
              </label>

              <label className="accessory-label">
                <span>画像</span>
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>

              {imageData ? (
                <div className="accessory-image-preview-wrapper">
                  <img src={imageData} alt="選択したアクセサリー" className="accessory-image-preview" />
                </div>
              ) : null}

              <label className="accessory-label">
                <span>メモ</span>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="例: 練習用ボール、雨天用など"
                  rows={4}
                />
              </label>

              <div className="accessory-dialog-actions">
                <button type="button" className="secondary" onClick={closeDialog}>
                  キャンセル
                </button>
                <button type="submit" className="primary">
                  {editingAccessoryId ? '保存' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};