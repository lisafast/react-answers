import React, { useEffect, useState } from 'react';
import { GcdsContainer, GcdsButton, GcdsInput, GcdsSelect } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';
import AuthService from '../services/AuthService.js';
import { getAbsoluteApiUrl } from '../utils/apiToUrl.js';

const SettingsPage = () => {
  const { t } = useTranslations();
  const [settings, setSettings] = useState({
    batchDuration: '',
    embeddingDuration: '',
    evalDuration: '',
    rateLimiterType: 'memory',
    rateLimitPoints: '',
    rateLimitDuration: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AuthService.fetchWithAuth(getAbsoluteApiUrl('/api/settings'))
      .then(data => {
        setSettings({
          batchDuration: data.batchDuration || '',
          embeddingDuration: data.embeddingDuration || '',
          evalDuration: data.evalDuration || '',
          rateLimiterType: data.rateLimiterType || 'memory',
          rateLimitPoints: data.rateLimitPoints !== undefined ? String(data.rateLimitPoints) : '10',
          rateLimitDuration: data.rateLimitDuration !== undefined ? String(data.rateLimitDuration) : '60'
        });
        setLoading(false);
      })
      .catch(() => {
        setError(t('settings.loadError', 'Failed to load settings.'));
        setLoading(false);
      });
  }, [t]);

  const handleChange = e => {
    const { name, value } = e.target;
    // Only allow digits for numeric fields
    if (["batchDuration", "embeddingDuration", "evalDuration", "rateLimitPoints", "rateLimitDuration"].includes(name)) {
      if (value === '' || /^\d+$/.test(value)) {
        setSettings({ ...settings, [name]: value });
        setError('');
        setSuccess('');
      }
    } else {
      setSettings({ ...settings, [name]: value });
      setError('');
      setSuccess('');
    }
  };

  const validate = () => {
    for (const [key, value] of Object.entries(settings)) {
      if (["batchDuration", "embeddingDuration", "evalDuration", "rateLimitPoints", "rateLimitDuration"].includes(key)) {
        const num = Number(value);
        if (!value || isNaN(num) || !Number.isInteger(num) || num <= 0) {
          // Use a user-friendly label for the field
          let label = t(`settings.${key}`);
          // If the translation is missing, fall back to a default label
          if (label === `settings.${key}`) {
            switch (key) {
              case 'batchDuration': label = t('settings.batchDuration', 'Batch Duration'); break;
              case 'embeddingDuration': label = t('settings.embeddingDuration', 'Embedding Duration'); break;
              case 'evalDuration': label = t('settings.evalDuration', 'Eval Duration'); break;
              case 'rateLimitPoints': label = t('settings.rateLimitPoints', 'Rate Limit Points'); break;
              case 'rateLimitDuration': label = t('settings.rateLimitDuration', 'Rate Limit Duration'); break;
              default: label = key;
            }
          }
          setError(`${label}, ${t('settings.validation.positiveInteger')}`);
          return false;
        }
      }
    }
    if (!["memory", "mongodb"].includes(settings.rateLimiterType)) {
      setError(t('settings.validation.invalidRateLimiter'));
      return false;
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
          evalDuration: Number(settings.evalDuration),
          rateLimiterType: settings.rateLimiterType,
          rateLimitPoints: Number(settings.rateLimitPoints),
          rateLimitDuration: Number(settings.rateLimitDuration)
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
        <GcdsSelect
          label={t('settings.rateLimiterType', 'Rate Limiter Type')}
          name="rateLimiterType"
          value={settings.rateLimiterType}
          onGcdsChange={handleChange}
          required
        >
          <option value="memory">Memory</option>
          <option value="mongodb">MongoDB</option>
        </GcdsSelect>
        <GcdsInput
          label={t('settings.rateLimitPoints', 'Rate Limit Points (requests per window)')}
          name="rateLimitPoints"
          type="number"
          min="1"
          required
          value={settings.rateLimitPoints}
          onGcdsChange={handleChange}
        />
        <GcdsInput
          label={t('settings.rateLimitDuration', 'Rate Limit Window (seconds)')}
          name="rateLimitDuration"
          type="number"
          min="1"
          required
          value={settings.rateLimitDuration}
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
