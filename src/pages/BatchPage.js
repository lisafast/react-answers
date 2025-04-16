import React, { useState, useEffect, useRef } from 'react';
import { GcdsContainer, GcdsText, GcdsLink } from '@cdssnc/gcds-components-react';
import BatchUpload from '../components/batch/BatchUpload.js';
import BatchList from '../components/batch/BatchList.js';
import { getAbsoluteApiUrl } from '../utils/apiToUrl.js';
import { useTranslations } from '../hooks/useTranslations.js';
import ExportService from '../services/ExportService.js';
import AuthService from '../services/AuthService.js';

const BatchPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState(null);
  // Store previous progress and updatedAt for each batch
  const prevProgressRef = useRef({});
  // Track last resume attempt per batch to avoid repeated resumes
  const lastResumeAttemptRef = useRef({});

  useEffect(() => {
    let pollInterval = null;
    let isProcessingChunk = false;
    const STUCK_THRESHOLD_MS = 60 * 1000; // 1 minute

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

          if (
            (batch.status === 'processing' || batch.status === 'queued') &&
            !isProcessingChunk
          ) {
            if (prev) {
              // If no progress and updatedAt hasn't changed for threshold, consider stuck
              if (
                processed === prev.processedItems &&
                updatedAt === prev.updatedAt &&
                now - updatedAt > STUCK_THRESHOLD_MS
              ) {
                // Only resume if last attempt was more than threshold ago
                const lastResume = lastResumeAttemptRef.current[batch._id] || 0;
                if (now - lastResume > STUCK_THRESHOLD_MS) {
                  shouldResume = true;
                  lastResumeAttemptRef.current[batch._id] = now;
                }
              }
            } else {
              // No previous record, just store and skip stuck check this time
              prevProgressRef.current[batch._id] = { processedItems: processed, updatedAt };
              continue;
            }
          }

          if (shouldResume) {
            isProcessingChunk = true;
            await AuthService.fetchWithAuth(getAbsoluteApiUrl(`/api/batch/process-for-duration`), {
              method: 'POST',
              body: JSON.stringify({ batchId: batch._id }) // Removed duration, now set by backend
            });
            isProcessingChunk = false;
          }
          // Always update the ref for next poll (after stuck check and resume attempt)
          prevProgressRef.current[batch._id] = { processedItems: processed, updatedAt };
        }
      } catch (err) {
        setError('Error polling batches or processing: ' + err.message);
        isProcessingChunk = false;
      }
    };

    pollInterval = setInterval(pollAndMaybeResume, 5000);
    pollAndMaybeResume();
    return () => clearInterval(pollInterval);
  }, []);

  const handleDownloadClick = async (batchId, type) => {
    const response = await fetch(getAbsoluteApiUrl(`/api/batch/results?batchId=${batchId}`), {
      headers: AuthService.getAuthHeader()
    });
    const batch = await response.json();
    const batches = [batch];
    const fileName = `${batch.name}-${batch.type}.${type === 'excel' ? 'xlsx' : 'csv'}`;
    ExportService.export(batches, fileName);
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
      <nav className="mb-400" aria-label={t('batch.navigation.ariaLabel')}>
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
