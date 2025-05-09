'use strict';

const TRANSLATION_CONTAINER_CLASS = 'gemini-translation-container';
const TRANSLATION_TEXT_CLASS = 'gemini-translation-text';
const MIN_WORDS_TO_TRANSLATE = 6; // Translate if 6 or more words
const PROCESSED_ATTR = 'data-gemini-translated';

let isTranslating = false; // Flag to prevent concurrent translations

// --- Listener for translation command ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'translatePage') {
    if (isTranslating) {
      console.warn("Translation already in progress.");
      // Optionally alert the user
      // alert("Translation is already running.");
      sendResponse({ success: false, message: "Translation already running." });
      return false;
    }
    
    // --- Extract data correctly --- 
    // Data might be nested under 'data' if sent via notifyContentScript from popup.js
    // Or at the top level if sent directly from background.js (context menu)
    const apiKey = request.apiKey || request.data?.apiKey;
    const tone = request.tone || request.data?.tone;
    const model = request.model || request.data?.model;
    
    // Check if data is actually present
    if (!apiKey || !tone || !model) {
        console.error("Translate command received, but missing apiKey, tone, or model.", request);
        alert("خطای داخلی: اطلاعات لازم برای ترجمه (کلید، لحن، مدل) یافت نشد.");
        sendResponse({ success: false, error: "Missing essential data in translatePage request." });
        return false; 
    }
    
    console.log(`translate.js received translatePage command. Tone: ${tone}, Model: ${model}`);
    isTranslating = true;
    // Show some visual feedback that translation has started
    showTranslationIndicator(true);

    // Clear previous translations before starting new ones
    clearPreviousTranslations();
    
    let translationError = null; // Define error variable outside catch
    
    extractAndTranslate(apiKey, tone, model)
      .then(() => {
        console.log("Translation process completed successfully.");
        sendResponse({ success: true });
      })
      .catch(error => { // Catch the error here
        translationError = error; // Assign caught error to the outer variable
        console.error("Translation process failed:", error);
        // Check for specific error codes passed from background
        if (error.message.includes("RATE_LIMIT")) { // Check if background sent RATE_LIMIT code
             alert("تعداد درخواست‌های شما از حد مجاز Gemini فراتر رفته است. لطفاً بعداً دوباره تلاش کنید.");
             updateTranslationIndicator("محدودیت تعداد درخواست API");
        } else {
            alert(`خطا در فرآیند ترجمه: ${error.message}`); 
            updateTranslationIndicator(`خطا: ${error.message}`);
        }
        sendResponse({ success: false, error: error.message });
      })
      .finally(() => {
        isTranslating = false;
        // Hide visual feedback, checking the captured error
        if (!translationError?.message.includes("RATE_LIMIT")) { // Use translationError here
            showTranslationIndicator(false);
        } 
      });
    return true; // Indicate asynchronous response
  } else if (request.command === 'showApiKeyNeededError') {
      alert('لطفاً ابتدا کلید API Gemini خود را در تنظیمات افزونه وارد کنید.');
      // Optionally try to open the popup
      // chrome.runtime.sendMessage({ command: 'openPopup' }); // Needs handling in background
      return false;
  }
});

