// YouTube Auto Ad Skip - Background Service Worker
// This is the background service worker for Chrome Extension MV3

// Inline all constants
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

// Extension state
let isExtensionEnabled = true;

// Initialize storage with defaults on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
        [STORAGE_KEYS.STATS]: DEFAULT_STATS
      });
      console.log('[YouTubeAdSkip] Extension installed with default settings');
    } catch (error) {
      console.error('[YouTubeAdSkip] Error during installation:', error);
    }
  } else if (details.reason === 'update') {
    console.log('[YouTubeAdSkip] Extension updated');
    try {
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
    } catch (error) {
      console.error('[YouTubeAdSkip] Error during update:', error);
    }
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Keep the message port open for async responses
  const promise = handleMessage(message, sender);
  promise.then(response => sendResponse(response)).catch(error => {
    sendResponse({ success: false, error: error.message });
  });
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(message, sender) {
  try {
    switch (message.type) {
      case MESSAGE_TYPES.TOGGLE_EXTENSION:
        isExtensionEnabled = message.value;
        await forwardMessageToContentScripts(message);
        return { success: true, extensionEnabled: isExtensionEnabled };

      case MESSAGE_TYPES.TOGGLE_AUTO_BLOCK:
      case MESSAGE_TYPES.TOGGLE_FALLBACK_SKIP:
      case MESSAGE_TYPES.TOGGLE_DEBUG:
        await forwardMessageToContentScripts(message);
        return { success: true };

      case MESSAGE_TYPES.GET_STATS:
        const stats = await chrome.storage.local.get(STORAGE_KEYS.STATS);
        return stats[STORAGE_KEYS.STATS] || DEFAULT_STATS;

      case MESSAGE_TYPES.RESET_STATS:
        await chrome.storage.local.set({
          [STORAGE_KEYS.STATS]: DEFAULT_STATS
        });
        return { success: true };

      case MESSAGE_TYPES.GET_STATE:
        return { isRunning: isExtensionEnabled };

      case MESSAGE_TYPES.LOG_EVENT:
        console.log(`[YouTubeAdSkip] ${message.level.toUpperCase()}: ${message.message}`, message.data);
        return { success: true };

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    console.error('[YouTubeAdSkip] Error handling message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Forward message to all YouTube tabs
 */
async function forwardMessageToContentScripts(message) {
  try {
    // Get all tabs that are on YouTube
    const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    
    for (const tab of tabs) {
      if (tab && tab.id) {
        try {
          // Send message to content script in this tab
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          // Content script might not be injected yet
          // This is normal and expected - just ignore
          console.debug(`[YouTubeAdSkip] Could not send message to tab ${tab.id}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('[YouTubeAdSkip] Error forwarding message:', error);
  }
}

// Log that background script is loaded
console.log('[YouTubeAdSkip] Background service worker loaded');
