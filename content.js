'use strict';

// Global variables
let isEnabled = true;
const SCRIPT_ID = 'dynamic-rtl-styles';

// Initialize the extension
function initExtension() {
    // Check if the page already has RTL language set
    if (document.documentElement.lang === "fa-IR" || document.documentElement.lang === "ar") {
        return;
    }

    // Check if the extension is enabled for this domain
    chrome.storage.sync.get(['disabledSites'], function(result) {
        const currentHost = window.location.hostname;
        const disabledSites = result.disabledSites || [];
        
        if (disabledSites.includes(currentHost)) {
            isEnabled = false;
            return;
        }
        
        // Add styles and start processing
        addStyles();
        loadFonts();
        setupInputObservers();
        setupObservers();
        processDocument();
    });
}

// Add CSS rules
function addStyles() {
    if (document.getElementById(SCRIPT_ID)) return;
    
    const style = document.createElement('style');
    style.id = SCRIPT_ID;
    style.textContent = `
        [data-rtl="true"] {
            direction: rtl !important;
            font-family: 'Vazirmatn', Arial, sans-serif !important;
            text-align: right !important;
        }
        
        input[data-rtl="true"], textarea[data-rtl="true"] {
            direction: rtl !important;
            font-family: 'Vazirmatn', Arial, sans-serif !important;
            text-align: right !important;
        }
        
        input[type="text"]:focus, textarea:focus {
            direction: auto !important;
        }
        
        /* Apply RTL to contenteditable elements */
        [contenteditable][data-rtl="true"] {
            direction: rtl !important;
            font-family: 'Vazirmatn', Arial, sans-serif !important;
            text-align: right !important;
        }
        
        /* Force RTL for input fields with Persian/Arabic text */
        .rtl-input-active {
            direction: rtl !important;
            font-family: 'Vazirmatn', Arial, sans-serif !important;
            text-align: right !important;
        }
    `;
    document.head.appendChild(style);
}

// Load the Vazirmatn font
function loadFonts() {
    // Preload the Vazirmatn font
    const fontLink = document.createElement('link');
    fontLink.href = "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css";
    fontLink.rel = "preload";
    fontLink.as = "style";
    fontLink.crossOrigin = "anonymous";
    document.head.appendChild(fontLink);

    // Load the actual font
    const actualFontLink = document.createElement('link');
    actualFontLink.href = fontLink.href;
    actualFontLink.rel = "stylesheet";
    actualFontLink.crossOrigin = "anonymous";
    document.head.appendChild(actualFontLink);
}

// Regular expression to detect Persian or Arabic text
function isPersianOrArabic(text) {
    if (!text) return false;
    // Enhanced regex to better detect Persian/Arabic text
    const persianArabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return persianArabicRegex.test(text);
}

// Check if text starts with Persian or Arabic characters
function startsWithPersianOrArabic(text) {
    if (!text) return false;
    
    // Trim leading whitespace and get the first word
    const trimmedText = text.trim();
    const firstWord = trimmedText.split(/\s+/)[0];
    
    // Check if the first word contains Persian or Arabic characters
    return isPersianOrArabic(firstWord);
}

// Setup observers specifically for input fields
function setupInputObservers() {
    // Find all input and textarea elements on the page
    function processInputs() {
        if (!isEnabled) return;
        
        // Process all input fields
        const inputElements = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea');
        inputElements.forEach(setupInputElement);
        
        // Process all contenteditable elements
        const editableElements = document.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
        editableElements.forEach(setupEditableElement);
    }
    
    // Process the document when it's ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processInputs);
    } else {
        processInputs();
    }
    
    // Also process inputs when the page is fully loaded
    window.addEventListener('load', processInputs);
    
    // Create a MutationObserver to detect new input elements
    const inputObserver = new MutationObserver(mutations => {
        if (!isEnabled) return;
        
        let shouldProcessInputs = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is an input or contains inputs
                        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || 
                            node.hasAttribute('contenteditable') ||
                            node.querySelector('input, textarea, [contenteditable]')) {
                            shouldProcessInputs = true;
                        }
                    }
                });
            }
        });
        
        if (shouldProcessInputs) {
            processInputs();
        }
    });
    
    // Start observing the document for added input elements
    inputObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// Setup event handlers for an input element