// --- Text Extraction and Processing ---
async function extractAndTranslate(apiKey, tone, model) {
  console.log("Starting text extraction...");
  const elementsToTranslate = [];
  let uniqueIdCounter = 0;

  // Select potential text-bearing elements, excluding those already processed or interactive elements
  const selectors = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, caption, dd, dt, figcaption, summary, td:not(:has(p, div, ul, ol, blockquote))'; // Selectors for common text blocks, exclude table cells that contain other blocks
  // Consider adding span if needed, but be careful as it can select too much
  const potentialElements = document.querySelectorAll(selectors);

  console.log(`Found ${potentialElements.length} potential elements.`);

  potentialElements.forEach(element => {
    // Basic filtering
    // Skip if inside problematic elements, already processed, or invisible
    if (element.closest(`.${TRANSLATION_CONTAINER_CLASS}, script, style, noscript, textarea, input, [contenteditable], code, pre, a`) || 
        element.hasAttribute(PROCESSED_ATTR) ||
        !isVisible(element)) { // Check if element is visible
      return; 
    }

    // Get direct text content, cleaning whitespace and ignoring empty strings
    let directText = '';
    for (const node of element.childNodes) {
        // Collect only direct text nodes of the element
        if (node.nodeType === Node.TEXT_NODE) {
             directText += node.textContent;
        }
    }
    directText = directText.replace(/\s+/g, ' ').trim();

    // Check word count and if it looks like it might need translation (heuristic: contains letters)
    const wordCount = directText.split(/\s+/).filter(Boolean).length;
    // Additional check: Avoid translating text that is mostly numbers or symbols
    const hasEnoughLetters = (directText.match(/[a-zA-Z]/g) || []).length > directText.length / 4;
    
    if (wordCount >= MIN_WORDS_TO_TRANSLATE && hasEnoughLetters) { 

      // Ensure element has a unique ID for mapping back results
      let elementId = element.id;
      if (!elementId) {
        elementId = `gemini-translate-id-${uniqueIdCounter++}`;
        element.id = elementId;
      }

      elementsToTranslate.push({
        id: elementId,
        text: directText,
        originalElement: element // Keep reference for insertion
      });

      // Mark as potentially processed to avoid adding duplicates in this run
      // element.setAttribute(PROCESSED_ATTR, 'pending'); // Can skip this if race condition unlikely
    }
  });

  // Remove the temporary 'pending' marker if used
  // document.querySelectorAll(`[${PROCESSED_ATTR}="pending"]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));

  console.log(`Found ${elementsToTranslate.length} text segments to translate.`);

  if (elementsToTranslate.length === 0) {
    // Use the indicator to show the message
    updateTranslationIndicator("متنی برای ترجمه در این صفحه پیدا نشد.");
    setTimeout(() => showTranslationIndicator(false), 3000); // Hide after 3s
    // We throw an error here to stop the process cleanly in the caller
    throw new Error("No text found to translate."); 
  }

  // --- Send to Background for Translation --- 
  // Stage 1: Sending Request
  updateTranslationIndicator(`در حال ترجمه صفحه: ارسال درخواست به Gemini...`); 
  try {
    console.log("Sending texts to background script...");
    const response = await chrome.runtime.sendMessage({
      command: 'callGeminiTranslate',
      texts: elementsToTranslate.map(el => ({ id: el.id, text: el.text })), // Send only id and text
      apiKey: apiKey,
      tone: tone,
      model: model // Pass model to background
    });
    
    // Stage 2: Received Response
    updateTranslationIndicator(`در حال ترجمه صفحه: دریافت پاسخ...`);
    console.log("Received response from background:", response);

    if (response?.success && response.translations) {
      // Pass the total count to displayTranslations for progress update
      const totalSent = elementsToTranslate.length;
      displayTranslations(elementsToTranslate, response.translations, totalSent);
      // Stage 5: Completion message
      updateTranslationIndicator(`ترجمه صفحه انجام شد (${response.translations.filter(t=>t.translation).length} بخش).`);
      setTimeout(() => showTranslationIndicator(false), 2500); // Hide after success message
    } else {
      // Throw error with message/code from background response
      const errorMessage = response?.error || "ترجمه از اسکریپت پس‌زمینه دریافت نشد.";
      const errorCode = response?.errorCode; // Pass error code if present
      const error = new Error(errorMessage);
      if (errorCode) error.code = errorCode; // Attach code to error object
      throw error;
    }
  } catch (error) { // Catch errors from sendMessage or translation process
    console.error("Error during message passing or translation:", error);
    // Show error in indicator
    updateTranslationIndicator(`خطا: ${error.message}`);
    // Don't auto-hide indicator on error
    // Re-throw to be caught by the initial caller if needed, but alert is already shown there.
    throw error;
  }
}

