// YouTube Auto Ad Skip - Content Script v3.0
// Updated for YouTube 2026 with iframe support and robust selectors

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS - YouTube 2026 Updated
  // ============================================================================

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
    AD_DETECTED: 0.7,
    HIGH_CONFIDENCE: 0.9
  };

  const AD_DETECTION_SCORES = {
    AD_INDICATOR_PRESENCE: 50,
    INFO_BUTTON_DETECTED: 40,
    KNOWN_AD_STRUCTURE: 30,
    AD_TEXT_DETECTED: 20,
    PLAYER_OVERLAY: 25,
    SKIP_BUTTON_PRESENT: 45,
    AD_CONTAINER_VISIBLE: 55
  };

  const TIMEOUTS = {
    MENU_OPEN_WAIT: 3000,
    AD_DETECTION_DEBOUNCE: 150,
    MAX_AD_SESSION_DURATION: 6000,
    CLICK_DELAY: 100,
    IFRAME_CHECK_INTERVAL: 500,
    MAX_IFRAME_WAIT: 2000
  };

  const AD_SESSION_LIMITS = {
    MAX_INFO_CLICKS: 3,
    MAX_BLOCK_CLICKS: 3,
    MAX_ATTEMPTS: 5,
    MAX_DURATION_MS: 6000
  };

  // YouTube 2026 Updated Selectors
  const SELECTORS = {
    PLAYER_CONTAINER: [
      'ytd-player',
      '#movie_player',
      '.html5-video-container',
      '[data-context-item-id]',
      '.ytd-watch-flexy',
      '#player',
      'div[class*="player"]',
      'ytd-rich-item-renderer',
      '#player-container',
      '.player-container'
    ],
    
    AD_INDICATORS: [
      '.ad-container',
      '.video-ads',
      'ytd-ad-module',
      '.ad-showing',
      '.ad-interrupting',
      '.ad-pod',
      'div.ad-placeholder',
      '.ad-video',
      '.ad-overlay',
      '.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button',
      '.ytp-ad-progress',
      '.ytp-ad-duration-remaining',
      'ytd-instream-video-ad',
      'ytd-ad',
      '.ad-banner',
      '[class*="-ad-"]',
      '[class*="ad-"]',
      '[id*="ad"]',
      '.ad-slate',
      '.ad-interrupting-video',
      'tp-yt-paper-button[aria-label*="ad" i]',
      'yt-icon-button[aria-label*="ad" i]'
    ],
    
    INFO_BUTTONS: [
      // YouTube 2026 - New info button patterns
      'yt-icon-button[aria-label*="info" i]',
      'yt-icon-button[aria-label*="about this ad" i]',
      'yt-icon-button[aria-label*="more" i]',
      'yt-icon-button[aria-label*="i" i]',
      'button[aria-label*="info" i]',
      'button[aria-label*="about this ad" i]',
      'button[aria-label*="more" i]',
      'button[aria-label*="i" i]',
      'button[aria-label*="plus d\'infos" i]',
      'button[aria-label*="informations" i]',
      'button[aria-label*="more info" i]',
      'button[aria-label*="ad info" i]',
      '.ytp-ad-button',
      '.ytp-ad-info-button',
      '.ad-info-button',
      'button:has(yt-icon)',
      'button:has(svg)',
      'tp-yt-paper-button:has(yt-icon)',
      'tp-yt-paper-button:has(svg)',
      // Position-based: bottom-left of player
      'yt-icon-button[class*="info"]',
      'button[class*="info"]',
      'button[class*="ad-info"]'
    ],
    
    MENUS: [
      '[role="menu"]',
      '[role="dialog"]',
      '[role="popup"]',
      '.ad-menu',
      '.ad-dialog',
      'ytd-popup-container',
      '.ytp-popup',
      'tp-yt-paper-listbox',
      'ytd-menu-popup-renderer',
      'ytd-popup',
      '[aria-label*="menu" i]',
      '[aria-label*="options" i]',
      '.menu-popup',
      '.dialog-container'
    ],
    
    BLOCK_ACTIONS: [
      'button',
      'a',
      '[role="menuitem"]',
      'yt-formatted-string',
      'tp-yt-paper-item',
      'ytd-menu-navigation-item-renderer',
      'ytd-button-renderer',
      '[role="option"]'
    ],
    
    SKIP_BUTTONS: [
      // YouTube 2026 - Updated skip button patterns
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button-modern',
      'button.ytp-ad-skip-button',
      'div.ytp-ad-skip-button',
      'tp-yt-paper-button[aria-label*="skip" i]',
      'tp-yt-paper-button[aria-label*="ignorer" i]',
      'button[aria-label*="skip" i]',
      'button[aria-label*="ignorer" i]',
      'button[aria-label*="passer" i]',
      'button[aria-label*="sauter" i]',
      'button[aria-label*="omitir" i]',
      'button[aria-label*="saltar" i]',
      '[class*="skip-button"]',
      '[class*="ad-skip"]',
      'div[class*="skip"]',
      'button.skip-button'
    ],
    
    // Iframe support
    IFRAME_SELECTORS: [
      'iframe[src*="youtube.com"]',
      'iframe[src*="googleads"]',
      'iframe[src*="doubleclick"]',
      'iframe[class*="ad"]',
      'iframe[id*="ad"]'
    ]
  };

  // Multi-language text patterns for YouTube 2026
  const TEXT_PATTERNS = {
    AD_INDICATORS: [
      /ad/i, /advertisement/i, /annonce/i, /pub/i, /publicit[ée]/i,
      /anuncio/i, /werbung/i, /pubblicit[àa]/i, /reclame/i, /広告/i,
      /광고/i, /广告/i
    ],
    
    INFO_BUTTON: [
      /info/i, /more/i, /plus/i, /i\s*circle/i, /help/i, /informations?/i,
      /plus d'infos/i, /más información/i, /mehr infos/i, /più informazioni/i,
      /about this ad/i, /à propos de cette annonce/i, /sobre este anuncio/i,
      /über diese anzeige/i, /informazioni su questo annuncio/i
    ],
    
    BLOCK_ACTIONS: [
      /block\s*ad/i, /block\s*this\s*ad/i, /stop\s*seeing\s*this\s*ad/i,
      /bloquer\s*l['"]annonce/i, /bloquer\s*cette\s*annonce/i, /bloquer\s*la\s*pub/i,
      /bloquear\s*anuncio/i, /anzeige\s*blockieren/i, /blocca\s*annuncio/i,
      /no\s*show\s*this\s*ad/i, /not\s*interested/i, /pas\s*int[ée]ress[ée]/i,
      /no\s*me\s*interesa/i, /nicht\s*interessiert/i, /non\s*interessato/i,
      /remove\s*ad/i, /supprimer\s*l['"]annonce/i, /eliminar\s*anuncio/i,
      /entfernen/i, /rimuovi/i
    ],
    
    SKIP_BUTTON: [
      /skip\s*ad/i, /skip/i, /ignorer/i, /passer/i, /sauter/i,
      /omitir/i, /saltar/i, /überspringen/i, /saltare/i,
      /skip\s*this\s*ad/i, /passer\s*cette\s*annonce/i
    ]
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
  // STORAGE MANAGER
  // ============================================================================

  class StorageManager {
    constructor() {
      this.cache = { settings: null, stats: null };
    }

    async getSettings() {
      if (this.cache.settings) return this.cache.settings;
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        this.cache.settings = result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
        return this.cache.settings;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }

    async saveSettings(settings) {
      this.cache.settings = { ...this.cache.settings, ...settings };
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: this.cache.settings });
      } catch (e) {}
    }

    async getStats() {
      if (this.cache.stats) return this.cache.stats;
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
        this.cache.stats = result[STORAGE_KEYS.STATS] || DEFAULT_STATS;
        return this.cache.stats;
      } catch (e) {
        return DEFAULT_STATS;
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

    async saveStats(stats) {
      this.cache.stats = { ...this.cache.stats, ...stats };
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: this.cache.stats });
      } catch (e) {}
    }

    async setSetting(key, value) {
      const settings = await this.getSettings();
      settings[key] = value;
      await this.saveSettings(settings);
    }

    async resetStats() {
      this.cache.stats = DEFAULT_STATS;
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: DEFAULT_STATS });
      } catch (e) {}
    }
  }

  const storage = new StorageManager();

  // ============================================================================
  // LOGGER
  // ============================================================================

  class Logger {
    constructor() {
      this.prefix = '[AutoSkip]';
      this.enabled = true;
      this.debugMode = false;
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

    sessionInfo(session) {
      if (!this.enabled || !this.debugMode) return;
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `${this.prefix} ${timestamp} [SESSION]`;
      console.log(logMessage, session);
    }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
    enableDebug() { this.debugMode = true; this.enabled = true; }
    disableDebug() { this.debugMode = false; }
  }

  const logger = new Logger();

  // ============================================================================
  // DOM UTILITIES - Enhanced with null checks
  // ============================================================================

  function safeGetClassName(element) {
    if (!element || !(element instanceof Element)) return '';
    try {
      return (element.className || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function safeGetAttribute(element, attr) {
    if (!element || !(element instanceof Element)) return '';
    try {
      return (element.getAttribute(attr) || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function safeGetText(element) {
    if (!element || !(element instanceof Element)) return '';
    try {
      return (element.textContent || '').toLowerCase().trim();
    } catch (e) {
      return '';
    }
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) return false;
    try {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      if (element.getAttribute('aria-hidden') === 'true') return false;
      if (element.hidden) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  function isClickable(element) {
    if (!element || !(element instanceof Element)) return false;
    if (element.disabled) return false;
    try {
      const style = window.getComputedStyle(element);
      if (style.pointerEvents === 'none') return false;
    } catch (e) {
      return false;
    }
    if (!isVisible(element)) return false;
    const tagName = (element.tagName || '').toLowerCase();
    const clickableTags = ['button', 'a', 'input', 'textarea', 'select', 'div', 'span', 'yt-formatted-string', 'tp-yt-paper-button', 'yt-icon-button'];
    if (!clickableTags.includes(tagName)) return false;
    if (tagName === 'input') {
      const type = (element.type || '').toLowerCase();
      const clickableTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
      if (!clickableTypes.includes(type)) return false;
    }
    return true;
  }

  function isInsideVideoPlayer(element) {
    if (!element || !(element instanceof Element)) return false;
    
    const playerContainers = [];
    for (const selector of SELECTORS.PLAYER_CONTAINER) {
      try {
        const containers = document.querySelectorAll(selector);
        containers.forEach(container => {
          if (container && isVisible(container)) playerContainers.push(container);
        });
      } catch (e) {}
    }
    
    for (const container of playerContainers) {
      try {
        if (container.contains(element)) return true;
      } catch (e) {}
    }
    
    // Position-based fallback
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const windowWidth = window.innerWidth;
    const playerWidthRatio = 0.7;
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
    if (!element || !(element instanceof Element)) return '';
    const ariaLabel = safeGetAttribute(element, 'aria-label');
    if (ariaLabel) return ariaLabel;
    const title = safeGetAttribute(element, 'title');
    if (title) return title;
    const text = safeGetText(element);
    if (text) return text;
    const svg = element.querySelector('svg');
    if (svg) {
      const svgLabel = safeGetAttribute(svg, 'aria-label');
      if (svgLabel) return svgLabel;
    }
    return '';
  }

  function textContains(element, text) {
    if (!element) return false;
    const elementText = safeGetText(element);
    return elementText.includes(text.toLowerCase());
  }

  function matchesAnyPattern(text, patterns) {
    if (!text) return false;
    for (const pattern of patterns) {
      if (pattern.test(text)) return true;
    }
    return false;
  }

  function findVisibleClickableElements(selectors, container = document) {
    const elements = [];
    for (const selector of selectors) {
      try {
        const found = container.querySelectorAll(selector);
        found.forEach(el => {
          if (isVisible(el) && isClickable(el) && !elements.includes(el)) {
            elements.push(el);
          }
        });
      } catch (e) {
        logger.debug(`Invalid selector: ${selector}`, e);
      }
    }
    return elements;
  }

  function findAllMatchingElements(selectors, container = document) {
    const elements = [];
    for (const selector of selectors) {
      try {
        const found = container.querySelectorAll(selector);
        found.forEach(el => {
          if (!elements.includes(el)) elements.push(el);
        });
      } catch (e) {}
    }
    return elements;
  }

  function findPlayerContainer() {
    for (const selector of SELECTORS.PLAYER_CONTAINER) {
      try {
        const container = document.querySelector(selector);
        if (container && isVisible(container)) return container;
      } catch (e) {}
    }
    return null;
  }

  // Iframe support functions
  function getAccessibleIframes() {
    const iframes = [];
    try {
      const allIframes = document.querySelectorAll('iframe');
      allIframes.forEach(iframe => {
        try {
          // Only access same-origin iframes
          if (iframe.contentDocument && iframe.contentDocument.body) {
            iframes.push(iframe);
          }
        } catch (e) {
          // Cross-origin iframes will throw security errors
        }
      });
    } catch (e) {}
    return iframes;
  }

  function findInIframes(selectors, checkFn) {
    const results = [];
    const iframes = getAccessibleIframes();
    
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) continue;
        
        const elements = findVisibleClickableElements(selectors, iframeDoc);
        for (const el of elements) {
          if (checkFn && checkFn(el, iframe)) {
            results.push({ element: el, iframe });
          } else if (!checkFn) {
            results.push({ element: el, iframe });
          }
        }
      } catch (e) {
        // Skip cross-origin iframes
      }
    }
    return results;
  }

  async function safeClick(element, retryCount = 2) {
    if (!element || !(element instanceof Element)) return false;
    if (!document.contains(element)) return false;
    if (!isVisible(element) || !isClickable(element)) return false;
    
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      element.dispatchEvent(clickEvent);
      if (!clickEvent.defaultPrevented) element.click();
      await new Promise(resolve => setTimeout(resolve, TIMEOUTS.CLICK_DELAY));
      return true;
    } catch (error) {
      logger.error('Error clicking element:', error);
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return await safeClick(element, retryCount - 1);
      }
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
  // AD DETECTOR - Enhanced for YouTube 2026
  // ============================================================================

  class AdDetector {
    constructor() {
      this.lastDetectionTime = 0;
    }

    async detectAd() {
      logger.debug('Starting ad detection...');
      
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
        const detectionElements = [];

        // Check for skip button (most reliable indicator)
        const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
        if (skipButtons.length > 0) {
          totalScore += AD_DETECTION_SCORES.SKIP_BUTTON_PRESENT;
          logger.debug('Skip button detected');
          detectionElements.push(...skipButtons);
        }

        // Check for ad indicators
        const indicators = findAllMatchingElements(SELECTORS.AD_INDICATORS);
        for (const indicator of indicators) {
          if (isVisible(indicator)) {
            totalScore += AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE;
            logger.debug('Ad indicators detected');
            detectionElements.push(indicator);
            break;
          }
        }

        // Check for info button
        const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
        for (const button of infoButtons) {
          if (isInsideVideoPlayer(button)) {
            totalScore += AD_DETECTION_SCORES.INFO_BUTTON_DETECTED;
            logger.debug('Info button detected');
            detectionElements.push(button);
            break;
          }
        }

        // Check for ad structure
        const adContainers = player.querySelectorAll('.ad-container, .video-ads, ytd-ad-module, .ad-showing, .ad-interrupting, ytd-ad, ytd-instream-video-ad');
        for (const container of adContainers) {
          if (isVisible(container)) {
            totalScore += AD_DETECTION_SCORES.KNOWN_AD_STRUCTURE;
            logger.debug('Ad structure detected');
            detectionElements.push(container);
            break;
          }
        }

        // Check for ad text
        const textElements = player.querySelectorAll('span, div, a, p, button, yt-formatted-string');
        for (const element of textElements) {
          if (isVisible(element)) {
            const text = safeGetText(element);
            if (matchesAnyPattern(text, TEXT_PATTERNS.AD_INDICATORS)) {
              totalScore += AD_DETECTION_SCORES.AD_TEXT_DETECTED;
              logger.debug('Ad text detected');
              detectionElements.push(element);
              break;
            }
          }
        }

        // Check for player overlay
        const overlays = player.querySelectorAll('[class*="overlay"], [class*="ad-overlay"]');
        for (const overlay of overlays) {
          if (isVisible(overlay)) {
            totalScore += AD_DETECTION_SCORES.PLAYER_OVERLAY;
            logger.debug('Player overlay detected');
            detectionElements.push(overlay);
            break;
          }
        }

        // Check in iframes
        const iframeResults = findInIframes(SELECTORS.AD_INDICATORS);
        if (iframeResults.length > 0) {
          totalScore += AD_DETECTION_SCORES.AD_CONTAINER_VISIBLE;
          logger.debug('Ad indicators found in iframes');
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
        AD_DETECTION_SCORES.AD_TEXT_DETECTED +
        AD_DETECTION_SCORES.PLAYER_OVERLAY;
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
  }

  const adDetector = new AdDetector();

  // ============================================================================
  // AD ACTIONS - Enhanced for YouTube 2026
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
      logger.debug(`Starting ad session: ${this.currentSession.id}`);
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
      
      // First, search in main document
      const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
      for (const button of infoButtons) {
        if (this.isValidInfoButton(button)) {
          logger.debug('Found valid info button in main document');
          return button;
        }
      }
      
      // Search in iframes
      const iframeResults = findInIframes(SELECTORS.INFO_BUTTONS, (el, iframe) => {
        return this.isValidInfoButton(el);
      });
      
      if (iframeResults.length > 0) {
        logger.debug('Found valid info button in iframe');
        return iframeResults[0].element;
      }
      
      logger.debug('No valid info button found');
      return null;
    }

    isValidInfoButton(button) {
      if (!button || !isVisible(button) || !isClickable(button)) return false;
      if (!isInsideVideoPlayer(button)) return false;
      
      const label = getElementLabel(button);
      const text = safeGetText(button);
      
      if (matchesAnyPattern(label, TEXT_PATTERNS.INFO_BUTTON)) return true;
      if (matchesAnyPattern(text, TEXT_PATTERNS.INFO_BUTTON)) return true;
      
      // Check for info icon (i in circle)
      const svg = button.querySelector('svg');
      if (svg) {
        const viewBox = safeGetAttribute(svg, 'viewBox');
        if (viewBox === '0 0 24 24') {
          const paths = svg.querySelectorAll('path');
          for (const path of paths) {
            const d = (path.getAttribute('d') || '').toLowerCase();
            if (d.includes('m12 2') || d.includes('m12,2') || d.includes('12 2')) return true;
          }
        }
      }
      
      // Check class names
      const className = safeGetClassName(button);
      if (className.includes('info') || className.includes('ad-info')) return true;
      
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
      
      logger.action('Clicking info button');
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
          logger.debug('Ad menu found');
          return menu;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      logger.warn('Ad menu did not appear within timeout');
      return null;
    }

    findAdMenu() {
      // Search in main document
      const menus = findAllMatchingElements(SELECTORS.MENUS);
      for (const menu of menus) {
        if (this.isValidAdMenu(menu)) return menu;
      }
      
      // Search in iframes
      const iframeResults = findInIframes(SELECTORS.MENUS, (el) => {
        return this.isValidAdMenu(el);
      });
      
      if (iframeResults.length > 0) {
        return iframeResults[0].element;
      }
      
      return null;
    }

    isValidAdMenu(menu) {
      if (!menu || !isVisible(menu)) return false;
      if (isInsideVideoPlayer(menu)) return true;
      const role = safeGetAttribute(menu, 'role');
      if (role === 'menu' || role === 'dialog' || role === 'popup') return true;
      
      const className = safeGetClassName(menu);
      if (className.includes('menu') || className.includes('popup') || className.includes('dialog')) return true;
      
      return false;
    }

    findBlockActions(menu = document) {
      logger.debug('Searching for block ad actions...');
      const candidates = [];
      
      // Search in provided menu or document
      const allActions = findVisibleClickableElements(SELECTORS.BLOCK_ACTIONS, menu);
      for (const action of allActions) {
        if (this.isValidBlockAction(action)) candidates.push(action);
      }
      
      // Also search in iframes
      const iframeResults = findInIframes(SELECTORS.BLOCK_ACTIONS, (el) => {
        return this.isValidBlockAction(el);
      });
      
      for (const result of iframeResults) {
        candidates.push(result.element);
      }
      
      return [...new Set(candidates)];
    }

    isValidBlockAction(element) {
      if (!element || !isVisible(element) || !isClickable(element)) return false;
      
      const label = getElementLabel(element);
      const text = safeGetText(element);
      
      if (matchesAnyPattern(label, TEXT_PATTERNS.BLOCK_ACTIONS)) return true;
      if (matchesAnyPattern(text, TEXT_PATTERNS.BLOCK_ACTIONS)) return true;
      
      const className = safeGetClassName(element);
      if (className.includes('block') || className.includes('remove') || className.includes('not-interested')) return true;
      
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
      
      logger.action('Clicking block ad action');
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
      
      // Search in main document
      const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
      for (const button of skipButtons) {
        if (this.isValidSkipButton(button)) {
          logger.debug('Found valid skip button in main document');
          return button;
        }
      }
      
      // Search in iframes
      const iframeResults = findInIframes(SELECTORS.SKIP_BUTTONS, (el) => {
        return this.isValidSkipButton(el);
      });
      
      if (iframeResults.length > 0) {
        logger.debug('Found valid skip button in iframe');
        return iframeResults[0].element;
      }
      
      logger.debug('No valid skip button found');
      return null;
    }

    isValidSkipButton(button) {
      if (!button || !isVisible(button) || !isClickable(button)) return false;
      if (!isInsideVideoPlayer(button)) return false;
      
      const label = getElementLabel(button);
      const text = safeGetText(button);
      
      if (matchesAnyPattern(label, TEXT_PATTERNS.SKIP_BUTTON)) return true;
      if (matchesAnyPattern(text, TEXT_PATTERNS.SKIP_BUTTON)) return true;
      
      const className = safeGetClassName(button);
      if (className.includes('skip') || className.includes('ytp-ad-skip')) return true;
      
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
      
      logger.action('Clicking skip ad button');
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
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const adIndicators = findAllMatchingElements(SELECTORS.AD_INDICATORS);
      const visibleIndicators = adIndicators.filter(el => isVisible(el));
      if (visibleIndicators.length > 0) return false;
      
      const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
      if (skipButtons.length > 0) return false;
      
      const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
      if (infoButtons.length > 0) {
        // Check if any info button is still associated with an ad
        for (const btn of infoButtons) {
          if (isInsideVideoPlayer(btn)) return false;
        }
      }
      
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
        await new Promise(resolve => setTimeout(resolve, 800));

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
  // MAIN EXTENSION CLASS
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
      const config = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-label', 'role'] };
      
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
      try {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              try {
                const className = safeGetClassName(element);
                if (className.includes('player') || className.includes('ad') || className.includes('video')) {
                  return true;
                }
                const tagName = (element.tagName || '').toLowerCase();
                if (tagName === 'button' || tagName === 'a' || 
                    safeGetAttribute(element, 'role') === 'menu' || 
                    safeGetAttribute(element, 'role') === 'dialog') {
                  return true;
                }
              } catch (e) {}
            }
          }
        }
        
        if (mutation.removedNodes && mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              try {
                const className = safeGetClassName(element);
                if (className.includes('ad') || className.includes('skip')) {
                  return true;
                }
              } catch (e) {}
            }
          }
        }
        
        if (mutation.attributeName && (mutation.attributeName === 'class' || 
            mutation.attributeName === 'style' || 
            mutation.attributeName === 'aria-label' || 
            mutation.attributeName === 'role')) {
          return true;
        }
        
        return false;
      } catch (e) {
        return false;
      }
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
        if (detection.isAd && detection.confidence >= CONFIDENCE_THRESHOLDS.AD_DETECTED) {
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
          case 'TOGGLE_EXTENSION':
            this.settings.extensionEnabled = message.value;
            if (this.settings.extensionEnabled) {
              await this.start();
            } else {
              this.stop();
            }
            await storage.setSetting('extensionEnabled', this.settings.extensionEnabled);
            sendResponse({ success: true, extensionEnabled: this.settings.extensionEnabled });
            break;
            
          case 'TOGGLE_AUTO_BLOCK':
            this.settings.autoBlockEnabled = message.value;
            await storage.setSetting('autoBlockEnabled', this.settings.autoBlockEnabled);
            sendResponse({ success: true, autoBlockEnabled: this.settings.autoBlockEnabled });
            break;
            
          case 'TOGGLE_FALLBACK_SKIP':
            this.settings.useFallbackSkip = message.value;
            await storage.setSetting('useFallbackSkip', this.settings.useFallbackSkip);
            sendResponse({ success: true, useFallbackSkip: this.settings.useFallbackSkip });
            break;
            
          case 'TOGGLE_DEBUG':
            this.settings.debugMode = message.value;
            await storage.setSetting('debugMode', this.settings.debugMode);
            if (this.settings.debugMode) {
              logger.enableDebug();
            } else {
              logger.enable();
            }
            sendResponse({ success: true, debugMode: this.settings.debugMode });
            break;
            
          case 'GET_STATE':
            sendResponse({
              isRunning: this.isRunning,
              state: adActions.getCurrentState(),
              session: adActions.getCurrentSession()
            });
            break;
            
          case 'GET_STATS':
            const stats = await storage.getStats();
            sendResponse(stats);
            break;
            
          case 'RESET_STATS':
            await storage.resetStats();
            sendResponse({ success: true });
            break;
            
          case 'LOG_EVENT':
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

  console.log('[AutoSkip] YouTube Auto Ad Skip content script loaded');

})();
