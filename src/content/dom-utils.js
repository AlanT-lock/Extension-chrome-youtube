// YouTube Auto Ad Skip - DOM Utilities

import { logger } from './logger.js';
import { SELECTORS, YOUTUBE_PATTERNS } from '../shared/constants.js';

/**
 * DOM utility functions for working with YouTube's DOM
 */

/**
 * Check if element is visible
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isVisible(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Check computed style
  const computedStyle = window.getComputedStyle(element);
  
  if (computedStyle.display === 'none' || 
      computedStyle.visibility === 'hidden' ||
      computedStyle.opacity === '0') {
    return false;
  }

  // Check if element is hidden via aria
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  // Check if element or any parent is hidden
  let current = element;
  while (current && current !== document.body) {
    const currentStyle = window.getComputedStyle(current);
    if (currentStyle.display === 'none' || 
        currentStyle.visibility === 'hidden' ||
        currentStyle.opacity === '0') {
      return false;
    }
    
    if (current.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    
    current = current.parentElement;
  }

  // Check if element has zero size
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  return true;
}

/**
 * Check if element is clickable
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isClickable(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Check if element is disabled
  if (element.disabled) {
    return false;
  }

  // Check if element has pointer-events: none
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.pointerEvents === 'none') {
    return false;
  }

  // Check if element is visible
  if (!isVisible(element)) {
    return false;
  }

  // Check if element is a button, link, or clickable element
  const tagName = element.tagName.toLowerCase();
  const clickableTags = ['button', 'a', 'input', 'textarea', 'select', 'div', 'span'];
  
  if (!clickableTags.includes(tagName)) {
    return false;
  }

  // For input elements, check type
  if (tagName === 'input') {
    const type = element.type.toLowerCase();
    const clickableTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
    if (!clickableTypes.includes(type)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if element is inside the video player
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isInsideVideoPlayer(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Find all player containers
  const playerContainers = [];
  
  for (const selector of SELECTORS.PLAYER_CONTAINER) {
    const containers = document.querySelectorAll(selector);
    containers.forEach(container => {
      if (container && isVisible(container)) {
        playerContainers.push(container);
      }
    });
  }

  // If no player containers found, check for common patterns
  if (playerContainers.length === 0) {
    const commonContainers = document.querySelectorAll('ytd-player, #movie_player, .html5-video-container');
    commonContainers.forEach(container => {
      if (container && isVisible(container)) {
        playerContainers.push(container);
      }
    });
  }

  // Check if element is inside any player container
  for (const container of playerContainers) {
    if (container.contains(element)) {
      return true;
    }
  }

  // Fallback: check if element is in a position that suggests it's in the player
  // This is a heuristic approach
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Check if element is roughly centered horizontally (player is usually centered)
  const windowWidth = window.innerWidth;
  const playerWidthRatio = 0.6; // Player typically takes ~60-80% of width
  const playerLeft = (windowWidth - (windowWidth * playerWidthRatio)) / 2;
  const playerRight = playerLeft + (windowWidth * playerWidthRatio);
  
  if (centerX >= playerLeft && centerX <= playerRight) {
    // Check vertical position - player is usually in the upper part
    const windowHeight = window.innerHeight;
    const playerTopRatio = 0.1; // Player starts around 10% from top
    const playerBottomRatio = 0.9; // Player ends around 90% from top
    
    if (centerY >= (windowHeight * playerTopRatio) && centerY <= (windowHeight * playerBottomRatio)) {
      return true;
    }
  }

  return false;
}

/**
 * Get element label (aria-label, title, or text)
 * @param {HTMLElement} element - Element to get label from
 * @returns {string}
 */
export function getElementLabel(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return '';
  }

  // Check aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  // Check title
  const title = element.getAttribute('title');
  if (title) {
    return title.trim();
  }

  // Check text content
  const text = element.textContent?.trim() || '';
  if (text) {
    return text;
  }

  // Check for SVG with aria-label
  const svg = element.querySelector('svg');
  if (svg) {
    const svgLabel = svg.getAttribute('aria-label');
    if (svgLabel) {
      return svgLabel.trim();
    }
  }

  return '';
}

/**
 * Get element role
 * @param {HTMLElement} element - Element to get role from
 * @returns {string}
 */
export function getElementRole(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return '';
  }

  return element.getAttribute('role') || '';
}

