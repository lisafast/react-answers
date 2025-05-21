import React, { useEffect, useState } from 'react';
import { GcdsContainer } from '@cdssnc/gcds-components-react';
import DataStoreService from '../services/DataStoreService.js';
import { useTranslations } from '../hooks/useTranslations.js';
import { usePageContext } from '../hooks/usePageParam.js';

const SettingsPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const { language } = usePageContext();
  const [status, setStatus] = useState('available');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      const current = await DataStoreService.getSiteStatus();
      setStatus(current);
    }
    loadStatus();
  }, []);

  const handleChange = async (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSaving(true);
    try {
      await DataStoreService.setSiteStatus(newStatus);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('settings.title', 'Settings')}</h1>
      <nav className="mb-400">
        <a href={`/${language}/admin`}>{t('common.backToAdmin', 'Back to Admin')}</a>
      </nav>
      <label htmlFor="site-status" className="mb-200 display-block">
        {t('settings.statusLabel', 'Service status')}
      </label>
      <select id="site-status" value={status} onChange={handleChange} disabled={saving}>
        <option value="available">{t('settings.statuses.available', 'Available')}</option>
        <option value="unavailable">{t('settings.statuses.unavailable', 'Unavailable')}</option>
      </select>
    </GcdsContainer>
  );
};

export default SettingsPage;
