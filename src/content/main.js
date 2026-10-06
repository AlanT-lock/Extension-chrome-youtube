// YouTube Auto Ad Skip - Main Content Script

import { logger } from './logger.js';
import { storage } from '../shared/storage.js';
import { adDetector } from './ad-detector.js';
import { adActions } from './ad-actions.js';
import { STATES, TIMEOUTS, MESSAGE_TYPES } from '../shared/constants.js';
import { debounce, throttle } from './dom-utils.js';

/**
 * Main content script for YouTube Auto Ad Skip extension
 * Handles ad detection and blocking workflow
 */

class YouTubeAdSkipper {
  constructor() {
    this.observer = null;
    this.detectionInterval = null;
    this.isRunning = false;
    this.lastDetectionTime = 0;
    this.settings = {};
    
    // Bind methods
    this.handleMutation = this.handleMutation.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.detectAndHandleAd = this.detectAndHandleAd.bind(this);
    this.debouncedDetect = debounce(this.detectAndHandleAd, TIMEOUTS.AD_DETECTION_DEBOUNCE);
  }

  /**
   * Initialize the extension
   */
  async initialize() {
    try {
      // Load settings
      this.settings = await storage.getSettings();
      
      // Update logger based on settings
      if (this.settings.debugMode) {
        logger.enableDebug();
      } else {
        logger.enable();
      }

      logger.info('YouTube Auto Ad Skip initialized');

      // Start the extension if enabled
      if (this.settings.extensionEnabled) {
        await this.start();
      }

      // Set up message listener for communication with popup
      chrome.runtime.onMessage.addListener(this.handleMessage);

      // Set up periodic settings check
      this.setupSettingsWatcher();
      
    } catch (error) {
      console.error('[YouTubeAdSkipper] Error initializing:', error);
    }
  }

  /**
   * Start the extension
   */
  async start() {
    if (this.isRunning) {
      logger.debug('Extension is already running');
      return;
    }

    logger.info('Starting YouTube Auto Ad Skip');
    this.isRunning = true;

    // Set up MutationObserver
    this.setupMutationObserver();

    // Start periodic detection (fallback)
    this.startPeriodicDetection();

    // Initial detection
    await this.detectAndHandleAd();
  }

  /**
   * Stop the extension
   */
  stop() {
    if (!this.isRunning) {
      logger.debug('Extension is already stopped');
      return;
    }

    logger.info('Stopping YouTube Auto Ad Skip');
    this.isRunning = false;

    // Disconnect MutationObserver
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clear periodic detection
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    // Reset ad actions
    adActions.reset();
  }

  /**
   * Set up MutationObserver to detect DOM changes
   */
  setupMutationObserver() {
    // Disconnect existing observer
    if (this.observer) {
      this.observer.disconnect();
    }

    // Target node - use the document body or a more specific container
    const targetNode = document.body || document.documentElement;

    // Options for the observer
    const config = {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    };

    // Create an observer instance
    this.observer = new MutationObserver(this.handleMutation);

    // Start observing
    this.observer.observe(targetNode, config);

    logger.debug('MutationObserver set up');
  }

  /**
   * Handle DOM mutations
   * @param {MutationRecord[]} mutations - Mutation records
   */
  handleMutation(mutations) {
    if (!this.isRunning) return;

    // Throttle mutation handling to avoid excessive processing
    const now = Date.now();
    if (now - this.lastDetectionTime < 100) {
      return;
    }

    // Check if any mutation is relevant
    let hasRelevantMutation = false;

    for (const mutation of mutations) {
      // Check if mutation affects player or ad-related elements
      if (this.isRelevantMutation(mutation)) {
        hasRelevantMutation = true;
        break;
      }
    }

    if (hasRelevantMutation) {
      this.lastDetectionTime = now;
      this.debouncedDetect();
    }
  }

