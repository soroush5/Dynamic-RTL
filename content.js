'use strict';

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Global variables
let isEnabled = true;
const SCRIPT_ID = 'dynamic-rtl-styles';
// const RTL_PROCESSED_ATTR = 'data-rtl-processed'; // REMOVED
const RTL_LISTENER_ATTR = 'data-rtl-listener'; // Attribute for input listeners

// --- Debounced Processing Functions ---
// Debounce document processing to avoid excessive runs on dynamic pages
const debouncedProcessDocument = debounce(processDocument, 300);
// Debounce input processing
const debouncedProcessInputs = debounce(processInputs, 300);

// --- Font Settings --- (Global scope for easy access)
let currentFontFamily = 'Vazirmatn'; // Default
let currentFontSrc = `url('${chrome.runtime.getURL('fonts/Vazirmatn[wght].ttf')}') format('truetype-variations')`;

// Initialize the extension
function initExtension() {
    // Check if the page already has RTL language set
    if (document.documentElement.lang === "fa-IR" || document.documentElement.lang === "ar") {
        return;
    }

    // Get font settings first, then proceed with enabling logic
    loadFontSettings(() => {
        // Check if the extension is enabled for this domain
        chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], (syncResult) => {
            const currentHost = window.location.hostname;
            const defaultEnabled = syncResult.defaultEnabled !== undefined ? syncResult.defaultEnabled : true;
            const disabledSites = syncResult.disabledSites || [];
            const enabledSites = syncResult.enabledSites || [];
            
            if (defaultEnabled) {
                isEnabled = !disabledSites.includes(currentHost);
            } else {
                isEnabled = enabledSites.includes(currentHost);
            }
            
            if (isEnabled) {
                // Add styles (which now uses global font settings)
                addOrUpdateStyles();
                setupInputObservers();
                setupObservers();
                processDocument();
                processInputs();
            }
        });
    });
}

// Load font settings from storage
function loadFontSettings(callback) {
    chrome.storage.local.get(['useCustomFont', 'customFontData', 'customFontFamily'], (localResult) => {
        if (localResult.useCustomFont && localResult.customFontData && localResult.customFontFamily) {
            currentFontFamily = localResult.customFontFamily;
            // Use the Base64 data URL directly
            currentFontSrc = `url('${localResult.customFontData}') format('truetype')`; 
            // Note: format('truetype') might be better for Data URLs than variations
             console.log('Using custom font:', currentFontFamily);
        } else {
            // Reset to default if custom font is disabled or data is missing
            currentFontFamily = 'Vazirmatn';
            currentFontSrc = `url('${chrome.runtime.getURL('fonts/Vazirmatn[wght].ttf')}') format('truetype-variations')`;
             console.log('Using default font: Vazirmatn');
        }
        if (callback) callback();
    });
}

// Add or Update CSS rules (Font applied only with direction)
function addOrUpdateStyles() {
    let style = document.getElementById(SCRIPT_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = SCRIPT_ID;
        document.head.appendChild(style);
    }
    
    // Determine the correct format string based on the source
    const formatString = currentFontSrc.startsWith('url(\'data:') ? 'truetype' : 'truetype-variations';

    style.textContent = `
        /* Load the font */
        @font-face {
            font-family: '${currentFontFamily}'; 
            src: ${currentFontSrc};
            font-weight: 100 900; 
            font-display: block; /* Still use block to prevent FOUT */
            /* Explicitly state format */
            /* format('${formatString}'); */ /* Commented out: format in src is preferred */
        }

        /* Remove broad application of font */
        /* 
        body,
        p, span, div, li, a, h1, h2, h3, h4, h5, h6, 
        input, textarea, [contenteditable] {
            font-family: '${currentFontFamily}', Arial, sans-serif;
        } 
        */

        /* Apply direction, alignment, AND font family ONLY when RTL is detected */
        [data-rtl="true"],
        input[data-rtl="true"],
        textarea[data-rtl="true"],
        [contenteditable][data-rtl="true"] {
            direction: rtl !important;
            text-align: right !important;
            /* Apply the correct font family here */
            font-family: '${currentFontFamily}', Arial, sans-serif !important;
        }
        
        /* Rule for focused inputs (auto direction) */
        input[type="text"]:focus, textarea:focus {
            direction: auto !important;
            /* Font is handled by the general input rule or data-rtl */
        }
        
        /* Rule for active RTL inputs (ensures styles stick) */
        .rtl-input-active {
            direction: rtl !important;
            text-align: right !important;
            /* Apply the correct font family here */
            font-family: '${currentFontFamily}', Arial, sans-serif !important;
        }
    `;
}

