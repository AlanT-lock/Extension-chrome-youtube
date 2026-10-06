// YouTube Auto Ad Skip - Ad Detector Module

import { logger } from './logger.js';
import { storage } from './storage.js';
import {
  AD_DETECTION_SCORES,
  CONFIDENCE_THRESHOLDS,
  SELECTORS,
  AD_TEXT_PATTERNS,
  YOUTUBE_PATTERNS
} from '../shared/constants.js';
import {
  isVisible,
  isAdRelatedElement,
  findAllMatchingElements,
  findVisibleClickableElements,
  findPlayerContainer,
  matchesAnySelector,
  textMatchesAnyPattern,
  getElementLabel,
  getElementRole
} from './dom-utils.js';

/**
 * Ad Detector class for identifying YouTube video ads
 */

class AdDetector {
  constructor() {
    this.scoreCache = new Map();
    this.lastDetectionTime = 0;
    this.detectionDebounce = null;
  }

  /**
   * Detect if an ad is currently playing
   * Uses a scoring system with multiple detection strategies
   * @returns {Promise<Object>} Detection result
   */
  async detectAd() {
    logger.debug('Starting ad detection...');
    
    const startTime = Date.now();
    
    try {
      // Check if extension is enabled
      const settings = await storage.getSettings();
      if (!settings.extensionEnabled) {
        return { isAd: false, type: null, confidence: 0, element: null };
      }

      // Find player container
      const player = findPlayerContainer();
      if (!player) {
        logger.debug('No player container found');
        return { isAd: false, type: null, confidence: 0, element: null };
      }

      // Check for skip button (strong indicator of ad)
      const skipButtonScore = this.checkSkipButton();
      if (skipButtonScore > 0) {
        logger.debug(`Skip button detected, score: ${skipButtonScore}`);
      }

      // Check for ad indicators
      const adIndicatorScore = this.checkAdIndicators();
      if (adIndicatorScore > 0) {
        logger.debug(`Ad indicators detected, score: ${adIndicatorScore}`);
      }

      // Check for info button (ad-specific)
      const infoButtonScore = this.checkInfoButton();
      if (infoButtonScore > 0) {
        logger.debug(`Info button detected, score: ${infoButtonScore}`);
      }

      // Check for ad structure
      const structureScore = this.checkAdStructure();
      if (structureScore > 0) {
        logger.debug(`Ad structure detected, score: ${structureScore}`);
      }

      // Check for ad text
      const textScore = this.checkAdText();
      if (textScore > 0) {
        logger.debug(`Ad text detected, score: ${textScore}`);
      }

      // Check for player overlay
      const overlayScore = this.checkPlayerOverlay();
      if (overlayScore > 0) {
        logger.debug(`Player overlay detected, score: ${overlayScore}`);
      }

      // Calculate total score and confidence
      const totalScore = 
        skipButtonScore +
        adIndicatorScore +
        infoButtonScore +
        structureScore +
        textScore +
        overlayScore;

      const confidence = this.calculateConfidence(totalScore);
      
      logger.debug(`Total score: ${totalScore}, Confidence: ${confidence}`);

      // Find the most likely ad element
      const adElement = this.findAdElement();

      const result = {
        isAd: confidence >= CONFIDENCE_THRESHOLDS.AD_DETECTED,
        type: this.determineAdType(totalScore),
        confidence,
        element: adElement,
        score: totalScore,
        timestamp: Date.now()
      };

      if (result.isAd) {
        logger.adDetected(result);
      } else {
        logger.debug('No ad detected');
      }

      return result;
    } catch (error) {
      logger.error('Error in ad detection:', error);
      return { isAd: false, type: null, confidence: 0, element: null };
    }
  }

  /**
   * Check for skip button (strong indicator)
   * @returns {number} Score
   */
  checkSkipButton() {
    const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
    
    if (skipButtons.length > 0) {
      for (const button of skipButtons) {
        if (isAdRelatedElement(button)) {
          return AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE;
        }
      }
      return AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE * 0.5;
    }

    return 0;
  }

