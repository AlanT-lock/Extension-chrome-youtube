// YouTube Auto Ad Skip - Background Service Worker
// Note: Service workers in Chrome extensions don't support ES modules natively
// So we inline the constants here

/**
 * Shared Constants - Inlined for service worker compatibility
 */
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

/**
 * Service Worker for background tasks
 * Handles extension lifecycle and message routing
 */

// Extension state
let isExtensionEnabled = true;

// Initialize storage with defaults
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First installation - set default settings and stats
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.STATS]: DEFAULT_STATS
    });
    
    console.log('[YouTubeAdSkip] Extension installed with default settings');
  } else if (details.reason === 'update') {
    // Extension updated - check if we need to migrate anything
    console.log('[YouTubeAdSkip] Extension updated');
    
    // Ensure all default settings exist
    const currentSettings = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const currentStats = await chrome.storage.local.get(STORAGE_KEYS.STATS);
    
    if (!currentSettings[STORAGE_KEYS.SETTINGS]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
      });
    }
    
    if (!currentStats[STORAGE_KEYS.STATS]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.STATS]: DEFAULT_STATS
      });
    }
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Return true to keep message port open for async response
});

/**
 * Handle incoming messages
 * @param {Object} message - Message object
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Response function
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      // Settings messages
      case MESSAGE_TYPES.TOGGLE_EXTENSION:
        isExtensionEnabled = message.value;
        // Forward to content scripts
        await forwardMessageToContentScripts(message);
        sendResponse({ success: true, extensionEnabled: isExtensionEnabled });
        break;

      case MESSAGE_TYPES.TOGGLE_AUTO_BLOCK:
      case MESSAGE_TYPES.TOGGLE_FALLBACK_SKIP:
      case MESSAGE_TYPES.TOGGLE_DEBUG:
        // Forward to content scripts
        await forwardMessageToContentScripts(message);
        sendResponse({ success: true });
        break;

      // Stats messages
      case MESSAGE_TYPES.GET_STATS:
        const stats = await chrome.storage.local.get(STORAGE_KEYS.STATS);
        sendResponse(stats[STORAGE_KEYS.STATS] || DEFAULT_STATS);
        break;

      case MESSAGE_TYPES.RESET_STATS:
        await chrome.storage.local.set({
          [STORAGE_KEYS.STATS]: DEFAULT_STATS
        });
        sendResponse({ success: true });
        break;

      // State messages
      case MESSAGE_TYPES.GET_STATE:
        // For now, just return the extension enabled state
        sendResponse({ isRunning: isExtensionEnabled });
        break;

      // Log messages (from popup for debugging)
      case MESSAGE_TYPES.LOG_EVENT:
        console.log(`[YouTubeAdSkip] ${message.level.toUpperCase()}: ${message.message}`, message.data);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[YouTubeAdSkip] Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Forward message to all content scripts
 * @param {Object} message - Message to forward
 */
async function forwardMessageToContentScripts(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (error) {
        // Content script might not be injected yet or tab is closed
        console.debug(`[YouTubeAdSkip] Error sending message to tab ${tab.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[YouTubeAdSkip] Error forwarding message:', error);
  }
}

/**
 * Get extension state
 * @returns {boolean}
 */
function getExtensionState() {
  return isExtensionEnabled;
}
