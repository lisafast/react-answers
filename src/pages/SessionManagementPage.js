import React, { useState, useEffect } from 'react';
import { useTranslations } from '../hooks/useTranslations.js';
import { GcdsContainer, GcdsInput } from '@cdssnc/gcds-components-react';
import DataStoreService from '../services/DataStoreService.js';

const SessionManagementPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [concurrentSessions, setConcurrentSessions] = useState(100);
  const [requestsPerMinute, setRequestsPerMinute] = useState(5);
  const [sessionDuration, setSessionDuration] = useState(5); // Default to 5 minutes
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const [cs, rpm, sd] = await Promise.all([
        DataStoreService.getSetting('concurrentSessions'),
        DataStoreService.getSetting('requestsPerMinute'),
        DataStoreService.getSetting('sessionDuration'),
      ]);
      if (cs !== null && cs !== undefined) setConcurrentSessions(Number(cs));
      if (rpm !== null && rpm !== undefined) setRequestsPerMinute(Number(rpm));
      if (sd !== null && sd !== undefined) setSessionDuration(Number(sd));
      setLoading(false);
    }
    fetchSettings();
  }, []);

  // Only allow positive integers and persist on change
  const handleConcurrentChange = (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    setConcurrentSessions(value);
  };
  const handleConcurrentBlur = async (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    await persistSetting('concurrentSessions', value);
  };
  const handleRequestsChange = (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    setRequestsPerMinute(value);
  };
  const handleRequestsBlur = async (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    await persistSetting('requestsPerMinute', value);
  };
  const handleSessionDurationChange = (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    setSessionDuration(value);
  };
  const handleSessionDurationBlur = async (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    await persistSetting('sessionDuration', value);
  };

  const persistSetting = async (key, value) => {
    try {
      await DataStoreService.setSetting(key, value);
    } catch (err) {
      // Optionally handle error (show message, etc)
      console.error('Failed to persist setting', key, value, err);
    }
  };

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('admin.sessionManagement.title', 'Session Management')}</h1>
      <form>
        <GcdsInput
          inputId="concurrent-sessions"
          label={t('admin.sessionManagement.concurrentSessions', 'Number Concurrent Sessions:')}
          type="number"
          min="1"
          step="1"
          value={concurrentSessions}
          onChange={handleConcurrentChange}
          onBlur={handleConcurrentBlur}
          style={{ maxWidth: 120 }}
          disabled={loading}
        />
        <GcdsInput
          inputId="requests-per-minute"
          label={t('admin.sessionManagement.requestsPerMinute', 'Requests per minute:')}
          type="number"
          min="1"
          step="1"
          value={requestsPerMinute}
          onChange={handleRequestsChange}
          onBlur={handleRequestsBlur}
          style={{ maxWidth: 120 }}
          disabled={loading}
        />
        <GcdsInput
          inputId="session-duration"
          label={t('admin.sessionManagement.sessionDuration', 'Session Duration (minutes):')}
          type="number"
          min="1"
          step="1"
          value={sessionDuration}
          onChange={handleSessionDurationChange}
          onBlur={handleSessionDurationBlur}
          style={{ maxWidth: 120 }}
          disabled={loading}
        />
        {/* Add a submit button if needed */}
        {/* <GcdsButton type="submit">{t('common.submit', 'Submit')}</GcdsButton> */}
      </form>
    </GcdsContainer>
  );
};

export default SessionManagementPage;
