import React from 'react';
import { GcdsContainer, GcdsNotice } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';

const OutagePage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('homepage.title', 'AI Answers')}</h1>
      <GcdsNotice type="warning" noticeTitleTag="h2" noticeTitle={t('outage.title', 'Service Unavailable')}>
        <p>{t('outage.message', 'This service is currently unavailable.')}</p>
      </GcdsNotice>
      <br/>
    </GcdsContainer>
  );
};

export default OutagePage;