// --- Displaying Translations ---
function displayTranslations(originalElementsMap, translations, totalSent) {
  console.log(`Displaying ${translations.length} translations.`);
  const elementsById = new Map(originalElementsMap.map(el => [el.id, el.originalElement]));
  let displayedCount = 0;
  
  // --- Batch DOM operations: Step 1: Prepare elements to insert ---
  const insertions = []; // Array to hold [originalElement, translationContainer] pairs

  translations.forEach((result, index) => {
    const originalElement = elementsById.get(result.id);
    // Ensure we have an element, a translation, and it hasn't been processed somehow else
    if (originalElement && result.translation && !originalElement.hasAttribute(PROCESSED_ATTR)) {
      
      // Double-check if a translation container already exists (belt-and-suspenders)
      if (originalElement.nextElementSibling?.classList.contains(TRANSLATION_CONTAINER_CLASS)) {
          console.log(`Skipping already displayed translation for: ${result.id}`);
          return;
      }

      // Create the container and text elements
      const translationContainer = document.createElement('div');
      translationContainer.className = TRANSLATION_CONTAINER_CLASS;
      translationContainer.setAttribute('lang', 'fa');
      translationContainer.style.cssText = `
          border-top: 1px dashed #dee2e6;
          margin-top: 0.5em;
          padding-top: 0.4em;
          margin-bottom: 0.5em;
          font-size: 0.9em;
          color: #555;
          direction: rtl;
          text-align: right;
          font-family: var(--dynamic-rtl-font-family, 'Vazirmatn', Arial, sans-serif);
          line-height: 1.6;
      `;

      const translationText = document.createElement('span');
      translationText.className = TRANSLATION_TEXT_CLASS;
      translationText.textContent = result.translation;
      translationContainer.appendChild(translationText);

      // Add to the list for batch insertion later
      insertions.push({ original: originalElement, container: translationContainer });

      // Mark the original element as translated *now* to prevent issues if processed again quickly
      originalElement.setAttribute(PROCESSED_ATTR, 'true');
      displayedCount++;
      
      // --- Update Progress Indicator ---
      // Stage 3: Processing each translation
      updateTranslationIndicator(`در حال ترجمه صفحه: پردازش ترجمه (${index + 1}/${totalSent})...`); 

    } else if (!originalElement) {
        console.warn(`Original element not found for ID: ${result.id}`);
    } else if (!result.translation) {
        console.warn(`Empty translation received for ID: ${result.id}`);
         if (originalElement) originalElement.setAttribute(PROCESSED_ATTR, 'true');
    }
  });
  
  // --- Batch DOM operations: Step 2: Insert all prepared elements ---
  console.log(`Batch inserting ${insertions.length} translation containers...`);
  // Stage 4: Inserting into page
  updateTranslationIndicator(`در حال ترجمه صفحه: درج ترجمه‌ها (${insertions.length})...`); 
  
  // Use requestAnimationFrame to potentially make insertion smoother?
  requestAnimationFrame(() => {
      insertions.forEach(item => {
          // Check if parent still exists before inserting
          if (item.original.parentNode) {
              item.original.parentNode.insertBefore(item.container, item.original.nextSibling);
          } else {
              console.warn("Original element's parent node disappeared before insertion:", item.original);
          }
      });
      console.log(`Finished batch inserting ${insertions.length} containers.`);
      // Final update message handled in the calling function `extractAndTranslate`
  });
  
  console.log(`Prepared ${displayedCount} new translations for insertion.`); // Log count prepared
}

// --- Utility Functions ---
function clearPreviousTranslations() {
    console.log("Clearing previous translations...");
    const containers = document.querySelectorAll(`.${TRANSLATION_CONTAINER_CLASS}`);
    containers.forEach(container => container.remove());
    const processedElements = document.querySelectorAll(`[${PROCESSED_ATTR}]`);
    processedElements.forEach(el => {
        el.removeAttribute(PROCESSED_ATTR);
        // Remove generated IDs?
        if (el.id.startsWith('gemini-translate-id-')) {
           // el.removeAttribute('id'); // Removing ID might break things if site relies on it later
        }
    });
}

// Check if an element is visible (basic check)
function isVisible(elem) {
  if (!(elem instanceof Element)) return false;
  return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
}

// --- Visual Indicator --- 
let indicatorDiv = null;
function showTranslationIndicator(show, message = "در حال ترجمه...") {
    if (show) {
        if (!indicatorDiv) {
            indicatorDiv = document.createElement('div');
            indicatorDiv.id = 'gemini-translation-indicator';
            // Apply styles for visibility, positioning, etc.
            Object.assign(indicatorDiv.style, {
                position: 'fixed',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 15px',
                borderRadius: '5px',
                zIndex: '999999',
                fontSize: '13px',
                fontFamily: 'Vazirmatn, sans-serif', // Ensure Vazirmatn for indicator
                direction: 'rtl', // Right-to-left text
                textAlign: 'right',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            });
            document.body.appendChild(indicatorDiv);
        }
        indicatorDiv.textContent = message;
        indicatorDiv.style.display = 'block';
    } else {
        if (indicatorDiv) {
            indicatorDiv.style.display = 'none';
        }
    }
}

function updateTranslationIndicator(message) {
    if (indicatorDiv) {
        indicatorDiv.textContent = message;
        // Ensure it's visible if we update it
        if (indicatorDiv.style.display === 'none') {
            indicatorDiv.style.display = 'block';
        }
    }
}

console.log("Dynamic RTL Translator content script (translate.js) loaded."); 