'use strict';

// Initialize extension settings when installed
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], function(result) {
    // Initialize disabledSites if not exists
    if (!result.disabledSites) {
      chrome.storage.sync.set({ disabledSites: [] });
    }
    
    // Initialize enabledSites if not exists
    if (!result.enabledSites) {
      chrome.storage.sync.set({ enabledSites: [] });
    }
    
    // Initialize defaultEnabled if not exists (true = enabled by default)
    if (result.defaultEnabled === undefined) {
      chrome.storage.sync.set({ defaultEnabled: true });
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCurrentTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        
        chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], function(result) {
          const defaultEnabled = result.defaultEnabled !== undefined ? result.defaultEnabled : true;
          const disabledSites = result.disabledSites || [];
          const enabledSites = result.enabledSites || [];
          
          let isEnabled;
          
          if (defaultEnabled) {
            // Default enabled mode: site is enabled unless in disabledSites
            isEnabled = !disabledSites.includes(hostname);
          } else {
            // Default disabled mode: site is disabled unless in enabledSites
            isEnabled = enabledSites.includes(hostname);
          }
          
          sendResponse({
            hostname: hostname,
            isEnabled: isEnabled,
            defaultEnabled: defaultEnabled
          });
        });
      }
    });
    return true; // Keep the message channel open for the async response
  }
  
  if (message.action === 'toggleSite') {
    const hostname = message.hostname;
    const enabled = message.enabled;
    
    chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], function(result) {
      const defaultEnabled = result.defaultEnabled !== undefined ? result.defaultEnabled : true;
      let disabledSites = result.disabledSites || [];
      let enabledSites = result.enabledSites || [];
      
      if (defaultEnabled) {
        // Default enabled mode
        if (enabled) {
          // Remove from disabled sites
          disabledSites = disabledSites.filter(site => site !== hostname);
        } else {
          // Add to disabled sites if not already there
          if (!disabledSites.includes(hostname)) {
            disabledSites.push(hostname);
          }
        }
        
        chrome.storage.sync.set({ disabledSites: disabledSites }, function() {
          updateContentScript(enabled, tabs => {
            sendResponse({ success: true });
          });
        });
      } else {
        // Default disabled mode
        if (enabled) {
          // Add to enabled sites if not already there
          if (!enabledSites.includes(hostname)) {
            enabledSites.push(hostname);
          }
        } else {
          // Remove from enabled sites
          enabledSites = enabledSites.filter(site => site !== hostname);
        }
        
        chrome.storage.sync.set({ enabledSites: enabledSites }, function() {
          updateContentScript(enabled, tabs => {
            sendResponse({ success: true });
          });
        });
      }
    });
    return true; // Keep the message channel open for the async response
  }
  
  if (message.action === 'toggleDefaultMode') {
    const defaultEnabled = message.defaultEnabled;
    
    chrome.storage.sync.set({ defaultEnabled: defaultEnabled }, function() {
      sendResponse({ success: true });
    });
    return true; // Keep the message channel open for the async response
  }
});

// Helper function to update content script
function updateContentScript(enabled, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleSite',
        enabled: enabled
      }, () => {
        if (callback) callback(tabs);
      });
    }
  });
}

// --- Context Menu Setup ---

// Create context menu item on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translatePage",
    title: "ترجمه فارسی این صفحه (Dynamic RTL)",
    contexts: ["page"] // Show context menu on page itself
  });
  
  // Set default settings on first install if not already set
  chrome.storage.sync.get(['defaultEnabled', 'translationTone'], (result) => {
     if (result.defaultEnabled === undefined) {
         chrome.storage.sync.set({ defaultEnabled: true });
     }
     if (result.translationTone === undefined) {
         chrome.storage.sync.set({ translationTone: 'رسمی' });
     }
  });
  chrome.storage.local.get(['useCustomFont'], (result) => {
      if (result.useCustomFont === undefined) {
          chrome.storage.local.set({ useCustomFont: false });
      }
  });

});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translatePage" && tab?.id && tab.url?.startsWith('http')) { 
    chrome.storage.local.get(['geminiApiKey'], (localResult) => {
      if (!localResult.geminiApiKey) {
        // Notify user to set API key - maybe open popup?
        console.warn("Gemini API Key not set.");
        // You could potentially open the popup here or send a different message
        // For simplicity, we'll rely on the user setting it via popup first.
        chrome.tabs.sendMessage(tab.id, { command: 'showApiKeyNeededError' }).catch(e => console.log("Could not send API key error to tab", tab.id, e));
        return;
      }
      // Also get tone AND model for context menu
      chrome.storage.sync.get(['translationTone', 'translationModel'], (syncResult) => {
        const apiKey = localResult.geminiApiKey;
        const tone = syncResult.translationTone || 'رسمی';
        const model = syncResult.translationModel || 'gemini-2.5-flash-preview-04-17'; // Get model

        chrome.tabs.sendMessage(tab.id, {
          command: 'translatePage',
          apiKey: apiKey,
          tone: tone,
          model: model // Send model from context menu too
        }).catch(error => {
          console.error(`Error sending translatePage command from context menu to tab ${tab.id}:`, error);
        });
      });
    });
  } else if (tab && !tab.url?.startsWith('http')) {
      console.log("Context menu clicked on non-http page, translation not applicable.");
  }
});


