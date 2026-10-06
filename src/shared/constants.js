// YouTube Auto Ad Skip - Shared Constants

// Extension state
export const EXTENSION_STATE = {
  ON: 'on',
  OFF: 'off'
};

// Machine states
export const STATES = {
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

// Detection confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.7,
  LOW: 0.5,
  AD_DETECTED: 0.8
};

// Scoring weights for ad detection
export const AD_DETECTION_SCORES = {
  AD_INDICATOR_PRESENCE: 40,
  INFO_BUTTON_DETECTED: 30,
  KNOWN_AD_STRUCTURE: 20,
  AD_TEXT_DETECTED: 10,
  PLAYER_OVERLAY: 15,
  AD_CONTAINER: 25
};

// Timeouts and delays (in milliseconds)
export const TIMEOUTS = {
  MENU_OPEN_WAIT: 2000,
  BLOCK_ACTION_WAIT: 2000,
  AD_DETECTION_DEBOUNCE: 200,
  MUTATION_OBSERVER_DELAY: 100,
  MAX_AD_SESSION_DURATION: 5000,
  POLLING_INTERVALS: [0, 50, 100, 200, 400, 800],
  CLICK_DELAY: 50,
  MAX_RETRIES: 2
};

// Limits for ad session
export const AD_SESSION_LIMITS = {
  MAX_INFO_CLICKS: 2,
  MAX_BLOCK_CLICKS: 2,
  MAX_ATTEMPTS: 3,
  MAX_DURATION_MS: 5000
};

// YouTube selectors - centralized configuration
export const SELECTORS = {
  // Player container
  PLAYER_CONTAINER: [
    'ytd-player',
    '#movie_player',
    '.html5-video-container',
    '[data-context-item-id]',
    '.ytd-watch-flexy'
  ],
  
  // Ad indicators
  AD_INDICATORS: [
    // Ad label text
    'div[aria-label*="advertisement" i]',
    'div[aria-label*="ad" i]',
    'div[aria-label*="annonce" i]',
    'div[aria-label*="publicité" i]',
    'span:has-text("Ad")',
    'span:has-text("Advertisement")',
    'span:has-text("Annonce")',
    'span:has-text("Publicité")',
    
    // Ad container classes
    '.ad-container',
    '.video-ads',
    'ytd-ad-module',
    '.ad-showing',
    '.ad-interrupting',
    '.ad-pod',
    
    // Specific YouTube ad elements
    'div.ad-placeholder',
    '.ad-video',
    '.ad-overlay',
    '[class*="ad-"]',
    '[id*="ad"]',
    
    // Skip ad button container (indicator that it's an ad)
    '.ytp-ad-skip-button-container',
    '.ytp-ad-skip-button',
    
    // Ad progress bar
    '.ytp-ad-progress',
    '.ytp-ad-progress-list',
    
    // Ad countdown
    '.ytp-ad-duration-remaining'
  ],
  
  // Info/Plus buttons for ads
  INFO_BUTTONS: [
    // Common patterns
    'button[aria-label*="info" i]',
    'button[aria-label*="more" i]',
    'button[aria-label*="plus" i]',
    'button[aria-label*="i" i]',
    'button[title*="info" i]',
    'button[title*="more" i]',
    
    // YouTube specific
    '.ytp-ad-button',
    '.ytp-ad-info-button',
    '.ytp-ad-more-button',
    '.ad-info-button',
    '.ad-more-info',
    
    // SVG icon patterns (info icon)
    'button svg[viewBox="0 0 24 24"]:has(path[d*="M12 2C6.48"])',
    'button:has(svg:has(path[d*="M12 2"]))',
    'button:has(.ad-info-icon)',
    
    // Text patterns
    'button:has-text("Info")',
    'button:has-text("More")',
    'button:has-text("i")',
    'button:has-text("Plus")',
    
    // French
    'button:has-text("Informations")',
    'button:has-text("Plus d\'infos")',
    'button:has-text("i")'
  ],
  
  // Ad menus
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
  
  // Block ad actions
  BLOCK_ACTIONS: [
    // English
    'button:has-text("Block ad")',
    'button:has-text("Block this ad")',
    'button:has-text("Stop seeing this ad")',
    'a:has-text("Block ad")',
    'div:has-text("Block ad")',
    'span:has-text("Block ad")',
    
    // French
    'button:has-text("Bloquer l\'annonce")',
    'button:has-text("Bloquer cette annonce")',
    'button:has-text("Bloquer la pub")',
    'a:has-text("Bloquer l\'annonce")',
    'div:has-text("Bloquer l\'annonce")',
    'span:has-text("Bloquer l\'annonce")',
    
    // Spanish
    'button:has-text("Bloquear anuncio")',
    'button:has-text("Bloquear este anuncio")',
    
    // German
    'button:has-text("Anzeige blockieren")',
    
    // Italian
    'button:has-text("Blocca annuncio")',
    
    // Portuguese
    'button:has-text("Bloquear anúncio")',
    
    // Generic patterns
    '[aria-label*="block" i]',
    '[aria-label*="bloquer" i]',
    '[aria-label*="bloquear" i]',
    '[data-action*="block"]',
    '[class*="block"]',
    
    // YouTube specific
    '.ad-block-action',
    '.block-ad-button',
    'ytd-menu-service-item-renderer:has(a:has-text("Block"))'
  ],
  
  // Skip ad buttons (fallback)
  SKIP_BUTTONS: [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-container',
    'button.ytp-ad-skip-button',
    'div.ytp-ad-skip-button',
    'button:has-text("Skip")',
    'button:has-text("Skip ad")',
    'button:has-text("Skip Ad")',
    'button:has-text("Ignorer")',
    'button:has-text("Ignorer la pub")',
    'button:has-text("Passer")',
    'button:has-text("Passer la pub")',
    'button:has-text("Sauter")',
    'button:has-text("Sauter la pub")',
    'button:has-text("Omitir")',
    'button:has-text("Saltar")',
    '[aria-label*="skip" i]',
    '[aria-label*="ignorer" i]',
    '[aria-label*="passer" i]',
    '[aria-label*="sauter" i]',
    '[aria-label*="omitir" i]',
    '[aria-label*="saltar" i]'
  ],
  
  // Confirmation buttons
  CONFIRMATION_BUTTONS: [
    'button:has-text("OK")',
    'button:has-text("Confirm")',
    'button:has-text("Confirmar")',
    'button:has-text("Confirmer")',
    'button:has-text("Done")',
    'button:has-text("Close")',
    'button:has-text("Fermer")',
    'button:has-text("Cerrar")',
    '[aria-label*="confirm" i]',
    '[aria-label*="close" i]',
    '[aria-label*="done" i]'
  ]
};