  /**
   * Check for ad indicators
   * @returns {number} Score
   */
  checkAdIndicators() {
    const indicators = findAllMatchingElements(SELECTORS.AD_INDICATORS);
    
    for (const indicator of indicators) {
      if (isVisible(indicator) && isAdRelatedElement(indicator)) {
        return AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE;
      }
    }

    return 0;
  }

  /**
   * Check for info button (ad-specific)
   * @returns {number} Score
   */
  checkInfoButton() {
    const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
    
    for (const button of infoButtons) {
      if (isAdRelatedElement(button)) {
        return AD_DETECTION_SCORES.INFO_BUTTON_DETECTED;
      }
    }

    return 0;
  }

  /**
   * Check for ad structure (known patterns)
   * @returns {number} Score
   */
  checkAdStructure() {
    // Check for common ad container structures
    const player = findPlayerContainer();
    if (!player) return 0;

    // Look for ad containers within the player
    const adContainers = player.querySelectorAll('.ad-container, .video-ads, ytd-ad-module, .ad-showing');
    
    for (const container of adContainers) {
      if (isVisible(container)) {
        return AD_DETECTION_SCORES.KNOWN_AD_STRUCTURE;
      }
    }

    // Check for elements with ad-related classes
    const elementsWithAdClasses = player.querySelectorAll('[class*="ad-"], [id*="ad"]');
    
    for (const element of elementsWithAdClasses) {
      if (isVisible(element) && !element.className.includes('ad-skip')) {
        return AD_DETECTION_SCORES.KNOWN_AD_STRUCTURE * 0.8;
      }
    }

    return 0;
  }

  /**
   * Check for ad text patterns
   * @returns {number} Score
   */
  checkAdText() {
    const player = findPlayerContainer();
    if (!player) return 0;

    // Look for text elements within the player
    const textElements = player.querySelectorAll('span, div, a, p, li, h1, h2, h3, h4, h5, h6');
    
    for (const element of textElements) {
      if (isVisible(element) && textMatchesAnyPattern(element, AD_TEXT_PATTERNS)) {
        return AD_DETECTION_SCORES.AD_TEXT_DETECTED;
      }
    }

    return 0;
  }

  /**
   * Check for player overlay (ads often overlay the player)
   * @returns {number} Score
   */
  checkPlayerOverlay() {
    const player = findPlayerContainer();
    if (!player) return 0;

    // Check for overlay elements
    const overlays = player.querySelectorAll('.ad-overlay, .player-overlay, [class*="overlay"]');
    
    for (const overlay of overlays) {
      if (isVisible(overlay) && isAdRelatedElement(overlay)) {
        return AD_DETECTION_SCORES.PLAYER_OVERLAY;
      }
    }

    // Check if there are elements positioned absolutely over the player
    const absoluteElements = player.querySelectorAll('[style*="position: absolute"]');
    
    for (const element of absoluteElements) {
      if (isVisible(element) && isAdRelatedElement(element)) {
        return AD_DETECTION_SCORES.PLAYER_OVERLAY * 0.7;
      }
    }

    return 0;
  }

  /**
   * Calculate confidence from score
   * @param {number} score - Detection score
   * @returns {number} Confidence (0-1)
   */
  calculateConfidence(score) {
    // Normalize score to 0-1 range based on maximum possible score
    const maxPossibleScore = 
      AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE +
      AD_DETECTION_SCORES.INFO_BUTTON_DETECTED +
      AD_DETECTION_SCORES.KNOWN_AD_STRUCTURE +
      AD_DETECTION_SCORES.AD_TEXT_DETECTED +
      AD_DETECTION_SCORES.PLAYER_OVERLAY +
      AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE; // Skip button

    const normalized = Math.min(score / maxPossibleScore, 1);
    
    // Apply sigmoid function for smoother confidence curve
    return 1 / (1 + Math.exp(-10 * (normalized - 0.5)));
  }

