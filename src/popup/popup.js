// YouTube Auto Ad Skip - Popup Script

import { storage } from '../shared/storage.js';
import { MESSAGE_TYPES, DEFAULT_SETTINGS, DEFAULT_STATS } from '../shared/constants.js';

/**
 * Popup controller for the extension
 */

class PopupController {
  constructor() {
    this.settings = DEFAULT_SETTINGS;
    this.stats = DEFAULT_STATS;
    this.state = {
      isRunning: false,
      currentState: 'Unknown'
    };
    
    // DOM elements
    this.elements = {
      extensionToggle: null,
      autoBlockToggle: null,
      fallbackToggle: null,
      debugToggle: null,
      adsDetected: null,
      adsBlocked: null,
      fallbackSkips: null,
      failedAttempts: null,
      timeSaved: null,
      extensionStatus: null,
      currentState: null,
      resetStats: null
    };
  }

  /**
   * Initialize the popup
   */
  async initialize() {
    try {
      // Load settings and stats
      await this.loadData();
      
      // Cache DOM elements
      this.cacheElements();
      
      // Bind events
      this.bindEvents();
      
      // Update UI
      await this.updateUI();
      
      // Request current state from content script
      this.requestState();
      
      // Set up periodic state updates
      this.setupPeriodicUpdates();
      
    } catch (error) {
      console.error('[Popup] Error initializing:', error);
    }
  }

  /**
   * Load settings and stats from storage
   */
  async loadData() {
    try {
      const loadedSettings = await storage.getSettings();
      const loadedStats = await storage.getStats();
      
      this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
      this.stats = { ...DEFAULT_STATS, ...loadedStats };
      
      console.log('[Popup] Loaded settings:', this.settings);
      console.log('[Popup] Loaded stats:', this.stats);
      
    } catch (error) {
      console.error('[Popup] Error loading data:', error);
      this.settings = DEFAULT_SETTINGS;
      this.stats = DEFAULT_STATS;
    }
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      extensionToggle: document.getElementById('extensionToggle'),
      autoBlockToggle: document.getElementById('autoBlockToggle'),
      fallbackToggle: document.getElementById('fallbackToggle'),
      debugToggle: document.getElementById('debugToggle'),
      adsDetected: document.getElementById('adsDetected'),
      adsBlocked: document.getElementById('adsBlocked'),
      fallbackSkips: document.getElementById('fallbackSkips'),
      failedAttempts: document.getElementById('failedAttempts'),
      timeSaved: document.getElementById('timeSaved'),
      extensionStatus: document.getElementById('extensionStatus'),
      currentState: document.getElementById('currentState'),
      resetStats: document.getElementById('resetStats')
    };
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Toggle events
    if (this.elements.extensionToggle) {
      this.elements.extensionToggle.addEventListener('change', (e) => this.handleToggle(e, 'extensionEnabled'));
    }
    
    if (this.elements.autoBlockToggle) {
      this.elements.autoBlockToggle.addEventListener('change', (e) => this.handleToggle(e, 'autoBlockEnabled'));
    }
    
    if (this.elements.fallbackToggle) {
      this.elements.fallbackToggle.addEventListener('change', (e) => this.handleToggle(e, 'useFallbackSkip'));
    }
    
    if (this.elements.debugToggle) {
      this.elements.debugToggle.addEventListener('change', (e) => this.handleToggle(e, 'debugMode'));
    }
    
