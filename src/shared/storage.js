// YouTube Auto Ad Skip - Storage Management

import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_STATS } from './constants.js';

/**
 * Storage manager for extension settings and statistics
 * Uses chrome.storage.local for persistence
 */

class StorageManager {
  constructor() {
    this.cache = {
      settings: null,
      stats: null
    };
  }

  /**
   * Get settings from storage
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    if (this.cache.settings) {
      return this.cache.settings;
    }

    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      this.cache.settings = result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
      return this.cache.settings;
    } catch (error) {
      console.error('[Storage] Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to storage
   * @param {Object} settings - Settings to save
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    this.cache.settings = { ...this.cache.settings, ...settings };
    
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: this.cache.settings
      });
    } catch (error) {
      console.error('[Storage] Error saving settings:', error);
    }
  }

  /**
   * Get statistics from storage
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    if (this.cache.stats) {
      return this.cache.stats;
    }

    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
      this.cache.stats = result[STORAGE_KEYS.STATS] || DEFAULT_STATS;
      return this.cache.stats;
    } catch (error) {
      console.error('[Storage] Error getting stats:', error);
      return DEFAULT_STATS;
    }
  }

  /**
   * Save statistics to storage
   * @param {Object} stats - Statistics to save
   * @returns {Promise<void>}
   */
  async saveStats(stats) {
    this.cache.stats = { ...this.cache.stats, ...stats };
    
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.STATS]: this.cache.stats
      });
    } catch (error) {
      console.error('[Storage] Error saving stats:', error);
    }
  }

  /**
   * Increment a statistic counter
   * @param {string} key - Statistic key to increment
   * @param {number} value - Value to add (default: 1)
   * @returns {Promise<Object>} Updated statistics
   */
  async incrementStat(key, value = 1) {
    const stats = await this.getStats();
    stats[key] = (stats[key] || 0) + value;
    await this.saveStats(stats);
    this.cache.stats = stats;
    return stats;
  }

  /**
   * Add estimated time saved
   * @param {number} seconds - Seconds to add
   * @returns {Promise<Object>} Updated statistics
   */
  async addTimeSaved(seconds) {
    const stats = await this.getStats();
    stats.estimatedTimeSaved = (stats.estimatedTimeSaved || 0) + seconds;
    await this.saveStats(stats);
    this.cache.stats = stats;
    return stats;
  }

  /**
   * Reset all statistics
   * @returns {Promise<void>}
   */
  async resetStats() {
    this.cache.stats = DEFAULT_STATS;
    
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.STATS]: DEFAULT_STATS
      });
    } catch (error) {
      console.error('[Storage] Error resetting stats:', error);
    }
  }

  /**
   * Reset all settings to defaults
   * @returns {Promise<void>}
   */
  async resetSettings() {
    this.cache.settings = DEFAULT_SETTINGS;
    
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
      });
    } catch (error) {
      console.error('[Storage] Error resetting settings:', error);
    }
  }

  /**
   * Get setting by key
   * @param {string} key - Setting key
   * @returns {Promise<*>} Setting value
   */
  async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key];
  }

  /**
   * Set setting by key
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.saveSettings(settings);
  }

  /**
   * Toggle setting by key
   * @param {string} key - Setting key
   * @returns {Promise<boolean>} New setting value
   */
  async toggleSetting(key) {
    const current = await this.getSetting(key);
    const newValue = typeof current === 'boolean' ? !current : !Boolean(current);
    await this.setSetting(key, newValue);
    return newValue;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {
      settings: null,
      stats: null
    };
  }
}

// Singleton instance
export const storage = new StorageManager();

export default storage;
