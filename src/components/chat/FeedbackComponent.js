import React, { useState } from 'react';
import ExpertRatingComponent from './ExpertRatingComponent.js';
import '../../styles/App.css';
import { useTranslations } from '../../hooks/useTranslations.js';
import DataStoreService from '../../services/DataStoreService.js';

const FeedbackComponent = ({
  lang = 'en',
  sentenceCount = 1,
  chatId,
  userMessageId,
  sentences = [],
  // Add these new props for the skip button
  showSkipButton = false,  // Determines if skip button should be shown
  onSkip = () => {},       // Function to call when skip button is clicked
  skipButtonLabel = ''     // Accessible label for the skip button
}) => {
  const { t } = useTranslations(lang);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showExpertRating, setShowExpertRating] = useState(false);

  const handleFeedback = (isPositive) => {
    if (isPositive) {
      const expertFeedback = {
        totalScore: 100,
        isPositive: true,
      };
      setFeedbackGiven(true);
      DataStoreService.persistFeedback(expertFeedback, chatId, userMessageId);
    } else {
      setShowExpertRating(true);
    }
  };

  const handleExpertFeedback = (expertFeedback) => {
    console.log('Expert feedback received:', expertFeedback);
    setFeedbackGiven(true);
    setShowExpertRating(false);
    DataStoreService.persistFeedback(expertFeedback, chatId, userMessageId);
  };

  if (feedbackGiven) {
    return (
      <p className="thank-you">
        <span className="gcds-icon fa fa-solid fa-check-circle"></span>
        {t('homepage.feedback.thankYou')}
      </p>
    );
  }

  if (showExpertRating) {
    return (
      <ExpertRatingComponent
        onSubmit={handleExpertFeedback}
        onClose={() => setShowExpertRating(false)}
        lang={lang}
        sentenceCount={sentenceCount}
        sentences={sentences}
      />
    );
  }

  return (
    <div className="feedback-container">
      <span className="feedback-text">{t('homepage.feedback.question')} </span>
      <button className="feedback-link button-as-link" onClick={() => handleFeedback(true)} tabIndex="0">
        {t('homepage.feedback.useful')}
      </button>
      <span className="feedback-separator">·</span>
      <span className="feedback-text">{t('homepage.feedback.or')}</span>
      <span className="feedback-separator">·</span>
      <button className="feedback-link button-as-link" onClick={() => handleFeedback(false)} tabIndex="0">
        {t('homepage.feedback.notUseful')}
      </button>
      
       {/* Skip button positioned absolutely on the right */}
       {showSkipButton && (
        <div style={{ position: 'absolute', top: 0, right: 0 }}>
          <button 
            className="wb-inv" 
            onClick={onSkip}
            aria-label={skipButtonLabel}
            tabIndex="0"
            style={{ position: 'relative' }} /* This will help it appear correctly when focused */
          >
            {skipButtonLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedbackComponent;