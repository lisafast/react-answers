import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations.js';
import { GcdsContainer, GcdsInput } from '@cdssnc/gcds-components-react';

const SessionManagementPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [concurrentSessions, setConcurrentSessions] = useState(1);
  const [requestsPerMinute, setRequestsPerMinute] = useState(1);

  // Only allow positive integers
  const handleConcurrentChange = (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    setConcurrentSessions(value);
  };
  const handleRequestsChange = (e) => {
    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
    setRequestsPerMinute(value);
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
          style={{ maxWidth: 120 }}
        />
        
        <GcdsInput
          inputId="requests-per-minute"
          label={t('admin.sessionManagement.requestsPerMinute', 'Requests per minute:')}
          type="number"
          min="1"
          step="1"
          value={requestsPerMinute}
          onChange={handleRequestsChange}
          style={{ maxWidth: 120 }}
        />
        
        {/* Add a submit button if needed */}
        {/* <GcdsButton type="submit">{t('common.submit', 'Submit')}</GcdsButton> */}
      </form>
    </GcdsContainer>
  );
};

export default SessionManagementPage;
