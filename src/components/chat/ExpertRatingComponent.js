import React, { useState } from 'react';
import { GcdsFieldset } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import { useTranslations } from '../../hooks/useTranslations.js';

// TODO: it's defaulting to 1 sentence, until we get the sentence count from the AI response

const ExpertRatingComponent = ({ onSubmit, lang = 'en', sentenceCount = 1 }) => {
  const { t } = useTranslations(lang);
  const [expertFeedback, setExpertFeedback] = useState({
    sentence1Score: null,
    sentence2Score: null,
    sentence3Score: null,
    sentence4Score: null,
    citationScore: null,
    answerImprovement: '',
    expertCitationUrl: '',
  });

  const handleRadioChange = (event) => {
    const { name, value } = event.target;
    setExpertFeedback(prev => ({ ...prev, [name]: parseInt(value) }));
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setExpertFeedback(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (expertFeedback.expertCitationUrl && !isValidGovernmentUrl(expertFeedback.expertCitationUrl)) {
      alert(t('homepage.expertRating.errors.invalidUrl'));
      return;
    }
    
    // Calculate total score before submitting
    const totalScore = computeTotalScore(expertFeedback);
    const feedbackWithScore = {
      ...expertFeedback,
      totalScore
    };
    
    console.log('Submitting expert feedback:', feedbackWithScore);
    onSubmit(feedbackWithScore);
  };

  const isValidGovernmentUrl = (url) => {
    try {
      const urlObject = new URL(url);
      return urlObject.hostname.includes('canada.ca') || 
             urlObject.hostname.includes('gc.ca');
    } catch {
      return false;
    }
  };

  const computeTotalScore = (feedback) => {
    // Get all sentence scores that exist and aren't null
    const sentenceScores = [
      feedback.sentence1Score,
      feedback.sentence2Score,
      feedback.sentence3Score,
      feedback.sentence4Score
    ].filter(score => score !== null);

    // If no sentences were rated, return 0
    if (sentenceScores.length === 0) return 0;

    // Calculate average of sentence scores and multiply by 0.75
    const sentenceComponent = (sentenceScores.reduce((sum, score) => sum + score, 0) / sentenceScores.length) * 0.75;
    
    // Citation score defaults to 25 (full marks) if not set
    const citationComponent = feedback.citationScore !== null ? feedback.citationScore : 25;

    // Simple addition since citation scores are already weighted
    const totalScore = sentenceComponent + citationComponent;
    
    // Round to 2 decimal places
    return Math.round(totalScore * 100) / 100;
  };

  return (
    <form onSubmit={handleSubmit} className="expert-rating-container">
      <GcdsFieldset>
        <p>{t('homepage.expertRating.intro')}</p>
        <details className="answer-details">
          <summary>{t('homepage.expertRating.title')}</summary>
          {console.log('sentenceCount:', sentenceCount)}
          <div className="sentence-rating-group">
            <h3>{t('homepage.expertRating.sentence1')}</h3>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="sentence1Score"
                  value="100"
                  checked={expertFeedback.sentence1Score === 100}
                  onChange={handleRadioChange}
                />
                {t('homepage.expertRating.options.good')} (100)
              </label>
              <label>
                <input
                  type="radio"
                  name="sentence1Score"
                  value="80"
                  checked={expertFeedback.sentence1Score === 80}
                  onChange={handleRadioChange}
                />
                {t('homepage.expertRating.options.needsImprovement')} (80)
              </label>
              <label>
                <input
                  type="radio"
                  name="sentence1Score"
                  value="0"
                  checked={expertFeedback.sentence1Score === 0}
                  onChange={handleRadioChange}
                />
                {t('homepage.expertRating.options.incorrect')} (0)
              </label>
            </div>
          </div>
          {[...Array(Math.max(0, sentenceCount - 1))].map((_, index) => (
            <div key={index + 2} className="sentence-rating-group">
              <h3>{t(`homepage.expertRating.sentence${index + 2}`)}</h3>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name={`sentence${index + 2}Score`}
                    value="100"
                    checked={expertFeedback[`sentence${index + 2}Score`] === 100}
                    onChange={handleRadioChange}
                  />
                  {t('homepage.expertRating.options.good')} (100)
                </label>
                <label>
                  <input
                    type="radio"
                    name={`sentence${index + 2}Score`}
                    value="80"
                    checked={expertFeedback[`sentence${index + 2}Score`] === 80}
                    onChange={handleRadioChange}
                  />
                  {t('homepage.expertRating.options.needsImprovement')} (80)
                </label>
                <label>
                  <input
                    type="radio"
                    name={`sentence${index + 2}Score`}
                    value="0"
                    checked={expertFeedback[`sentence${index + 2}Score`] === 0}
                    onChange={handleRadioChange}
                  />
                  {t('homepage.expertRating.options.incorrect')} (0)
                </label>
              </div>
            </div>
          ))}

          <div className="answer-improvement">
            <label>
              {t('homepage.expertRating.options.answerImprovement')}
              <textarea
                name="answerImprovement"
                value={expertFeedback.answerImprovement}
                onChange={handleInputChange}
              />
            </label>
          </div>
        </details>

        <details className="citation-details">
          <summary>{t('homepage.expertRating.citation')}</summary>
          <div className="citation-rating-group">
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="citationScore"
                  value="25"
                  checked={expertFeedback.citationScore === 25}
                  onChange={handleRadioChange}
                />
                {t('homepage.expertRating.options.good')} (25)
              </label>
              <label>
                <input
                  type="radio"
                  name="citationScore"
                  value="20"
                  checked={expertFeedback.citationScore === 20}
                  onChange={handleRadioChange}
                />
                {t('homepage.expertRating.options.needsImprovement')} (20)
              </label>
              <label>
                <input
                  type="radio"
                  name="citationScore"
                  value="0"
                  checked={expertFeedback.citationScore === 0}
                  onChange={handleRadioChange}
                />
                {t('homepage.expertRating.options.incorrect')} (0)
              </label>
            </div>
          </div>

          <div>
            <label>
              {t('homepage.expertRating.options.betterCitation')}
              <input
                type="url"
                name="expertCitationUrl"
                value={expertFeedback.expertCitationUrl}
                onChange={handleInputChange}
              />
            </label>
          </div>
        </details>
      </GcdsFieldset>
      <button type="submit">{t('homepage.expertRating.submit')}</button>
    </form>
  );
};

export default ExpertRatingComponent;