// Regular expression to detect Persian or Arabic text
function isPersianOrArabic(text) {
    if (!text) return false;
    // Enhanced regex to better detect Persian/Arabic text
    const persianArabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return persianArabicRegex.test(text);
}

// Check if the first word of text is Persian or Arabic
function startsWithPersianOrArabic(text) {
    if (!text) return false;
    
    // Remove leading whitespace and get the first word
    const trimmedText = text.trim();
    const firstWord = trimmedText.split(/\s+/)[0];
    
    // Check if the first word contains Persian/Arabic characters
    return isPersianOrArabic(firstWord);
}

// Function to process a single text node (More Conservative: Apply to direct parent)
function processNode(node) {
    const parent = node.parentElement;
    // Basic checks
    if (!parent || parent.tagName === 'BODY' || parent.tagName === 'HTML') {
        // Avoid applying directly to body/html or if no parent
        return; 
    }
    // Also skip if parent is already RTL (avoids redundant checks/setting)
    if (parent.hasAttribute('data-rtl')) {
        return;
    }

    const text = node.textContent;

    // Check for Persian/Arabic starting text
    if (text && text.trim() !== '' && isPersianOrArabic(text) && startsWithPersianOrArabic(text)) {
        // Apply data-rtl directly to the immediate parent element
        // This is more conservative and less likely to affect large page sections.
        parent.setAttribute('data-rtl', 'true');
        // console.log('Applied data-rtl to:', parent.tagName, parent.id ? `#${parent.id}` : '', parent.className ? `.${parent.className}` : ''); // Debugging
    } 
    // If text is not RTL, we currently do nothing (don't remove attributes applied by other text nodes)
}

// New function to walk and process a specific subtree (Uses the conservative processNode)
function walkAndProcessSubtree(rootElement) {
    if (!rootElement || !isEnabled) return;
    // Ensure we don't process inside elements that should be ignored
    if (rootElement.closest('script, style, noscript, textarea, input, [contenteditable]')){
        return;
    }
    
    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                const parent = node.parentElement;
                // Basic filter: ignore scripts/styles/inputs/etc.
                if (parent?.closest('script, style, noscript, textarea, input, [contenteditable]')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip nodes whose direct parent already got RTL (optimization)
                if (parent?.hasAttribute('data-rtl')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (!node.textContent || node.textContent.trim() === '') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );
    let node;
    while (node = walker.nextNode()) {
        processNode(node); // Uses the conservative version now
    }
}

// Setup observers for general page content changes (Targeted Processing)
function setupObservers() {
    const mainObserver = new MutationObserver(mutations => {
        if (!isEnabled) return;
        // console.log('Mutations observed:', mutations.length); // Debugging

        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                // Process the text node that changed
                // console.log('Processing characterData mutation');
                 processNode(mutation.target);
            } else if (mutation.type === 'childList') {
                // Process added nodes
                if (mutation.addedNodes.length > 0) {
                    // console.log('Processing added nodes:', mutation.addedNodes.length);
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            processNode(node);
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check the element itself and its descendants
                            // Avoid processing if element is inside an already RTL element
                            if (!node.closest('[data-rtl="true"]')) {
                                 // Check text within the added element
                                if (node.matches(':not(script, style, noscript, textarea, input, [contenteditable])')) {
                                    walkAndProcessSubtree(node); 
                                }                                
                            }
                        }
                    });
                }
                // Handling removed nodes is complex and often not necessary
                // If an RTL element is removed, its effect is gone naturally.
            }
        }
    });

    mainObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true 
    });
}