  /**
   * Determine ad type from score
   * @param {number} score - Detection score
   * @returns {string}
   */
  determineAdType(score) {
    if (score >= AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE + AD_DETECTION_SCORES.INFO_BUTTON_DETECTED) {
      return 'video';
    }
    if (score >= AD_DETECTION_SCORES.AD_INDICATOR_PRESENCE) {
      return 'overlay';
    }
    if (score > 0) {
      return 'unknown';
    }
    return null;
  }

  /**
   * Find the most likely ad element
   * @returns {HTMLElement|null}
   */
  findAdElement() {
    // Strategy: find the most prominent ad-related element
    const candidates = [];

    // 1. Look for ad containers
    const adContainers = findAllMatchingElements(SELECTORS.AD_INDICATORS);
    candidates.push(...adContainers.filter(el => isVisible(el) && isAdRelatedElement(el)));

    // 2. Look for info buttons
    const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
    candidates.push(...infoButtons.filter(el => isAdRelatedElement(el)));

    // 3. Look for skip buttons
    const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
    candidates.push(...skipButtons.filter(el => isAdRelatedElement(el)));

    if (candidates.length === 0) {
      return null;
    }

    // Sort by visibility and position (prefer elements closer to player center)
    const player = findPlayerContainer();
    if (player) {
      const playerRect = player.getBoundingClientRect();
      const playerCenterX = playerRect.left + playerRect.width / 2;
      const playerCenterY = playerRect.top + playerRect.height / 2;

      candidates.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();

        const aDist = Math.sqrt(
          Math.pow(aRect.left + aRect.width / 2 - playerCenterX, 2) +
          Math.pow(aRect.top + aRect.height / 2 - playerCenterY, 2)
        );
        
        const bDist = Math.sqrt(
          Math.pow(bRect.left + bRect.width / 2 - playerCenterX, 2) +
          Math.pow(bRect.top + bRect.height / 2 - playerCenterY, 2)
        );

        return aDist - bDist;
      });
    }

    return candidates[0] || null;
  }

  /**
   * Quick check if an ad might be present (for frequent polling)
   * @returns {boolean}
   */
  quickAdCheck() {
    try {
      // Check for skip button (fastest check)
      const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-container');
      for (const button of skipButtons) {
        if (isVisible(button)) {
          return true;
        }
      }

      // Check for ad indicators
      const indicators = document.querySelectorAll('.ad-container, .video-ads, ytd-ad-module, .ad-showing');
      for (const indicator of indicators) {
        if (isVisible(indicator)) {
          return true;
        }
      }

      // Check for ad text
      const textElements = document.querySelectorAll('span, div');
      for (const element of textElements) {
        if (isVisible(element) && textMatchesAnyPattern(element, AD_TEXT_PATTERNS)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we're in an ad break (pre-roll, mid-roll, post-roll)
   * @returns {Promise<boolean>}
   */
  async isInAdBreak() {
    const detection = await this.detectAd();
    return detection.isAd && detection.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM;
  }

  /**
   * Check if the current content is a video ad
   * @returns {Promise<boolean>}
   */
  async isVideoAd() {
    const detection = await this.detectAd();
    return detection.isAd && detection.type === 'video' && detection.confidence >= CONFIDENCE_THRESHOLDS.HIGH;
  }

  /**
   * Clear score cache
   */
  clearCache() {
    this.scoreCache.clear();
  }

  /**
   * Debounced ad detection
   * @param {number} delay - Delay in milliseconds
   * @returns {Promise<Object>}
   */
  debouncedDetectAd(delay = 200) {
    clearTimeout(this.detectionDebounce);
    
    return new Promise((resolve) => {
      this.detectionDebounce = setTimeout(async () => {
        const result = await this.detectAd();
        resolve(result);
      }, delay);
    });
  }
}

// Singleton instance
export const adDetector = new AdDetector();

export default adDetector;
