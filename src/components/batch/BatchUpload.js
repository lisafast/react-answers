// src/components/batch/BatchUpload.js
import React, { useState, useEffect } from 'react';
import { useTranslations } from '../../hooks/useTranslations.js';
import { GcdsContainer, GcdsText } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import * as XLSX from 'xlsx';
import { getAbsoluteApiUrl } from '../../utils/apiToUrl.js';
import AuthService from '../../services/AuthService.js';

const BatchUpload = ({ lang }) => {
  const { t } = useTranslations(lang);
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAI, setSelectedAI] = useState('openai');
  const [fileUploaded, setFileUploaded] = useState(false);
  const [batchId, setBatchId] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [batchName, setBatchName] = useState('');
  const [selectedSearch, setSelectedSearch] = useState('google');

  const handleFileChange = (event) => {
    setError(null);
    const uploadedFile = event.target.files[0];

    if (!uploadedFile) {
      setFile(null);
      return;
    }

    if (!uploadedFile.name.endsWith('.csv')) {
      setError(t('batch.upload.error.invalidFile'));
      setFile(null);
      return;
    }

    setFile(uploadedFile);
    setFileUploaded(false);
  };

  const handleAIToggle = (e) => {
    setSelectedAI(e.target.value);
  };

  const handleSearchToggle = (e) => {
    setSelectedSearch(e.target.value);
  };

  const handleLanguageToggle = (e) => {
    setSelectedLanguage(e.target.value);
  };

  const handleBatchNameChange = (e) => {
    setBatchName(e.target.value);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!processing) {
      if (!file) {
        setError('Please select a file first');
        return;
      }

      if (!batchName.trim()) {
        setError(t('batch.upload.error.nameRequired') || 'Please enter a batch name');
        return;
      }

      try {
        await file.text();
        setFileUploaded(true);
        setError(null);
      } catch (err) {
        setError('Failed to read the file. Please try uploading again.');
        console.error('Error reading file:', err);
      }
    }
  };

  const processCSV = (csvText) => {
    try {
      // Parse the CSV content using XLSX
      const workbook = XLSX.read(csvText, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet data to JSON
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

      // Validate and extract data
      if (!jsonData.length) {
        throw new Error('The CSV file is empty or invalid.');
      }

      const headers = jsonData[0].map((header) => header.trim().toUpperCase());
      const problemDetailsIndex = headers.findIndex(
        (h) => h === 'PROBLEM DETAILS' || h === 'QUESTION' || h === 'REDACTEDQUESTION'
      );

      if (problemDetailsIndex === -1) {
        throw new Error(
          'Required column "PROBLEM DETAILS/REDACTEDQUESTION" not found in CSV file. Please ensure you are using a file with that column or downloaded from the Feedback Viewer.'
        );
      }

      const entries = jsonData
        .slice(1)
        .map((row) => {
          const entry = {};
          headers.forEach((header, index) => {
            const key = header === 'PROBLEM DETAILS' ? 'REDACTEDQUESTION' : header;
            entry[key] = row[index]?.trim() || '';
          });
          console.log('Processing entry:', entry);
          return entry;
        })
        .filter((entry) => entry['REDACTEDQUESTION']); // Only filter based on 'QUESTION' presence

      console.log(`Found ${entries.length} valid entries to process`);
      return entries;
    } catch (error) {
      console.error('Error processing CSV:', error);
      throw new Error(`Failed to process CSV file: ${error.message}`);
    }
  };

  const processBatch = async (entries) => {
    try {
      setProcessing(true);
      setBatchStatus('preparing');
      setError(null);

      // Use AuthService.fetchWithAuth for consistent auth and error handling
      const data = await AuthService.fetchWithAuth(getAbsoluteApiUrl('/api/batch/create'), {
        method: 'POST',
        body: JSON.stringify({
          batchName,
          aiProvider: selectedAI,
          searchProvider: selectedSearch,
          lang: selectedLanguage,
          applyOverrides: false, // or use a state if you add a checkbox
          entries
        })
      });

      setBatchId(data.batchId);
      setBatchStatus('started');
      setProcessing(false);
      return data;
    } catch (error) {
      setError(`Failed to start batch processing: ${error.message}`);
      setProcessing(false);
      setBatchStatus(null);
      throw error;
    }
  };

  const handleProcessFile = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);
    try {
      const csvText = await file.text();
      const entries = processCSV(csvText);
      await processBatch(entries);
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  };

  useEffect(() => {
    console.log('State changed:', {
      processing,
      batchStatus,
      batchId,
    });
  }, [processing, batchStatus, batchId]);

  return (
    <GcdsContainer className="mb-600">
      <div className="steps-container">
        <div className="step">
          <GcdsText>{t('batch.upload.intro')}</GcdsText>
          <GcdsText>{t('batch.upload.csvRequirements.title')}</GcdsText>
          <ul>
            <li>{t('batch.upload.csvRequirements.items.problemDetails')}</li>
            <li>{t('batch.upload.csvRequirements.items.url')}</li>
            <li>{t('batch.upload.csvRequirements.items.context')}</li>
          </ul>

          <form onSubmit={handleUpload} className="mt-400">
            <div className="mrgn-bttm-20">
              <label htmlFor="batchName" className="mrgn-bttm-10 display-block">
                {t('batch.upload.batchName')}
              </label>
              <input
                type="text"
                id="batchName"
                value={batchName}
                onChange={handleBatchNameChange}
                className="mrgn-bttm-10"
                required
                aria-required="true"
              />
            </div>

            <div className="ai-toggle">
              <fieldset className="ai-toggle_fieldset">
                <div className="ai-toggle_container">
                  <legend className="ai-toggle_legend">{t('batch.upload.aiService.label')}</legend>

                  <div className="flex-center">
                    <input
                      type="radio"
                      id="chatgpt"
                      name="ai-selection"
                      value="openai"
                      checked={selectedAI === 'openai'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label className="mrgn-rght-15" htmlFor="chatgpt">
                      {t('batch.upload.aiService.openai')}
                    </label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="claude"
                      name="ai-selection"
                      value="anthropic"
                      checked={selectedAI === 'anthropic'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="claude">{t('batch.upload.aiService.anthropic')}</label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="search-toggle">
              <fieldset className="ai-toggle_fieldset">
                <div className="ai-toggle_container">
                  <legend className="ai-toggle_legend">
                    {t('batch.upload.searchService.label')}
                  </legend>

                  <div className="flex-center">
                    <input
                      type="radio"
                      id="google"
                      name="search-selection"
                      value="google"
                      checked={selectedSearch === 'google'}
                      onChange={handleSearchToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label className="mrgn-rght-15" htmlFor="google">
                      {t('batch.upload.searchService.google')}
                    </label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="canadaca"
                      name="search-selection"
                      value="canadaca"
                      checked={selectedSearch === 'canadaca'}
                      onChange={handleSearchToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="canadaca">{t('batch.upload.searchService.canadaca')}</label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="language-toggle mrgn-bttm-20">
              <fieldset className="ai-toggle_fieldset">
                <div className="flex-center">
                  <legend className="ai-toggle_legend">{t('batch.upload.language.label')}</legend>
                  <div className="flex-center mrgn-rght-15">
                    <input
                      type="radio"
                      id="english"
                      name="language-selection"
                      value="en"
                      checked={selectedLanguage === 'en'}
                      onChange={handleLanguageToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label className="mrgn-rght-15" htmlFor="english">
                      {t('batch.upload.language.english')}
                    </label>
                  </div>
                  <div className="flex-center">
                    <input
                      type="radio"
                      id="french"
                      name="language-selection"
                      value="fr"
                      checked={selectedLanguage === 'fr'}
                      onChange={handleLanguageToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="french">{t('batch.upload.language.french')}</label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="file-input-container mrgn-bttm-20">
              <label htmlFor="csvFile" className="mrgn-bttm-10 display-block">
                {t('batch.upload.file.label')}
              </label>
              <input
                type="file"
                id="csvFile"
                accept=".csv"
                onChange={handleFileChange}
                className="mrgn-bttm-10 display-block"
              />
              {file && (
                <div>
                  {t('batch.upload.file.selected')} {file.name}
                </div>
              )}
            </div>

            {error && <div className="error-message mrgn-bttm-10 red">{error}</div>}

            {file && !fileUploaded && (
              <button type="submit" className="primary-button force-style-button">
                {t('batch.upload.buttons.upload')}
              </button>
            )}

            {processing && (
              <div className="mt-4">
                {batchStatus === 'preparing' && selectedAI === 'openai' && (
                  <div className="text-sm text-gray-500 mt-2">
                    {t('batch.upload.status.openaiWait')}
                  </div>
                )}
              </div>
            )}

            {fileUploaded && (
              <div className="processing-controls">
                <button onClick={handleProcessFile} className="secondary-button force-style-button">
                  {t('batch.upload.buttons.startProcessing')}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </GcdsContainer>
  );
};

export default BatchUpload;
