import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ClaudeService from '../../services/ClaudeService.js';
import ChatGPTService from '../../services/ChatGPTService.js';
import CohereService from '../../services/CohereService.js';
import RedactionService from '../../services/RedactionService.js';
import FeedbackComponent from './FeedbackComponent.js';
import LoggingService from '../../services/LoggingService.js';
import { GcdsTextarea, GcdsButton, GcdsDetails } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import { urlToSearch } from '../../utils/urlToSearch.js';
import { useTranslations } from '../../hooks/useTranslations.js';
import { usePageContext, DEPARTMENT_MAPPINGS } from '../../hooks/usePageParam.js';
import DepartmentSelectorTesting from './DepartmentSelectorTesting';
import ContextService from '../../services/ContextService.js';

// Utility functions go here, before the component
const extractSentences = (paragraph) => {
  const sentenceRegex = /<s-\d+>(.*?)<\/s-\d+>/g;
  const sentences = [];
  let match;
  while ((match = sentenceRegex.exec(paragraph)) !== null) {
    sentences.push(match[1].trim());
  }
  return sentences.length > 0 ? sentences : [paragraph];
};

// Move parsing logic outside component
const parseMessageContent = (text) => {
  let responseType = 'normal';
  let content = text;

  // Check for and remove tags, storing the response type
  if (text.includes('<not-gc>')) {
    responseType = 'not-gc';
    content = text.replace(/<\/?not-gc>/g, '').trim();
  } else if (text.includes('<pt-muni>')) {
    responseType = 'pt-muni';
    content = text.replace(/<\/?p?-?pt-muni>/g, '').trim();  // Updated regex to catch both <pt-muni> and <p-pt-muni>
  } else if (text.includes('<clarifying-question>')) {
    responseType = 'question';
    content = text.replace(/<\/?clarifying-question>/g, '').trim();
  }
  
  return { responseType, content };
};

