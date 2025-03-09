# Dynamic RTL

A Chrome extension that automatically detects Persian/Arabic text on web pages and applies RTL (Right-to-Left) direction and appropriate font styling.

## Features

- Automatically detects Persian and Arabic text on any webpage
- Applies RTL direction and Vazirmatn font to detected text
- Only applies RTL to paragraphs that start with Persian/Arabic words
- Works with dynamic content that loads after the page is initially rendered
- Enhanced real-time detection for input fields, text areas, and contenteditable elements
- Option to disable the extension for specific websites
- Compatible with Chrome's Manifest V3

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store
2. Search for "Dynamic RTL"
3. Click "Add to Chrome"

### Manual Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be installed and active

## Usage

- The extension works automatically on all websites by default
- To disable the extension for a specific website:
  1. Click on the extension icon in the toolbar
  2. Toggle the switch to disable it for the current site
  3. Refresh the page for changes to take effect

## Technical Details

- Uses MutationObserver to detect and process dynamically added content
- Enhanced text detection for input fields, text areas, and contenteditable elements
- Real-time RTL detection during typing in input fields
- Multiple event listeners (input, focus, blur, paste) for better text detection
- Smart detection that only applies RTL to text starting with Persian/Arabic words
- Implements Manifest V3 for Chrome extension compatibility
- Uses the Vazirmatn font for optimal Persian/Arabic text display

## Recent Improvements

- Added smart detection that only applies RTL to text starting with Persian/Arabic words
- Added real-time RTL detection for input fields and text areas
- Added support for contenteditable elements
- Improved handling of dynamically added input elements
- Enhanced CSS styling for better compatibility with various websites
- Added focus/blur/paste event handling for more reliable detection

## License

This project is open source and available under the MIT License.

## Credits

- Original script by Sorou-sh
- Vazirmatn font by Saber Rastikerdar

## Language

- [فارسی (Persian)](README.fa.md) 