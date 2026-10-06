# YouTube Auto Ad Skip

A Chrome extension that automatically detects and blocks YouTube ads by clicking the Info button and selecting "Block Ad". This extension works locally and does not collect any data.

## Features

- **Automatic Ad Detection**: Detects YouTube video ads using multiple strategies (CSS selectors, ARIA attributes, text patterns, etc.)
- **Smart Blocking**: Clicks the Info button and selects "Block Ad" to permanently block the advertisement
- **Fallback Mechanism**: Uses "Skip Ad" button as fallback when Block Ad is not available
- **Statistics Tracking**: Keeps track of ads detected, blocked, and time saved
- **Debug Mode**: Enables detailed logging for troubleshooting
- **Lightweight**: Minimal performance impact with efficient DOM observation

## Installation

### Method 1: Load Unpacked (Recommended for Development)

1. **Download the extension files**
   - Clone this repository or download the ZIP file
   - Extract the files to a folder on your computer

2. **Open Chrome Extensions Page**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top right corner)

3. **Load the Extension**
   - Click **Load unpacked** button
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

### Method 2: Pack as CRX (For Distribution)

1. **Create a ZIP file** of the extension folder
2. **Go to `chrome://extensions/`** in Chrome
3. **Enable Developer mode**
4. **Drag and drop** the ZIP file onto the extensions page
5. **Confirm installation** when prompted

## Usage

Once installed:

1. **Enable the extension** using the toggle in the popup
2. **Navigate to YouTube** and start watching videos
3. The extension will automatically:
   - Detect when an ad is playing
   - Find and click the Info button
   - Find and click the "Block Ad" option
   - Fall back to "Skip Ad" if Block Ad is not available

### Popup Controls

- **Extension Enabled**: Turn the entire extension on/off
- **Auto Block Ads**: Enable/disable automatic ad blocking
- **Use Skip Fallback**: Enable/disable fallback to Skip Ad button
- **Debug Mode**: Show detailed logs in the Chrome console

### Viewing Statistics

The popup displays:
- **Ads Detected**: Total number of ads detected
- **Ads Blocked**: Number of ads successfully blocked via Info → Block Ad
- **Fallback Skips**: Number of ads skipped using the Skip Ad button
- **Failed Attempts**: Number of times the extension failed to block/skip an ad
- **Time Saved**: Estimated time saved by skipping ads

## Architecture

The extension uses Chrome Extension Manifest V3 and consists of:

```
youtube-auto-ad-skip/
├── manifest.json              # Extension manifest
├── icons/                     # Extension icons
├── src/
│   ├── content/
│   │   ├── main.js            # Main content script
│   │   ├── ad-detector.js     # Ad detection logic
│   │   ├── ad-actions.js      # Ad blocking actions
│   │   ├── dom-utils.js       # DOM utility functions
│   │   └── logger.js          # Logging functionality
│   │
│   ├── background/
│   │   └── service-worker.js  # Background service worker
│   │
│   ├── popup/
│   │   ├── popup.html        # Popup HTML
│   │   ├── popup.css         # Popup styles
│   │   └── popup.js          # Popup logic
│   │
│   └── shared/
│       ├── constants.js       # Shared constants
│       └── storage.js         # Storage management
│
└── README.md
```

### Key Components

1. **Ad Detector** (`ad-detector.js`)
   - Uses a scoring system to detect ads
   - Multiple detection strategies (CSS, ARIA, text, structure)
   - Configurable confidence thresholds

2. **Ad Actions** (`ad-actions.js`)
   - State machine for ad blocking workflow
   - Finds and clicks Info button
   - Finds and clicks Block Ad option
   - Handles confirmation dialogs
   - Fallback to Skip Ad button

3. **DOM Utilities** (`dom-utils.js`)
   - Checks element visibility and clickability
   - Finds elements in specific contexts
   - Safe DOM manipulation

4. **Logger** (`logger.js`)
   - Configurable logging levels
   - Debug mode support
   - State transition logging

## Detection Strategies

The extension uses multiple strategies to detect ads:

- **CSS Classes**: Looks for known YouTube ad classes
- **ARIA Attributes**: Checks for `aria-label` containing "ad", "advertisement", etc.
- **Text Patterns**: Searches for text like "Ad", "Advertisement", "Annonce", etc.
- **DOM Structure**: Identifies known ad container structures
- **Player Overlays**: Detects elements overlaid on the video player
- **Skip Button Presence**: Skip button is a strong indicator of an ad

## Blocking Workflow

1. **Detection**: Ad is detected with high confidence
2. **Info Button**: Find and click the Info button (usually bottom-left of ad)
3. **Menu**: Wait for the ad menu to appear
4. **Block Action**: Find and click the "Block Ad" option
5. **Confirmation**: Handle any confirmation dialog
6. **Fallback**: If any step fails, use Skip Ad button

## State Machine

The extension uses a state machine to manage the ad blocking process:

```
IDLE → AD_DETECTED → FINDING_INFO → CLICKING_INFO → WAITING_FOR_MENU 
→ FINDING_BLOCK_ACTION → CLICKING_BLOCK → WAITING_FOR_RESULT 
→ AD_DISAPPEARED → IDLE
```

With fallback path:
```
AD_DETECTED → FALLBACK_SKIP → AD_DISAPPEARED → IDLE
```

## Privacy & Security

- **No Data Collection**: The extension does not collect any user data
- **No Network Access**: No external network requests are made
- **Local Only**: All data is stored locally in Chrome's storage
- **No Tracking**: No tracking or analytics are implemented
- **No Remote Code**: All code runs locally, no remote scripts are loaded

## Permissions

The extension requires the following permissions:

- **storage**: To save settings and statistics locally
- **https://www.youtube.com/***: To inject content scripts on YouTube pages

## Compatibility

- **Chrome**: Latest versions (Manifest V3)
- **Platforms**: Windows, macOS, Linux
- **YouTube**: Desktop version

## Troubleshooting

### Extension Not Working

1. **Check if extension is enabled** in the popup
2. **Verify Chrome Developer mode** is enabled
3. **Check console logs** (Ctrl+Shift+J) for errors
4. **Enable Debug Mode** in the popup for detailed logging
5. **Refresh YouTube page** after enabling the extension

### Ads Not Being Blocked

1. **Check if YouTube has changed** its DOM structure
2. **Try refreshing the page**
3. **Check if ad has a Skip button** - the extension might be waiting for it
4. **Enable Debug Mode** to see what the extension is detecting

### High CPU Usage

1. **Disable the extension** when not watching YouTube
2. **Check if Debug Mode** is enabled (can cause extra logging)

## Development

### Testing

The extension includes a comprehensive testing approach:

1. **Manual Testing**: Use Chrome's developer tools to inspect YouTube
2. **Debug Mode**: Enable detailed logging in the console
3. **Unit Testing**: Test individual components (ad detection, button finding, etc.)

### Updating Selectors

If YouTube changes its DOM:

1. **Inspect the new structure** using Chrome DevTools
2. **Update selectors** in `src/shared/constants.js`
3. **Test the changes** with various ad types

### Building

No build process is required. The extension uses native ES modules.

## Contributing

This is a personal extension, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This extension is provided as-is for personal use. No license is specified.

## Disclaimer

This extension is designed for personal use and educational purposes. It automates user interactions with YouTube's interface. The extension does not:

- Bypass YouTube's ad system
- Modify network requests
- Collect user data
- Violate YouTube's Terms of Service

Use at your own discretion.

---

**Version**: 1.0.0  
**Author**: Personal Use  
**Last Updated**: October 2024
