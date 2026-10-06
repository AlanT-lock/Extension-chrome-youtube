// YouTube Auto Ad Skip - Ad Actions Module

import { logger } from './logger.js';
import { storage } from './storage.js';
import { SELECTORS, TIMEOUTS, AD_SESSION_LIMITS, STATES } from '../shared/constants.js';
import {
  isVisible,
  isClickable,
  isInsideVideoPlayer,
  findVisibleClickableElements,
  findAllMatchingElements,
  findElementsInPlayer,
  isInBottomLeftArea,
  matchesAnySelector,
  textMatchesAnyPattern,
  getElementLabel,
  getElementRole,
  safeClick,
  waitForElement,
  waitForVisible
} from './dom-utils.js';

/**
 * Ad Actions class for performing actions on detected ads
 */

class AdActions {
  constructor() {
    this.currentSession = null;
    this.state = STATES.IDLE;
    this.observer = null;
    this.pendingActions = [];
  }

  /**
   * Start a new ad session
   * @returns {Object} Session object
   */
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

  /**
   * End current session
   */
  endSession() {
    if (this.currentSession) {
      logger.debug(`Ending ad session: ${this.currentSession.id}`);
      this.currentSession = null;
    }
    this.state = STATES.IDLE;
  }

  /**
   * Check if session is expired
   * @returns {boolean}
   */
  isSessionExpired() {
    if (!this.currentSession) return true;
    
    const duration = Date.now() - this.currentSession.startedAt;
    return duration > AD_SESSION_LIMITS.MAX_DURATION_MS;
  }

  /**
   * Check if session has exceeded limits
   * @returns {boolean}
   */
  hasExceededLimits() {
    if (!this.currentSession) return true;
    
    return this.currentSession.attempts >= AD_SESSION_LIMITS.MAX_ATTEMPTS ||
           this.currentSession.infoClicks >= AD_SESSION_LIMITS.MAX_INFO_CLICKS ||
           this.currentSession.blockClicks >= AD_SESSION_LIMITS.MAX_BLOCK_CLICKS;
  }

  /**
   * Set current state
   * @param {string} state - New state
   */
  setState(state) {
    const previousState = this.state;
    this.state = state;
    logger.stateTransition(previousState, state);
  }

  /**
   * Find ad info button
   * @returns {HTMLElement|null}
   */
  findAdInfoButton() {
    logger.debug('Searching for ad info button...');
    
    // Strategy 1: Look for info buttons specifically in ad context
    const infoButtons = findVisibleClickableElements(SELECTORS.INFO_BUTTONS);
    
    for (const button of infoButtons) {
      if (this.isValidInfoButton(button)) {
        logger.debug('Found valid info button:', button);
        return button;
      }
    }

    // Strategy 2: Look for buttons with info-like labels
    const allButtons = findVisibleClickableElements(['button', 'a']);
    
    for (const button of allButtons) {
      if (this.isValidInfoButton(button)) {
        logger.debug('Found valid info button (strategy 2):', button);
        return button;
      }
    }

    // Strategy 3: Look for buttons in bottom-left area of player
    const playerButtons = findElementsInPlayer(['button', 'a']);
    const bottomLeftButtons = playerButtons.filter(btn => isInBottomLeftArea(btn));
    
    for (const button of bottomLeftButtons) {
      if (this.isValidInfoButton(button)) {
        logger.debug('Found valid info button (strategy 3):', button);
        return button;
      }
    }

    logger.debug('No valid info button found');
    return null;
  }

  /**
   * Check if button is a valid info button for the current ad
   * @param {HTMLElement} button - Button to check
   * @returns {boolean}
   */
  isValidInfoButton(button) {
    if (!button || !isVisible(button) || !isClickable(button)) {
      return false;
    }

    // Check if button is inside player
    if (!isInsideVideoPlayer(button)) {
      return false;
    }

    // Check label and text
    const label = getElementLabel(button).toLowerCase();
    const text = (button.textContent || '').toLowerCase().trim();
    
    const infoPatterns = [
      /info/i,
      /more/i,
      /plus/i,
      /i\s*circle/i,
      /help/i,
      /informations/i,
      /plus d'infos/i,
      /detalles/i,
      /mas informacion/i
    ];

    for (const pattern of infoPatterns) {
      if (pattern.test(label) || pattern.test(text)) {
        return true;
      }
    }

    // Check for SVG with info icon
    const svg = button.querySelector('svg');
    if (svg) {
      const svgLabel = svg.getAttribute('aria-label') || '';
      const svgText = svg.textContent || '';
      
      for (const pattern of infoPatterns) {
        if (pattern.test(svgLabel) || pattern.test(svgText)) {
          return true;
        }
      }

      // Check SVG viewBox and path for info icon
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox === '0 0 24 24') {
        const paths = svg.querySelectorAll('path');
        for (const path of paths) {
          const d = path.getAttribute('d') || '';
          // Common info icon path patterns
          if (d.includes('M12 2') || d.includes('M12,2') || d.includes('12 2')) {
            return true;
          }
        }
      }
    }

