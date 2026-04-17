import { useState, useRef } from 'react';
import type { AccessoryItem, Attachment } from '../types/golf';
import { ConfirmationDialog } from './ConfirmationDialog';
import { saveFileToDB, createObjectUrlFromDB, deleteFileFromDB } from '../utils/indexedDB';
import './AccessoryPanel.css';
import './SharedUI.css';

type AccessoryPanelProps = {
  accessories: AccessoryItem[];
  onAddAccessory: (accessory: Omit<AccessoryItem, 'id' | 'createdAt'>) => void;
  onUpdateAccessory: (accessory: AccessoryItem) => void;
  onDeleteAccessory: (id: string) => void;
  onShiftSelectedAccessoryLeft?: () => void;
  selectedAccessoryId: string | null;
  onAccessorySelect: (id: string | null) => void;
};

type AccessoryFormState = {
  id: string | null;
  name: string;
  note: string;
  imageData: string;
  attachments: Attachment[];
};

type AttachmentInputState = {
  type: 'file' | 'url';
  name: string;
  value: string;
};

const initialFormState: AccessoryFormState = {
  id: null,
  name: '',
  note: '',
  imageData: '',
  attachments: [],
};

const initialAttachmentInput: AttachmentInputState = {
  type: 'url',
  name: '',
  value: '',
};