/**
 * Check if element matches any selector in a list
 * @param {HTMLElement} element - Element to check
 * @param {Array<string>} selectors - List of selectors
 * @returns {boolean}
 */
export function matchesAnySelector(element, selectors) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  for (const selector of selectors) {
    try {
      // Handle :has-text pseudo-selector (not standard, but we support it)
      if (selector.includes(':has-text(')) {
        const match = selector.match/:has-text\(([^)]+)\)/i);
        if (match) {
          const textPattern = match[1];
          const elementText = (element.textContent || '').toLowerCase();
          const patternText = textPattern.toLowerCase();
          
          if (elementText.includes(patternText)) {
            return true;
          }
        }
      } else {
        // Standard selector matching
        // Create a temporary parent and check if element matches
        const tempParent = document.createElement('div');
        tempParent.appendChild(element.cloneNode(true));
        
        const matches = tempParent.querySelector(selector);
        if (matches) {
          return true;
        }
      }
    } catch (error) {
      // Invalid selector, skip it
      logger.debug(`Invalid selector: ${selector}`, error);
    }
  }

  return false;
}

/**
 * Check if element text matches any pattern
 * @param {HTMLElement} element - Element to check
 * @param {Array<RegExp>} patterns - Array of regex patterns
 * @returns {boolean}
 */
export function textMatchesAnyPattern(element, patterns) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  const text = (element.textContent || '').toLowerCase();
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Find closest ancestor that matches a selector
 * @param {HTMLElement} element - Starting element
 * @param {Array<string>} selectors - Selectors to match
 * @returns {HTMLElement|null}
 */
export function findClosestAncestor(element, selectors) {
  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  let current = element.parentElement;
  
  while (current && current !== document.body) {
    if (matchesAnySelector(current, selectors)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Find all elements that match any selector in a list
 * @param {Array<string>} selectors - List of selectors
 * @param {HTMLElement} container - Container to search in (default: document)
 * @returns {Array<HTMLElement>}
 */
export function findAllMatchingElements(selectors, container = document) {
  const elements = [];
  
  for (const selector of selectors) {
    try {
      let foundElements = [];
      
      // Handle :has-text pseudo-selector
      if (selector.includes(':has-text(')) {
        const match = selector.match/:has-text\(([^)]+)\)/i);
        if (match) {
          const textPattern = match[1];
          const patternText = textPattern.toLowerCase();
          
          // Find all elements and filter by text
          const allElements = container.querySelectorAll('*');
          allElements.forEach(el => {
            const text = (el.textContent || '').toLowerCase();
            if (text.includes(patternText) && !elements.includes(el)) {
              elements.push(el);
            }
          });
        }
      } else {
        foundElements = container.querySelectorAll(selector);
        foundElements.forEach(el => {
          if (!elements.includes(el)) {
            elements.push(el);
          }
        });
      }
    } catch (error) {
      logger.debug(`Error with selector ${selector}:`, error);
    }
  }

  return elements;
}

/**
 * Find visible and clickable elements that match selectors
 * @param {Array<string>} selectors - List of selectors
 * @param {HTMLElement} container - Container to search in
 * @returns {Array<HTMLElement>}
 */
export function findVisibleClickableElements(selectors, container = document) {
  const allElements = findAllMatchingElements(selectors, container);
  
  return allElements.filter(el => {
    return isVisible(el) && isClickable(el);
  });
}

/**
 * Find elements inside video player that match selectors
 * @param {Array<string>} selectors - List of selectors
 * @returns {Array<HTMLElement>}
 */
export function findElementsInPlayer(selectors) {
  const allElements = findAllMatchingElements(selectors);
  
  return allElements.filter(el => {
    return isVisible(el) && isInsideVideoPlayer(el);
  });
}

/**
 * Check if element is an ad-related element
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isAdRelatedElement(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Check if element matches any ad indicator selector
  if (matchesAnySelector(element, SELECTORS.AD_INDICATORS)) {
    return true;
  }

  // Check if element text matches ad patterns
  if (textMatchesAnyPattern(element, YOUTUBE_PATTERNS.AD)) {
    return true;
  }

  // Check if element has ad-related class or ID
  const className = (element.className || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  
  if (YOUTUBE_PATTERNS.AD.test(className) || YOUTUBE_PATTERNS.AD.test(id)) {
    return true;
  }

  // Check if any ancestor is an ad-related element
  const adAncestor = findClosestAncestor(element, SELECTORS.AD_INDICATORS);
  if (adAncestor) {
    return true;
  }

  return false;
}

/**
 * Get element position relative to viewport
 * @param {HTMLElement} element - Element to get position for
 * @returns {Object} Position object with top, left, width, height
 */
export function getElementPosition(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return { top: 0, left: 0, width: 0, height: 0 };
  }

  const rect = element.getBoundingClientRect();
  
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right
  };
}

