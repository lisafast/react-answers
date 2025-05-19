import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/App.css';
import { useTranslations } from '../../hooks/useTranslations.js';
import { usePageContext, DEPARTMENT_MAPPINGS } from '../../hooks/usePageParam.js';
import ChatInterface from './ChatInterface.js';
import { ChatService, RedactionError } from '../../services/ChatService.js';
import AuthService from '../../services/AuthService.js'; // Added for admin check and token
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Utility functions go here, before the component
const extractSentences = (paragraph) => {
  const sentenceRegex = /<s-?\d+>(.*?)<\/s-?\d+>/g;
  const sentences = [];
  let match;
  while ((match = sentenceRegex.exec(paragraph)) !== null) {
    sentences.push(match[1].trim());
  }
  return sentences.length > 0 ? sentences : [paragraph];
};

const ChatAppContainer = ({ lang = 'en', chatId }) => {
  const MAX_CONVERSATION_TURNS = 3;
  const MAX_CHAR_LIMIT = 400;
  const { t } = useTranslations(lang); 
  
  // Add safeT helper function
  const safeT = useCallback((key) => {
    const result = t(key);
    return typeof result === 'object' && result !== null ? result.text : result;
  }, [t]);

  const { url: pageUrl, department: urlDepartment } = usePageContext();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [textareaKey, setTextareaKey] = useState(0);
  // Load initial state from localStorage or use defaults
  const [selectedAI, setSelectedAI] = useState(() => localStorage.getItem('selectedAI') || 'openai');
  const [selectedSearch, setSelectedSearch] = useState(() => localStorage.getItem('selectedSearch') || 'google');
  const [showFeedback, setShowFeedback] = useState(false);
  const [referringUrl, setReferringUrl] = useState(pageUrl || '');
  const [selectedDepartment, setSelectedDepartment] = useState(urlDepartment || ''); // Department is derived, not stored directly
  const [turnCount, setTurnCount] = useState(0);
  const messageIdCounter = useRef(0);
  const [displayStatus, setDisplayStatus] = useState({ key: null, message: '' });
  // Load override state, ensuring it's treated as a boolean
  const [isOverrideTestingActive, setIsOverrideTestingActive] = useState(() => localStorage.getItem('isOverrideTestingActive') === 'true');
  const isAdmin = AuthService.isAdmin(); // Check if user is admin
  const statusQueueRef = useRef([]);
  const statusTimeoutRef = useRef(null); // Ref for the active display timeout
  const isProcessingQueue = useRef(false); // Ref to prevent concurrent processing
  const isTyping = useRef(false);
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');
  // Add this new state to prevent multiple loading announcements
  const [loadingAnnounced, setLoadingAnnounced] = useState(false);

  // This effect monitors displayStatus changes to update screen reader announcements
  useEffect(() => {
    if (isLoading) {
      // Update aria-live message whenever displayStatus changes to key statuses
      if (displayStatus === 'moderatingQuestion') {
        setAriaLiveMessage(safeT('homepage.chat.messages.moderatingQuestion'));
        setLoadingAnnounced(true);
      } else if (displayStatus === 'generatingAnswer') {
        setAriaLiveMessage(safeT('homepage.chat.messages.generatingAnswer'));
        setLoadingAnnounced(true);
      }
    } else {
      // Reset the flag when loading completes
      setLoadingAnnounced(false);
      
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage) {
        if (lastMessage.sender === 'ai' && !lastMessage.error) {
          // AI response
          const paragraphs = lastMessage.interaction?.answer?.paragraphs || [];
          const sentences = paragraphs.flatMap(paragraph => extractSentences(paragraph));
          const plainText = sentences.join(' ');
          const citation = lastMessage.interaction?.answer?.citationHead || '';
          const displayUrl = lastMessage.interaction?.citationUrl || '';
          setAriaLiveMessage(`${safeT('homepage.chat.messages.yourAnswerIs')} ${plainText} ${citation} ${displayUrl}`.trim());
        } else if (lastMessage.sender === 'user' && lastMessage.redactedText) {
          // Redacted user message - announce the redacted text first
          setAriaLiveMessage(lastMessage.text || '');
          // Don't set a timeout here - let ChatInterface handle the warning announcement
        } else if (lastMessage.sender === 'user' && !lastMessage.redactedText && !lastMessage.error) {
          // Regular user message
          setAriaLiveMessage(lastMessage.text || '');
        } else if (lastMessage.error && lastMessage.sender === 'system') {
          // System error messages (including character limit, general errors, etc.)
          if (lastMessage.text) {
            // Handle React elements by extracting text content
            if (React.isValidElement(lastMessage.text)) {
              // For system messages with dangerouslySetInnerHTML, we need the actual text
              // This is a fallback - ideally the error message should be stored as plain text
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = lastMessage.text.props.dangerouslySetInnerHTML.__html;
              setAriaLiveMessage(tempDiv.textContent || tempDiv.innerText || '');
            } else {
              setAriaLiveMessage(lastMessage.text);
            }
          }
        }
      }
    }
  }, [isLoading, displayStatus, messages, t, selectedDepartment, safeT, loadingAnnounced]);
  
  // --- Save state changes to localStorage ---
  useEffect(() => {
    localStorage.setItem('selectedAI', selectedAI);
  }, [selectedAI]);

  useEffect(() => {
    localStorage.setItem('selectedSearch', selectedSearch);
  }, [selectedSearch]);



  useEffect(() => {
    localStorage.setItem('isOverrideTestingActive', isOverrideTestingActive);
  }, [isOverrideTestingActive]);


  // --- Function to Process the Status Queue ---
  const processStatusQueue = useCallback(() => {
    if (isProcessingQueue.current || statusQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;
    const nextStatusDetails = statusQueueRef.current.shift();

    setDisplayStatus(nextStatusDetails);

    statusTimeoutRef.current = setTimeout(() => {
      isProcessingQueue.current = false;
      processStatusQueue();
    }, 500);
  }, []);

  // --- Define Single Status Update Handler ---
  // Receives status (enum) and details ({ key, params } or { message }) from ChatService
  const handleStatusUpdate = useCallback((status, details) => {
    

    statusQueueRef.current.push(details); // Add to queue

    if (!isProcessingQueue.current) {
      processStatusQueue();
    }
  }, [processStatusQueue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (e) => {
    isTyping.current = true;
    setInputText(e.target.value);
    // Reset typing state after a short delay
    setTimeout(() => {
      isTyping.current = false;
    }, 100);
  };

  const handleAIToggle = (e) => {
    const newAI = e.target.value;
    setSelectedAI(newAI);
    console.log('AI toggled to:', newAI);
  };

  const handleSearchToggle = (e) => {
    const newSearch = e.target.value;
    setSelectedSearch(newSearch);
    console.log('Search toggled to:', newSearch);
  };

  // Handler for the override toggle
  const handleOverrideToggleChange = (e) => {
    const newOverrideState = e.target.checked;
    setIsOverrideTestingActive(newOverrideState);
  };

  const clearInput = useCallback(() => {
    setInputText('');
    setTextareaKey(prevKey => prevKey + 1);
  }, []);

  const handleReferringUrlChange = (e) => {
    const newUrl = e.target.value.trim();
    console.log('Referring URL changed:', newUrl);
    setReferringUrl(newUrl);

    // Parse department from manually entered URL
    try {
      // Avoid parsing if the URL is empty
      if (!newUrl) {
        setSelectedDepartment(''); // Clear department if URL is cleared
        return;
      }
      const urlObj = new URL(newUrl);
      // const urlObj = new URL(url); // Removed duplicate declaration
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

  const handleSendMessage = useCallback(async () => {
    if (inputText.trim() !== '' && !isLoading) {

      setIsLoading(true);
      // Initial status set via handleStatusUpdate callback from service

      // --- Input Validation ---
      if (inputText.length > MAX_CHAR_LIMIT) {
        const errorMessageId = messageIdCounter.current++;
        setMessages(prevMessages => [
          ...prevMessages,
          {
            id: errorMessageId,
           text: safeT('homepage.chat.messages.characterLimit'),
            sender: 'system',
            error: true
          }
        ]);
        setIsLoading(false);
        return;
      }

      // --- Add User Message ---
      const userMessageId = messageIdCounter.current++;
      const userMessage = inputText.trim();
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: userMessageId,
          text: userMessage,
          sender: 'user',
          ...(referringUrl.trim() && { referringUrl: referringUrl.trim() })
        }
      ]);
      clearInput(); // Clear input after adding user message

      // --- Initiate Stream and Wait for Final Result ---
      try {
        // Determine if we need to send the auth token
        const authToken = (isAdmin && isOverrideTestingActive) ? AuthService.getToken() : null;
        if (authToken) {
           console.log("Sending chat request with admin auth token for override testing.");
        }

        // Call the service, passing the single status handler AND the auth token if applicable
        // Updated: ChatService.processChatStream no longer takes aiMessageId or messages
        const finalInteraction = await ChatService.processChatStream(
          chatId,
          userMessage,
          lang,
          selectedDepartment,
          referringUrl,
          selectedAI,
          handleStatusUpdate,
          selectedSearch,
          authToken,
          messageIdCounter.current 
        );

        // --- Process Final Result ---
        // Add the final AI message only upon successful completion
        const finalAiMessageId = messageIdCounter.current++;
        

        setMessages(prevMessages => [
          ...prevMessages,
          {
            id: finalAiMessageId,
            text: finalInteraction.answer, // Set the final text content
            interaction: finalInteraction,
            sender: 'ai',
            aiService: selectedAI,
            isLoading: false, // Not loading anymore
          }
        ]);

        setIsLoading(false);
        setShowFeedback(true);
        setTurnCount(prev => prev + 1);
        clearTimeout(statusTimeoutRef.current);
        setDisplayStatus({ key: null, message: '' });
        statusQueueRef.current = [];
        isProcessingQueue.current = false;

      } catch (error) {
        console.error('Chat stream failed:', error);

        clearTimeout(statusTimeoutRef.current);
        setDisplayStatus({ key: null, message: '' });
        statusQueueRef.current = [];
        isProcessingQueue.current = false;

        if (error instanceof RedactionError) {
          const redactionUserMsgId = messageIdCounter.current++;
          const redactionBlockedMsgId = messageIdCounter.current++;
          setMessages(prevMessages => prevMessages.filter(msg => msg.id !== userMessageId));
          setMessages(prevMessages => [
            ...prevMessages,
            {
              id: redactionUserMsgId,
              text: error.redactedText,
              redactedText: error.redactedText,
              redactedItems: error.redactedItems,
              sender: 'user',
              error: true
            },
            {
              id: redactionBlockedMsgId,  // Changed from blockedMessageId to redactionBlockedMsgId
              text: error.redactedText.includes('XXX') 
                ? safeT('homepage.chat.messages.privateContent')
                : safeT('homepage.chat.messages.blockedContent'),
              sender: 'system',
              error: true
            }
          ]);
          setIsLoading(false);
          return;
        } else {
          const systemErrorMsgId = messageIdCounter.current++;
          setMessages(prevMessages => [
            ...prevMessages,
            {
              id: systemErrorMsgId,
              text: safeT('homepage.chat.messages.error'),
              sender: 'system',
              error: true
            }
          ]);
          setIsLoading(false);
        }
      }
    }
  }, [
    chatId,
    inputText,
    referringUrl,
    selectedAI,
    selectedSearch,
    lang,
    t,
    clearInput,
    selectedDepartment,
    isLoading,
    handleStatusUpdate,
    isAdmin,
    isOverrideTestingActive
  ]);

  // Effect to set initial referringUrl from page context if not already set or loaded
  useEffect(() => {
    // Set department based on URL context (either initial page or loaded/changed referringUrl)
    if (urlDepartment && !selectedDepartment) {
       setSelectedDepartment(urlDepartment);
    }
    // Re-parse department if referringUrl changes after initial load
    // This handles cases where the user manually changes the URL
    try {
        if (referringUrl) {
            const urlObj = new URL(referringUrl);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
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
            if (newDepartment && newDepartment !== selectedDepartment) {
                setSelectedDepartment(newDepartment);
            } else if (!newDepartment && selectedDepartment) {
                 // Clear department if URL no longer maps to one
                 // setSelectedDepartment(''); // Optional: Decide if clearing is desired
            }
        } else if (selectedDepartment) {
             // Clear department if URL is empty
             // setSelectedDepartment(''); // Optional: Decide if clearing is desired
        }
    } catch (error) {
        console.log('Invalid URL format during effect:', error);
        // Optionally clear department on invalid URL
        // if (selectedDepartment) setSelectedDepartment('');
    }

  }, [pageUrl, urlDepartment, referringUrl, selectedDepartment]); // Rerun when referringUrl changes too


  const formatAIResponse = useCallback((aiService, message) => {
    const messageId = message.id;
    let sentences = message.interaction.sentences;
    const displayUrl = message.interaction.citationUrl;
    const finalConfidenceRating = message.interaction.confidenceRating ? message.interaction.confidenceRating : '0.1';

    const messageDepartment = message?.department || selectedDepartment;

    return (
      <div className="ai-message-content">
        {sentences.map((sentence, sentenceIndex) => (
            <p key={`${messageId}-p-s${sentenceIndex}`} className="ai-sentence">
              {sentence}
            </p>
          ))}
        
        <div className="mistake-disc">
          <p><FontAwesomeIcon icon="wand-magic-sparkles" />&nbsp;
          {safeT('homepage.chat.input.loadingHint')}
        </p>
       </div>
        {/* Use the static translation key for the citation head */}
        {message.interaction.answerType === 'normal' && (t('homepage.chat.citation.head') || displayUrl) && (
          <div className="citation-container">
            {/* Display the static translation */}
            {t('homepage.chat.citation.head') && <p key={`${messageId}-head`} className="citation-head">{t('homepage.chat.citation.head')}</p>}
            {displayUrl && (
              <p key={`${messageId}-link`} className="citation-link">
                <a href={displayUrl} target="_blank" rel="noopener noreferrer" tabIndex="0">
                  {displayUrl}
                </a>
              </p>
            )}
            {/*<p key={`${messageId}-confidence`} className="confidence-rating">
              {finalConfidenceRating !== undefined && `${t('homepage.chat.citation.confidence')} ${finalConfidenceRating}`}
              {finalConfidenceRating !== undefined && (aiService || messageDepartment) && ' | '}
              {aiService && `${t('homepage.chat.citation.ai')} ${aiService}`}
              {messageDepartment && ` | ${messageDepartment}`}
            </p> */}
          </div>
        )}
      </div>
    );
  }, [t, selectedDepartment, safeT]);

  // Add handler for department changes
  const handleDepartmentChange = (department) => {
    setSelectedDepartment(department);
  };
  
  const initialInput = t('homepage.chat.input.initial');
  
  return (
    <>
      <ChatInterface
        messages={messages}
        inputText={inputText}
        isLoading={isLoading}
        textareaKey={textareaKey}
        handleInputChange={handleInputChange}
        handleSendMessage={handleSendMessage}
        handleReload={handleReload}
        handleAIToggle={handleAIToggle}
        handleSearchToggle={handleSearchToggle} // Add this line
        handleDepartmentChange={handleDepartmentChange}
        handleReferringUrlChange={handleReferringUrlChange}
        formatAIResponse={formatAIResponse}
        selectedAI={selectedAI}
        selectedSearch={selectedSearch} // Add this line
        selectedDepartment={selectedDepartment}
        referringUrl={referringUrl}
        turnCount={turnCount}
        showFeedback={showFeedback}
        displayStatus={displayStatus}
        MAX_CONVERSATION_TURNS={MAX_CONVERSATION_TURNS}
        t={t}
        lang={lang}
        isAdmin={isAdmin}
        isOverrideTestingActive={isOverrideTestingActive}
        handleOverrideToggleChange={handleOverrideToggleChange}
        privacyMessage={safeT('homepage.chat.messages.privacy')}
        getLabelForInput={() =>
          turnCount === 0
            ? (typeof initialInput === 'object' ? initialInput.text : initialInput)
            : (typeof t('homepage.chat.input.followUp') === 'object' 
               ? t('homepage.chat.input.followUp').text 
               : t('homepage.chat.input.followUp'))
        }
        ariaLabelForInput={
          turnCount === 0
            ? (typeof initialInput === 'object' ? initialInput.ariaLabel : undefined)
            : (typeof t('homepage.chat.input.followUp') === 'object'
               ? t('homepage.chat.input.followUp').ariaLabel
               : undefined)
        }
        extractSentences={extractSentences}
        chatId={chatId}
      />
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
      >
        {ariaLiveMessage}
      </div>
    </>
  );
};

export default ChatAppContainer;
