// YouTube Auto Ad Skip - Logger Module

import { storage } from '../shared/storage.js';

/**
 * Logger class for extension debugging and logging
 * Supports different log levels and can be enabled/disabled
 */

class Logger {
  constructor() {
    this.logLevels = {
      INFO: 'info',
      DEBUG: 'debug',
      WARN: 'warn',
      ERROR: 'error'
    };
    
    this.prefix = '[AutoSkip]';
    this.enabled = false;
    this.debugMode = false;
    
    // Initialize from settings
    this.initialize();
  }

  /**
   * Initialize logger from settings
   */
  async initialize() {
    try {
      const settings = await storage.getSettings();
      this.enabled = settings.extensionEnabled;
      this.debugMode = settings.debugMode;
    } catch (error) {
      console.error('[Logger] Error initializing:', error);
    }
  }

  /**
   * Update logger settings
   */
  async updateSettings() {
    try {
      const settings = await storage.getSettings();
      this.enabled = settings.extensionEnabled;
      this.debugMode = settings.debugMode;
    } catch (error) {
      console.error('[Logger] Error updating settings:', error);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {Object} data - Additional data to log
   */
  info(message, data = {}) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [INFO] ${message}`;
    
    if (this.debugMode) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   * @param {Object} data - Additional data to log
   */
  debug(message, data = {}) {
    if (!this.enabled || !this.debugMode) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [DEBUG] ${message}`;
    
    console.debug(logMessage, data);
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {Object} data - Additional data to log
   */
  warn(message, data = {}) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [WARN] ${message}`;
    
    console.warn(logMessage, data);
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {Object} data - Additional data to log
   */
  error(message, data = {}) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [ERROR] ${message}`;
    
    console.error(logMessage, data);
  }

  /**
   * Log state transition
   * @param {string} from - Previous state
   * @param {string} to - New state
   */
  stateTransition(from, to) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [STATE] ${from} -> ${to}`;
    
    if (this.debugMode) {
      console.log(logMessage);
    }
  }

  /**
   * Log ad detection event
   * @param {Object} adInfo - Ad detection information
   */
  adDetected(adInfo) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [AD_DETECTED] Confidence: ${adInfo.confidence}, Type: ${adInfo.type}`;
    
    if (this.debugMode) {
      console.log(logMessage, adInfo);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Log action event
   * @param {string} action - Action name
   * @param {Object} details - Action details
   */
  action(action, details = {}) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [ACTION] ${action}`;
    
    if (this.debugMode) {
      console.log(logMessage, details);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Log DOM event
   * @param {string} event - Event name
   * @param {HTMLElement} element - Element involved
   */
  domEvent(event, element) {
    if (!this.enabled || !this.debugMode) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const elementInfo = element ? {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      text: element.textContent?.trim()?.substring(0, 50)
    } : null;
    
    const logMessage = `${this.prefix} ${timestamp} [DOM] ${event}`;
    console.log(logMessage, elementInfo);
  }

  /**
   * Log performance metric
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   */
  performance(metric, value) {
    if (!this.enabled || !this.debugMode) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [PERF] ${metric}: ${value}ms`;
    
    console.log(logMessage);
  }

  /**
   * Log session information
   * @param {Object} session - Session information
   */
  sessionInfo(session) {
    if (!this.enabled || !this.debugMode) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${this.prefix} ${timestamp} [SESSION]`;
    
    console.log(logMessage, session);
  }

  /**
   * Enable logger
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable logger
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Enable debug mode
   */
  enableDebug() {
    this.debugMode = true;
    this.enabled = true;
  }

  /**
   * Disable debug mode
   */
  disableDebug() {
    this.debugMode = false;
  }

  /**
   * Check if logger is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Check if debug mode is enabled
   * @returns {boolean}
   */
  isDebugEnabled() {
    return this.debugMode;
  }
}

// Singleton instance
export const logger = new Logger();

export default logger;
