import React, { useState } from 'react';
import ExpertRatingComponent from './ExpertRatingComponent.js';
import { useHasAnyRole } from '../RoleBasedUI.js';
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
  onSkip = () => { },       // Function to call when skip button is clicked
  skipButtonLabel = ''     // Accessible label for the skip button
}) => {
  const { t } = useTranslations(lang);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showExpertRating, setShowExpertRating] = useState(false);
  const hasExpertRole = useHasAnyRole(['admin', 'partner']);

  const handleFeedback = (isPositive) => {
    let expertFeedback = null;
    if (isPositive) {
      expertFeedback = {
        totalScore: 100,
        type: hasExpertRole ? 'expert' : 'public',
        isPositive: true,
      };
      
      DataStoreService.persistFeedback(expertFeedback, chatId, userMessageId);
      setFeedbackGiven(true);
    } else {
      
      if (hasExpertRole) {
        setShowExpertRating(true);
        
      } else {
        // For negative feedback from non-expert
        expertFeedback = {
          totalScore: 0,
          type: 'public',
          isPositive: false,
        };
        DataStoreService.persistFeedback(expertFeedback, chatId, userMessageId);
        setFeedbackGiven(true);
      }
    }
  };
  const handleExpertFeedback = (expertFeedback) => {
    console.log('Expert feedback received:', expertFeedback);
    const feedbackWithType = {
      ...expertFeedback,
      type: 'expert'
    };
    setFeedbackGiven(true);
    setShowExpertRating(false);
    DataStoreService.persistFeedback(feedbackWithType, chatId, userMessageId);
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

      {/* Add the skip button after the other buttons, in the same line */}
      {showSkipButton && (
        <>
          <span className="feedback-separator"></span>
          <button
            className="wb-inv"
            onClick={onSkip}
            aria-label={skipButtonLabel}
            tabIndex="0"
          >
            {skipButtonLabel}
          </button>
        </>
      )}
    </div>
  );
};

export default FeedbackComponent;