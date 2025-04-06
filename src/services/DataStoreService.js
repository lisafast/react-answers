import { getApiUrl, getProviderApiUrl } from '../utils/apiToUrl.js';
import AuthService from './AuthService.js';
// NOTE: Removed backend model imports (PromptOverride, User) and ServerLoggingService
// This file should only contain frontend logic making API calls.

class DataStoreService {
  static async checkDatabaseConnection() {
    if (process.env.REACT_APP_ENV !== 'production') {
      console.log('Skipping database connection check in development environment');
      return true;
    }

    try {
      const response = await fetch(getApiUrl('db-check'));
      if (!response.ok) {
        throw new Error('Database connection failed');
      }
      const data = await response.json();
      console.log('Database connection status:', data.message);
      return true;
    } catch (error) {
      console.error('Error checking database connection:', error);
      return false;
    }
  }

  static async persistBatch(batchData) {
    try {
      const response = await fetch(getApiUrl('db-batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        body: JSON.stringify(batchData)
      });
      
      if (!response.ok) throw new Error('Failed to persist batch');
      return await response.json();
    } catch (error) {
      console.error('Error persisting batch:', error);
      throw error;
    }
  }

  static async getBatchList() {
    try {
      const response = await fetch(getApiUrl('db-batch-list'), {
        headers: AuthService.getAuthHeader()
      });
      
      if (!response.ok) throw new Error('Failed to get batch list');
      return await response.json();
    } catch (error) {
      console.error('Error getting batch list:', error);
      throw error;
    }
  }

  static async getBatch(batchId) {
    try {
      const response = await fetch(getApiUrl(`db-batch-retrieve?batchId=${batchId}`), {
        headers: AuthService.getAuthHeader()
      });
      
      if (!response.ok) throw new Error('Failed to retrieve batch');
      return await response.json();
    } catch (error) {
      console.error('Error retrieving batch:', error);
      throw error;
    }
  }

  static async persistInteraction(interactionData) {
    try {
      
      const response = await fetch(getApiUrl('db-persist-interaction'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(interactionData)
      });
      
      if (!response.ok) throw new Error('Failed to persist interaction');
      return await response.json();
    } catch (error) {
      console.error('Error persisting interaction:', error);
      throw error;
    }
  }

  
  static async persistFeedback(expertFeedback, chatId, userMessageId) {
    // Standardize expert feedback format - only accept new format
    let formattedExpertFeedback = null;
    if (expertFeedback) {
      formattedExpertFeedback = {
        totalScore: expertFeedback.totalScore ?? null,
        sentence1Score: expertFeedback.sentence1Score ?? null,
        sentence2Score: expertFeedback.sentence2Score ?? null,
        sentence3Score: expertFeedback.sentence3Score ?? null,
        sentence4Score: expertFeedback.sentence4Score ?? null,
        citationScore: expertFeedback.citationScore ?? null,
        answerImprovement: expertFeedback.answerImprovement || '',
        expertCitationUrl: expertFeedback.expertCitationUrl || '',
        feedback: expertFeedback.isPositive ? 'positive' : 'negative'
      };
    }
    console.log(`User feedback: ${expertFeedback}`);

    try {
      const response = await fetch(getApiUrl('db-persist-feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          interactionId: userMessageId,
          expertFeedback: formattedExpertFeedback
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to log interaction');
      }

      console.log('Interaction logged successfully to database');
    } catch (error) {
      console.log('Development mode: Interaction logged to console', {
        ...expertFeedback
      });
    }

  }

  static async getChatSession(sessionId) {
    try {
      const response = await fetch(getApiUrl(`db-chat-session?sessionId=${sessionId}`), {
        headers: AuthService.getAuthHeader()
      });
      
      if (!response.ok) throw new Error('Failed to get chat session');
      return await response.json();
    } catch (error) {
      console.error('Error getting chat session:', error);
      throw error;
    }
  }

  static async getChatLogs(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(getApiUrl(`db-chat-logs?${queryParams}`), {
        headers: AuthService.getAuthHeader()
      });
      
      if (!response.ok) throw new Error('Failed to get chat logs');
      return await response.json();
    } catch (error) {
      console.error('Error getting chat logs:', error);
      throw error;
    }
  }

  static async getLogs(chatId) {
    try {
      const response = await fetch(getApiUrl(`db-log?chatId=${chatId}`), {
        headers: AuthService.getAuthHeader()
      });
      
      if (!response.ok) throw new Error('Failed to get logs');
      return await response.json();
    } catch (error) {
      console.error('Error getting logs:', error);
      throw error;
    }
  }

  static async getBatchStatus(batchId, aiProvider) {
    try {
      const response = await fetch(
        getProviderApiUrl(aiProvider, `batch-status?batchId=${batchId}`),
        {
          headers: AuthService.getAuthHeader()
        }
      );
      const data = await response.json();
      return { batchId, status: data.status };
    } catch (error) {
      console.error(`Error fetching status for batch ${batchId}:`, error);
      return { batchId, status: 'Error' };
    }
  }

  static async cancelBatch(batchId, aiProvider) {
    try {
      const response = await fetch(
        getProviderApiUrl(aiProvider, `batch-cancel?batchId=${batchId}`),
        {
          headers: AuthService.getAuthHeader()
        }
      );
      if (!response.ok) throw new Error('Failed to cancel batch');
      return await response.json();
    } catch (error) {
      console.error('Error canceling batch:', error);
      throw error;
    }
  }

  static async getBatchStatuses(batches) {
    try {
      const statusPromises = batches.map(async (batch) => {
        if (!batch.status || batch.status !== 'processed') {
          const statusResult = await this.getBatchStatus(batch.batchId, batch.aiProvider);
          if (statusResult.status === 'not_found') {
            await this.cancelBatch(batch.batchId, batch.aiProvider);
          }
          return statusResult;
        } else {
          return Promise.resolve({ batchId: batch.batchId, status: batch.status });
        }
      });
      const statusResults = await Promise.all(statusPromises);
      return batches.map((batch) => {
        const statusResult = statusResults.find((status) => status.batchId === batch.batchId);
        return { ...batch, status: statusResult ? statusResult.status : 'Unknown' };
      });
    } catch (error) {
      console.error('Error fetching statuses:', error);
      throw error;
    }
  }

  static async deleteChat(chatId) {
    try {
      const response = await fetch(getApiUrl(`db-delete-chat?chatId=${chatId}`), {
        method: 'DELETE',
        headers: AuthService.getAuthHeader()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete chat');
      }
      return await response.json();
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }
}

export default DataStoreService;
