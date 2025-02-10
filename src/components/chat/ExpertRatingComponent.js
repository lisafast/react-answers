import React, { useState } from 'react';
import '../../styles/App.css';
import { useTranslations } from '../../hooks/useTranslations.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


// Shows ratings for a maximum of 4 sentences, and for the citation score
// if there are somehow 5 sentences, the 5th sentence is ignored _YES THIS IS A HACK

const ExpertRatingComponent = ({ onSubmit, onClose, lang = 'en', sentenceCount = 1 }) => {
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

    // Prevent form submission on enter key press inside text areas
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
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
    <FontAwesomeIcon icon="fa-solid fa-close" className="close-icon" 
        onClick={onClose} 
        onKeyDown={(e) => e.key === 'Enter' && onClose()} 
        role="button" 
        tabIndex={0} 
        aria-label="Close" />
      <fieldset className="gc-chckbxrdio sm-v">
        <h2>{t('homepage.expertRating.intro')}</h2>
        <details className="answer-details">
      <summary>{t('homepage.expertRating.title')}</summary>
          
          {/* Sentence 1 */}
          <div className="sentence-rating-group">
            <legend>{t('homepage.expertRating.sentence1')}</legend>
            <ul className="list-unstyled lst-spcd-2">
              <li className="radio">
                <input
                  type="radio"
                  name="sentence1Score"
                  id="sentence1-100"
                  value="100"
                  checked={expertFeedback.sentence1Score === 100}
                  onChange={handleRadioChange}
                />
                <label htmlFor="sentence1-100">
                  {t('homepage.expertRating.options.good')} (100)
                </label>
              </li>
              <li className="radio">
                <input
                  type="radio"
                  name="sentence1Score"
                  id="sentence1-80"
                  value="80"
                  checked={expertFeedback.sentence1Score === 80}
                  onChange={handleRadioChange}
                />
                <label htmlFor="sentence1-80">
                  {t('homepage.expertRating.options.needsImprovement')} (80)
                </label>
              </li>
              <li className="radio">
                <input
                  type="radio"
                  name="sentence1Score"
                  id="sentence1-0"
                  value="0"
                  checked={expertFeedback.sentence1Score === 0}
                  onChange={handleRadioChange}
                />
                <label htmlFor="sentence1-0">
                  {t('homepage.expertRating.options.incorrect')} (0)
                </label>
              </li>
            </ul>
          </div>

          {/* Dynamic sentences 2-3 */}
          {[...Array(Math.min(3, sentenceCount - 1))].map((_, index) => (
            <div key={index + 2} className="sentence-rating-group">
              <legend>{t(`homepage.expertRating.sentence${index + 2}`)}</legend>
              <ul className="list-unstyled lst-spcd-2">
                <li className="radio">
                  <input
                    type="radio"
                    name={`sentence${index + 2}Score`}
                    id={`sentence${index + 2}-100`}
                    value="100"
                    checked={expertFeedback[`sentence${index + 2}Score`] === 100}
                    onChange={handleRadioChange}
                  />
                  <label htmlFor={`sentence${index + 2}-100`}>
                    {t('homepage.expertRating.options.good')} (100)
                  </label>
                </li>
                <li className="radio">
                  <input
                    type="radio"
                    name={`sentence${index + 2}Score`}
                    id={`sentence${index + 2}-80`}
                    value="80"
                    checked={expertFeedback[`sentence${index + 2}Score`] === 80}
                    onChange={handleRadioChange}
                  />
                  <label htmlFor={`sentence${index + 2}-80`}>
                    {t('homepage.expertRating.options.needsImprovement')} (80)
                  </label>
                </li>
                <li className="radio">
                  <input
                    type="radio"
                    name={`sentence${index + 2}Score`}
                    id={`sentence${index + 2}-0`}
                    value="0"
                    checked={expertFeedback[`sentence${index + 2}Score`] === 0}
                    onChange={handleRadioChange}
                  />
                  <label htmlFor={`sentence${index + 2}-0`}>
                    {t('homepage.expertRating.options.incorrect')} (0)
                  </label>
                </li>
              </ul>
            </div>
          ))}

          <div className="answer-improvement">
            <label htmlFor="answer-improvement">
              {t('homepage.expertRating.options.answerImprovement')}
              <textarea
                id="answer-improvement"
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
            <legend>{t('homepage.expertRating.citation')}</legend>
            <ul className="list-unstyled lst-spcd-2">
              <li className="radio">
                <input
                  type="radio"
                  name="citationScore"
                  id="citation-25"
                  value="25"
                  checked={expertFeedback.citationScore === 25}
                  onChange={handleRadioChange}
                />
                <label htmlFor="citation-25">
                  {t('homepage.expertRating.options.good')} (25)
                </label>
              </li>
              <li className="radio">
                <input
                  type="radio"
                  name="citationScore"
                  id="citation-20"
                  value="20"
                  checked={expertFeedback.citationScore === 20}
                  onChange={handleRadioChange}
                />
                <label htmlFor="citation-20">
                  {t('homepage.expertRating.options.needsImprovement')} (20)
                </label>
              </li>
              <li className="radio">
                <input
                  type="radio"
                  name="citationScore"
                  id="citation-0"
                  value="0"
                  checked={expertFeedback.citationScore === 0}
                  onChange={handleRadioChange}
                />
                <label htmlFor="citation-0">
                  {t('homepage.expertRating.options.incorrect')} (0)
                </label>
              </li>
            </ul>
          </div>

          <div>
            <label className="expert-citation-url" htmlFor="expert-citation-url">
              {t('homepage.expertRating.options.betterCitation')}
              <input
                type="url"
                id="expert-citation-url"
                name="expertCitationUrl"
                value={expertFeedback.expertCitationUrl}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
              />
            </label>
          </div>
        </details>
      </fieldset>
      <button type="submit" className="btn-primary mrgn-lft-sm">{t('homepage.expertRating.submit')}</button>
    </form>
  );
};

export default ExpertRatingComponent;