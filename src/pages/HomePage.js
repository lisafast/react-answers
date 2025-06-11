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
  const [serviceStatus, setServiceStatus] = useState({ isAvailable: false, message: '' });
  const [chatId, setChatId] = useState(null);
  const [isLoadingSiteStatus, setIsLoadingSiteStatus] = useState(true);
  const [isSessionFetched, setIsSessionFetched] = useState(false);
  const [showOutageOnError, setShowOutageOnError] = useState(false); // Renamed and initialized

  const handleChatError = useCallback(() => { // New callback for chat errors
    setShowOutageOnError(true);
  }, []);

  async function fetchSessionAndSiteStatus() {
    setIsLoadingSiteStatus(true); // Ensure loading state is true at the start
    let sessionOk = false;
    try {
      const sessionData = await DataStoreService.getChatSession();
      setChatId(sessionData.chatId);
      localStorage.setItem('chatId', sessionData.chatId);
      sessionOk = true; // Session fetch was successful
    } catch (error) {
      console.error('Failed to get or create chat session:', error);
      setShowOutageOnError(true); // Show outage on session fetch error
      // No need to set sessionOk to false, it's already false
    }
    setIsSessionFetched(true);

    // Only proceed to get site status if session was okay, or if we decide it's not strictly dependent
    // For now, let's assume site status can be checked even if session fails,
    // but an error in session *OR* site status should show outage.
    try {
      const status = await DataStoreService.getSiteStatus();
      if (status === 'available') {
        setServiceStatus({ isAvailable: true, message: '' });
      } else {
        setServiceStatus({ isAvailable: false, message: t('homepage.errors.serviceUnavailable') });
        setShowOutageOnError(true); // Show outage if service is unavailable
      }
    } catch (error) {
      console.error('Failed to get site status:', error);
      setServiceStatus({ isAvailable: false, message: t('homepage.errors.serviceUnavailable') });
      setShowOutageOnError(true); // Show outage on site status fetch error
    } finally {
      setIsLoadingSiteStatus(false);
    }
  }

  useEffect(() => {
    fetchSessionAndSiteStatus();
  }, [t, isPrivileged]); // Dependencies remain the same

  const WrappedErrorBoundary = ({ children }) => <ErrorBoundary t={t}>{children}</ErrorBoundary>;

  // If a critical error occurred (either during initial fetch or from ChatAppContainer),
  // show OutageComponent to all users.
  if (showOutageOnError) {
    return <OutageComponent />;
  }

  // If no critical error, then check for initial loading or service unavailability for non-privileged users.
  // This is only reached if showOutageOnError is false.
  if (!isPrivileged && (isLoadingSiteStatus || !isSessionFetched || !serviceStatus.isAvailable)) {
    return <OutageComponent />;
  }

  // If no critical error AND (service is available OR user is privileged),
  // show the main application content.
  // This is only reached if showOutageOnError is false AND the above condition for non-privileged users is false.
  if (serviceStatus.isAvailable === true || isPrivileged) {
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
          <ChatAppContainer lang={lang} chatId={chatId} onChatError={handleChatError} /> {/* Pass onChatError prop */}
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

  // Fallback: show outage if status is unknown or error occurred (and not privileged)
  // This condition is largely covered by the first 'if' block now.
  // If it's reached, it implies !isPrivileged and some error/unavailable state.
  return <OutageComponent />;
};

export default HomePage;
