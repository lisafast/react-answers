import DataStoreService from './DataStoreService.js';

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

  async updateSettings(updates) {
    const updated = await DataStoreService.updateSettings(updates);
    this.#cache = updated;
    return updated;
  }

  async refresh() {
    this.#cache = await DataStoreService.getSettings();
    return this.#cache;
  }
}

export default new SettingsService();
