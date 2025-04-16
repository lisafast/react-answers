import React, { useEffect, useState } from 'react';
import { GcdsContainer, GcdsButton, GcdsInput } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';
import AuthService from '../services/AuthService.js';
import { getAbsoluteApiUrl } from '../utils/apiToUrl.js';

const SettingsPage = () => {
  const { t } = useTranslations();
  const [settings, setSettings] = useState({ batchDuration: '', embeddingDuration: '', evalDuration: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AuthService.fetchWithAuth(getAbsoluteApiUrl('/api/settings'))
      .then(data => {
        setSettings({
          batchDuration: data.batchDuration || '',
          embeddingDuration: data.embeddingDuration || '',
          evalDuration: data.evalDuration || ''
        });
        setLoading(false);
      })
      .catch(() => {
        setError(t('settings.loadError', 'Failed to load settings.'));
        setLoading(false);
      });
  }, [t]);

  const handleChange = e => {
    // Only allow digits (or empty string)
    const { name, value } = e.target;
    if (value === '' || /^\d+$/.test(value)) {
      setSettings({ ...settings, [name]: value });
      setError('');
      setSuccess('');
    }
  };

  const validate = () => {
    for (const [key, value] of Object.entries(settings)) {
      const num = Number(value);
      if (!value || isNaN(num) || !Number.isInteger(num) || num <= 0) {
        setError(`${key} must be a positive integer.`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setError('');
    setSuccess('');
    try {
      await AuthService.fetchWithAuth(getAbsoluteApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchDuration: Number(settings.batchDuration),
          embeddingDuration: Number(settings.embeddingDuration),
          evalDuration: Number(settings.evalDuration)
        })
      });
      setSuccess(t('settings.saveSuccess', 'Settings saved successfully.'));
    } catch (err) {
      setError(t('settings.saveError', 'Failed to save settings.'));
    }
  };

  if (loading) return <div>{t('settings.loading', 'Loading...')}</div>;

  return (
    <GcdsContainer size="md" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('settings.title', 'System Settings')}</h1>
      <form onSubmit={handleSubmit}>
        <GcdsInput
          label={t('settings.batchDuration', 'Batch Duration (seconds)')}
          name="batchDuration"
          type="number"
          min="1"
          required
          value={settings.batchDuration}
          onGcdsChange={handleChange}
        />
        <GcdsInput
          label={t('settings.embeddingDuration', 'Embedding Duration (seconds)')}
          name="embeddingDuration"
          type="number"
          min="1"
          required
          value={settings.embeddingDuration}
          onGcdsChange={handleChange}
        />
        <GcdsInput
          label={t('settings.evalDuration', 'Eval Duration (seconds)')}
          name="evalDuration"
          type="number"
          min="1"
          required
          value={settings.evalDuration}
          onGcdsChange={handleChange}
        />
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginTop: 8 }}>{success}</div>}
        <GcdsButton type="submit" className="mt-400">
          {t('settings.save', 'Save Settings')}
        </GcdsButton>
      </form>
    </GcdsContainer>
  );
};

export default SettingsPage;
