import React, { useState, useEffect, useRef } from 'react';
import { GcdsContainer, GcdsText, GcdsLink } from '@cdssnc/gcds-components-react';
import BatchUpload from '../components/batch/BatchUpload.js';
import BatchList from '../components/batch/BatchList.js';
import { getAbsoluteApiUrl } from '../utils/apiToUrl.js';
import { useTranslations } from '../hooks/useTranslations.js';
import { usePageContext } from '../hooks/usePageParam.js';
import ExportService from '../services/ExportService.js';
import AuthService from '../services/AuthService.js';

const BatchPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const { language } = usePageContext();
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState(null);
  // Store previous progress and updatedAt for each batch
  const prevProgressRef = useRef({});
  // Track last resume attempt per batch to avoid repeated resumes
  const lastResumeAttemptRef = useRef({});

  useEffect(() => {
    let pollInterval = null;
    let isProcessingChunk = false;
    const STUCK_THRESHOLD_MS = 120 * 1000; // 2 minutes

    const pollAndMaybeResume = async () => {
      try {
        const batchList = await AuthService.fetchWithAuth(getAbsoluteApiUrl('/api/batch/list'));
        setBatches(batchList);
        const now = Date.now();
        

        for (const batch of batchList) {
          const prev = prevProgressRef.current[batch._id];
          const processed = batch.processedItems ?? 0;
          const updatedAt = batch.updatedAt ? new Date(batch.updatedAt).getTime() : 0;
          let shouldResume = false;

          if (!isProcessingChunk) {
            if (batch.status === 'queued') {
              // Immediately try to start queued batches if not already attempted recently
              const lastResume = lastResumeAttemptRef.current[batch._id] || 0;
              // Use a shorter threshold (e.g., 10s) to prevent rapid retries on failed starts
              if (now - lastResume > 10000) { 
                shouldResume = true;
                lastResumeAttemptRef.current[batch._id] = now;
              }
            } else if (batch.status === 'processing') {
              // Apply stuck logic only to processing batches
              if (prev) {
                // If no progress and updatedAt hasn't changed for threshold, consider stuck
                if (
                  processed === prev.processed &&
                  updatedAt === prev.updatedAt &&
                  now - updatedAt > STUCK_THRESHOLD_MS
                ) {
                  shouldResume = true;
                  lastResumeAttemptRef.current[batch._id] = now;
                }
              }
            }
            if (shouldResume) {
              isProcessingChunk = true;
              // Send lastProcessedIndex to the API (no baseUrl, server will determine it)
              await AuthService.fetchWithAuth(getAbsoluteApiUrl('/api/batch/process-for-duration'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
                body: JSON.stringify({ batchId: batch._id, lastProcessedIndex: batch.lastProcessedIndex })
              });
              isProcessingChunk = false;
            }
          }
          // Always update the ref for next poll (after stuck check and resume attempt)
          // Only update if it wasn't a queued batch we just tried to start?
          // Let's update regardless for now, simplifies logic.
          prevProgressRef.current[batch._id] = { processedItems: processed, updatedAt };
        }
      } catch (err) {
        setError('Error polling batches or processing: ' + err.message);
        isProcessingChunk = false;
      }
    };

    pollInterval = setInterval(pollAndMaybeResume, 5000); // Keep polling at 5 seconds
    pollAndMaybeResume();
    return () => clearInterval(pollInterval);
  }, []);

  const handleDownloadClick = async (batchId, type) => {
    // Use the new ExportService method for batch export
    await ExportService.exportBatchResults(batchId, type === 'excel' ? 'xlsx' : 'csv');
  };

  const handleCompleteCancelClick = async (batchId, action) => {
    if (action === 'cancel') {
      await fetch(getAbsoluteApiUrl('/api/batch/cancel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        body: JSON.stringify({ batchId })
      });
    } else {
      // Implement process results if needed
    }
  };

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('batch.navigation.title')}</h1>

      <nav className="mb-400">
        <GcdsText>
          <GcdsLink href={`/${language}/admin`}>{t('common.backToAdmin', 'Back to Admin')}</GcdsLink>
        </GcdsText>
      </nav>
      
      <nav className="mb-400 mt-400" aria-label={t('batch.navigation.ariaLabel')}>
        <h2 className="mt-400 mb-400">{t('batch.navigation.links.onThisPage')}</h2>
        <ul>
          <li className="mb-400">
            <GcdsText>
              <GcdsLink href="#evaluator">{t('batch.navigation.links.newEvaluation')}</GcdsLink>
            </GcdsText>
          </li>
          <li className="mb-400">
            <GcdsText>
              <GcdsLink href="#running-evaluation">
                {t('batch.navigation.links.runningBatches')}
              </GcdsLink>
            </GcdsText>
          </li>
          <li className="mb-400">
            <GcdsText>
              <GcdsLink href="#processed-evaluation">
                {t('batch.navigation.links.processedBatches')}
              </GcdsLink>
            </GcdsText>
          </li>
        </ul>
      </nav>

      <section id="evaluator" className="mb-600">
        <h2 className="mt-400 mb-400">{t('batch.sections.evaluator.title')}</h2>
        <BatchUpload lang={lang} />
      </section>

      <section id="running-evaluation" className="mb-600">
        <h2 className="mt-400 mb-400">{t('batch.sections.running.title')}</h2>
        <BatchList
          buttonAction={handleCompleteCancelClick}
          batchStatus={"processing,queued,error"} // Remove 'completed' from running list
          lang={lang}
          batches={batches}
        />
      </section>

      <section id="processed-evaluation" className="mb-600">
        <h2 className="mt-400 mb-400">{t('batch.sections.processed.title')}</h2>
        <BatchList buttonAction={handleDownloadClick} batchStatus="processed" lang={lang} batches={batches} />
      </section>
      {error && <div className="error-message red">{error}</div>}
    </GcdsContainer>
  );
};

export default BatchPage;