// --- Message Handling & API Call ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'callGeminiTranslate') {
    console.log("Background script received texts to translate:", request.texts?.length || 0, "Model:", request.model);

    // Validate essential data, including model
    if (!request.apiKey || !request.texts || request.texts.length === 0 || !request.model) {
      console.error("Missing API Key, texts, or model for translation.");
      sendResponse({ success: false, error: "Missing API Key, texts, or model." });
      return false; 
    }

    translateTextWithGemini(request.apiKey, request.model, request.tone, request.texts) // Pass model
      .then(translations => {
        console.log("Background script sending translations back:", translations.length);
        sendResponse({ success: true, translations: translations });
      })
      .catch(error => {
        console.error("Error during Gemini API call:", error);
        // Check if it's a rate limit error to send specific code
        if (error.message.includes("429") || error.message.toLowerCase().includes("rate limit")) {
             sendResponse({ success: false, error: error.message, errorCode: 'RATE_LIMIT' });
        } else if (error.message.toLowerCase().includes("api key not valid")) {
             sendResponse({ success: false, error: "کلید API نامعتبر است.", errorCode: 'INVALID_KEY' });
        }
         else {
             sendResponse({ success: false, error: error.message || "Unknown error calling Gemini API." });
        }
      });

    return true; // Indicate asynchronous response
  }
  // --- <<< NEW: API Key Test Handler >>> ---
  else if (request.command === 'testApiKey') {
      const apiKey = request.apiKey;
      if (!apiKey) {
          sendResponse({ success: false, error: "No API Key provided." });
          return false; // No key, synchronous response
      }
      
      // Use a simple, free API call to test the key, like listing models
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      
      fetch(testUrl)
          .then(response => {
              if (response.ok) { // Status 200-299
                  // Key is likely valid if we can list models
                  sendResponse({ success: true });
              } else {
                  // Key is invalid or other issue
                  console.warn(`API Key test failed with status: ${response.status}`);
                  // Try to parse error message from Gemini if possible
                  response.json().then(errorData => {
                       const message = errorData?.error?.message || `خطای ${response.status}`;
                       sendResponse({ success: false, error: message });
                  }).catch(() => {
                       // If parsing JSON fails, send status text
                       sendResponse({ success: false, error: response.statusText || `خطای ${response.status}` });
                  });
              }
          })
          .catch(error => {
              // Network error or other fetch issue
              console.error("Error during API Key test fetch:", error);
              sendResponse({ success: false, error: "خطا در ارتباط با سرور گوگل." });
          });
          
      return true; // Indicate asynchronous response
  }
  // --- <<< END NEW SECTION >>> ---
  // Handle other potential messages, e.g., from content script to check status
    else if (request.action === 'getCurrentTabInfo') { // Handling message used by older popup.js version? Keep for safety or remove if popup.js is fully updated
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id && tabs[0].url) {
                 try {
                    const url = new URL(tabs[0].url);
                    const hostname = url.hostname;
                    chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], (result) => {
                        const defaultEnabled = result.defaultEnabled !== undefined ? result.defaultEnabled : true;
                        const disabledSites = result.disabledSites || [];
                        const enabledSites = result.enabledSites || [];
                        let isEnabled = defaultEnabled ? !disabledSites.includes(hostname) : enabledSites.includes(hostname);
                        sendResponse({ hostname: hostname, isEnabled: isEnabled, defaultEnabled: defaultEnabled });
                    });
                } catch (e) {
                    sendResponse(null); // Invalid URL
                }
            } else {
                sendResponse(null); // No valid tab
            }
        });
        return true; // Async response
    }
    // Default case for unhandled messages
    return false;
});