function setupInputElement(element) {
    if (!element || element.hasAttribute('data-rtl-listener')) return;
    
    // Mark this element as processed
    element.setAttribute('data-rtl-listener', 'true');
    
    // Check if the input already has Persian/Arabic text
    if (startsWithPersianOrArabic(element.value) || 
        (element.hasAttribute('placeholder') && startsWithPersianOrArabic(element.getAttribute('placeholder')))) {
        element.setAttribute('data-rtl', 'true');
        element.classList.add('rtl-input-active');
    }
    
    // Add input event listener for real-time RTL detection
    element.addEventListener('input', function() {
        if (startsWithPersianOrArabic(this.value)) {
            this.setAttribute('data-rtl', 'true');
            this.classList.add('rtl-input-active');
        } else if (this.value.trim() === '') {
            // Only remove RTL if there's no placeholder with Persian/Arabic
            if (!(this.hasAttribute('placeholder') && startsWithPersianOrArabic(this.getAttribute('placeholder')))) {
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
        if (startsWithPersianOrArabic(this.value)) {
            this.setAttribute('data-rtl', 'true');
            this.classList.add('rtl-input-active');
        }
    });
    
    element.addEventListener('blur', function() {
        if (startsWithPersianOrArabic(this.value)) {
            this.setAttribute('data-rtl', 'true');
            this.classList.add('rtl-input-active');
        }
    });
    
    // Handle paste events
    element.addEventListener('paste', function() {
        // Use setTimeout to check the value after paste is complete
        setTimeout(() => {
            if (startsWithPersianOrArabic(this.value)) {
                this.setAttribute('data-rtl', 'true');
                this.classList.add('rtl-input-active');
            } else {
                this.removeAttribute('data-rtl');
                this.classList.remove('rtl-input-active');
            }
        }, 0);
    });
}

// Setup event handlers for a contenteditable element
function setupEditableElement(element) {
    if (!element || element.hasAttribute('data-rtl-listener')) return;
    
    // Mark this element as processed
    element.setAttribute('data-rtl-listener', 'true');
    
    // Check if the element already has Persian/Arabic text
    if (startsWithPersianOrArabic(element.textContent)) {
        element.setAttribute('data-rtl', 'true');
    }
    
    // Add input event listeners for real-time RTL detection
    element.addEventListener('input', function() {
        if (startsWithPersianOrArabic(this.textContent)) {
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
            if (startsWithPersianOrArabic(this.textContent)) {
                this.setAttribute('data-rtl', 'true');
            } else {
                this.removeAttribute('data-rtl');
            }
        }, 0);
    });
}

// Function to check and apply RTL and font
function applyRTL(element) {
    if (!isEnabled || !element || !element.parentElement) return;

    if (element.nodeType === Node.TEXT_NODE) {
        const text = element.textContent.trim();
        if (text && startsWithPersianOrArabic(text)) {
            let currentElement = element.parentElement;
            
            // Special handling for input and textarea elements
            if (currentElement.tagName === 'INPUT' || currentElement.tagName === 'TEXTAREA') {
                setupInputElement(currentElement);
                return;
            }
            
            // Special handling for contenteditable elements
            if (currentElement.hasAttribute('contenteditable')) {
                setupEditableElement(currentElement);
                return;
            }
            
            // Apply RTL only to the specific element containing the text
            // that starts with Persian/Arabic, not to parent containers
            currentElement.setAttribute('data-rtl', 'true');
            
            // Don't traverse up the DOM tree anymore
            // This ensures only the specific text element gets RTL
        }
    } else if (element.nodeType === Node.ELEMENT_NODE) {
        // Check title attribute
        if (element.hasAttribute('title') && startsWithPersianOrArabic(element.getAttribute('title'))) {
            element.setAttribute('data-rtl', 'true');
        }
        
        // Check placeholder attribute for input elements
        if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
            setupInputElement(element);
        }
        
        // Check contenteditable elements
        if (element.hasAttribute('contenteditable')) {
            setupEditableElement(element);
        }

        // Process child nodes
        Array.from(element.childNodes).forEach(child => applyRTL(child));
    }
}

// Process the entire document
function processDocument() {
    if (!isEnabled) return;
    applyRTL(document.body);
}

// Setup MutationObserver to monitor changes in the DOM
function setupObservers() {
    const observer = new MutationObserver(mutations => {
        if (!isEnabled) return;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => applyRTL(node));
            } else if (mutation.type === 'characterData') {
                applyRTL(mutation.target);
            }
        });
    });

    // Start observing the body for changes
    const observerConfig = {
        childList: true,
        characterData: true,
        subtree: true,
        characterDataOldValue: true
    };

    // Wait for body to be available
    if (document.body) {
        observer.observe(document.body, observerConfig);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, observerConfig);
        });
    }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleSite') {
        isEnabled = message.enabled;
        
        if (isEnabled) {
            addStyles();
            processDocument();
        } else {
            // Remove RTL attributes
            const rtlElements = document.querySelectorAll('[data-rtl="true"], .rtl-input-active');
            rtlElements.forEach(el => {
                el.removeAttribute('data-rtl');
                el.classList.remove('rtl-input-active');
            });
            
            // Remove style element
            const styleEl = document.getElementById(SCRIPT_ID);
            if (styleEl) styleEl.remove();
        }
    }
    
    sendResponse({ success: true });
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