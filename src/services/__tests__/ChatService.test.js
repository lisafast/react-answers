import { ChatService, RedactionError } from '../ChatService';
import RedactionService from '../RedactionService';
import ClientLoggingService from '../ClientLoggingService';

jest.mock('../RedactionService');
jest.mock('../ClientLoggingService');

describe('ChatService', () => {
  const mockParams = {
    chatId: 'test-chat-id',
    userMessage: 'Hello, how are you?',
    aiMessageId: 'msg-123',
    messages: [],
    lang: 'en',
    selectedDepartment: 'general',
    referringUrl: 'http://example.com',
    selectedAI: 'gpt4',
    t: jest.fn(),
    updateStatusWithTimer: jest.fn(),
    selectedSearch: 'default'
  };

  beforeEach(() => {
    RedactionService.ensureInitialized = jest.fn().mockResolvedValue();
    RedactionService.redactText = jest.fn().mockReturnValue({
      redactedText: 'Hello, how are you?',
      redactedItems: []
    });
    ClientLoggingService.info = jest.fn().mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processResponse', () => {
    it('should process a message successfully', async () => {
      const { chatId, userMessage, aiMessageId, messages, lang, selectedDepartment, 
        referringUrl, selectedAI, t, updateStatusWithTimer, selectedSearch } = mockParams;

      const result = await ChatService.processResponse(
        chatId,
        userMessage,
        aiMessageId,
        messages,
        lang,
        selectedDepartment,
        referringUrl,
        selectedAI,
        t,
        updateStatusWithTimer,
        selectedSearch
      );

      expect(RedactionService.ensureInitialized).toHaveBeenCalled();
      expect(RedactionService.redactText).toHaveBeenCalledWith(userMessage);
      expect(ClientLoggingService.info).toHaveBeenCalledWith(
        chatId,
        'Starting pipeline with data:',
        expect.any(Object)
      );
      expect(result).toBeDefined();
      expect(result.content).toEqual("This is a mock response");
      expect(result.context).toEqual({ topic: "general" });
      expect(result.question).toEqual(userMessage);
      expect(ChatService.onStatusUpdate).toHaveBeenCalledWith(PipelineStatus.MODERATING_QUESTION);
      expect(ChatService.onStatusUpdate).toHaveBeenCalledWith(PipelineStatus.REDACTING);
      expect(ClientLoggingService.info).toHaveBeenCalledWith(
        chatId,
        'Starting pipeline with data:',
        expect.objectContaining({
          chatId: chatId,
          userMessage: userMessage,
          aiMessageId: aiMessageId,
          messages: messages,
          lang: lang,
          selectedDepartment: selectedDepartment,
          referringUrl: referringUrl,
          selectedAI: selectedAI,
          selectedSearch: selectedSearch,
          elapsedTime: expect.any(Number)
        })
      );
    });

    it('should throw RedactionError for blocked content', async () => {
      RedactionService.redactText.mockReturnValue({
        redactedText: 'Hello, how are you? #blocked#',
        redactedItems: ['blocked']
      });

      const { chatId, userMessage, aiMessageId, messages, lang, selectedDepartment, 
        referringUrl, selectedAI, t, updateStatusWithTimer, selectedSearch } = mockParams;

      await expect(ChatService.processResponse(
        chatId,
        userMessage,
        aiMessageId,
        messages,
        lang,
        selectedDepartment,
        referringUrl,
        selectedAI,
        t,
        updateStatusWithTimer,
        selectedSearch
      )).rejects.toThrow(RedactionError);
    });
  });

  describe('processRedaction', () => {
    it('should process text without blocked content', async () => {
      const result = await ChatService.processRedaction('Hello, how are you?');
      expect(RedactionService.ensureInitialized).toHaveBeenCalled();
      expect(RedactionService.redactText).toHaveBeenCalledWith('Hello, how are you?');
      expect(result).toBeUndefined();
    });

    it('should throw RedactionError for text with blocked content', async () => {
      RedactionService.redactText.mockReturnValue({
        redactedText: 'Hello #blocked# XXX',
        redactedItems: ['blocked']
      });

      await expect(ChatService.processRedaction('Hello blocked XXX'))
        .rejects.toThrow(RedactionError);
    });
  });

  describe('onStatusUpdate', () => {
    it('should update status correctly', () => {
      const mockStatus = 'PROCESSING';
      const updateStatus = jest.fn();
      
      ChatService.onStatusUpdate(mockStatus, updateStatus);
      expect(updateStatus).toHaveBeenCalledWith(mockStatus);
    });
  });
});