  /**
   * Check if a mutation is relevant for ad detection
   * @param {MutationRecord} mutation - Mutation to check
   * @returns {boolean}
   */
  isRelevantMutation(mutation) {
    // Check added nodes
    if (mutation.addedNodes && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node;
          
          // Check if it's a player or ad-related element
          if (element.className && (
            element.className.includes('player') ||
            element.className.includes('ad') ||
            element.className.includes('video')
          )) {
            return true;
          }

          // Check if it's a button or menu
          if (element.tagName === 'BUTTON' || 
              element.tagName === 'A' ||
              element.getAttribute('role') === 'menu' ||
              element.getAttribute('role') === 'dialog') {
            return true;
          }
        }
      }
    }

    // Check removed nodes
    if (mutation.removedNodes && mutation.removedNodes.length > 0) {
      for (const node of mutation.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node;
          
          // Check if it's an ad-related element being removed
          if (element.className && (
            element.className.includes('ad') ||
            element.className.includes('skip')
          )) {
            return true;
          }
        }
      }
    }

    // Check attribute changes
    if (mutation.attributeName && (
      mutation.attributeName === 'class' ||
      mutation.attributeName === 'style' ||
      mutation.attributeName === 'aria-label' ||
      mutation.attributeName === 'role'
    )) {
      return true;
    }

    return false;
  }

  /**
   * Start periodic detection as fallback
   */
  startPeriodicDetection() {
    // Clear existing interval
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    // Check every 2 seconds as fallback
    this.detectionInterval = setInterval(() => {
      if (this.isRunning) {
        this.detectAndHandleAd();
      }
    }, 2000);

    logger.debug('Periodic detection started');
  }

  /**
   * Detect and handle ads
   */
  async detectAndHandleAd() {
    if (!this.isRunning) return;

    // Check if we're already processing an ad
    const currentState = adActions.getCurrentState();
    if (currentState !== STATES.IDLE && currentState !== STATES.AD_DISAPPEARED) {
      logger.debug(`Already in state ${currentState}, skipping detection`);
      return;
    }

    try {
      // Detect ad
      const detection = await adDetector.detectAd();
      
      if (detection.isAd && detection.confidence >= 0.8) {
        logger.info(`Ad detected with confidence ${detection.confidence}`);
        
        // Increment detection counter
        await storage.incrementStat('adsDetected');
        
        // Handle the ad
        await this.handleAdDetection(detection);
      } else {
        logger.debug(`No ad detected (confidence: ${detection.confidence})`);
      }
      
    } catch (error) {
      logger.error('Error in detect and handle ad:', error);
    }
  }

  /**
   * Handle ad detection
   * @param {Object} detection - Detection result
   */
  async handleAdDetection(detection) {
    if (!this.isRunning) return;

    logger.debug('Handling ad detection...');

    try {
      // Check if we should process this ad
      const currentSession = adActions.getCurrentSession();
      
      if (currentSession && !adActions.isSessionExpired()) {
        logger.debug('Already processing an ad session');
        return;
      }

      // Start new session
      adActions.startSession();
      
      // Try to block the ad
      const result = await adActions.blockCurrentAd();
      
      if (result.success) {
        logger.info(`Ad handled successfully using ${result.method}`);
      } else {
        logger.warn(`Failed to handle ad: ${result.reason}`);
        await storage.incrementStat('failedAttempts');
      }
      
    } catch (error) {
      logger.error('Error handling ad detection:', error);
      await storage.incrementStat('failedAttempts');
    }
  }

  /**
   * Set up settings watcher
   */
  setupSettingsWatcher() {
    // Check settings every 30 seconds
    setInterval(async () => {
      try {
        const newSettings = await storage.getSettings();
        
        // Check if settings have changed
        if (JSON.stringify(newSettings) !== JSON.stringify(this.settings)) {
          this.settings = newSettings;
          logger.debug('Settings updated:', this.settings);
          
          // Update logger
          if (this.settings.debugMode) {
            logger.enableDebug();
          } else {
            logger.enable();
          }

          // Restart or stop based on new settings
          if (this.settings.extensionEnabled && !this.isRunning) {
            await this.start();
          } else if (!this.settings.extensionEnabled && this.isRunning) {
            this.stop();
          }
        }
      } catch (error) {
        logger.error('Error in settings watcher:', error);
      }
    }, 30000);
  }

  /**
   * Handle messages from popup or background
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response function
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.TOGGLE_EXTENSION:
          this.settings.extensionEnabled = message.value;
          if (this.settings.extensionEnabled) {
            await this.start();
          } else {
            this.stop();
          }
          await storage.setSetting('extensionEnabled', this.settings.extensionEnabled);
          sendResponse({ success: true, extensionEnabled: this.settings.extensionEnabled });
          break;

        case MESSAGE_TYPES.TOGGLE_AUTO_BLOCK:
          this.settings.autoBlockEnabled = message.value;
          await storage.setSetting('autoBlockEnabled', this.settings.autoBlockEnabled);
          sendResponse({ success: true, autoBlockEnabled: this.settings.autoBlockEnabled });
          break;

        case MESSAGE_TYPES.TOGGLE_FALLBACK_SKIP:
          this.settings.useFallbackSkip = message.value;
          await storage.setSetting('useFallbackSkip', this.settings.useFallbackSkip);
          sendResponse({ success: true, useFallbackSkip: this.settings.useFallbackSkip });
          break;

        case MESSAGE_TYPES.TOGGLE_DEBUG:
          this.settings.debugMode = message.value;
          await storage.setSetting('debugMode', this.settings.debugMode);
          
          if (this.settings.debugMode) {
            logger.enableDebug();
          } else {
            logger.enable();
          }
          
          sendResponse({ success: true, debugMode: this.settings.debugMode });
          break;

        case MESSAGE_TYPES.GET_STATE:
          sendResponse({
            isRunning: this.isRunning,
            state: adActions.getCurrentState(),
            session: adActions.getCurrentSession()
          });
          break;

        case MESSAGE_TYPES.GET_STATS:
          const stats = await storage.getStats();
          sendResponse(stats);
          break;

        case MESSAGE_TYPES.RESET_STATS:
          await storage.resetStats();
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.LOG_EVENT:
          logger[message.level](message.message, message.data);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Check if we're on a YouTube video page
   * @returns {boolean}
   */
  isYouTubeVideoPage() {
    const path = window.location.pathname;
    return path.startsWith('/watch') || 
           path.startsWith('/shorts') ||
           path.startsWith('/live') ||
           path === '/' ||
           path === '';
  }

  /**
   * Check if we're on a YouTube page
   * @returns {boolean}
   */
  isYouTubePage() {
    return window.location.hostname.includes('youtube.com');
  }
}

// Initialize the extension when DOM is ready
let skipper = null;

function initializeExtension() {
  if (!window.location.hostname.includes('youtube.com')) {
    return;
  }

  // Create singleton instance
  if (!skipper) {
    skipper = new YouTubeAdSkipper();
    skipper.initialize();
  }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Export for testing
export { YouTubeAdSkipper, skipper };