// --- Gemini API Call Function ---
async function translateTextWithGemini(apiKey, modelId, tone, texts) { // Added modelId parameter
  // Construct API URL using the selected model ID
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  
  // --- Prompt Construction ---
  // Create a numbered list of texts to translate.
  // Including original text in the prompt helps the model maintain context,
  // but for very long pages, consider sending only texts.
  // Using a clear separator helps in parsing the response.
  const separator = "|||---|||"; // Unique separator
  // Simplified instruction focusing on core task
  let promptContent = `Translate the following English texts to Persian using a "${tone}" tone. Provide ONLY the Persian translation for each text, separated by "${separator}".

Input Texts:
`;

  texts.forEach((textObj, index) => {
      // Adding index helps verify response order, though model should follow sequence
      // Clean up excessive newlines in input text for better processing
      const cleanedText = textObj.text.replace(/\n\s*\n/g, '\n').trim();
      promptContent += `${index + 1}. ${cleanedText}\n`; // Use \n as newline marker
  });

  // Remove trailing newline from the list
  promptContent = promptContent.trim(); 
  promptContent += `

Persian Translations (separated by "${separator}"):
`;


  console.log(`Calling Gemini API: ${API_URL}`);
  console.log("Generated Prompt (first 500 chars):", promptContent.substring(0, 500));
  // console.log("Full Prompt:", promptContent); // DEBUG: Log full prompt if needed

  // --- API Request ---
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptContent }]
        }],
        // Optional: Add safety settings or generation config if needed
         generationConfig: {
           // temperature: 0.7, // Adjust creativity vs. predictability
           // topP: 0.95,
           // topK: 40,
           maxOutputTokens: 8192, // Set a reasonable limit for output tokens based on flash model
         },
         safetySettings: [
             // Example: Block harmful content with higher thresholds
             { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
             { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
             { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
             { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
         ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Could not parse error response body." })); 
      console.error("Gemini API Error Response:", response.status, errorBody);
      let errorMessage = `Gemini API request failed with status ${response.status}`;
      if (errorBody?.error?.message) {
          errorMessage += `: ${errorBody.error.message}`;
      } else if (typeof errorBody === 'string') {
           errorMessage += `: ${errorBody}`;
      } else {
          errorMessage += `: ${response.statusText}`;
      }
       // Check for common API key error
      if (response.status === 400 && errorBody?.error?.message?.toLowerCase().includes("api key not valid")) {
          errorMessage = "کلید API Gemini نامعتبر است. لطفاً آن را در تنظیمات بررسی کنید.";
      } else if (response.status === 429) {
          errorMessage = "محدودیت تعداد درخواست API (Rate Limit). لطفاً کمی صبر کنید و دوباره تلاش کنید."; // Keep specific message
          // Throw error that includes 429 info if possible
          throw new Error(`429: ${errorMessage}`); 
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    // console.log("Full Gemini Response:", JSON.stringify(data, null, 2)); // DEBUG: Log full response if needed


    // --- Response Processing ---
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts || data.candidates[0].content.parts.length === 0) {
       // Handle cases where the model might have blocked the request or returned empty
       let blockReason = "Unknown reason";
       if (data.candidates && data.candidates[0]?.finishReason === 'SAFETY') {
           blockReason = "Content blocked by safety settings";
       } else if (data.promptFeedback?.blockReason) {
           blockReason = `Prompt blocked due to: ${data.promptFeedback.blockReason}`;
           console.error("Gemini prompt blocked:", data.promptFeedback.blockReason, data.promptFeedback.safetyRatings);
       } else {
            console.error("Invalid or empty response structure from Gemini:", data);
       }
       throw new Error(`ترجمه توسط Gemini انجام نشد: ${blockReason}`);
    }

    const combinedTranslations = data.candidates[0].content.parts[0].text;
    // console.log("Received raw combined translations:", combinedTranslations.substring(0, 500));

    const translationParts = combinedTranslations.split(separator).map(t => t.trim().replace(/^\d+\.\s*/, '')); // Remove leading numbers/dots if model added them

    // --- Mapping results ---
    // Ensure the number of translations matches the number of inputs - crucial!
    if (translationParts.length !== texts.length) {
       console.warn(`Mismatch in translation count: Expected ${texts.length}, Got ${translationParts.length}. Mapping might be incorrect.`);
       // Attempt a best-effort mapping, padding with empty strings for missing ones
       const adjustedTranslations = new Array(texts.length).fill("");
       for(let i = 0; i < Math.min(translationParts.length, texts.length); i++) {
           adjustedTranslations[i] = translationParts[i];
       }
        const results = texts.map((textObj, index) => ({
          id: textObj.id,
          translation: adjustedTranslations[index]
        }));
         console.warn("Returning potentially incomplete/misaligned results due to count mismatch.");
        return results;

    } else {
         // Map translations back using the original IDs if counts match
        const results = texts.map((textObj, index) => ({
          id: textObj.id,
          translation: translationParts[index] || "" // Use empty string if translation is missing
        }));
         return results;
    }


  } catch (error) {
    console.error(`Fetch or processing error in translateTextWithGemini for model ${modelId}:`, error);
    throw error; 
  }
}

console.log("background.js loaded and listener attached."); 