    // Check if button has aria-label or title with info
    const ariaLabel = button.getAttribute('aria-label') || '';
    const title = button.getAttribute('title') || '';
    
    for (const pattern of infoPatterns) {
      if (pattern.test(ariaLabel) || pattern.test(title)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Click info button
   * @param {HTMLElement} button - Info button to click
   * @returns {Promise<boolean>}
   */
  async clickInfoButton(button) {
    if (!button || !this.currentSession) {
      return false;
    }

    // Check session limits
    if (this.hasExceededLimits() || this.isSessionExpired()) {
      logger.warn('Cannot click info button: session limits exceeded or expired');
      return false;
    }

    // Verify button is still valid
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

  /**
   * Wait for ad menu to appear
   * @returns {Promise<HTMLElement|null>}
   */
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

  /**
   * Find ad menu
   * @returns {HTMLElement|null}
   */
  findAdMenu() {
    // Look for menus that appeared recently
    const menus = findAllMatchingElements(SELECTORS.MENUS);
    
    for (const menu of menus) {
      if (this.isValidAdMenu(menu)) {
        return menu;
      }
    }

    return null;
  }

  /**
   * Check if menu is a valid ad menu
   * @param {HTMLElement} menu - Menu to check
   * @returns {boolean}
   */
  isValidAdMenu(menu) {
    if (!menu || !isVisible(menu)) {
      return false;
    }

    // Check if menu is near the info button or in player area
    if (isInsideVideoPlayer(menu)) {
      return true;
    }

    // Check if menu has role menu or dialog
    const role = getElementRole(menu);
    if (role === 'menu' || role === 'dialog' || role === 'popup') {
      return true;
    }

    // Check if menu contains block ad options
    const blockActions = this.findBlockActions(menu);
    if (blockActions.length > 0) {
      return true;
    }

    // Check if menu appeared recently (within last second)
    // This is a heuristic - we can't know the exact creation time
    return true;
  }

  /**
   * Find block ad actions in a menu
   * @param {HTMLElement} menu - Menu to search in
   * @returns {Array<HTMLElement>}
   */
  findBlockActions(menu = document) {
    logger.debug('Searching for block ad actions...');
    
    const candidates = [];

    // Strategy 1: Look for elements matching block action selectors
    const blockElements = findVisibleClickableElements(SELECTORS.BLOCK_ACTIONS, menu);
    candidates.push(...blockElements);

    // Strategy 2: Look for all buttons and links, then filter by text
    const allActions = findVisibleClickableElements(['button', 'a', '[role="menuitem"]'], menu);
    
    for (const action of allActions) {
      if (this.isValidBlockAction(action)) {
        candidates.push(action);
      }
    }

    // Remove duplicates
    return [...new Set(candidates)];
  }

  /**
   * Check if element is a valid block ad action
   * @param {HTMLElement} element - Element to check
   * @returns {boolean}
   */
  isValidBlockAction(element) {
    if (!element || !isVisible(element) || !isClickable(element)) {
      return false;
    }

    // Check text and labels
    const label = getElementLabel(element).toLowerCase();
    const text = (element.textContent || '').toLowerCase().trim();
    
    const blockPatterns = [
      /block\s*ad/i,
      /block\s*this\s*ad/i,
      /stop\s*seeing\s*this\s*ad/i,
      /bloquer\s*l['"]annonce/i,
      /bloquer\s*cette\s*annonce/i,
      /bloquer\s*la\s*pub/i,
      /bloquear\s*anuncio/i,
      /bloquear\s*este\s*anuncio/i,
      /anzeige\s*blockieren/i,
      /blocca\s*annuncio/i,
      /bloquear\s*anúncio/i
    ];

    for (const pattern of blockPatterns) {
      if (pattern.test(label) || pattern.test(text)) {
        return true;
      }
    }

    // Check for specific YouTube patterns
    const className = element.className || '';
    const id = element.id || '';
    
    if (className.includes('block') || id.includes('block')) {
      return true;
    }

    // Check if element is in a menu context
    const menuAncestor = this.findClosestMenuAncestor(element);
    if (menuAncestor) {
      return true;
    }

    return false;
  }

  /**
   * Find closest menu ancestor
   * @param {HTMLElement} element - Element to check
   * @returns {HTMLElement|null}
   */
  findClosestMenuAncestor(element) {
    let current = element.parentElement;
    
    while (current && current !== document.body) {
      const role = getElementRole(current);
      if (role === 'menu' || role === 'dialog' || role === 'popup') {
        return current;
      }
      
      if (matchesAnySelector(current, SELECTORS.MENUS)) {
        return current;
      }
      
      current = current.parentElement;
    }

    return null;
  }

  /**
   * Click block ad action
   * @param {HTMLElement} action - Block action to click
   * @returns {Promise<boolean>}
   */
  async clickBlockAction(action) {
    if (!action || !this.currentSession) {
      return false;
    }

    // Check session limits
    if (this.hasExceededLimits() || this.isSessionExpired()) {
      logger.warn('Cannot click block action: session limits exceeded or expired');
      return false;
    }

    // Verify action is still valid
    if (!isVisible(action) || !isClickable(action)) {
      logger.warn('Block action is no longer valid');
      return false;
    }

    // Verify action is in a menu
    const menu = this.findClosestMenuAncestor(action);
    if (!menu || !isVisible(menu)) {
      logger.warn('Block action is not in a visible menu');
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
        
        // Increment stats
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

  /**
   * Handle confirmation dialog
   * @returns {Promise<boolean>}
   */
  async handleConfirmation() {
    logger.debug('Looking for confirmation dialog...');
    
    // Look for confirmation buttons
    const confirmButtons = findVisibleClickableElements(SELECTORS.CONFIRMATION_BUTTONS);
    
    for (const button of confirmButtons) {
      if (this.isValidConfirmationButton(button)) {
        logger.action('Clicking confirmation button', { button });
        const result = await safeClick(button);
        if (result) {
          logger.info('Confirmation button clicked');
          return true;
        }
      }
    }

    // If no confirmation button found, the action might have been successful
    logger.debug('No confirmation button found, assuming success');
    return true;
  }

  /**
   * Check if button is a valid confirmation button
   * @param {HTMLElement} button - Button to check
   * @returns {boolean}
   */
  isValidConfirmationButton(button) {
    if (!button || !isVisible(button) || !isClickable(button)) {
      return false;
    }

    // Only click confirmation buttons that are in the context of ad blocking
    const label = getElementLabel(button).toLowerCase();
    const text = (button.textContent || '').toLowerCase().trim();
    
    const confirmationPatterns = [
      /ok/i,
      /confirm/i,
      /done/i,
      /close/i,
      /fermer/i,
      /cerrar/i,
      /confirmer/i
    ];

    for (const pattern of confirmationPatterns) {
      if (pattern.test(label) || pattern.test(text)) {
        // Check if button is in a dialog or menu context
        const menu = this.findClosestMenuAncestor(button);
        if (menu) {
          return true;
        }
        
        // Check if button is near other ad-related elements
        if (isInsideVideoPlayer(button)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find skip ad button (fallback)
   * @returns {HTMLElement|null}
   */
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

  /**
   * Check if button is a valid skip button
   * @param {HTMLElement} button - Button to check
   * @returns {boolean}
   */
  isValidSkipButton(button) {
    if (!button || !isVisible(button) || !isClickable(button)) {
      return false;
    }

    // Check if button is inside player
    if (!isInsideVideoPlayer(button)) {
      return false;
    }

    // Check label and text
    const label = getElementLabel(button).toLowerCase();
    const text = (button.textContent || '').toLowerCase().trim();
    
    const skipPatterns = [
      /skip\s*ad/i,
      /skip/i,
      /ignorer/i,
      /ignorer\s*la\s*pub/i,
      /passer/i,
      /passer\s*la\s*pub/i,
      /sauter/i,
      /sauter\s*la\s*pub/i,
      /omitir/i,
      /saltar/i
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(label) || pattern.test(text)) {
        return true;
      }
    }

    // Check for YouTube skip button classes
    const className = button.className || '';
    if (className.includes('ytp-ad-skip') || className.includes('skip-button')) {
      return true;
    }

    return false;
  }

  /**
   * Click skip ad button
   * @param {HTMLElement} button - Skip button to click
   * @returns {Promise<boolean>}
   */
  async clickSkipButton(button) {
    if (!button || !this.currentSession) {
      return false;
    }

    // Check session limits
    if (this.hasExceededLimits() || this.isSessionExpired()) {
      logger.warn('Cannot click skip button: session limits exceeded or expired');
      return false;
    }

    // Verify button is still valid
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
        
        // Increment fallback stats
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

  /**
   * Check if ad has disappeared
   * @returns {Promise<boolean>}
   */
  async hasAdDisappeared() {
    // Wait a bit to ensure any animations have completed
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if ad indicators are gone
    const adIndicators = findAllMatchingElements(SELECTORS.AD_INDICATORS);
    const visibleIndicators = adIndicators.filter(el => isVisible(el));
    
    if (visibleIndicators.length > 0) {
      return false;
    }

    // Check if skip buttons are gone
    const skipButtons = findVisibleClickableElements(SELECTORS.SKIP_BUTTONS);
    if (skipButtons.length > 0) {
      return false;
    }

    // Check if we're back to normal video
    const player = findPlayerContainer();
    if (player) {
      // Check for video controls (indicating normal video)
      const controls = player.querySelectorAll('.ytp-chrome-controls, .ytp-controls');
      for (const control of controls) {
        if (isVisible(control)) {
          return true;
        }
      }
    }

    return true;
  }

  /**
   * Block current ad (main workflow)
   * @returns {Promise<Object>} Result object
   */
  async blockCurrentAd() {
    logger.debug('Starting block current ad workflow...');
    
    // Check if we can perform the action
    const settings = await storage.getSettings();
    if (!settings.extensionEnabled || !settings.autoBlockEnabled) {
      logger.warn('Extension or auto-block is disabled');
      return { success: false, reason: 'disabled' };
    }

    // Start new session
    this.startSession();
    this.setState(STATES.AD_DETECTED);

    try {
      // Step 1: Find info button
      this.setState(STATES.FINDING_INFO);
      const infoButton = this.findAdInfoButton();
      
      if (!infoButton) {
        logger.warn('No info button found, trying fallback');
        return await this.fallbackSkipAd();
      }

      // Step 2: Click info button
      this.setState(STATES.CLICKING_INFO);
      const infoClicked = await this.clickInfoButton(infoButton);
      
      if (!infoClicked) {
        logger.warn('Failed to click info button, trying fallback');
        return await this.fallbackSkipAd();
      }

      // Step 3: Wait for menu
      this.setState(STATES.WAITING_FOR_MENU);
      const menu = await this.waitForMenu();
      
      if (!menu) {
        logger.warn('Menu did not appear, trying fallback');
        return await this.fallbackSkipAd();
      }

      // Step 4: Find block action
      this.setState(STATES.FINDING_BLOCK_ACTION);
      const blockActions = this.findBlockActions(menu);
      
      if (blockActions.length === 0) {
        logger.warn('No block actions found, trying fallback');
        return await this.fallbackSkipAd();
      }

      // Step 5: Click block action
      this.setState(STATES.CLICKING_BLOCK);
      const blockClicked = await this.clickBlockAction(blockActions[0]);
      
      if (!blockClicked) {
        logger.warn('Failed to click block action, trying fallback');
        return await this.fallbackSkipAd();
      }

      // Step 6: Handle confirmation
      this.setState(STATES.WAITING_FOR_RESULT);
      await this.handleConfirmation();

      // Step 7: Check if ad disappeared
      const adGone = await this.hasAdDisappeared();
      
      if (adGone) {
        this.setState(STATES.AD_DISAPPEARED);
        logger.info('Ad successfully blocked and disappeared');
        
        // Increment stats
        await storage.incrementStat('adsDetected');
        
        // Estimate time saved (conservative estimate)
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

  /**
   * Fallback: Skip ad
   * @returns {Promise<Object>} Result object
   */
  async fallbackSkipAd() {
    logger.debug('Starting fallback skip ad workflow...');
    
    const settings = await storage.getSettings();
    if (!settings.useFallbackSkip) {
      logger.warn('Fallback skip is disabled');
      return { success: false, reason: 'fallback_disabled' };
    }

    if (!this.currentSession) {
      this.startSession();
    }

    try {
      // Find skip button
      const skipButton = this.findSkipButton();
      
      if (!skipButton) {
        logger.warn('No skip button found for fallback');
        return { success: false, reason: 'no_skip_button' };
      }

      // Click skip button
      const result = await this.clickSkipButton(skipButton);
      
      if (!result) {
        logger.warn('Failed to click skip button');
        return { success: false, reason: 'click_failed' };
      }

      // Check if ad disappeared
      const adGone = await this.hasAdDisappeared();
      
      if (adGone) {
        logger.info('Ad successfully skipped via fallback');
        
        // Increment stats
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

  /**
   * Get current session
   * @returns {Object|null}
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get current state
   * @returns {string}
   */
  getCurrentState() {
    return this.state;
  }

  /**
   * Reset action system
   */
  reset() {
    this.endSession();
    this.pendingActions = [];
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Singleton instance
export const adActions = new AdActions();

export default adActions;
