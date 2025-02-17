import React, { useState } from 'react';
import { GcdsContainer, GcdsText } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';
import { getApiUrl } from '../utils/apiToUrl.js';

const EvalPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [selectedDuration, setSelectedDuration] = useState('7days');
  const [goldenFile, setGoldenFile] = useState(null);
  const [brownFile, setBrownFile] = useState(null);

  const handleGoldenFileChange = (event) => {
    setGoldenFile(event.target.files[0]);
  };

  const handleBrownFileChange = (event) => {
    setBrownFile(event.target.files[0]);
  };

  const handleDurationChange = (event) => {
    setSelectedDuration(event.target.value);
  };

  const handleStartScoring = async () => {
    // (!goldenFile || !brownFile) {
    //  alert('Please upload both golden and brown answer files');
    //  return;
    //}

    const formData = new FormData();
    formData.append('goldenFile', goldenFile);
    formData.append('brownFile', brownFile);
    formData.append('duration', selectedDuration);

    try {
      const response = await fetch(getApiUrl('evaluation-start'), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to start evaluation');
      }

      const result = await response.json();
      console.log('Evaluation started:', result);
      // TODO: Add success message UI
    } catch (error) {
      console.error('Error starting evaluation:', error);
      // TODO: Add error message UI
    }
  };

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className='mb-400'>{t('evaluation.title')}</h1>

      <section className="mb-600">
        <GcdsText className="mb-400">
          {t('evaluation.intro')}
        </GcdsText>

        <div className="evaluation-description mb-400">
          <p>
            {t('evaluation.description')}
          </p>
        </div>

        <div className="file-upload-section mb-400">
          <div className="upload-group mb-400">
            <label htmlFor="golden-answers" className="upload-label">
              {t('evaluation.upload.goldenAnswers')}
              <input
                type="file"
                id="golden-answers"
                accept=".csv,.xlsx"
                onChange={handleGoldenFileChange}
                className="file-input"
              />
            </label>
            {goldenFile && <p className="file-name">{t('evaluation.upload.selectedFile', { name: goldenFile.name })}</p>}
          </div>

          <div className="upload-group mb-400">
            <label htmlFor="brown-answers" className="upload-label">
              {t('evaluation.upload.brownAnswers')}
              <input
                type="file"
                id="brown-answers"
                accept=".csv,.xlsx"
                onChange={handleBrownFileChange}
                className="file-input"
              />
            </label>
            {brownFile && <p className="file-name">{t('evaluation.upload.selectedFile', { name: brownFile.name })}</p>}
          </div>
        </div>

        <div className="duration-selection mb-400">
          <label htmlFor="duration" className="duration-label">
            {t('evaluation.upload.duration.label')}
            <select
              id="duration"
              value={selectedDuration}
              onChange={handleDurationChange}
              className="duration-select"
            >
              <option value="7days">{t('evaluation.upload.duration.7days')}</option>
              <option value="30days">{t('evaluation.upload.duration.30days')}</option>
              <option value="90days">{t('evaluation.upload.duration.90days')}</option>
              <option value="all">{t('evaluation.upload.duration.all')}</option>
            </select>
          </label>
        </div>

        <button
          onClick={handleStartScoring}
          className="start-scoring-button"
        >
          {t('evaluation.buttons.startScoring')}
        </button>
      </section>
    </GcdsContainer>
  );
};

export default EvalPage;