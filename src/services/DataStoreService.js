import { getApiUrl, getProviderApiUrl } from '../utils/apiToUrl.js';
import AuthService from './AuthService.js';
import { fetchWithSession } from '../utils/fetchWithSession.js';

class DataStoreService {
  static async checkDatabaseConnection() {
    if (process.env.REACT_APP_ENV !== 'production') {
      console.log('Skipping database connection check in development environment');
      return true;
    }

    try {
      const response = await fetchWithSession(getApiUrl('db-check'));
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
      const response = await AuthService.fetchWithAuth(getApiUrl('db-batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      const response = await AuthService.fetchWithAuth(getApiUrl('db-batch-list'));
      
      if (!response.ok) throw new Error('Failed to get batch list');
      return await response.json();
    } catch (error) {
      console.error('Error getting batch list:', error);
      throw error;
    }
  }

  static async getBatch(batchId) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl(`db-batch-retrieve?batchId=${batchId}`));
      
      if (!response.ok) throw new Error('Failed to retrieve batch');
      return await response.json();
    } catch (error) {
      console.error('Error retrieving batch:', error);
      throw error;
    }
  }

  static async persistInteraction(interactionData) {
    try {
      
      const response = await fetchWithSession(getApiUrl('db-persist-interaction'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader() // Add Authorization header
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
        ...expertFeedback, // Spread the incoming feedback object
        totalScore: expertFeedback.totalScore ?? null,
        sentence1Score: expertFeedback.sentence1Score ?? null,
        sentence2Score: expertFeedback.sentence2Score ?? null,
        sentence3Score: expertFeedback.sentence3Score ?? null,
        sentence4Score: expertFeedback.sentence4Score ?? null,
        citationScore: expertFeedback.citationScore ?? null,
        answerImprovement: expertFeedback.answerImprovement || '',
        expertCitationUrl: expertFeedback.expertCitationUrl || '',
        feedback: expertFeedback.feedback, // Directly use the feedback string provided by the component
        publicFeedbackReason: expertFeedback.publicFeedbackReason || '',
        publicFeedbackScore: expertFeedback.publicFeedbackScore ?? null
      };
    }
    console.log('User feedback:', JSON.stringify(formattedExpertFeedback, null, 2));

    try {
      const response = await fetchWithSession(getApiUrl('db-persist-feedback'), {
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
        throw new Error('Failed to log feedback');
      }

      console.log('Feedback logged successfully to database');
    } catch (error) {
      console.log('Development mode: Feedback not logged to console', {
        ...formattedExpertFeedback
      });
    }

  }
  static async getChatSession(sessionId) {
    try {
      const response = await fetchWithSession(getApiUrl(`db-chat-session?sessionId=${sessionId}`));
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
      const response = await AuthService.fetchWithAuth(getApiUrl(`db-chat-logs?${queryParams}`));
      if (!response.ok) throw new Error('Failed to get chat logs');
      return await response.json();
    } catch (error) {
      console.error('Error getting chat logs:', error);
      throw error;
    }
  }

  static async getLogs(chatId) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl(`db-log?chatId=${chatId}`));
      
      if (!response.ok) throw new Error('Failed to get logs');
      return await response.json();
    } catch (error) {
      console.error('Error getting logs:', error);
      throw error;
    }
  }

  static async getBatchStatus(batchId, aiProvider) {
    try {
      const response = await AuthService.fetchWithAuth(
        getProviderApiUrl(aiProvider, `batch-status?batchId=${batchId}`)
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
      const response = await AuthService.fetchWithAuth(
        getProviderApiUrl(aiProvider, `batch-cancel?batchId=${batchId}`)
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
      const response = await AuthService.fetchWithAuth(getApiUrl(`db-delete-chat?chatId=${chatId}`), {
        method: 'DELETE'
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

  static async getSiteStatus() {
    try {
      const response = await fetchWithSession(getApiUrl('db-public-site-status'));
      if (!response.ok) throw new Error('Failed to get site status');
      const data = await response.json();
      return data.value || 'unavailable';
    } catch (error) {
      console.error('Error getting site status:', error);
      return 'unavailable';
    }
  }

  static async setSiteStatus(status) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: 'siteStatus', value: status })
      });
      if (!response.ok) throw new Error('Failed to set site status');
      return await response.json();
    } catch (error) {
      console.error('Error setting site status:', error);
      throw error;
    }
  }

  // Add deployment mode setting
  static async getDeploymentMode() {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-settings?key=deploymentMode')); // Use fetchWithAuth
      if (!response.ok) throw new Error('Failed to get deployment mode');
      const data = await response.json();
      return data.value || 'CDS';
    } catch (error) {
      console.error('Error getting deployment mode:', error);
      return 'CDS';
    }
  }

  static async setDeploymentMode(mode) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: 'deploymentMode', value: mode })
      });
      if (!response.ok) throw new Error('Failed to set deployment mode');
      return await response.json();
    } catch (error) {
      console.error('Error setting deployment mode:', error);
      throw error;
    }
  }

  static async generateEmbeddings({ lastProcessedId = null, regenerateAll = false } = {}) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-generate-embeddings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lastProcessedId, regenerateAll })
      });
      if (!response.ok) throw new Error('Failed to generate embeddings');
      return await response.json();
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  static async generateEvals({ lastProcessedId = null, regenerateAll = false } = {}) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-generate-evals'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lastProcessedId, regenerateAll })
      });
      if (!response.ok) throw new Error('Failed to generate evals');
      return await response.json();
    } catch (error) {
      console.error('Error generating evals:', error);
      throw error;
    }
  }

  static async getExpertFeedbackCount() {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-expert-feedback-count'));
      if (!response.ok) throw new Error('Failed to get expert feedback count');
      const data = await response.json();
      return data.count;
    } catch (error) {
      console.error('Error getting expert feedback count:', error);
      throw error;
    }
  }
  static async getTableCounts() {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-table-counts'));
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to fetch table counts');
      }
      const data = await response.json();
      return data.counts;
    } catch (error) {
      console.error('Error fetching table counts:', error);
      throw error;
    }
  }
  static async repairTimestamps() {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-repair-timestamps'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to repair timestamps');
      }
      return await response.json();
    } catch (error) {
      console.error('Error repairing timestamps:', error);
      throw error;
    }
  }

  static async repairExpertFeedback() {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-repair-expert-feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to repair expert feedback');
      }
      return await response.json();
    } catch (error) {
      console.error('Error repairing expert feedback:', error);
      throw error;
    }
  }

  // Generic settings methods
  static async getSetting(key) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl(`db-settings?key=${key}`));
      if (!response.ok) throw new Error('Failed to get setting');
      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  static async setSetting(key, value) {
    try {
      const response = await AuthService.fetchWithAuth(getApiUrl('db-settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value })
      });
      if (!response.ok) throw new Error('Failed to set setting');
      return await response.json();
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  }
}

export default DataStoreService;