// Setup observers specifically for input fields (Uses debouncedProcessInputs)
function setupInputObservers() {
    // Process initial inputs
    processInputs();

    const inputObserver = new MutationObserver(mutations => {
        if (!isEnabled) return;
        let shouldProcessInputs = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (
                            (node.tagName === 'INPUT' && (node.type === 'text' || node.type === 'search' || !node.hasAttribute('type'))) || 
                            node.tagName === 'TEXTAREA' || 
                            node.hasAttribute('contenteditable') ||
                            node.querySelector('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable]')
                           ) {
                            shouldProcessInputs = true;
                            break; // Break inner loop
                        }
                    }
                }
            }
             if (shouldProcessInputs) break; // Break outer loop
        }
        
        if (shouldProcessInputs) {
            debouncedProcessInputs(); // Call the debounced function
        }
    });

    inputObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// Process the entire document body using TreeWalker (Uses the conservative processNode)
function processDocument() {
    if (!isEnabled) return;
    // console.log('Processing document...');
    const walker = document.createTreeWalker(
        document.body, 
        NodeFilter.SHOW_TEXT, 
        {
            acceptNode: function(node) {
                const parent = node.parentElement;
                // Basic filter: ignore scripts/styles/inputs/etc.
                if (parent?.closest('script, style, noscript, textarea, input, [contenteditable]')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip nodes whose direct parent already got RTL (optimization)
                if (parent?.hasAttribute('data-rtl')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Reject if the text content is purely whitespace
                if (!node.textContent || node.textContent.trim() === '') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    let node;
    while (node = walker.nextNode()) {
        processNode(node); // Uses the conservative version now
    }
}

// Process input and textarea elements (Uses debouncedProcessInputs indirectly)
function processInputs() {
    if (!isEnabled) return;
    // console.log('Processing inputs...'); // For debugging

    // Process input fields
    const inputElements = document.querySelectorAll(`input[type="text"]:not([${RTL_LISTENER_ATTR}]), input[type="search"]:not([${RTL_LISTENER_ATTR}]), input:not([type]):not([${RTL_LISTENER_ATTR}]), textarea:not([${RTL_LISTENER_ATTR}])`);
    inputElements.forEach(setupInputElement);

    // Process contenteditable elements
    const editableElements = document.querySelectorAll(`[contenteditable="true"]:not([${RTL_LISTENER_ATTR}]), [contenteditable=""]:not([${RTL_LISTENER_ATTR}])`);
    editableElements.forEach(setupEditableElement);
}

// Setup event handlers for an input element (uses RTL_LISTENER_ATTR)
function setupInputElement(element) {
    if (!element || element.hasAttribute(RTL_LISTENER_ATTR)) return;
    element.setAttribute(RTL_LISTENER_ATTR, 'true');
    
    // Check if the input already has Persian/Arabic text that starts with Persian/Arabic
    if ((isPersianOrArabic(element.value) && startsWithPersianOrArabic(element.value)) || 
        (element.hasAttribute('placeholder') && isPersianOrArabic(element.getAttribute('placeholder')) && 
         startsWithPersianOrArabic(element.getAttribute('placeholder')))) {
        element.setAttribute('data-rtl', 'true');
        element.classList.add('rtl-input-active');
    }
    
    // Add input event listener for real-time RTL detection
    element.addEventListener('input', function() {
        if (isPersianOrArabic(this.value) && startsWithPersianOrArabic(this.value)) {
            this.setAttribute('data-rtl', 'true');
            this.classList.add('rtl-input-active');
        } else if (this.value.trim() === '') {
            // Only remove RTL if there's no placeholder with Persian/Arabic
            if (!(this.hasAttribute('placeholder') && 
                  isPersianOrArabic(this.getAttribute('placeholder')) && 
                  startsWithPersianOrArabic(this.getAttribute('placeholder')))) {
                this.removeAttribute('data-rtl');
                this.classList.remove('rtl-input-active');
            }
        } else {
            // If text doesn't start with Persian/Arabic, remove RTL
            this.removeAttribute('data-rtl');
            this.classList.remove('rtl-input-active');
        }
    });
    
    // Also check on focus and blur
    element.addEventListener('focus', function() {
        if (isPersianOrArabic(this.value) && startsWithPersianOrArabic(this.value)) {
            this.setAttribute('data-rtl', 'true');
            this.classList.add('rtl-input-active');
        }
    });
    
    element.addEventListener('blur', function() {
        if (isPersianOrArabic(this.value) && startsWithPersianOrArabic(this.value)) {
            this.setAttribute('data-rtl', 'true');
            this.classList.add('rtl-input-active');
        } else {
            this.removeAttribute('data-rtl');
            this.classList.remove('rtl-input-active');
        }
    });
    
    // Handle paste events
    element.addEventListener('paste', function() {
        // Use setTimeout to check the value after paste is complete
        setTimeout(() => {
            if (isPersianOrArabic(this.value) && startsWithPersianOrArabic(this.value)) {
                this.setAttribute('data-rtl', 'true');
                this.classList.add('rtl-input-active');
            } else {
                this.removeAttribute('data-rtl');
                this.classList.remove('rtl-input-active');
            }
        }, 0);
    });
}

// Setup event handlers for a contenteditable element (uses RTL_LISTENER_ATTR)
function setupEditableElement(element) {
    if (!element || element.hasAttribute(RTL_LISTENER_ATTR)) return;
    element.setAttribute(RTL_LISTENER_ATTR, 'true');
    
    // Check if the element already has Persian/Arabic text that starts with Persian/Arabic
    if (isPersianOrArabic(element.textContent) && startsWithPersianOrArabic(element.textContent)) {
        element.setAttribute('data-rtl', 'true');
    }
    
    // Add input event listeners for real-time RTL detection
    element.addEventListener('input', function() {
        if (isPersianOrArabic(this.textContent) && startsWithPersianOrArabic(this.textContent)) {
            this.setAttribute('data-rtl', 'true');
        } else if (this.textContent.trim() === '') {
            this.removeAttribute('data-rtl');
        } else {
            // If text doesn't start with Persian/Arabic, remove RTL
            this.removeAttribute('data-rtl');
        }
    });
    
    // Handle paste events
    element.addEventListener('paste', function() {
        // Use setTimeout to check the content after paste is complete
        setTimeout(() => {
            if (isPersianOrArabic(this.textContent) && startsWithPersianOrArabic(this.textContent)) {
                this.setAttribute('data-rtl', 'true');
            } else {
                this.removeAttribute('data-rtl');
            }
        }, 0);
    });
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let asyncResponse = false;
    if (request.command === 'toggleStatus') {
        const wasEnabled = isEnabled;
        isEnabled = request.status;
        console.log('Received toggleStatus:', isEnabled);
        if (isEnabled && !wasEnabled) {
            // If enabling, reload font settings and apply styles/processing
            asyncResponse = true; // Need to wait for font settings
            loadFontSettings(() => {
                addOrUpdateStyles();
                processDocument();
                processInputs();
                setupObservers(); 
                setupInputObservers();
                sendResponse({ success: true });
            });
        } else if (!isEnabled && wasEnabled) {
            // If disabling, simply stop processing (observers check isEnabled flag)
            // Optionally remove styles or attributes here if needed
            // const styleElement = document.getElementById(SCRIPT_ID);
            // if (styleElement) styleElement.remove();
            sendResponse({ success: true });
        } else {
            // No change in state needed
            sendResponse({ success: true });
        }
    } else if (request.command === 'updateFont') {
        console.log('Received updateFont command');
        asyncResponse = true; // Need to wait for font settings
        loadFontSettings(() => {
            if (isEnabled) { // Only update styles if the extension is active for this tab
                addOrUpdateStyles(); 
            }
            sendResponse({ success: true });
        });
    }

    return asyncResponse; // Return true if we used an async callback for sendResponse
});

// Initialize when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}

// Handle dynamic content loading
window.addEventListener('load', processDocument);
document.addEventListener('readystatechange', processDocument); 