export const AccessoryPanel = ({
  accessories,
  onAddAccessory,
  onUpdateAccessory,
  onDeleteAccessory,
  onShiftSelectedAccessoryLeft,
  selectedAccessoryId,
  onAccessorySelect,
}: AccessoryPanelProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState<AccessoryFormState>(initialFormState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accessoryToDelete, setAccessoryToDelete] = useState<string | null>(null);
  const [attachmentInput, setAttachmentInput] = useState<AttachmentInputState>(initialAttachmentInput);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);

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
      attachments: accessory.attachments ?? [],
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setFormState(initialFormState);
    setAttachmentInput(initialAttachmentInput);
    setShowAttachmentForm(false);
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
          attachments: formState.attachments.length > 0 ? formState.attachments : undefined,
        });
      }
    } else {
      onAddAccessory({
        name: trimmedName,
        note: formState.note.trim(),
        imageData: formState.imageData || undefined,
        attachments: formState.attachments.length > 0 ? formState.attachments : undefined,
      });
    }

    closeDialog();
  };

  const handleDeleteClick = (accessoryId: string) => {
    setAccessoryToDelete(accessoryId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (accessoryToDelete) {
      onDeleteAccessory(accessoryToDelete);
    }
    setDeleteConfirmOpen(false);
    setAccessoryToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setAccessoryToDelete(null);
  };

  const handleAddAttachment = () => {
    const trimmedName = attachmentInput.name.trim();
    const trimmedValue = attachmentInput.value.trim();
    if (!trimmedName || !trimmedValue) {
      return;
    }

    const newAttachment: Attachment = {
      type: attachmentInput.type,
      name: trimmedName,
      value: trimmedValue,
      createdAt: new Date().toISOString(),
    };

    setFormState((prev) => ({
      ...prev,
      attachments: [...prev.attachments, newAttachment],
    }));
    setAttachmentInput(initialAttachmentInput);
    setShowAttachmentForm(false);
  };

  const handleRemoveAttachment = async (index: number) => {
    const attachmentToRemove = formState.attachments[index];
    if (attachmentToRemove.type === 'file') {
      // ファイルタイプの場合はIndexedDBからも削除
      try {
        await deleteFileFromDB(attachmentToRemove.value);
      } catch (error) {
        console.error('ファイルの削除に失敗しました:', error);
      }
    }

    setFormState((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleAccessoryClick = (accessoryId: string) => {
    onAccessorySelect(accessoryId === selectedAccessoryId ? null : accessoryId);
  };

  const handleAttachmentClick = async (attachment: Attachment) => {
    if (attachment.type === 'url') {
      // URLはそのまま開く
      window.open(attachment.value, '_blank');
    } else {
      // ファイルはIndexedDBから読み込んで開く
      try {
        const objectUrl = await createObjectUrlFromDB(attachment.value);
        if (objectUrl) {
          window.open(objectUrl, '_blank');
        } else {
          alert('ファイルの読み込みに失敗しました');
        }
      } catch (error) {
        console.error('ファイルの読み込みに失敗しました:', error);
        alert('ファイルの読み込みに失敗しました');
      }
    }
  };

  const handleAttachmentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    // ファイル名を自動的に名称に設定
    const fileName = file.name;
    const fileId = `attachment-${Date.now()}`;

    try {
      // ファイルをIndexedDBに保存
      await saveFileToDB(fileId, file, file.type);
      
      setAttachmentInput((prev) => ({
        ...prev,
        name: fileName,
        value: fileId, // IndexedDBのIDとして保存
      }));
    } catch (error) {
      console.error('ファイルの保存に失敗しました:', error);
      // エラーの場合はファイル名のみ保存
      setAttachmentInput((prev) => ({
        ...prev,
        name: fileName,
        value: fileName,
      }));
    }

    // inputのvalueをクリアして同じファイルを再選択できるように
    if (event.target) {
      event.target.value = '';
    }
    // ファイル選択後にフォーカスを戻す
    setTimeout(() => {
      const form = document.querySelector('.accessory-form');
      if (form) {
        const firstInput = form.querySelector('input[type="text"]') as HTMLInputElement;
        if (firstInput) {
          firstInput.focus();
        }
      }
    }, 100);
  };

  const handleUrlChange = async (url: string) => {
    setAttachmentInput((prev) => ({ ...prev, value: url }));
    
    // URLが有効で、名称欄が空の場合のみタイトルを自動取得
    if (url && isValidUrl(url) && !attachmentInput.name.trim()) {
      setIsFetchingTitle(true);
      try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (data.data && data.data.title) {
          setAttachmentInput((prev) => ({ ...prev, name: data.data.title }));
        }
      } catch (error) {
        console.error('タイトルの取得に失敗しました:', error);
        // エラーの場合はURLを名称として使用
        setAttachmentInput((prev) => ({ ...prev, name: url }));
      } finally {
        setIsFetchingTitle(false);
      }
    }
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  return (
    <section className="accessory-panel" aria-label="アクセサリー">
      <div className="accessory-panel-content">
        <div className="accessory-badge-list">
          {accessories.map((accessory) => (
            <div key={accessory.id} className={`accessory-item-row ${selectedAccessoryId === accessory.id ? 'selected' : ''}`}>
              <div className="accessory-item-image-group">
                <button
                  type="button"
                  className="accessory-item-image-button"
                  onClick={() => handleAccessoryClick(accessory.id)}
                  aria-label={`${accessory.name}を選択`}
                  title={selectedAccessoryId === accessory.id ? '選択解除' : '選択'}
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
              </div>
            </div>
          ))}
        </div>

        <div className="accessory-panel-actions">
          <button
            type="button"
            className="btn-icon btn-add"
            onClick={openAddDialog}
            title="アイテムを追加"
            aria-label="新しいアイテムを追加"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          {selectedAccessoryId && (
            <>
              <button
                type="button"
                className="btn-icon btn-edit"
                onClick={() => {
                  const selectedAccessory = accessories.find((a) => a.id === selectedAccessoryId);
                  if (selectedAccessory) {
                    openEditDialog(selectedAccessory);
                  }
                }}
                title="編集"
                aria-label="編集"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              {onShiftSelectedAccessoryLeft && (
                <button
                  type="button"
                  className="btn-icon btn-shift"
                  onClick={onShiftSelectedAccessoryLeft}
                  disabled={accessories.findIndex((a) => a.id === selectedAccessoryId) <= 0}
                  title="左に移動"
                  aria-label="左に移動"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="btn-icon btn-delete"
                onClick={() => handleDeleteClick(selectedAccessoryId)}
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
            </>
          )}
        </div>

        {selectedAccessoryId && (() => {
          const selectedAccessory = accessories.find((a) => a.id === selectedAccessoryId);
          if (!selectedAccessory) return null;
          return (
            <div className="accessory-detail-panel">
              <h4 className="accessory-detail-title">{selectedAccessory.name}</h4>
              {selectedAccessory.note && (
                <div className="accessory-detail-note">
                  <strong>メモ:</strong> {selectedAccessory.note}
                </div>
              )}
              {selectedAccessory.attachments && selectedAccessory.attachments.length > 0 && (
                <div className="accessory-detail-attachments">
                  <div className="accessory-detail-attachments-list">
                    {selectedAccessory.attachments.map((attachment, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleAttachmentClick(attachment)}
                        className="accessory-detail-attachment-link"
                      >
                        <span className="attachment-icon">
                          {attachment.type === 'file' ? '📄' : '🔗'}
                        </span>
                        <span className="attachment-name">{attachment.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
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

              <div className="accessory-label">
                <div className="accessory-attachments-header">
                  <span>添付ファイル・リンク</span>
                  {!showAttachmentForm && (
                    <button
                      type="button"
                      className="accessory-add-attachment-btn"
                      onClick={() => setShowAttachmentForm(!showAttachmentForm)}
                    >
                      + 追加
                    </button>
                  )}
                </div>

                {formState.attachments.length > 0 && (
                  <div className="accessory-attachments-list">
                    {formState.attachments.map((attachment, index) => (
                      <div key={index} className="accessory-attachment-item">
                        <span className="accessory-attachment-icon">
                          {attachment.type === 'file' ? '📄' : '🔗'}
                        </span>
                        <span className="accessory-attachment-name">{attachment.name}</span>
                        <button
                          type="button"
                          className="accessory-attachment-remove"
                          onClick={() => handleRemoveAttachment(index)}
                          aria-label="削除"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showAttachmentForm && (
                  <div className="accessory-attachment-form">
                    <div className="accessory-attachment-type-selector">
                      <label>
                        <input
                          type="radio"
                          name="attachmentType"
                          value="url"
                          checked={attachmentInput.type === 'url'}
                          onChange={() => setAttachmentInput((prev) => ({ ...prev, type: 'url' }))}
                        />
                        <span>URL</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="attachmentType"
                          value="file"
                          checked={attachmentInput.type === 'file'}
                          onChange={() => setAttachmentInput((prev) => ({ ...prev, type: 'file' }))}
                        />
                        <span>ファイル</span>
                      </label>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="accessory-attachment-name-input"
                        placeholder={isFetchingTitle ? '取得中...' : '名称（ファイル選択時に自動設定）'}
                        value={attachmentInput.name}
                        onChange={(event) => setAttachmentInput((prev) => ({ ...prev, name: event.target.value }))}
                        disabled={isFetchingTitle}
                      />
                      {isFetchingTitle && (
                        <span style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '12px',
                          color: '#a8caba',
                        }}>
                          取得中...
                        </span>
                      )}
                    </div>
                    {attachmentInput.type === 'url' ? (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="accessory-attachment-value-input"
                          placeholder="https://..."
                          value={attachmentInput.value}
                          onChange={(event) => handleUrlChange(event.target.value)}
                          disabled={isFetchingTitle}
                        />
                        {isFetchingTitle && (
                          <span style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '12px',
                            color: '#a8caba',
                          }}>
                            取得中...
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="accessory-file-selector">
                        <button
                          type="button"
                          className="accessory-file-select-btn"
                          onClick={() => attachmentFileInputRef.current?.click()}
                        >
                          📁 ファイルを選択
                        </button>
                        {attachmentInput.value && (
                          <span className="accessory-selected-file-name">{attachmentInput.value}</span>
                        )}
                      </div>
                    )}
                    <div className="accessory-attachment-form-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowAttachmentForm(false);
                          setAttachmentInput(initialAttachmentInput);
                        }}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddAttachment();
                        }}
                      >
                        追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
      {/* Hidden file input for attachment - outside form */}
      <input
        ref={attachmentFileInputRef}
        type="file"
        onChange={handleAttachmentFileChange}
        style={{ display: 'none' }}
      />

      <ConfirmationDialog
        open={deleteConfirmOpen}
        title="削除の確認"
        message="このアイテムを削除してもよろしいですか？"
        confirmLabel="削除"
        cancelLabel="キャンセル"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </section>
  );
};