/**
 * Check if element is in the bottom-left area of the player
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isInBottomLeftArea(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  const position = getElementPosition(element);
  const player = findPlayerContainer();
  
  if (!player) {
    return false;
  }

  const playerPosition = getElementPosition(player);
  
  // Check if element is in the bottom 20% and left 30% of the player
  const isBottom = position.bottom <= playerPosition.bottom && 
                   position.top >= playerPosition.bottom - (playerPosition.height * 0.2);
  
  const isLeft = position.left >= playerPosition.left && 
                 position.right <= playerPosition.left + (playerPosition.width * 0.3);

  return isBottom && isLeft;
}

/**
 * Find the main player container
 * @returns {HTMLElement|null}
 */
export function findPlayerContainer() {
  for (const selector of SELECTORS.PLAYER_CONTAINER) {
    const container = document.querySelector(selector);
    if (container && isVisible(container)) {
      return container;
    }
  }
  
  // Fallback selectors
  const fallbackSelectors = ['ytd-player', '#movie_player', '.html5-video-container'];
  for (const selector of fallbackSelectors) {
    const container = document.querySelector(selector);
    if (container && isVisible(container)) {
      return container;
    }
  }
  
  return null;
}

/**
 * Check if element is newly added (within last N milliseconds)
 * @param {HTMLElement} element - Element to check
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {boolean}
 */
export function isNewlyAdded(element, maxAgeMs = 1000) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // This is a heuristic - we can't know the exact creation time
  // Instead, we check if the element has certain attributes that indicate it's new
  // or if it's in a position that suggests it's a recently opened menu
  
  // Check for animation classes that YouTube uses for new elements
  const className = element.className || '';
  if (className.includes('animate') || className.includes('transition')) {
    return true;
  }

  // Check if element has focus (newly opened menus often get focus)
  if (element === document.activeElement) {
    return true;
  }

  // Check if any ancestor has focus
  let current = element.parentElement;
  while (current && current !== document.body) {
    if (current === document.activeElement) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

/**
 * Wait for element to be visible
 * @param {HTMLElement} element - Element to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<HTMLElement|null>}
 */
export async function waitForVisible(element, timeoutMs = 2000) {
  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (isVisible(element)) {
      return element;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return null;
}

/**
 * Wait for element to appear in DOM
 * @param {Array<string>} selectors - Selectors to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<HTMLElement|null>}
 */
export async function waitForElement(selectors, timeoutMs = 2000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const elements = findVisibleClickableElements(selectors);
    if (elements.length > 0) {
      return elements[0];
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return null;
}

/**
 * Simulate click on element with safety checks
 * @param {HTMLElement} element - Element to click
 * @returns {Promise<boolean>}
 */
export async function safeClick(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Check if element is still in DOM
  if (!document.contains(element)) {
    return false;
  }

  // Check if element is visible and clickable
  if (!isVisible(element) || !isClickable(element)) {
    return false;
  }

  try {
    // Scroll element into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    
    // Dispatch click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    element.dispatchEvent(clickEvent);
    
    // Also try native click as fallback
    if (!clickEvent.defaultPrevented) {
      element.click();
    }
    
    // Small delay to allow any animations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return true;
  } catch (error) {
    logger.error('Error clicking element:', error);
    return false;
  }
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeoutId = null;
  
  return function(...args) {
    const context = this;
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle = false;
  
  return function(...args) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export default {
  isVisible,
  isClickable,
  isInsideVideoPlayer,
  getElementLabel,
  getElementRole,
  matchesAnySelector,
  textMatchesAnyPattern,
  findClosestAncestor,
  findAllMatchingElements,
  findVisibleClickableElements,
  findElementsInPlayer,
  isAdRelatedElement,
  getElementPosition,
  isInBottomLeftArea,
  findPlayerContainer,
  isNewlyAdded,
  waitForVisible,
  waitForElement,
  safeClick,
  debounce,
  throttle
};
