// src/pages/HomePage.js
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import ChatAppContainer from '../components/chat/ChatAppContainer.js';
import { GcdsContainer, GcdsDetails, GcdsText, GcdsLink } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';
import DataStoreService from '../services/DataStoreService.js';
import OutageComponent from '../components/OutageComponent.js';
import { useHasAnyRole } from '../components/RoleBasedUI.js';

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <GcdsContainer size="xl" mainContainer centered>
          <h2>{t('homepage.errors.timeout.title')}</h2>
          <GcdsText>{t('homepage.errors.timeout.message')}</GcdsText>
          <button
            onClick={() => window.location.reload()}
            className="gcds-button gcds-button--primary"
          >
            {t('homepage.errors.timeout.button')}
          </button> {/* Corrected: Ensure button is properly closed */}
        </GcdsContainer>
      );
    }
    return this.props.children;
  }
}

const HomePage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const isPrivileged = useHasAnyRole(['admin', 'partner']);
  const [serviceStatus, setServiceStatus] = useState({ isAvailable: null, message: '' });
  const [chatId, setChatId] = useState(null);
  const [isLoadingSiteStatus, setIsLoadingSiteStatus] = useState(true);

  useEffect(() => {
    const checkSiteStatus = async () => {
      setIsLoadingSiteStatus(true); // Ensure loading state is true at the start of the check
      try {
        const status = await DataStoreService.getSiteStatus();
        if (status === 'available') {
          setServiceStatus({ isAvailable: true, message: '' });
        } else { // Covers 'unavailable' and any other unexpected status from the service
          setServiceStatus({ isAvailable: false, message: t('homepage.errors.serviceUnavailable') });
        }
      } catch (error) {
        console.error('Failed to get site status:', error);
        setServiceStatus({ isAvailable: false, message: t('homepage.errors.serviceUnavailable') });
      } finally {
        setIsLoadingSiteStatus(false);
      }
    };

    checkSiteStatus();
  }, [t]); // Dependency 't' is kept as it's used for error messages.

  async function fetchSession() {
    try {
      const data = await DataStoreService.getChatSession();
      setChatId(data.chatId);
      localStorage.setItem('chatId', data.chatId);
    } catch (error) {
      // If chat session fails, just leave chatId null, outage will already be shown if site is unavailable
      console.error('Failed to get chat session:', error);
      // Set service status to unavailable to show OutageComponent
      setServiceStatus({ isAvailable: false, message: t('homepage.errors.serviceUnavailable') });
    }
  }

  useEffect(() => {
    if (serviceStatus.isAvailable === true || isPrivileged) {
      fetchSession();
    }
  }, [serviceStatus.isAvailable, isPrivileged]);

  const WrappedErrorBoundary = ({ children }) => <ErrorBoundary t={t}>{children}</ErrorBoundary>;

  // Revised rendering logic:
  // Show OutageComponent if service is confirmed unavailable AND user is not privileged.
  if (serviceStatus.isAvailable === false && !isPrivileged) {
    return <OutageComponent />;
  } else {
    // Otherwise, show the chat application.
    // This covers:
    // 1. Service is available (serviceStatus.isAvailable === true).
    // 2. User is privileged (isPrivileged === true), overriding service status.
    // 3. Site status is still loading (serviceStatus.isAvailable === null), rendering chat optimistically.
    return (
      <WrappedErrorBoundary>
        <GcdsContainer
          size="xl"
          mainContainer
          centered
          tag="main"
          className="mb-600"
        >
          <h1 className="mb-400">{t('homepage.title')}</h1>
          <h2 className="mt-400 mb-400" aria-label={t('homepage.subtitle.ariaLabel')}>
            <span className="aria-hidden">{t('homepage.subtitle.text')}</span>
          </h2>
          <GcdsText className="mb-200">{t('homepage.intro.researchOnly')}</GcdsText>
          <GcdsDetails detailsTitle={t('homepage.privacy.title')} className="mb-400" tabIndex={0}>
            <GcdsText>{t('homepage.privacy.storage')}</GcdsText>
            <GcdsText>{t('homepage.privacy.disclaimer')}</GcdsText>
            <GcdsText>
              {t('homepage.privacy.terms')}{' '}
              <GcdsLink href="https://www.canada.ca/en/transparency/terms.html">
                {t('homepage.privacy.termsLink')}
              </GcdsLink>
            </GcdsText>
          </GcdsDetails>
          <ChatAppContainer lang={lang} chatId={chatId} />
        </GcdsContainer>
        <GcdsContainer size="xl" mainContainer centered tag="below" className="mb-600" tabIndex={0}>
          <GcdsText>
            <a
              href={t('homepage.publicFeedback.surveyUrl')}
              className="feedback-survey-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('homepage.publicFeedback.surveyLink')}
            </a>
          </GcdsText>
          <GcdsDetails detailsTitle={t('homepage.about.title')} className="mb-400" tabIndex={0}>
            <GcdsText>{t('homepage.about.privacyNote')}</GcdsText>
            <GcdsText>{t('homepage.about.aiServices.azure')}</GcdsText>
            <GcdsText>
              <GcdsLink href="https://github.com/cds-snc/ai-answers">
                {t('homepage.about.systemPrompt')}
              </GcdsLink>
            </GcdsText>
            <GcdsText>{t('homepage.about.contact')}</GcdsText>
          </GcdsDetails>
        </GcdsContainer>
      </WrappedErrorBoundary>
    );
  }
};

export default HomePage;
