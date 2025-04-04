import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/App.css';
import { useTranslations } from '../../hooks/useTranslations.js';
import { usePageContext, DEPARTMENT_MAPPINGS } from '../../hooks/usePageParam.js';
import ChatInterface from './ChatInterface.js';
import { ChatService, RedactionError, PipelineStatus } from '../../services/ChatService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


const ChatAppContainer = ({ lang = 'en', chatId }) => {
  const MAX_CONVERSATION_TURNS = 3;
  const MAX_CHAR_LIMIT = 400;
  const { t } = useTranslations(lang);
  const { url: pageUrl, department: urlDepartment } = usePageContext();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [textareaKey, setTextareaKey] = useState(0);
  const [selectedAI, setSelectedAI] = useState('openai'); 
  const [selectedSearch, setSelectedSearch] = useState('google'); 
  const [showFeedback, setShowFeedback] = useState(false);
  const [referringUrl, setReferringUrl] = useState(pageUrl || '');
  const [selectedDepartment, setSelectedDepartment] = useState(urlDepartment || '');
  const [turnCount, setTurnCount] = useState(0);
  const messageIdCounter = useRef(0);
  // Update displayStatus state to hold an object { key: string|null, params?: object, message?: string }
  const [displayStatus, setDisplayStatus] = useState({ key: null, message: '' });
  const statusQueueRef = useRef([]); // Queue for status detail objects
  const statusTimeoutRef = useRef(null); // Ref for the active display timeout
  const isProcessingQueue = useRef(false); // Ref to prevent concurrent processing
  const isTyping = useRef(false);
  // Ref to store the ID of the message currently being streamed into (no longer used for placeholder)
  // const streamingMessageIdRef = useRef(null); // Removed as placeholder is gone

  // --- Function to Process the Status Queue ---
  const processStatusQueue = useCallback(() => {
    if (isProcessingQueue.current || statusQueueRef.current.length === 0) {
      return; // Don't process if already processing or queue is empty
    }

    isProcessingQueue.current = true; // Mark as processing
    const nextStatusDetails = statusQueueRef.current.shift(); // Get the next status details object

    setDisplayStatus(nextStatusDetails); // Display the status object

    // Clear the status after a delay
    statusTimeoutRef.current = setTimeout(() => {
      setDisplayStatus({ key: null, message: '' }); // Clear the displayed status object
      statusTimeoutRef.current = null; // Clear the timeout ref
      isProcessingQueue.current = false; // Mark as not processing
      processStatusQueue(); // Process the next item if any
    }, 2500); // Display for 2.5 seconds
  }, []); // No dependencies needed as it uses refs and setDisplayStatus

  // --- Define Single Status Update Handler ---
  // Receives status (enum) and details ({ key, params } or { message }) from ChatService
  const handleStatusUpdate = useCallback((status, details) => {
    console.log("Status Update Received:", status, details); // Debugging

    // Only queue statuses that have a key or a message intended for display
    // Ignore events like TOOL_END, AGENT_END, COMPLETE etc. unless they provide specific details
    if (details && (details.key || details.message)) {
       // Add the details object directly to the queue
      statusQueueRef.current.push(details);
      processStatusQueue(); // Attempt to process the queue
    } else if (status === PipelineStatus.COMPLETE || status === PipelineStatus.AGENT_END) {
       // If it's a completion event with no specific message, ensure the queue processes to clear
       processStatusQueue();
    }
    // No translation ('t()') happens here anymore.
  }, [processStatusQueue]); // Only depends on processStatusQueue (stable)

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
    setSelectedAI(e.target.value);
    console.log('AI toggled to:', e.target.value); // Add this line for debugging
  };

  const handleSearchToggle = (e) => {
    setSelectedSearch(e.target.value);
    console.log('Search toggled to:', e.target.value);
  };

  const clearInput = useCallback(() => {
    setInputText('');
    setTextareaKey(prevKey => prevKey + 1);
  }, []);



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
            text: t('homepage.chat.messages.characterLimit'),
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
      // NOTE: Placeholder AI message is removed. Message is added only on success.
      try {
        // Call the service, passing the single status handler
        const finalInteraction = await ChatService.processChatStream(
          chatId,
          userMessage,
          null, // No aiMessageId needed upfront anymore
          messages, // Pass previous messages for context
          lang,
          selectedDepartment,
          referringUrl,
          selectedAI,
          handleStatusUpdate, // Pass the single callback
          selectedSearch
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
        // Status queue will clear itself via timeouts

      } catch (error) {
         // Handle errors from the promise (e.g., connection failure, stream error, redaction)
        if (error instanceof RedactionError) {
          // Handle redaction error (remove user msg, add redacted user + system msg)
          const redactionUserMsgId = messageIdCounter.current++;
          const redactionBlockedMsgId = messageIdCounter.current++;
          // Filter only the original user message
          setMessages(prevMessages => prevMessages.filter(msg => msg.id !== userMessageId));
          // Add the redacted user message and the system block message
          setMessages(prevMessages => [
            ...prevMessages,
            {
              id: redactionUserMsgId, // Use new ID for redacted user message
              text: error.redactedText,
              redactedText: error.redactedText,
              redactedItems: error.redactedItems,
              sender: 'user',
              error: true
            },
            {
              id: redactionBlockedMsgId, // Use new ID for system block message
              text: <div dangerouslySetInnerHTML={{ __html: (error.redactedText.includes('XXX') ? t('homepage.chat.messages.privateContent') : t('homepage.chat.messages.blockedContent')) }} />,
              sender: 'system',
              error: true
            }
          ]);
          setIsLoading(false);
          // Status queue will clear itself
          return; // Stop further processing
        } else {
          // Handle other errors from the promise or stream
          console.error('Chat stream failed:', error);
          // Add a system error message instead of updating a placeholder
          const systemErrorMsgId = messageIdCounter.current++;
          setMessages(prevMessages => [
            ...prevMessages,
            {
              id: systemErrorMsgId,
              text: t('homepage.chat.messages.error'),
              sender: 'system',
              error: true
            }
          ]);
          setIsLoading(false);
          // Status queue will clear itself
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
    messages, // Ensure 'messages' is a dependency
    handleStatusUpdate, // Add handleStatusUpdate as dependency
    clearInput,
    lang,
    selectedAI,
    selectedDepartment,
    selectedSearch,
    referringUrl,
    t,
    chatId
    // processStatusQueue is stable due to useCallback([])
  ]);

  useEffect(() => {
    if (pageUrl && !referringUrl) {
      setReferringUrl(pageUrl);
    }
    if (urlDepartment && !selectedDepartment) {
      setSelectedDepartment(urlDepartment);
    }
  }, [pageUrl, urlDepartment, referringUrl, selectedDepartment]);

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
          {t('homepage.chat.input.loadingHint')}
        </p>
       </div>
        {/* Use the static translation key for the citation head */}
        {message.interaction.answerType === 'normal' && (t('homepage.chat.citation.head') || displayUrl) && (
          <div className="citation-container">
            {/* Display the static translation */}
            {t('homepage.chat.citation.head') && <p key={`${messageId}-head`} className="citation-head">{t('homepage.chat.citation.head')}</p>}
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
  }, [t, selectedDepartment]);

  // Add handler for department changes
  const handleDepartmentChange = (department) => {
    setSelectedDepartment(department);
  };

  return (
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
      privacyMessage={t('homepage.chat.messages.privacy')}
      getLabelForInput={() => turnCount >= 1 ? t('homepage.chat.input.followUp') : t('homepage.chat.input.initial')}
      chatId={chatId}
    />
  );
};

export default ChatAppContainer;