    // Reset stats button
    if (this.elements.resetStats) {
      this.elements.resetStats.addEventListener('click', () => this.handleResetStats());
    }
  }

  /**
   * Handle toggle change
   * @param {Event} event - Change event
   * @param {string} settingKey - Setting key to update
   */
  async handleToggle(event, settingKey) {
    try {
      const value = event.target.checked;
      
      // Update local state
      this.settings[settingKey] = value;
      
      // Save to storage
      await storage.setSetting(settingKey, value);
      
      // Send message to content scripts
      const messageType = this.getMessageTypeForSetting(settingKey);
      await this.sendMessage({ type: messageType, value });
      
      // Update UI
      await this.updateUI();
      
      console.log(`[Popup] ${settingKey} set to ${value}`);
      
    } catch (error) {
      console.error(`[Popup] Error handling toggle for ${settingKey}:`, error);
      // Revert UI
      if (this.elements[`${settingKey}Toggle`]) {
        this.elements[`${settingKey}Toggle`].checked = this.settings[settingKey];
      }
    }
  }

  /**
   * Get message type for setting
   * @param {string} settingKey - Setting key
   * @returns {string}
   */
  getMessageTypeForSetting(settingKey) {
    const mapping = {
      extensionEnabled: MESSAGE_TYPES.TOGGLE_EXTENSION,
      autoBlockEnabled: MESSAGE_TYPES.TOGGLE_AUTO_BLOCK,
      useFallbackSkip: MESSAGE_TYPES.TOGGLE_FALLBACK_SKIP,
      debugMode: MESSAGE_TYPES.TOGGLE_DEBUG
    };
    
    return mapping[settingKey] || MESSAGE_TYPES.TOGGLE_EXTENSION;
  }

  /**
   * Handle reset stats
   */
  async handleResetStats() {
    try {
      // Show confirmation
      if (!confirm('Are you sure you want to reset all statistics?')) {
        return;
      }
      
      // Reset stats
      await storage.resetStats();
      
      // Update local state
      this.stats = DEFAULT_STATS;
      
      // Update UI
      await this.updateUI();
      
      // Send message to content scripts
      await this.sendMessage({ type: MESSAGE_TYPES.RESET_STATS });
      
      console.log('[Popup] Statistics reset');
      
    } catch (error) {
      console.error('[Popup] Error resetting stats:', error);
    }
  }

  /**
   * Update UI with current settings and stats
   */
  async updateUI() {
    try {
      // Update toggle states
      this.updateToggle('extensionToggle', this.settings.extensionEnabled);
      this.updateToggle('autoBlockToggle', this.settings.autoBlockEnabled);
      this.updateToggle('fallbackToggle', this.settings.useFallbackSkip);
      this.updateToggle('debugToggle', this.settings.debugMode);
      
      // Update statistics
      this.updateStat('adsDetected', this.stats.adsDetected);
      this.updateStat('adsBlocked', this.stats.adsBlocked);
      this.updateStat('fallbackSkips', this.stats.fallbackSkips);
      this.updateStat('failedAttempts', this.stats.failedAttempts);
      this.updateTimeSaved(this.stats.estimatedTimeSaved);
      
      // Update status
      this.updateStatus();
      
    } catch (error) {
      console.error('[Popup] Error updating UI:', error);
    }
  }

  /**
   * Update toggle state
   * @param {string} elementId - Element ID
   * @param {boolean} value - Toggle value
   */
  updateToggle(elementId, value) {
    const element = this.elements[elementId];
    if (element) {
      element.checked = value;
    }
  }

  /**
   * Update stat value
   * @param {string} elementId - Element ID
   * @param {number} value - Stat value
   */
  updateStat(elementId, value) {
    const element = this.elements[elementId];
    if (element) {
      element.textContent = value.toLocaleString();
    }
  }

  /**
   * Update time saved display
   * @param {number} seconds - Time saved in seconds
   */
  updateTimeSaved(seconds) {
    const element = this.elements.timeSaved;
    if (element) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      
      if (minutes > 0) {
        element.textContent = `${minutes} min ${remainingSeconds} sec`;
      } else {
        element.textContent = `${remainingSeconds} sec`;
      }
    }
  }

  /**
   * Update status display
   */
  updateStatus() {
    const extensionStatusElement = this.elements.extensionStatus;
    const currentStateElement = this.elements.currentState;
    
    if (extensionStatusElement) {
      extensionStatusElement.textContent = this.settings.extensionEnabled ? 'Active' : 'Inactive';
      extensionStatusElement.className = `status-value ${this.settings.extensionEnabled ? 'active' : 'inactive'}`;
    }
    
    if (currentStateElement) {
      currentStateElement.textContent = this.state.currentState || 'Unknown';
    }
  }

  /**
   * Request current state from content script
   */
  requestState() {
    this.sendMessage({ type: MESSAGE_TYPES.GET_STATE })
      .then(response => {
        if (response) {
          this.state = response;
          this.updateStatus();
        }
      })
      .catch(error => {
        console.error('[Popup] Error getting state:', error);
      });
  }

  /**
   * Set up periodic state updates
   */
  setupPeriodicUpdates() {
    // Update state every 5 seconds
    setInterval(() => {
      this.requestState();
    }, 5000);
    
    // Reload stats every 30 seconds
    setInterval(async () => {
      try {
        const newStats = await storage.getStats();
        this.stats = newStats;
        this.updateUI();
      } catch (error) {
        console.error('[Popup] Error reloading stats:', error);
      }
    }, 30000);
  }

  /**
   * Send message to background script
   * @param {Object} message - Message to send
   * @returns {Promise<Object>}
   */
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send message to content script in current tab
   * @param {Object} message - Message to send
   * @returns {Promise<Object>}
   */
  async sendMessageToContentScript(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.id) {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, message, response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      }
      
      return null;
    } catch (error) {
      console.error('[Popup] Error sending message to content script:', error);
      return null;
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const popup = new PopupController();
  await popup.initialize();
  
  // Export for testing
  window.popupController = popup;
});
