import React from 'react';
import { GcdsContainer } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';

const OutagePage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('outage.title', 'Service Unavailable')}</h1>
      <p>{t('outage.message', 'This service is currently unavailable.')}</p>
    </GcdsContainer>
  );
};

export default OutagePage;
