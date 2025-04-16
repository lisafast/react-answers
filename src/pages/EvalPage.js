import React, { useState } from 'react';
import { getApiUrl } from '../utils/apiToUrl.js';
import { GcdsContainer, GcdsText, GcdsButton, GcdsDetails } from '@cdssnc/gcds-components-react';

const EvalPage = () => {
  const [embeddingProgress, setEmbeddingProgress] = useState(null);
  const [evalProgress, setEvalProgress] = useState(null);
  const [isAutoProcessingEmbeddings, setIsAutoProcessingEmbeddings] = useState(false);
  const [isAutoProcessingEvals, setIsAutoProcessingEvals] = useState(false);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);
  const [isEvalRequestInProgress, setIsEvalRequestInProgress] = useState(false);

  const handleGenerateEmbeddings = async (isAutoProcess = false, regenerateAll = false, lastId = null) => {
    if (isRequestInProgress) {
      return; // Skip if a request is already in progress
    }

    try {
      setIsRequestInProgress(true);
      if (!isAutoProcess) {
        setIsAutoProcessingEmbeddings(true);
      }

      const response = await fetch(getApiUrl('db-generate-embeddings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          lastProcessedId: lastId,
          regenerateAll: regenerateAll 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate embeddings');
      }

      const result = await response.json();
      
      // Only update progress if we got a valid response
      if (typeof result.remaining === 'number') {
        setEmbeddingProgress({
          remaining: result.remaining,
          lastProcessedId: result.lastProcessedId
        });
        
        // Only continue processing if there are actually items remaining
        if (result.remaining > 0) {
          handleGenerateEmbeddings(true, false, result.lastProcessedId);
        } else {
          setIsAutoProcessingEmbeddings(false);
          if (!isAutoProcess) {
            alert('All embeddings have been generated!');
          }
        }
      } else {
        // If we don't get a valid remaining count, stop processing
        setIsAutoProcessingEmbeddings(false);
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error generating embeddings:', error);
      if (!isAutoProcess) {
        alert('Failed to generate embeddings. Check the console for details.');
      }
      setIsAutoProcessingEmbeddings(false);
    } finally {
      setIsRequestInProgress(false);
    }
  };

  const handleGenerateEvals = async (isAutoProcess = false, regenerateAll = false, lastId = null) => {
    if (isEvalRequestInProgress) {
      return; // Skip if a request is already in progress
    }

    try {
      setIsEvalRequestInProgress(true);
      if (!isAutoProcess) {
        setIsAutoProcessingEvals(true);
        if (regenerateAll) {
          setIsRegeneratingAll(true);
        }
      }

      setEvalProgress(prev => ({ ...prev, loading: true }));
      const response = await fetch(getApiUrl('db-generate-evals'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          lastProcessedId: lastId,
          regenerateAll: regenerateAll 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate evals');
      }

      const result = await response.json();
      
      // Only update progress if we got a valid response
      if (typeof result.remaining === 'number') {
        setEvalProgress({
          remaining: result.remaining,
          lastProcessedId: result.lastProcessedId
        });
        
        // Only continue processing if there are actually items remaining
        if (result.remaining > 0) {
          handleGenerateEvals(true, false, result.lastProcessedId);
        } else {
          setIsAutoProcessingEvals(false);
          setIsRegeneratingAll(false);
          if (!isAutoProcess) {
            alert('All evaluations have been generated!');
          }
        }
      } else {
        // If we don't get a valid remaining count, stop processing
        setIsAutoProcessingEvals(false);
        setIsRegeneratingAll(false);
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error generating evals:', error);
      if (!isAutoProcess) {
        alert('Failed to generate evals. Check the console for details.');
      }
      setIsAutoProcessingEvals(false);
      setIsRegeneratingAll(false);
    } finally {
      setIsEvalRequestInProgress(false);
    }
  };

  const handleRegenerateAllEvals = () => {
    const confirmed = window.confirm(
      'This will delete all existing evaluations and regenerate them from scratch. This operation cannot be undone. Are you sure you want to continue?'
    );
    
    if (confirmed) {
      handleGenerateEvals(false, true);
    }
  };

  const handleRegenerateEmbeddings = () => {
    const confirmed = window.confirm(
      'This will delete all existing embeddings and regenerate them from scratch. This operation cannot be undone. Are you sure you want to continue?'
    );
    
    if (confirmed) {
      handleGenerateEmbeddings(false, true, null);
    }
  };

  return (
    <GcdsContainer size="xl" centered>
      <h1>Evaluation Tools</h1>
      
      <div className="mb-400">
        <h2>Generate Embeddings</h2>
        <GcdsText>
          Process interactions to generate embeddings.
        </GcdsText>
        <div className="button-group">
          <GcdsButton 
            onClick={() => handleGenerateEmbeddings(false)}
            disabled={embeddingProgress?.loading || isAutoProcessingEmbeddings}
            className="mb-200 mr-200"
          >
            {embeddingProgress?.loading && !isAutoProcessingEmbeddings ? 'Processing...' : 'Generate Embeddings'}
          </GcdsButton>
          
          <GcdsButton 
            onClick={handleRegenerateEmbeddings}
            disabled={embeddingProgress?.loading || isAutoProcessingEmbeddings}
            variant="danger"
            className="mb-200 mr-200"
          >
            {'Regenerate Embeddings'}
          </GcdsButton>
        </div>
        
        {embeddingProgress && (
          <div className="mb-200">
            <p>
              {embeddingProgress.remaining !== undefined && (
                <span> • Remaining: {embeddingProgress.remaining}</span>
              )}
              {isAutoProcessingEmbeddings && (
                <span> • <strong>Auto-processing active</strong></span>
              )}
            </p>
          </div>
        )}
      </div>
      
      <div className="mb-400">
        <h2>Similarity-Based Expert Feedback Transfer</h2>
        <GcdsText>
          This approach automatically evaluates new interactions by finding similar expert-evaluated interactions and transferring the feedback scores and explanations.
        </GcdsText>
        
        <GcdsDetails detailsTitle="Detailed Evaluation Process" className="mt-400">
          
          <ol className="mb-200">
            <li><strong>Initial Validation:</strong> The system first validates that the interaction has question and answer content, then checks if an evaluation already exists</li>
            <li><strong>Embedding Retrieval:</strong> Finds vector embeddings for the interaction (question+answer combined, answer-only, and sentence-level)</li>
            <li><strong>Finding Similar Content:</strong> Searches for interactions with:
              <ul>
                <li>Existing expert feedback</li>
                <li>Question(s)+answer similarity above threshold (0.85)</li>
                <li>Returns up to 20 closest matches</li>
              </ul>
            </li>
            <li><strong>Determining Best Matches:</strong> 
              <ul>
                <li>Calculates answer similarity for each potential match</li>
                <li>Applies a sentence count penalty (0.05 per sentence difference)</li>
                <li>Applies recency bias to favor newer examples</li>
                <li>Selects top 5 answer matches</li>
              </ul>
            </li>
            <li><strong>Sentence-Level Matching:</strong> 
              <ul>
                <li>For each sentence in the new interaction, finds the most similar sentence in each potential match</li>
                <li>Keeps matches above the sentence similarity threshold</li>
              </ul>
            </li>
            <li><strong>Final Match Selection:</strong> Combines overall similarity scores to select the best overall match with good sentence alignment</li>
            <li><strong>Evaluation Creation:</strong> 
              <ul>
                <li>Creates a new expert feedback object based on the matched interaction's feedback</li>
                <li>Maps sentence-specific feedback to corresponding sentences in the new interaction</li>
                <li>Records similarity scores at question, answer, and sentence levels</li>
                <li>Updates the interaction with the new evaluation reference</li>
              </ul>
            </li>
            
          </ol>
        </GcdsDetails>
        <br/>
        <div className="button-group">
          <GcdsButton 
            onClick={() => handleGenerateEvals(false)}
            disabled={evalProgress?.loading || isAutoProcessingEvals || isRegeneratingAll}
            className="mb-200 mr-200"
          >
            {evalProgress?.loading && !isAutoProcessingEvals && !isRegeneratingAll ? 'Processing...' : 'Generate Evaluations'}
          </GcdsButton>
          
          <GcdsButton 
            onClick={handleRegenerateAllEvals}
            disabled={evalProgress?.loading || isAutoProcessingEvals || isRegeneratingAll}
            variant="danger"
            className="mb-200 mr-200"
          >
            {isRegeneratingAll ? 'Regenerating All...' : 'Regenerate All Evaluations'}
          </GcdsButton>
        </div>
        
        {evalProgress && (
          <div className="mb-200">
            <p>
              {evalProgress.successful !== undefined && (
                <span> • Successful: {evalProgress.successful}</span>
              )}
              {evalProgress.remaining !== undefined && (
                <span> • Remaining: {evalProgress.remaining}</span>
              )}
              {isAutoProcessingEvals && !isRegeneratingAll && (
                <span> • <strong>Auto-processing active</strong></span>
              )}
              {isRegeneratingAll && (
                <span> • <strong>Regenerating all evaluations</strong></span>
              )}
            </p>
          </div>
        )}
      </div>
    </GcdsContainer>
  );
};

export default EvalPage;