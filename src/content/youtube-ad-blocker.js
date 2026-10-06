// YouTube Auto Ad Skip - Main Content Script (Inline version for reliability)
// This file contains all the logic inlined to avoid module loading issues

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION & CONSTANTS
  // ============================================================================

  const EXTENSION_STATE = {
    ON: 'on',
    OFF: 'off'
  };

  const STATES = {
    IDLE: 'IDLE',
    AD_DETECTED: 'AD_DETECTED',
    FINDING_INFO: 'FINDING_INFO',
    CLICKING_INFO: 'CLICKING_INFO',
    WAITING_FOR_MENU: 'WAITING_FOR_MENU',
    FINDING_BLOCK_ACTION: 'FINDING_BLOCK_ACTION',
    CLICKING_BLOCK: 'CLICKING_BLOCK',
    WAITING_FOR_RESULT: 'WAITING_FOR_RESULT',
    AD_DISAPPEARED: 'AD_DISAPPEARED',
    FALLBACK_SKIP: 'FALLBACK_SKIP',
    FAILED: 'FAILED'
  };

  const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.85,
    MEDIUM: 0.7,
    LOW: 0.5,
    AD_DETECTED: 0.8
  };

  const AD_DETECTION_SCORES = {
    AD_INDICATOR_PRESENCE: 40,
    INFO_BUTTON_DETECTED: 30,
    KNOWN_AD_STRUCTURE: 20,
    AD_TEXT_DETECTED: 10,
    PLAYER_OVERLAY: 15,
    AD_CONTAINER: 25
  };

  const TIMEOUTS = {
    MENU_OPEN_WAIT: 2000,
    BLOCK_ACTION_WAIT: 2000,
    AD_DETECTION_DEBOUNCE: 200,
    MUTATION_OBSERVER_DELAY: 100,
    MAX_AD_SESSION_DURATION: 5000,
    POLLING_INTERVALS: [0, 50, 100, 200, 400, 800],
    CLICK_DELAY: 50,
    MAX_RETRIES: 2
  };

  const AD_SESSION_LIMITS = {
    MAX_INFO_CLICKS: 2,
    MAX_BLOCK_CLICKS: 2,
    MAX_ATTEMPTS: 3,
    MAX_DURATION_MS: 5000
  };

  const SELECTORS = {
    PLAYER_CONTAINER: [
      'ytd-player',
      '#movie_player',
      '.html5-video-container',
      '[data-context-item-id]',
      '.ytd-watch-flexy'
    ],
    AD_INDICATORS: [
      'div[aria-label*="advertisement" i]',
      'div[aria-label*="ad" i]',
      'div[aria-label*="annonce" i]',
      'div[aria-label*="publicité" i]',
      '.ad-container',
      '.video-ads',
      'ytd-ad-module',
      '.ad-showing',
      '.ad-interrupting',
      '.ad-pod',
      'div.ad-placeholder',
      '.ad-video',
      '.ad-overlay',
      '[class*="ad-"]',
      '[id*="ad"]',
      '.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button',
      '.ytp-ad-progress',
      '.ytp-ad-progress-list',
      '.ytp-ad-duration-remaining'
    ],
    INFO_BUTTONS: [
      'button[aria-label*="info" i]',
      'button[aria-label*="more" i]',
      'button[aria-label*="plus" i]',
      'button[title*="info" i]',
      '.ytp-ad-button',
      '.ytp-ad-info-button',
      '.ad-info-button',
      'button:has(svg)',
      'button svg'
    ],
    MENUS: [
      '[role="menu"]',
      '[role="dialog"]',
      '[role="popup"]',
      '.ad-menu',
      '.ad-dialog',
      '.ad-context-menu',
      'ytd-popup-container',
      '.ytp-popup',
      '.ad-info-popup',
      '.ad-details-menu'
    ],
    BLOCK_ACTIONS: [
      'button:contains("Block ad")',
      'button:contains("Block this ad")',
      'button:contains("Stop seeing this ad")',
      'button:contains("Bloquer l\'annonce")',
      'button:contains("Bloquer cette annonce")',
      'button:contains("Bloquer la pub")',
      '[aria-label*="block" i]',
      '[aria-label*="bloquer" i]',
      '[data-action*="block"]'
    ],
    SKIP_BUTTONS: [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-container',
      'button.ytp-ad-skip-button',
      'div.ytp-ad-skip-button',
      '[aria-label*="skip" i]',
      '[aria-label*="ignorer" i]',
      '[aria-label*="passer" i]',
      '[aria-label*="sauter" i]'
    ]
  };

  const MESSAGE_TYPES = {
    TOGGLE_EXTENSION: 'TOGGLE_EXTENSION',
    TOGGLE_AUTO_BLOCK: 'TOGGLE_AUTO_BLOCK',
    TOGGLE_FALLBACK_SKIP: 'TOGGLE_FALLBACK_SKIP',
    TOGGLE_DEBUG: 'TOGGLE_DEBUG',
    RESET_STATS: 'RESET_STATS',
    GET_STATE: 'GET_STATE',
    GET_STATS: 'GET_STATS',
    LOG_EVENT: 'LOG_EVENT'
  };

  const STORAGE_KEYS = {
    SETTINGS: 'ytaas_settings',
    STATS: 'ytaas_stats'
  };

  const DEFAULT_SETTINGS = {
    extensionEnabled: true,
    autoBlockEnabled: true,
    useFallbackSkip: true,
    debugMode: false
  };

  const DEFAULT_STATS = {
    adsDetected: 0,
    adsBlocked: 0,
    fallbackSkips: 0,
    failedAttempts: 0,
    estimatedTimeSaved: 0
  };

  // ============================================================================
  // STORAGE MANAGER (Inline)
  // ============================================================================

  class StorageManager {
    constructor() {
      this.cache = {
        settings: null,
        stats: null
      };
    }

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

    async incrementStat(key, value = 1) {
      const stats = await this.getStats();
      stats[key] = (stats[key] || 0) + value;
      await this.saveStats(stats);
      this.cache.stats = stats;
      return stats;
    }

    async addTimeSaved(seconds) {
      const stats = await this.getStats();
      stats.estimatedTimeSaved = (stats.estimatedTimeSaved || 0) + seconds;
      await this.saveStats(stats);
      this.cache.stats = stats;
      return stats;
    }

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

    async setSetting(key, value) {
      const settings = await this.getSettings();
      settings[key] = value;
      await this.saveSettings(settings);
    }

    clearCache() {
      this.cache = { settings: null, stats: null };
    }
  }

  const storage = new StorageManager();

  // ============================================================================
  // LOGGER (Inline)
  // ============================================================================

  class Logger {
    constructor() {
      this.prefix = '[AutoSkip]';
      this.enabled = false;
      this.debugMode = false;
      this.initialize();
    }

    async initialize() {
      try {
        const settings = await storage.getSettings();
        this.enabled = settings.extensionEnabled;
        this.debugMode = settings.debugMode;
      } catch (error) {
        console.error('[Logger] Error initializing:', error);
      }
    }

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

    debug(message, data = {}) {
      if (!this.enabled || !this.debugMode) return;
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `${this.prefix} ${timestamp} [DEBUG] ${message}`;
      console.debug(logMessage, data);
    }

    warn(message, data = {}) {
      if (!this.enabled) return;
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `${this.prefix} ${timestamp} [WARN] ${message}`;
      console.warn(logMessage, data);
    }

    error(message, data = {}) {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `${this.prefix} ${timestamp} [ERROR] ${message}`;
      console.error(logMessage, data);
    }

    stateTransition(from, to) {
      if (!this.enabled) return;
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `${this.prefix} ${timestamp} [STATE] ${from} -> ${to}`;
      if (this.debugMode) console.log(logMessage);
    }

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

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
    enableDebug() { this.debugMode = true; this.enabled = true; }
    disableDebug() { this.debugMode = false; }
    isEnabled() { return this.enabled; }
    isDebugEnabled() { return this.debugMode; }
  }

  const logger = new Logger();

  // ============================================================================
  // DOM UTILITIES (Inline)
  // ============================================================================

  function isVisible(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    let current = element;
    while (current && current !== document.body) {
      const currentStyle = window.getComputedStyle(current);
      if (currentStyle.display === 'none' || currentStyle.visibility === 'hidden' || currentStyle.opacity === '0') return false;
      if (current.getAttribute('aria-hidden') === 'true') return false;
      current = current.parentElement;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function isClickable(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    if (element.disabled) return false;
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.pointerEvents === 'none') return false;
    if (!isVisible(element)) return false;
    const tagName = element.tagName.toLowerCase();
    const clickableTags = ['button', 'a', 'input', 'textarea', 'select', 'div', 'span'];
    if (!clickableTags.includes(tagName)) return false;
    if (tagName === 'input') {
      const type = element.type.toLowerCase();
      const clickableTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
      if (!clickableTypes.includes(type)) return false;
    }
    return true;
  }

  function isInsideVideoPlayer(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    const playerContainers = [];
    for (const selector of SELECTORS.PLAYER_CONTAINER) {
      const containers = document.querySelectorAll(selector);
      containers.forEach(container => {
        if (container && isVisible(container)) playerContainers.push(container);
      });
    }
    for (const container of playerContainers) {
      if (container.contains(element)) return true;
    }
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const windowWidth = window.innerWidth;
    const playerWidthRatio = 0.6;
    const playerLeft = (windowWidth - (windowWidth * playerWidthRatio)) / 2;
    const playerRight = playerLeft + (windowWidth * playerWidthRatio);
    if (centerX >= playerLeft && centerX <= playerRight) {
      const windowHeight = window.innerHeight;
      const playerTopRatio = 0.1;
      const playerBottomRatio = 0.9;
      if (centerY >= (windowHeight * playerTopRatio) && centerY <= (windowHeight * playerBottomRatio)) {
        return true;
      }
    }
    return false;
  }

  function getElementLabel(element) {
    if (!element || !(element instanceof HTMLElement)) return '';
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    const title = element.getAttribute('title');
    if (title) return title.trim();
    const text = element.textContent?.trim() || '';
    if (text) return text;
    const svg = element.querySelector('svg');
    if (svg) {
      const svgLabel = svg.getAttribute('aria-label');
      if (svgLabel) return svgLabel.trim();
    }
    return '';
  }

  function getElementRole(element) {
    if (!element || !(element instanceof HTMLElement)) return '';
    return element.getAttribute('role') || '';
  }

  function textContains(element, text) {
    if (!element) return false;
    const elementText = (element.textContent || '').toLowerCase();
    return elementText.includes(text.toLowerCase());
  }

  function findVisibleClickableElements(selectors, container = document) {
    const elements = [];
    for (const selector of selectors) {
      try {
        let found;
        if (selector.includes(':contains(')) {
          const match = selector.match(/:contains\(([^)]+)\)/i);
          if (match) {
            const searchText = match[1];
            const allElements = container.querySelectorAll('*');
            allElements.forEach(el => {
              if (isVisible(el) && isClickable(el) && textContains(el, searchText) && !elements.includes(el)) {
                elements.push(el);
              }
            });
          }
        } else {
          found = container.querySelectorAll(selector);
          found.forEach(el => {
            if (isVisible(el) && isClickable(el) && !elements.includes(el)) {
              elements.push(el);
            }
          });
        }
      } catch (e) {}
    }
    return elements;
  }

  function findAllMatchingElements(selectors, container = document) {
    const elements = [];
    for (const selector of selectors) {
      try {
        if (selector.includes(':contains(')) {
          const match = selector.match(/:contains\(([^)]+)\)/i);
          if (match) {
            const searchText = match[1];
            const allElements = container.querySelectorAll('*');
            allElements.forEach(el => {
              if (textContains(el, searchText) && !elements.includes(el)) {
                elements.push(el);
              }
            });
          }
        } else {
          const found = container.querySelectorAll(selector);
          found.forEach(el => {
            if (!elements.includes(el)) elements.push(el);
          });
        }
      } catch (e) {}
    }
    return elements;
  }

  function findPlayerContainer() {
    for (const selector of SELECTORS.PLAYER_CONTAINER) {
      const container = document.querySelector(selector);
      if (container && isVisible(container)) return container;
    }
    const fallbackSelectors = ['ytd-player', '#movie_player', '.html5-video-container'];
    for (const selector of fallbackSelectors) {
      const container = document.querySelector(selector);
      if (container && isVisible(container)) return container;
    }
    return null;
  }

  async function safeClick(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    if (!document.contains(element)) return false;
    if (!isVisible(element) || !isClickable(element)) return false;
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      element.dispatchEvent(clickEvent);
      if (!clickEvent.defaultPrevented) element.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      return true;
    } catch (error) {
      logger.error('Error clicking element:', error);
      return false;
    }
  }

  function debounce(func, wait) {
    let timeoutId = null;
    return function(...args) {
      const context = this;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // ============================================================================
  // AD DETECTOR (Inline)
  // ============================================================================

  class AdDetector {
    constructor() {
      this.lastDetectionTime = 0;
    }

    async detectAd() {
      logger.debug('Starting ad detection...');
      const startTime = Date.now();

      try {
        const settings = await storage.getSettings();
        if (!settings.extensionEnabled) {
          return { isAd: false, type: null, confidence: 0, element: null };
        }

        const player = findPlayerContainer();
        if (!player) {
          logger.debug('No player container found');
          return { isAd: false, type: null, confidence: 0, element: null };
        }

        let totalScore = 0;

        // Check for skip button
        const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
        if (skipButtons.length > 0) {
          totalScore += AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE;
          logger.debug('Skip button detected');
        }

        // Check for ad indicators
        const indicators = findAllMatchingElements(SELECTORS.AD_INDICATORS);
        for (const indicator of indicators) {
          if (isVisible(indicator)) {
            totalScore += AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE;
            logger.debug('Ad indicators detected');
            break;
          }
        }

        // Check for info button
        const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
        for (const button of infoButtons) {
          if (isInsideVideoPlayer(button)) {
            totalScore += AD_DETECTION_SCORES.INFO_BUTTON_DETECTED;
            logger.debug('Info button detected');
            break;
          }
        }

        // Check for ad structure
        const adContainers = player.querySelectorAll('.ad-container, .video-ads, ytd-ad-module, .ad-showing');
        for (const container of adContainers) {
          if (isVisible(container)) {
            totalScore += AD_DETECTION_SCORES.KNOWN_AD_STRUCTURE;
            logger.debug('Ad structure detected');
            break;
          }
        }

        // Check for ad text
        const textElements = player.querySelectorAll('span, div, a, p');
        for (const element of textElements) {
          if (isVisible(element)) {
            const text = (element.textContent || '').toLowerCase();
            if (text.includes('ad') || text.includes('advertisement') || text.includes('annonce') || text.includes('pub')) {
              totalScore += AD_DETECTION_SCORES.AD_TEXT_DETECTED;
              logger.debug('Ad text detected');
              break;
            }
          }
        }

        const confidence = this.calculateConfidence(totalScore);
        logger.debug(`Total score: ${totalScore}, Confidence: ${confidence}`);

        const adElement = this.findAdElement();

        return {
          isAd: confidence >= CONFIDENCE_THRESHOLDS.AD_DETECTED,
          type: this.determineAdType(totalScore),
          confidence,
          element: adElement,
          score: totalScore,
          timestamp: Date.now()
        };
      } catch (error) {
        logger.error('Error in ad detection:', error);
        return { isAd: false, type: null, confidence: 0, element: null };
      }
    }

    calculateConfidence(score) {
      const maxPossibleScore = AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE * 2 +
        AD_DETECTION_SCORES.INFO_BUTTON_DETECTED +
        AD_DETECTION_SCORES.KNOWN_AD_STRUCTURE +
        AD_DETECTION_SCORES.AD_TEXT_DETECTED;
      const normalized = Math.min(score / maxPossibleScore, 1);
      return 1 / (1 + Math.exp(-10 * (normalized - 0.5)));
    }

    determineAdType(score) {
      if (score >= AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE + AD_DETECTION_SCORES.INFO_BUTTON_DETECTED) return 'video';
      if (score >= AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE) return 'overlay';
      if (score > 0) return 'unknown';
      return null;
    }

    findAdElement() {
      const candidates = [];
      const adContainers = findAllMatchingElements(SELECTORS.AD_INDICATORS);
      candidates.push(...adContainers.filter(el => isVisible(el)));
      const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
      candidates.push(...infoButtons.filter(el => isInsideVideoPlayer(el)));
      const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
      candidates.push(...skipButtons.filter(el => isInsideVideoPlayer(el)));
      if (candidates.length === 0) return null;
      return candidates[0];
    }

    quickAdCheck() {
      try {
        const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-container');
        for (const button of skipButtons) if (isVisible(button)) return true;
        const indicators = document.querySelectorAll('.ad-container, .video-ads, ytd-ad-module, .ad-showing');
        for (const indicator of indicators) if (isVisible(indicator)) return true;
        const textElements = document.querySelectorAll('span, div');
        for (const element of textElements) {
          if (isVisible(element)) {
            const text = (element.textContent || '').toLowerCase();
            if (text.includes('ad') || text.includes('advertisement') || text.includes('annonce') || text.includes('pub')) {
              return true;
            }
          }
        }
        return false;
      } catch (e) { return false; }
    }
  }

  const adDetector = new AdDetector();

  // ============================================================================
  // AD ACTIONS (Inline)
  // ============================================================================

  class AdActions {
    constructor() {
      this.currentSession = null;
      this.state = STATES.IDLE;
    }

    startSession() {
      this.endSession();
      this.currentSession = {
        id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startedAt: Date.now(),
        infoButtonClicked: false,
        blockButtonClicked: false,
        menuOpened: false,
        adBlocked: false,
        attempts: 0,
        infoClicks: 0,
        blockClicks: 0,
        element: null,
        adType: null
      };
      logger.sessionInfo(this.currentSession);
      return this.currentSession;
    }

    endSession() {
      if (this.currentSession) {
        logger.debug(`Ending ad session: ${this.currentSession.id}`);
      }
      this.currentSession = null;
      this.state = STATES.IDLE;
    }

    isSessionExpired() {
      if (!this.currentSession) return true;
      return Date.now() - this.currentSession.startedAt > AD_SESSION_LIMITS.MAX_DURATION_MS;
    }

    hasExceededLimits() {
      if (!this.currentSession) return true;
      return this.currentSession.attempts >= AD_SESSION_LIMITS.MAX_ATTEMPTS ||
             this.currentSession.infoClicks >= AD_SESSION_LIMITS.MAX_INFO_CLICKS ||
             this.currentSession.blockClicks >= AD_SESSION_LIMITS.MAX_BLOCK_CLICKS;
    }

    setState(state) {
      const previousState = this.state;
      this.state = state;
      logger.stateTransition(previousState, state);
    }

    findAdInfoButton() {
      logger.debug('Searching for ad info button...');
      const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
      for (const button of infoButtons) {
        if (this.isValidInfoButton(button)) {
          logger.debug('Found valid info button:', button);
          return button;
        }
      }
      const allButtons = findVisibleClickableElements(['button', 'a']);
      for (const button of allButtons) {
        if (this.isValidInfoButton(button)) {
          logger.debug('Found valid info button (strategy 2):', button);
          return button;
        }
      }
      logger.debug('No valid info button found');
      return null;
    }

    isValidInfoButton(button) {
      if (!button || !isVisible(button) || !isClickable(button)) return false;
      if (!isInsideVideoPlayer(button)) return false;
      const label = getElementLabel(button).toLowerCase();
      const text = (button.textContent || '').toLowerCase().trim();
      const infoPatterns = [/info/i, /more/i, /plus/i, /i\s*circle/i, /help/i, /informations/i, /plus d'infos/i];
      for (const pattern of infoPatterns) {
        if (pattern.test(label) || pattern.test(text)) return true;
      }
      const svg = button.querySelector('svg');
      if (svg) {
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox === '0 0 24 24') {
          const paths = svg.querySelectorAll('path');
          for (const path of paths) {
            const d = path.getAttribute('d') || '';
            if (d.includes('M12 2') || d.includes('M12,2') || d.includes('12 2')) return true;
          }
        }
      }
      return false;
    }

    async clickInfoButton(button) {
      if (!button || !this.currentSession) return false;
      if (this.hasExceededLimits() || this.isSessionExpired()) {
        logger.warn('Cannot click info button: session limits exceeded or expired');
        return false;
      }
      if (!isVisible(button) || !isClickable(button) || !isInsideVideoPlayer(button)) {
        logger.warn('Info button is no longer valid');
        return false;
      }
      logger.action('Clicking info button', { button });
      this.currentSession.infoClicks++;
      this.currentSession.attempts++;
      try {
        const result = await safeClick(button);
        if (result) {
          this.currentSession.infoButtonClicked = true;
          logger.info('Info button clicked successfully');
          return true;
        }
        logger.warn('Failed to click info button');
        return false;
      } catch (error) {
        logger.error('Error clicking info button:', error);
        return false;
      }
    }

    async waitForMenu() {
      logger.debug('Waiting for ad menu to appear...');
      const startTime = Date.now();
      const timeout = TIMEOUTS.MENU_OPEN_WAIT;
      while (Date.now() - startTime < timeout) {
        const menu = this.findAdMenu();
        if (menu) {
          logger.debug('Ad menu found:', menu);
          return menu;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      logger.warn('Ad menu did not appear within timeout');
      return null;
    }

    findAdMenu() {
      const menus = findAllMatchingElements(SELECTORS.MENUS);
      for (const menu of menus) {
        if (this.isValidAdMenu(menu)) return menu;
      }
      return null;
    }

    isValidAdMenu(menu) {
      if (!menu || !isVisible(menu)) return false;
      if (isInsideVideoPlayer(menu)) return true;
      const role = getElementRole(menu);
      if (role === 'menu' || role === 'dialog' || role === 'popup') return true;
      return false;
    }

    findBlockActions(menu = document) {
      logger.debug('Searching for block ad actions...');
      const candidates = [];
      const blockElements = findVisibleClickableElements(SELECTORS.BLOCK_ACTIONS, menu);
      candidates.push(...blockElements);
      const allActions = findVisibleClickableElements(['button', 'a', '[role="menuitem"]'], menu);
      for (const action of allActions) {
        if (this.isValidBlockAction(action)) candidates.push(action);
      }
      return [...new Set(candidates)];
    }

    isValidBlockAction(element) {
      if (!element || !isVisible(element) || !isClickable(element)) return false;
      const label = getElementLabel(element).toLowerCase();
      const text = (element.textContent || '').toLowerCase().trim();
      const blockPatterns = [
        /block\s*ad/i, /block\s*this\s*ad/i, /stop\s*seeing\s*this\s*ad/i,
        /bloquer\s*l['"]annonce/i, /bloquer\s*cette\s*annonce/i, /bloquer\s*la\s*pub/i,
        /bloquear\s*anuncio/i, /anzeige\s*blockieren/i
      ];
      for (const pattern of blockPatterns) {
        if (pattern.test(label) || pattern.test(text)) return true;
      }
      return false;
    }

    async clickBlockAction(action) {
      if (!action || !this.currentSession) return false;
      if (this.hasExceededLimits() || this.isSessionExpired()) {
        logger.warn('Cannot click block action: session limits exceeded or expired');
        return false;
      }
      if (!isVisible(action) || !isClickable(action)) {
        logger.warn('Block action is no longer valid');
        return false;
      }
      logger.action('Clicking block ad action', { action });
      this.currentSession.blockClicks++;
      this.currentSession.attempts++;
      try {
        const result = await safeClick(action);
        if (result) {
          this.currentSession.blockButtonClicked = true;
          this.currentSession.adBlocked = true;
          logger.info('Block ad action clicked successfully');
          await storage.incrementStat('adsBlocked');
          return true;
        }
        logger.warn('Failed to click block ad action');
        return false;
      } catch (error) {
        logger.error('Error clicking block ad action:', error);
        return false;
      }
    }

    findSkipButton() {
      logger.debug('Searching for skip ad button...');
      const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
      for (const button of skipButtons) {
        if (this.isValidSkipButton(button)) {
          logger.debug('Found valid skip button:', button);
          return button;
        }
      }
      logger.debug('No valid skip button found');
      return null;
    }

    isValidSkipButton(button) {
      if (!button || !isVisible(button) || !isClickable(button)) return false;
      if (!isInsideVideoPlayer(button)) return false;
      const label = getElementLabel(button).toLowerCase();
      const text = (button.textContent || '').toLowerCase().trim();
      const skipPatterns = [
        /skip\s*ad/i, /skip/i, /ignorer/i, /passer/i, /sauter/i,
        /omitir/i, /saltar/i
      ];
      for (const pattern of skipPatterns) {
        if (pattern.test(label) || pattern.test(text)) return true;
      }
      const className = button.className || '';
      if (className.includes('ytp-ad-skip') || className.includes('skip-button')) return true;
      return false;
    }

    async clickSkipButton(button) {
      if (!button || !this.currentSession) return false;
      if (this.hasExceededLimits() || this.isSessionExpired()) {
        logger.warn('Cannot click skip button: session limits exceeded or expired');
        return false;
      }
      if (!isVisible(button) || !isClickable(button) || !isInsideVideoPlayer(button)) {
        logger.warn('Skip button is no longer valid');
        return false;
      }
      logger.action('Clicking skip ad button', { button });
      this.currentSession.attempts++;
      try {
        const result = await safeClick(button);
        if (result) {
          logger.info('Skip ad button clicked successfully');
          await storage.incrementStat('fallbackSkips');
          return true;
        }
        logger.warn('Failed to click skip ad button');
        return false;
      } catch (error) {
        logger.error('Error clicking skip ad button:', error);
        return false;
      }
    }

    async hasAdDisappeared() {
      await new Promise(resolve => setTimeout(resolve, 200));
      const adIndicators = findAllMatchingElements(SELECTORS.AD_INDICATORS);
      const visibleIndicators = adIndicators.filter(el => isVisible(el));
      if (visibleIndicators.length > 0) return false;
      const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
      if (skipButtons.length > 0) return false;
      return true;
    }

    async blockCurrentAd() {
      logger.debug('Starting block current ad workflow...');
      const settings = await storage.getSettings();
      if (!settings.extensionEnabled || !settings.autoBlockEnabled) {
        logger.warn('Extension or auto-block is disabled');
        return { success: false, reason: 'disabled' };
      }

      this.startSession();
      this.setState(STATES.AD_DETECTED);

      try {
        this.setState(STATES.FINDING_INFO);
        const infoButton = this.findAdInfoButton();
        if (!infoButton) {
          logger.warn('No info button found, trying fallback');
          return await this.fallbackSkipAd();
        }

        this.setState(STATES.CLICKING_INFO);
        const infoClicked = await this.clickInfoButton(infoButton);
        if (!infoClicked) {
          logger.warn('Failed to click info button, trying fallback');
          return await this.fallbackSkipAd();
        }

        this.setState(STATES.WAITING_FOR_MENU);
        const menu = await this.waitForMenu();
        if (!menu) {
          logger.warn('Menu did not appear, trying fallback');
          return await this.fallbackSkipAd();
        }

        this.setState(STATES.FINDING_BLOCK_ACTION);
        const blockActions = this.findBlockActions(menu);
        if (blockActions.length === 0) {
          logger.warn('No block actions found, trying fallback');
          return await this.fallbackSkipAd();
        }

        this.setState(STATES.CLICKING_BLOCK);
        const blockClicked = await this.clickBlockAction(blockActions[0]);
        if (!blockClicked) {
          logger.warn('Failed to click block action, trying fallback');
          return await this.fallbackSkipAd();
        }

        this.setState(STATES.WAITING_FOR_RESULT);
        await new Promise(resolve => setTimeout(resolve, 500));

        const adGone = await this.hasAdDisappeared();
        if (adGone) {
          this.setState(STATES.AD_DISAPPEARED);
          logger.info('Ad successfully blocked and disappeared');
          await storage.incrementStat('adsDetected');
          await storage.addTimeSaved(5);
          this.endSession();
          return { success: true, method: 'block' };
        }

        logger.warn('Ad did not disappear after block attempt');
        this.endSession();
        return { success: false, reason: 'ad_still_visible' };
      } catch (error) {
        logger.error('Error in block current ad workflow:', error);
        this.endSession();
        return { success: false, reason: 'error', error };
      }
    }

    async fallbackSkipAd() {
      logger.debug('Starting fallback skip ad workflow...');
      const settings = await storage.getSettings();
      if (!settings.useFallbackSkip) {
        logger.warn('Fallback skip is disabled');
        return { success: false, reason: 'fallback_disabled' };
      }

      if (!this.currentSession) this.startSession();

      try {
        const skipButton = this.findSkipButton();
        if (!skipButton) {
          logger.warn('No skip button found for fallback');
          return { success: false, reason: 'no_skip_button' };
        }

        const result = await this.clickSkipButton(skipButton);
        if (!result) {
          logger.warn('Failed to click skip button');
          return { success: false, reason: 'click_failed' };
        }

        const adGone = await this.hasAdDisappeared();
        if (adGone) {
          logger.info('Ad successfully skipped via fallback');
          await storage.incrementStat('adsDetected');
          await storage.addTimeSaved(3);
          this.endSession();
          return { success: true, method: 'skip' };
        }

        logger.warn('Ad did not disappear after skip attempt');
        this.endSession();
        return { success: false, reason: 'ad_still_visible' };
      } catch (error) {
        logger.error('Error in fallback skip workflow:', error);
        this.endSession();
        return { success: false, reason: 'error', error };
      }
    }

    getCurrentSession() { return this.currentSession; }
    getCurrentState() { return this.state; }
    reset() { this.endSession(); }
  }

  const adActions = new AdActions();

  // ============================================================================
  // MAIN EXTENSION LOGIC
  // ============================================================================

  class YouTubeAdSkipper {
    constructor() {
      this.observer = null;
      this.detectionInterval = null;
      this.isRunning = false;
      this.lastDetectionTime = 0;
      this.settings = {};
      this.handleMutation = this.handleMutation.bind(this);
      this.handleMessage = this.handleMessage.bind(this);
      this.detectAndHandleAd = this.detectAndHandleAd.bind(this);
      this.debouncedDetect = debounce(this.detectAndHandleAd, TIMEOUTS.AD_DETECTION_DEBOUNCE);
    }

    async initialize() {
      try {
        this.settings = await storage.getSettings();
        if (this.settings.debugMode) {
          logger.enableDebug();
        } else {
          logger.enable();
        }

        logger.info('YouTube Auto Ad Skip initialized');

        if (this.settings.extensionEnabled) {
          await this.start();
        }

        chrome.runtime.onMessage.addListener(this.handleMessage);
        this.setupSettingsWatcher();
      } catch (error) {
        console.error('[YouTubeAdSkipper] Error initializing:', error);
      }
    }

    async start() {
      if (this.isRunning) {
        logger.debug('Extension is already running');
        return;
      }

      logger.info('Starting YouTube Auto Ad Skip');
      this.isRunning = true;
      this.setupMutationObserver();
      this.startPeriodicDetection();
      await this.detectAndHandleAd();
    }

    stop() {
      if (!this.isRunning) {
        logger.debug('Extension is already stopped');
        return;
      }

      logger.info('Stopping YouTube Auto Ad Skip');
      this.isRunning = false;

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.detectionInterval) {
        clearInterval(this.detectionInterval);
        this.detectionInterval = null;
      }

      adActions.reset();
    }

    setupMutationObserver() {
      if (this.observer) this.observer.disconnect();
      const targetNode = document.body || document.documentElement;
      const config = { childList: true, subtree: true, attributes: true, characterData: true };
      this.observer = new MutationObserver(this.handleMutation);
      this.observer.observe(targetNode, config);
      logger.debug('MutationObserver set up');
    }

    handleMutation(mutations) {
      if (!this.isRunning) return;
      const now = Date.now();
      if (now - this.lastDetectionTime < 100) return;
      let hasRelevantMutation = false;
      for (const mutation of mutations) {
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

    isRelevantMutation(mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.className && (element.className.includes('player') || element.className.includes('ad') || element.className.includes('video'))) {
              return true;
            }
            if (element.tagName === 'BUTTON' || element.tagName === 'A' || element.getAttribute('role') === 'menu' || element.getAttribute('role') === 'dialog') {
              return true;
            }
          }
        }
      }
      if (mutation.removedNodes && mutation.removedNodes.length > 0) {
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.className && (element.className.includes('ad') || element.className.includes('skip'))) {
              return true;
            }
          }
        }
      }
      if (mutation.attributeName && (mutation.attributeName === 'class' || mutation.attributeName === 'style' || mutation.attributeName === 'aria-label' || mutation.attributeName === 'role')) {
        return true;
      }
      return false;
    }

    startPeriodicDetection() {
      if (this.detectionInterval) clearInterval(this.detectionInterval);
      this.detectionInterval = setInterval(() => {
        if (this.isRunning) this.detectAndHandleAd();
      }, 2000);
      logger.debug('Periodic detection started');
    }

    async detectAndHandleAd() {
      if (!this.isRunning) return;
      const currentState = adActions.getCurrentState();
      if (currentState !== STATES.IDLE && currentState !== STATES.AD_DISAPPEARED) {
        logger.debug(`Already in state ${currentState}, skipping detection`);
        return;
      }

      try {
        const detection = await adDetector.detectAd();
        if (detection.isAd && detection.confidence >= 0.8) {
          logger.info(`Ad detected with confidence ${detection.confidence}`);
          await storage.incrementStat('adsDetected');
          await this.handleAdDetection(detection);
        } else {
          logger.debug(`No ad detected (confidence: ${detection.confidence})`);
        }
      } catch (error) {
        logger.error('Error in detect and handle ad:', error);
      }
    }

    async handleAdDetection(detection) {
      if (!this.isRunning) return;
      logger.debug('Handling ad detection...');
      try {
        const currentSession = adActions.getCurrentSession();
        if (currentSession && !adActions.isSessionExpired()) {
          logger.debug('Already processing an ad session');
          return;
        }
        adActions.startSession();
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

    setupSettingsWatcher() {
      setInterval(async () => {
        try {
          const newSettings = await storage.getSettings();
          if (JSON.stringify(newSettings) !== JSON.stringify(this.settings)) {
            this.settings = newSettings;
            logger.debug('Settings updated:', this.settings);
            if (this.settings.debugMode) {
              logger.enableDebug();
            } else {
              logger.enable();
            }
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
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  let skipper = null;

  function initializeExtension() {
    if (!window.location.hostname.includes('youtube.com')) return;
    if (!skipper) {
      skipper = new YouTubeAdSkipper();
      skipper.initialize();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

  // Log initial load
  console.log('[AutoSkip] YouTube Auto Ad Skip content script loaded');

})();
