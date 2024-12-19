import React, { useState } from 'react';
import ExpertRatingComponent from './ExpertRatingComponent.js';
import '../../styles/App.css';
import { useTranslations } from '../../hooks/useTranslations.js';

const FeedbackComponent = ({ onFeedback, lang = 'en', sentenceCount = 0 }) => {
  const { t } = useTranslations(lang);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showExpertRating, setShowExpertRating] = useState(false);

  const handleFeedback = (isPositive) => {
    if (isPositive) {
      const expertFeedback = {
        totalScore: 100
      };
      onFeedback(true, expertFeedback);
      setFeedbackGiven(true);
    } else {
      setShowExpertRating(true);
    }
  };

  const handleExpertFeedback = (expertFeedback) => {
    console.log('Expert feedback received:', expertFeedback);
    onFeedback(false, expertFeedback);
    setFeedbackGiven(true);
    setShowExpertRating(false);
  };

  if (feedbackGiven) {
    return <p>{t('homepage.feedback.thankYou')}</p>;
  }
  if (showExpertRating) {
    return <ExpertRatingComponent 
      onSubmit={handleExpertFeedback} 
      lang={lang} 
      sentenceCount={sentenceCount}
    />;
  }
  return (
    <div className="feedback-container">
      <span className="feedback-text">{t('homepage.feedback.question')} </span>
      <button 
        className="feedback-link button-as-link"
        onClick={() => handleFeedback(true)}
      >
        {t('homepage.feedback.useful')}
      </button>
      <span className="feedback-separator">·</span>
      <span className="feedback-text">{t('homepage.feedback.or')}</span>
      <span className="feedback-separator">·</span>
      <button 
        className="feedback-link button-as-link"
        onClick={() => handleFeedback(false)}
      >
        {t('homepage.feedback.notUseful')}
      </button>
    </div>
  );
};

export default FeedbackComponent;