const ChatAppContainer = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const { url: pageUrl, department: urlDepartment } = usePageContext();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [textareaKey, setTextareaKey] = useState(0);
  const [selectedAI, setSelectedAI] = useState('chatgpt');
  const [showFeedback, setShowFeedback] = useState(false);
  const [checkedCitations, setCheckedCitations] = useState({});
  const [referringUrl, setReferringUrl] = useState(pageUrl || '');
  const [selectedDepartment, setSelectedDepartment] = useState(urlDepartment || '');
  const MAX_CONVERSATION_TURNS = 3;
  const [turnCount, setTurnCount] = useState(0);
  const MAX_CHAR_LIMIT = 400;
  const messageIdCounter = useRef(0);

  // Add a ref to track if we're currently typing
  const isTyping = useRef(false);

  const handleInputChange = (e) => {
    isTyping.current = true;
    setInputText(e.target.value);
    // Reset typing state after a short delay
    setTimeout(() => {
      isTyping.current = false;
    }, 100);
  };

  const handleAIToggle = (e) => {
    setSelectedAI(e.target.value);
    console.log('AI toggled to:', e.target.value); // Add this line for debugging
  };

  const clearInput = useCallback(() => {
    setInputText('');
    setTextareaKey(prevKey => prevKey + 1);
  }, []);

  const parseAIResponse = useCallback((text, aiService) => {
    // console.log('Parsing AI response:', text, aiService);
    const citationHeadRegex = /<citation-head>(.*?)<\/citation-head>/;
    const citationUrlRegex = /<citation-url>(.*?)<\/citation-url>/;
    const confidenceRatingRegex = /<confidence>(.*?)<\/confidence>/;

    const headMatch = text.match(citationHeadRegex);
    const urlMatch = text.match(citationUrlRegex);
    const confidenceMatch = text.match(confidenceRatingRegex);

    let mainContent = text
      .replace(citationHeadRegex, '')
      .replace(citationUrlRegex, '')
      .replace(confidenceRatingRegex, '')
      .trim();

    // Split content into paragraphs, preserving sentence tags
    const paragraphs = mainContent.split(/\n+/);

    const result = {
      paragraphs,
      citationHead: headMatch ? headMatch[1] : null,
      citationUrl: urlMatch ? urlMatch[1] : null,
      confidenceRating: confidenceMatch ? confidenceMatch[1] : null,
      aiService
    };
    // console.log('Parsed AI response:', result);
    return result;
  }, []);

  const logInteraction = useCallback((
    redactedQuestion, 
    aiResponse, 
    aiService, 
    referringUrl, 
    citationUrl,
    originalCitationUrl,
    confidenceRating,
    feedback,
    expertFeedback
  ) => {
    console.log('Logging interaction with referringUrl:', referringUrl);

    const logEntry = {
      redactedQuestion,
      aiResponse,
      aiService,
      ...(referringUrl && { referringUrl }),
      citationUrl,
      originalCitationUrl,
      ...(confidenceRating && { confidenceRating }),
      ...(feedback !== undefined && { feedback }),
      ...(expertFeedback && { expertFeedback })
    };

    console.log('Final log entry:', logEntry);
    
    if (process.env.REACT_APP_ENV === 'production') {
      LoggingService.logInteraction(logEntry, false);
    }
  }, []);

  const handleFeedback = useCallback((isPositive, expertFeedback = null) => {
    const feedback = isPositive ? 'positive' : 'negative';
    console.log(`User feedback: ${feedback}`, expertFeedback);

    // Get the last message (which should be the AI response)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === 'ai') {
      const { text: aiResponse, aiService } = lastMessage;
      // Get original URL from AI response
      const { citationUrl: originalCitationUrl, confidenceRating } = parseAIResponse(aiResponse, aiService);

      // Get validated URL from checkedCitations
      const lastIndex = messages.length - 1;
      const validationResult = checkedCitations[lastIndex];
      const finalCitationUrl = validationResult?.url || validationResult?.fallbackUrl;

      // Get the user's message (which should be the second-to-last message)
      const userMessage = messages[messages.length - 2];
      if (userMessage && userMessage.sender === 'user') {
        // Only log if there's feedback
        logInteraction(
          userMessage.redactedText,
          aiResponse,
          aiService,
          userMessage.referringUrl,
          finalCitationUrl,
          originalCitationUrl,
          confidenceRating,
          feedback,
          expertFeedback
        );
      }
    }
  }, [messages, checkedCitations, logInteraction, parseAIResponse]);

  const handleReferringUrlChange = (e) => {
    const url = e.target.value.trim();
    console.log('Referring URL changed:', url);
    setReferringUrl(url);

    // Parse department from manually entered URL
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      // Find matching department
      let newDepartment = '';
      for (const segment of pathSegments) {
        for (const [, value] of Object.entries(DEPARTMENT_MAPPINGS)) {
          if (segment === value.en || segment === value.fr) {
            newDepartment = value.code;
            break;
          }
        }
        if (newDepartment) break;
      }
      
      // Update department if found, otherwise keep existing
      if (newDepartment) {
        setSelectedDepartment(newDepartment);
      }
    } catch (error) {
      // If URL is invalid or incomplete, don't change the department
      console.log('Invalid URL format:', error);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  // Define the failover order for each AI service
  const getNextAIService = (currentAI) => {
    const failoverOrder = {
      'claude': 'chatgpt',
      'chatgpt': 'claude',
      'cohere': 'claude'
    };
    return failoverOrder[currentAI];
  };

  const tryAIService = async (aiType, messageWithUrl, conversationHistory, lang) => {
    switch(aiType) {
      case 'claude':
        return await ClaudeService.sendMessage(messageWithUrl, conversationHistory, lang);
      case 'chatgpt':
        return await ChatGPTService.sendMessage(messageWithUrl, conversationHistory, lang);
      case 'cohere':
        return await CohereService.sendMessage(messageWithUrl, conversationHistory, lang);
      default:
        throw new Error('Invalid AI service');
    }
  };

  const addMessage = useCallback((messageData) => {
    const messageId = messageIdCounter.current++;
    setMessages(prev => [...prev, { ...messageData, id: messageId }]);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (inputText.trim() !== '' && !isLoading) {
      try {
        setIsLoading(true);
        
        // Initial validation checks
        if (inputText.length > MAX_CHAR_LIMIT) {
          setMessages(prevMessages => [
            ...prevMessages,
            { 
              text: t('homepage.chat.messages.characterLimit'),
              sender: 'system',
              error: true
            }
          ]);
          return;
        }

        if (turnCount >= MAX_CONVERSATION_TURNS) {
          return;
        }

        // Prepare user message and check for blocked content
        const userMessage = inputText.trim();
        const { redactedText, redactedItems } = RedactionService.redactText(userMessage);

        // Check for blocked content
        const hasBlockedContent = redactedText.includes('###');
        if (hasBlockedContent) {
          setMessages(prevMessages => [
            ...prevMessages,
            { 
              text: redactedText,
              redactedText: redactedText,
              redactedItems: redactedItems,
              sender: 'user'
            },
            { 
              text: t('homepage.chat.messages.blockedContent'),
              sender: 'system',
              error: true
            }
          ]);
          clearInput();
          return;
        }

        // Add initial thinking message
        setMessages(prevMessages => [
          ...prevMessages,
          { 
            text: t('homepage.chat.messages.startingToThink'), 
            sender: 'system', 
            temporary: true 
          }
        ]);

        // Get context only for the first message
        let department = selectedDepartment;
        let topic = '';
        let topicUrl = '';
        let departmentUrl = '';

        if (!referringUrl && turnCount === 0) {  // Only for first message
          try {
            // Update message to show deriving context
            setMessages(prevMessages => [
              ...prevMessages.filter(m => !m.temporary),
              { 
                text: t('homepage.chat.messages.derivingContext'), 
                sender: 'system', 
                temporary: true 
              }
            ]);
            // Start context derivation
            const contextMessage = `${redactedText}${
              referringUrl ? `\n<referring-url>${referringUrl}</referring-url>` : ''
            }`;
            const derivedContext = await ContextService.deriveContext(contextMessage, lang, department);
            department = derivedContext.department;
            topic = derivedContext.topic;
            topicUrl = derivedContext.topicUrl;
            departmentUrl = derivedContext.departmentUrl;
            console.log('Derived context:', { department, topic, topicUrl, departmentUrl });
          } catch (error) {
            console.error('Error deriving context:', error);
            department = '';
            topic = '';
          }
        }

        // Add user message after context derivation
        addMessage({
          text: userMessage,
          redactedText: redactedText,
          redactedItems: redactedItems,
          sender: 'user',
          department: department,
          topic: topic,
          topicUrl: topicUrl,
          departmentUrl: departmentUrl,
          ...(referringUrl.trim() && { referringUrl: referringUrl.trim() })
        });

        clearInput();

        // Update thinking message for AI processing
        setMessages(prevMessages => [
          ...prevMessages.filter(m => !m.temporary),
          { 
            text: t('homepage.chat.messages.processingRequest'), 
            sender: 'system', 
            temporary: true 
          }
        ]);

        // Rest of the existing AI processing code...
        const messageWithUrl = `${redactedText}${
          referringUrl ? `\n<referring-url>${referringUrl}</referring-url>` : ''
        }${
          department ? `\n<department>${department}</department>` : ''
        }${
          topic ? `\n<topic>${topic}</topic>` : ''
        }${
          topicUrl ? `\n<topicUrl>${topicUrl}</topicUrl>` : ''
        }${
          departmentUrl ? `\n<departmentUrl>${departmentUrl}</departmentUrl>` : ''
        }`;

        // console.log('Final message being sent to AI:', messageWithUrl);

        // Create conversation history
        const conversationHistory = messages
          .filter(msg => !msg.temporary && !msg.error)
          .map(msg => {
            if (msg.sender === 'user') {
              // For user messages, include all the context that was originally sent
              const contextEnrichedContent = `${msg.redactedText}${
                msg.referringUrl ? `\n<referring-url>${msg.referringUrl}</referring-url>` : ''
              }${
                msg.department ? `\n<department>${msg.department}</department>` : ''
              }${
                msg.topic ? `\n<topic>${msg.topic}</topic>` : ''
              }${
                msg.topicUrl ? `\n<topicUrl>${msg.topicUrl}</topicUrl>` : ''
              }${
                msg.departmentUrl ? `\n<departmentUrl>${msg.departmentUrl}</departmentUrl>` : ''
              }`;
              return {
                role: 'user',
                content: contextEnrichedContent
              };
            } else if (msg.sender === 'ai') {
              // For AI responses, preserve the complete response including any tags
              return {
                role: 'assistant',
                content: msg.text,
                aiService: msg.aiService
              };
            } else {
              // For any other message types (system messages, etc.)
              return {
                role: 'system',
                content: msg.text
              };
            }
          });

        console.log('Final message being sent to AI:', messageWithUrl);

        let response;
        let usedAI = selectedAI;

        try {
          response = await tryAIService(selectedAI, messageWithUrl, conversationHistory, lang);
          // console.log('Raw AI response:', response);
          
          // Remove this addMessage call since we'll add it after URL validation
          // addMessage({
          //   text: response,
          //   sender: 'ai',
          //   aiService: usedAI
          // });
          
          setShowFeedback(true);
        } catch (error) {
          console.error(`Error with ${selectedAI}:`, error);
          
          // Show "thinking more" message
          addMessage({
            text: t('homepage.chat.messages.thinkingMore'),
            sender: 'system'
          });

          // Try next service in the failover chain
          usedAI = getNextAIService(selectedAI);
          try {
            response = await tryAIService(usedAI, messageWithUrl, conversationHistory, lang);
            console.log('Raw AI response:', response);
          } catch (secondError) {
            console.error(`Error with ${usedAI}:`, secondError);
            
            // Try the final service in the chain
            usedAI = getNextAIService(usedAI);
            response = await tryAIService(usedAI, messageWithUrl, conversationHistory, lang);
          }
        }

        const { citationUrl: originalCitationUrl } = parseAIResponse(response, usedAI);
        
        // Create a new message ID before adding the message
        const newMessageId = messageIdCounter.current++;
        
        // Validate URL if present
        let finalCitationUrl, confidenceRating;
        if (originalCitationUrl) {
          const validationResult = await urlToSearch.validateAndCheckUrl(
            originalCitationUrl, 
            lang, 
            redactedText,  // Changed from userMessage to redactedText
            selectedDepartment,
            t
          );
          
          // Store validation result in checkedCitations using the new message ID
          setCheckedCitations(prev => ({
            ...prev,
            [newMessageId]: {
              url: validationResult?.url,
              fallbackUrl: validationResult?.fallbackUrl,
              confidenceRating: validationResult?.confidenceRating || '0.1',
              finalCitationUrl: validationResult?.url || validationResult?.fallbackUrl
            }
          }));

          finalCitationUrl = validationResult?.url || validationResult?.fallbackUrl;
          confidenceRating = validationResult?.confidenceRating || '0.1';
        }

        // Always log interaction for all response types (normal, not-gc, pt-muni, question)
        logInteraction(
          redactedText,
          response,
          usedAI,
          referringUrl.trim() || undefined,
          finalCitationUrl,
          originalCitationUrl,
          confidenceRating,
          undefined,
          undefined
        );

        // Add message with the new ID
        setMessages(prev => [...prev, {
          id: newMessageId,
          text: response,
          sender: 'ai',
          aiService: usedAI,
          department: department
        }]);
        
        setShowFeedback(true);

        setTurnCount(prevCount => prevCount + 1);

      } catch (error) {
        console.error('Error sending message:', error);
        setMessages(prevMessages => [
          ...prevMessages,
          { text: t('homepage.chat.messages.error'), sender: 'system', error: true }
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [inputText, referringUrl, turnCount, addMessage, clearInput, t, messages, selectedAI, parseAIResponse, lang, logInteraction, selectedDepartment, isLoading]);

  useEffect(() => {
    if (pageUrl && !referringUrl) {
      setReferringUrl(pageUrl);
    }
    
    if (urlDepartment && !selectedDepartment) {
      setSelectedDepartment(urlDepartment);
    }
  }, [pageUrl, urlDepartment, referringUrl, selectedDepartment]);

  // Memoize the parsed responses with better message tracking
  const parsedResponses = useMemo(() => {
    if (isTyping.current) return {};

    const responses = {};
    const processedIds = new Set();

    messages.forEach((message) => {
      if (message.sender === 'ai' && !processedIds.has(message.id) && message.id !== undefined) {
        processedIds.add(message.id);
        // console.log(`Parsing message ${message.id}:`, message.text.substring(0, 100) + '...');
        
        const { responseType, content } = parseMessageContent(message.text);
        const { paragraphs, citationHead } = parseAIResponse(content, message.aiService);
        
        responses[message.id] = {
          responseType,
          paragraphs,
          citationHead,
          aiService: message.aiService
        };
      }
    });
    return responses;
  }, [messages, parseAIResponse]);

  const formatAIResponse = useCallback((text, aiService, messageId) => {
    if (!isTyping.current && messageId !== undefined) {
      // console.log('Formatting message:', messageId);
    }
    
    const parsedResponse = parsedResponses[messageId];
    if (!parsedResponse) return null;
    
    const citationResult = checkedCitations[messageId];
    const displayUrl = citationResult?.finalCitationUrl || citationResult?.url || citationResult?.fallbackUrl;
    const finalConfidenceRating = citationResult ? citationResult.confidenceRating : '0.1';

    // Find the message to get its department
    const message = messages.find(m => m.id === messageId);
    const messageDepartment = message?.department || selectedDepartment;

    return (
      <div className="ai-message-content">
        {parsedResponse.paragraphs.map((paragraph, index) => {
          const sentences = extractSentences(paragraph);
          return sentences.map((sentence, sentenceIndex) => (
            <p key={`${messageId}-p${index}-s${sentenceIndex}`} className="ai-sentence">
              {sentence}
            </p>
          ));
        })}
        {parsedResponse.responseType === 'normal' && (parsedResponse.citationHead || displayUrl) && (
          <div className="citation-container">
            {parsedResponse.citationHead && <p key={`${messageId}-head`} className="citation-head">{parsedResponse.citationHead}</p>}
            {displayUrl && (
              <p key={`${messageId}-link`} className="citation-link">
                <a href={displayUrl} target="_blank" rel="noopener noreferrer">
                  {displayUrl}
                </a>
              </p>
            )}
            <p key={`${messageId}-confidence`} className="confidence-rating">
              {finalConfidenceRating !== undefined && `${t('homepage.chat.citation.confidence')} ${finalConfidenceRating}`}
              {finalConfidenceRating !== undefined && (aiService || messageDepartment) && ' | '}
              {aiService && `${t('homepage.chat.citation.ai')} ${aiService}`}
              {messageDepartment && ` | ${messageDepartment}`}
            </p>
          </div>
        )}
      </div>
    );
  }, [parsedResponses, checkedCitations, t, selectedDepartment, messages]);

  const privacyMessage = t('homepage.chat.messages.privacy');

  const getLabelForInput = () => {
    if (turnCount >= 1) {
      return t('homepage.chat.input.followUp');
    }
    return t('homepage.chat.input.initial');
  };

  // Add handler for department changes
  const handleDepartmentChange = (department) => {
    setSelectedDepartment(department);
  };

  return (
    <div className="chat-container">
      <div className="message-list">
        {messages.map((message) => (
          <div key={`message-${message.id}`} className={`message ${message.sender}`}>
            {message.sender === 'user' ? (
              <div className={`user-message-box ${message.redactedItems && message.redactedItems.length > 0 ? 'redacted-box' : ''}`}>
                <p className={message.redactedItems && message.redactedItems.length > 0 ? "redacted-message" : ""}>
                  {message.redactedText}
                </p>
                {message.redactedItems && message.redactedItems.length > 0 && (
                  <>
                    {message.redactedText.includes('XXX') && (
                      <p className="redacted-preview">{privacyMessage}</p>
                    )}
                    {message.redactedText.includes('###') && (
                      <p className="redacted-preview">{t('homepage.chat.messages.blockedMessage')}</p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                {message.error ? (
                  <div className="error-message">{message.text}</div>
                ) : (
                  formatAIResponse(message.text, message.aiService, message.id)
                )}
                {message.id === messages.length - 1 && 
                 showFeedback && 
                 !message.error && 
                 !message.text.includes('<clarifying-question>') && (
                  <FeedbackComponent onFeedback={handleFeedback} lang={lang} />
                )}
              </>
            )}
          </div>
        ))}
        {isLoading && <div key="loading" className="message ai">{t('homepage.chat.messages.thinking')}</div>}
        {turnCount >= MAX_CONVERSATION_TURNS && (
          <div key="limit-reached" className="message ai">
            <div className="limit-reached-message">
              {t('homepage.chat.messages.limitReached', { count: MAX_CONVERSATION_TURNS })}
              <GcdsButton onClick={handleReload} className="reload-button">
                {t('homepage.chat.buttons.reload')}
              </GcdsButton>
            </div>
          </div>
        )}
      </div>
      {turnCount < MAX_CONVERSATION_TURNS && (
        <div className="input-area mt-400">
          <div className="input-button-wrapper">
            <GcdsTextarea
              key={textareaKey}
              textareaId="textarea-props"
              value={inputText}
              label={getLabelForInput()}
              name="textarea-name"
              rows="2"
              hint={t('homepage.chat.input.hint')}
              onInput={handleInputChange}
              disabled={isLoading}
            />
             <GcdsButton onClick={handleSendMessage} disabled={isLoading} className="send-button">
              {t('homepage.chat.buttons.send')}
            </GcdsButton>
          </div>
          <GcdsDetails detailsTitle={t('homepage.chat.options.title')}>
            <div className="ai-toggle">
              <fieldset className="ai-toggle_fieldset">
                <div className="ai-toggle_container">
                  <legend className="ai-toggle_legend">{t('homepage.chat.options.aiSelection.label')}</legend>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="claude"
                      name="ai-selection"
                      value="claude"
                      checked={selectedAI === 'claude'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="claude" className="ai-toggle_label">{t('homepage.chat.options.aiSelection.claude')}</label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="chatgpt"
                      name="ai-selection"
                      value="chatgpt"
                      checked={selectedAI === 'chatgpt'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="chatgpt" className="ai-toggle_label">{t('homepage.chat.options.aiSelection.chatgpt')}</label>
                  </div>
                  <div className="ai-toggle_option">
                    <input
                      type="radio"
                      id="cohere"
                      name="ai-selection"
                      value="cohere"
                      checked={selectedAI === 'cohere'}
                      onChange={handleAIToggle}
                      className="ai-toggle_radio-input"
                    />
                    <label htmlFor="cohere">{t('homepage.chat.options.aiSelection.cohere')}</label>
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Add department selector here with label */}
            <div className="mrgn-bttm-10">
              <label className="display-block mrgn-bttm-4">Referred from:</label>
              <DepartmentSelectorTesting
                selectedDepartment={selectedDepartment}
                onDepartmentChange={handleDepartmentChange}
                lang={lang}
              />
            </div>

            <div className="mrgn-bttm-10">
              <label htmlFor="referring-url">{t('homepage.chat.options.referringUrl.label')}</label>
              <input
                id="referring-url"
                type="url"
                value={referringUrl}
                onChange={handleReferringUrlChange}
                className="chat-border"
              />
            </div>
          </GcdsDetails>
        </div>
      )}
    </div>
  );
};

export default ChatAppContainer;