// Text patterns for ad detection
export const AD_TEXT_PATTERNS = [
  /ad/gi,
  /advertisement/gi,
  /annonce/gi,
  /publicit[ée]/gi,
  /pub/gi,
  /sponsored/gi,
  /promotion/gi,
  /commercial/gi
];

// Default settings
export const DEFAULT_SETTINGS = {
  extensionEnabled: true,
  autoBlockEnabled: true,
  useFallbackSkip: true,
  debugMode: false
};

// Default statistics
export const DEFAULT_STATS = {
  adsDetected: 0,
  adsBlocked: 0,
  fallbackSkips: 0,
  failedAttempts: 0,
  estimatedTimeSaved: 0
};

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'ytaas_settings',
  STATS: 'ytaas_stats'
};

// Message types for communication
export const MESSAGE_TYPES = {
  TOGGLE_EXTENSION: 'TOGGLE_EXTENSION',
  TOGGLE_AUTO_BLOCK: 'TOGGLE_AUTO_BLOCK',
  TOGGLE_FALLBACK_SKIP: 'TOGGLE_FALLBACK_SKIP',
  TOGGLE_DEBUG: 'TOGGLE_DEBUG',
  RESET_STATS: 'RESET_STATS',
  GET_STATE: 'GET_STATE',
  GET_STATS: 'GET_STATS',
  LOG_EVENT: 'LOG_EVENT'
};

// CSS classes for styling
export const CSS_CLASSES = {
  HIDDEN: 'ytaas-hidden',
  AD_DETECTED: 'ytaas-ad-detected',
  PROCESSING: 'ytaas-processing'
};

// Attribute names
export const DATA_ATTRIBUTES = {
  AD_SESSION_ID: 'data-ytaas-ad-session',
  AD_ELEMENT_ID: 'data-ytaas-ad-element',
  PROCESSED: 'data-ytaas-processed'
};

// YouTube specific class patterns
export const YOUTUBE_PATTERNS = {
  PLAYER: /ytd-player|html5-video-container|movie_player/i,
  AD: /ad|advertisement|annonce|sponsored/i,
  INFO: /info|more|i\s*circle|help/i,
  BLOCK: /block|stop\s*seeing|bloquer|bloquear/i,
  SKIP: /skip|ignore|pass|saltar|omitir/i
};
