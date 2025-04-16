import DataStoreService from './DataStoreService.js';
import { refreshRateLimiterSettings } from '../middleware/rateLimitMiddleware.js';

class SettingsService {
  #cache = null;
  #loading = null;

  async getSettings() {
    if (this.#cache) return this.#cache;
    if (this.#loading) return this.#loading;
    this.#loading = DataStoreService.getSettings().then(settings => {
      this.#cache = settings;
      this.#loading = null;
      return settings;
    });
    return this.#loading;
  }

  async getBatchDuration() {
    const settings = await this.getSettings();
    return settings.batchDuration;
  }

  async getEmbeddingDuration() {
    const settings = await this.getSettings();
    return settings.embeddingDuration;
  }

  async getEvalDuration() {
    const settings = await this.getSettings();
    return settings.evalDuration;
  }

  async getRateLimiterType() {
    const settings = await this.getSettings();
    return settings?.rateLimiterType || 'memory';
  }

  async getRateLimitPoints() {
    const settings = await this.getSettings();
    return settings?.rateLimitPoints || 10;
  }

  async getRateLimitDuration() {
    const settings = await this.getSettings();
    return settings?.rateLimitDuration || 60;
  }

  async updateSettings(updates) {
    const updated = await DataStoreService.updateSettings(updates);
    this.#cache = updated;
    await refreshRateLimiterSettings();
    return updated;
  }

  async refresh() {
    this.#cache = await DataStoreService.getSettings();
    await refreshRateLimiterSettings();
    return this.#cache;
  }
}

export default new SettingsService();
