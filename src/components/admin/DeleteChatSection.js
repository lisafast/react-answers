import React, { useState } from 'react';
import { useTranslations } from '../../hooks/useTranslations.js';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import DataStoreService from '../../services/DataStoreService.js';

const DeleteChatSection = () => {
  const { t } = useTranslations();
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleInputChange = (event) => {
    const value = event?.target?.value || '';
    setChatId(value);
  };

  const handleInitialDelete = (e) => {
    e.preventDefault();
    if (!chatId.trim()) return;
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!chatId.trim()) return;

    setLoading(true);
    try {
      await DataStoreService.deleteChat(chatId);
      alert(t('admin.deleteChat.success', 'Chat deleted successfully'));
      setChatId('');
      setShowConfirm(false);
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert(t('admin.deleteChat.error', 'Failed to delete chat: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="mt-400 mb-400">{t('admin.deleteChat.title', 'Delete Chat')}</h2>
      <div className="flex gap-400">
        <input
          type="text"
          id="chatId"
          className="form-control"
          value={chatId}
          onChange={handleInputChange}
          placeholder={t('admin.deleteChat.idLabel', 'Chat ID')}
          disabled={loading}
          required
        />
        {!showConfirm ? (
          <GcdsButton 
            onClick={handleInitialDelete}
            variant="danger"
            disabled={loading || !chatId.trim()}
            className="me-400 hydrated mrgn-tp-1r"
          >
            {loading 
              ? t('admin.deleteChat.loading', 'Deleting...') 
              : t('admin.deleteChat.button', 'Delete Chat')}
          </GcdsButton>
        ) : (
          <div className="flex gap-400">
            <GcdsButton 
              onClick={handleConfirmDelete}
              variant="danger"
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              {loading 
                ? t('admin.deleteChat.loading', 'Deleting...') 
                : t('admin.deleteChat.confirm', 'Confirm Delete')}
            </GcdsButton>
            <GcdsButton 
              onClick={handleCancel}
              variant="secondary"
              disabled={loading}
              className="hydrated mrgn-tp-1r"
            >
              {t('admin.deleteChat.cancel', 'Cancel')}
            </GcdsButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteChatSection;