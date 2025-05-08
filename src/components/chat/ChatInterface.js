import React, { useEffect, useState, useRef } from 'react';
import { GcdsDetails } from '@cdssnc/gcds-components-react';
import FeedbackComponent from './FeedbackComponent.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const MAX_CHARS = 400;

const ChatInterface = ({
  messages,
  inputText,
  isLoading,
  textareaKey,
  handleInputChange,
  handleSendMessage,
  handleReload,
  handleAIToggle,
  handleSearchToggle,
  handleReferringUrlChange,
  formatAIResponse,
  selectedAI,
  selectedSearch,
  referringUrl,
  turnCount,
  showFeedback,
  displayStatus,
  MAX_CONVERSATION_TURNS,
  t,
  lang,
  isAdmin,
  isOverrideTestingActive,
  handleOverrideToggleChange,
  chatId,
  extractSentences
}) => {
    // Add safeT helper function
  const safeT = (key) => {
    const result = t(key);
    return typeof result === 'object' && result !== null ? result.text : result;
  };

  const [charCount, setCharCount] = useState(0);
  const [userHasClickedTextarea, setUserHasClickedTextarea] = useState(false);
  const textareaRef = useRef(null);
  
  // Function to focus textarea when skip button is clicked
  const focusTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleCitationAppearance = () => {
      if (textareaRef.current && !userHasClickedTextarea) {
        textareaRef.current.blur();
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.classList && node.classList.contains('citation-container')) {
              handleCitationAppearance();
              break;
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [userHasClickedTextarea]);

  useEffect(() => {
    const textarea = document.querySelector('#message');
    const button = document.querySelector('.btn-primary-send');

    // Create loading hint
    const placeholderHint = document.createElement('div');
    placeholderHint.id = 'temp-hint';
    placeholderHint.innerHTML = `<p><FontAwesomeIcon icon="wand-magic-sparkles" />${safeT('homepage.chat.input.loadingHint')}</p>`;

    if (isLoading) {
      if (textarea) {
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(placeholderHint, textarea);
      }
      if (button) button.style.display = 'none';
    } else {
      if (textarea) textarea.style.display = 'block';
      const tempHint = document.getElementById('temp-hint');
      if (tempHint) tempHint.remove();
    }

    return () => {
      const tempHint = document.getElementById('temp-hint');
      if (tempHint) tempHint.remove();
    };
  }, [isLoading, t]);
   
  const getLabelForInput = () => {
    if (turnCount >= 1) {
      const followUp = t('homepage.chat.input.followUp');
      return typeof followUp === 'object' ? followUp.text : followUp;
    }
    const initial = t('homepage.chat.input.initial');
    return typeof initial === 'object' ? initial.text : initial;
  };

  
    const getLastMessageSentenceCount = () => {
    const lastAiMessage = messages.filter((m) => m.sender === 'ai').pop();
    if (lastAiMessage && lastAiMessage.interaction && lastAiMessage.interaction.answer && lastAiMessage.interaction.answer.paragraphs && lastAiMessage.interaction.answer.paragraphs.length > 0) {
      return lastAiMessage.interaction.answer.paragraphs.reduce(
        (count, paragraph) => count + extractSentences(paragraph).length,
        0
      );
    }
    return 1;
  };

  const handleTextareaInput = (event) => {
    const textarea = event.target;
    setCharCount(textarea.value.length);
    handleInputChange(event);

    // Auto-resize
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      if (event.shiftKey) return;

      if (inputText.trim().length === 0 || charCount > MAX_CHARS) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      handleSendMessage(event);
    }
  };

  const handleTextareaClick = () => {
    setUserHasClickedTextarea(true);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTextareaBlur = () => {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer.contains(document.activeElement)) {
      setUserHasClickedTextarea(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="message-list">
        {messages.map((message) => (
          <div key={`message-${message.id}`} className={`message ${message.sender}`}>
            {message.sender === 'user' ? (
              <div
                className={`user-message-box ${
                  message.redactedText?.includes('XXX')
                    ? 'privacy-box'
                    : message.redactedText?.includes('###')
                      ? 'redacted-box'
                      : ''
                }`}
              >
                <p
                  className={
                    message.redactedText?.includes('XXX')
                      ? 'privacy-message'
                      : message.redactedText?.includes('###')
                        ? 'redacted-message'
                        : ''
                  }
                >
                  {message.text}
                </p>
                {message.redactedItems?.length > 0 && message.redactedText && (
                  <p
                    className={
                      message.redactedText?.includes('XXX')
                        ? 'privacy-preview'
                        : message.redactedText?.includes('###')
                          ? 'redacted-preview'
                          : ''
                    }
                  >
                    {message.redactedText?.includes('XXX') && (
                      <>
                        <FontAwesomeIcon icon="fa-circle-exclamation" />{' '}
                        {safeT('homepage.chat.messages.privacyMessage')}
                      </>
                    )}
                    {message.redactedText?.includes('###') &&
                      safeT('homepage.chat.messages.blockedMessage')}
                  </p>
                )}
              </div>
            ) : (
              <>
                {message.error ? (
                  <div
                    className={`error-message-box ${
                      messages[
                        messages.findIndex((m) => m.id === message.id) - 1
                      ]?.redactedText?.includes('XXX')
                        ? 'privacy-error-box'
                        : 'error-box'
                    }`}
                  >
                    <p
                      className={
                        messages[
                          messages.findIndex((m) => m.id === message.id) - 1
                        ]?.redactedText?.includes('XXX')
                          ? 'privacy-error-message'
                          : 'error-message'
                      }
                    >
                      {message.text}
                    </p>
                  </div>
                ) : (
                  <>
                    {formatAIResponse(message.aiService, message)}
                    
                    {chatId && (
                      <div className="chat-id">
                        <p>
                          {safeT('homepage.chat.chatId')}: {chatId}
                        </p>
                      </div>
                    )}
                  </>
                )}
                
                {message.id === messages[messages.length - 1].id &&
                  showFeedback &&
                  !message.error &&
                  message.interaction.answer.answerType !== 'question' && (
                    <FeedbackComponent
                      lang={lang}
                      sentenceCount={getLastMessageSentenceCount()}
                      chatId={chatId}
                      userMessageId={message.id}
                      // Add the new props for the skip button
                      showSkipButton={turnCount < MAX_CONVERSATION_TURNS && !isLoading}
                      onSkip={focusTextarea}
                      skipButtonLabel={safeT('homepage.textarea.ariaLabel.skipfo')}
                    />
                  )}
              </>
            )}
          </div>
        ))}

        {isLoading && (
          <>
            <div key="loading" className="loading-container">
              <div className="loading-animation"></div>
                <div className="loading-text">
                  {/* Translate using key/params if key exists, otherwise display direct message */}
                  {displayStatus.key
                    ? safeT(displayStatus.key, displayStatus.params || {})
                    : displayStatus.message
                  }
                </div>
              </div>
              <div className="loading-hint-text">
              <FontAwesomeIcon icon="wand-magic-sparkles" />
              &nbsp;
             {safeT('homepage.chat.input.loadingHint')}
            </div>
          </>
        )}

        {turnCount >= MAX_CONVERSATION_TURNS && (
          <div key="limit-reached" className="message ai">
            <div className="limit-reached-message">
              <p>{safeT('homepage.chat.messages.limitReached', { count: MAX_CONVERSATION_TURNS })}</p>
              <button onClick={handleReload} className="btn-primary visible">
                {safeT('homepage.chat.buttons.reload')}
              </button>
            </div>
          </div>
        )}
      </div>

      {turnCount < MAX_CONVERSATION_TURNS && (
        <div className="input-area mt-200">
          {!isLoading && (
            <form className="mrgn-tp-xl mrgn-bttm-lg">
              <div className="field-container">
                <label 
                  htmlFor="message" 
                  aria-label={turnCount === 0 
                    ? (typeof t('homepage.chat.input.initial') === 'object' ? t('homepage.chat.input.initial').ariaLabel : undefined)
                    : (typeof t('homepage.chat.input.followUp') === 'object' ? t('homepage.chat.input.followUp').ariaLabel : undefined)}
                >
                  <span className="aria-hidden" aria-hidden="true">{getLabelForInput()}</span>
                </label>
                <span className="hint-text">
                  <FontAwesomeIcon icon="wand-magic-sparkles" />
                  &nbsp;
                  {safeT('homepage.chat.input.hint')}
                </span>
                <div className="form-group">
                  <textarea
                    ref={textareaRef}
                    id="message"
                    name="message"
                    key={textareaKey}
                    value={inputText}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyPress}
                    onClick={handleTextareaClick}
                    onBlur={handleTextareaBlur}
                     aria-label={turnCount === 0 
                      ? safeT('homepage.textarea.ariaLabel.first')
                      : safeT('homepage.textarea.ariaLabel.followon')}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    onClick={handleSendMessage}
                    className={`btn-primary-send ${inputText.trim().length > 0 && charCount <= MAX_CHARS ? 'visible' : ''}`}
                    disabled={isLoading || charCount > MAX_CHARS || inputText.trim().length === 0}
                    aria-label={safeT('homepage.chat.buttons.send') || 'Send message'}
                  >
                    <span className="button-text">{safeT('homepage.chat.buttons.send')}</span>
                    <FontAwesomeIcon className="button-icon" icon="arrow-up" size="md" />
                  </button>
                </div>

                {charCount >= MAX_CHARS - 10 && (
                  <div className={charCount > MAX_CHARS ? 'character-limit' : 'character-warning'}>
                    <FontAwesomeIcon icon="circle-exclamation" />
                    &nbsp;
                    {charCount > MAX_CHARS
                      ? safeT('homepage.chat.messages.characterLimit')
                          .replace('{count}', Math.max(1, charCount - MAX_CHARS))
                          .replace(
                            '{unit}',
                            charCount - MAX_CHARS === 1
                              ? safeT('homepage.chat.messages.character')
                              : safeT('homepage.chat.messages.characters')
                          )
                      : safeT('homepage.chat.messages.characterWarning')
                          .replace('{count}', MAX_CHARS - charCount)
                          .replace(
                            '{unit}',
                            MAX_CHARS - charCount === 1
                              ? safeT('homepage.chat.messages.character')
                              : safeT('homepage.chat.messages.characters')
                          )}
                  </div>
                )}
              </div>
            </form>
          )}
          <GcdsDetails className="hr" detailsTitle={safeT('homepage.chat.options.title')} tabIndex="0">
            <div className="ai-toggle">
              <fieldset className="ai-toggle_fieldset">
                <div className="ai-toggle_container">
                  <legend className="ai-toggle_legend">
                    {safeT('homepage.chat.options.aiSelection.label')}
                  </legend>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="anthropic"
                      name="ai-selection"
                      value="anthropic"
                      checked={selectedAI === 'anthropic'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="claude">
                      {safeT('homepage.chat.options.aiSelection.anthropic')}
                    </label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="openai"
                      name="ai-selection"
                      value="openai"
                      checked={selectedAI === 'openai'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="openai">{safeT('homepage.chat.options.aiSelection.openai')}</label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="azure"
                      name="ai-selection"
                      value="azure"
                      checked={selectedAI === 'azure'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="azure">{safeT('homepage.chat.options.aiSelection.azure')}</label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="search-toggle">
              <fieldset className="ai-toggle_fieldset">
                <div className="ai-toggle_container">
                  <legend className="ai-toggle_legend">
                    {safeT('homepage.chat.options.searchSelection.label')}
                  </legend>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="search-canadaca"
                      name="search-selection"
                      value="canadaca"
                      checked={selectedSearch === 'canadaca'}
                      onChange={handleSearchToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="search-canadaca">
                      {safeT('homepage.chat.options.searchSelection.canadaca')}
                    </label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="search-google"
                      name="search-selection"
                      value="google"
                      checked={selectedSearch === 'google'}
                      onChange={handleSearchToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="search-google">
                      {safeT('homepage.chat.options.searchSelection.google')}
                    </label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="mrgn-bttm-10">
              <label htmlFor="referring-url">{safeT('homepage.chat.options.referringUrl.label')}</label>
              <input
                id="referring-url"
                type="url"
                value={referringUrl}
                onChange={handleReferringUrlChange}
                className="chat-border"
              />
            </div>

            {/* Conditionally render the override toggle for admins */}
            {isAdmin && (
              <div className="override-toggle">
                 <input
                  type="checkbox"
                  id="override-toggle-checkbox"
                  name="overrideToggle"
                  checked={isOverrideTestingActive}
                  onChange={handleOverrideToggleChange} // Use the passed handler
                />
                <label htmlFor="override-toggle-checkbox">
                  {t('homepage.chat.options.overrideToggle.label', 'Test with my prompt overrides')}
                </label>
               
              </div>
            )}
          </GcdsDetails>
        </div>
      )}

    </div>
  );
};

export default ChatInterface;