'use strict';

// Function to get the font family name from a TTF file name
function getFontFamilyName(fileName) {
  // Remove TTF extension and potential variable axes in brackets
  let name = fileName.replace(/\.(ttf|otf)$/i, '').replace(/\[.*?\]/g, '');
  // Replace common separators and non-alphanumeric (keep spaces) with space, trim
  name = name.replace(/[_-]+/g, ' ').replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, ' ').trim();
  // Capitalize first letter of each word (optional, for better display)
  name = name.split(' ').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  // Common case: append 'VF' or 'Variable' if it was likely stripped but might be needed
  // This is heuristic and might not always be correct
  // if (fileName.toLowerCase().includes('variable') || fileName.includes('[')) {
  //   if (!name.toLowerCase().includes('variable') && !name.toLowerCase().includes(' vf')) {
  //     name += ' Variable'; // Or VF?
  //   }
  // }
  return name || 'Custom Font'; // Fallback name
}

document.addEventListener('DOMContentLoaded', () => {
  const siteToggle = document.getElementById('site-toggle');
  const defaultEnabledRadio = document.getElementById('default-enabled');
  const defaultDisabledRadio = document.getElementById('default-disabled');
  const currentSiteSpan = document.getElementById('current-site');

  // Collapsible General Settings
  const generalSettingsHeader = document.getElementById('general-settings-header');
  const generalSettingsContent = document.getElementById('general-settings-content');

  // Custom Font Elements
  const customFontToggle = document.getElementById('custom-font-toggle');
  const customFontControls = document.getElementById('custom-font-controls');
  const customFontInput = document.getElementById('custom-font-input');
  const customFontStatus = document.getElementById('current-font-name');

  // New Translator elements
  const apiKeyInput = document.getElementById('api-key-input');
  const testApiButton = document.getElementById('test-api-button');
  const apiTestResultSpan = document.getElementById('api-test-result');
  const toneSelect = document.getElementById('translation-tone');
  const modelSelect = document.getElementById('translation-model');
  const translateButton = document.getElementById('translate-button');

  let currentHost = '';
  let currentTabId = null;

  // --- Load initial state --- 
  function loadInitialState() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        currentTabId = tabs[0].id;
        if (tabs[0].url) {
           try {
              const url = new URL(tabs[0].url);
              currentHost = url.hostname;
              currentSiteSpan.textContent = currentHost;
              // Load sync settings (RTL)
              chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], (syncResult) => {
                 const defaultEnabled = syncResult.defaultEnabled !== undefined ? syncResult.defaultEnabled : true;
                 const disabledSites = syncResult.disabledSites || [];
                 const enabledSites = syncResult.enabledSites || [];

                 defaultEnabledRadio.checked = defaultEnabled;
                 defaultDisabledRadio.checked = !defaultEnabled;

                 siteToggle.checked = defaultEnabled ? !disabledSites.includes(currentHost) : enabledSites.includes(currentHost);
                 siteToggle.disabled = false;
              });
           } catch(e) {
               currentSiteSpan.textContent = 'Invalid URL';
               siteToggle.disabled = true;
               translateButton.disabled = true; // Disable translate on invalid URL
           }
        } else {
           currentSiteSpan.textContent = 'N/A';
           siteToggle.disabled = true;
           translateButton.disabled = true; // Disable translate on non-http pages
        }
        // Enable translate button only for valid http/https tabs
        if (!tabs[0].url?.startsWith('http')) {
            translateButton.disabled = true;
        }
      } else {
           currentSiteSpan.textContent = 'N/A';
           siteToggle.disabled = true;
           translateButton.disabled = true; // Disable if no active tab
      }
    });

    // Load local settings (custom font and API key)
    chrome.storage.local.get(['useCustomFont', 'customFontName', 'geminiApiKey'], (localResult) => {
      // Custom font part
      const useCustomFont = localResult.useCustomFont || false;
      const fontName = localResult.customFontName || 'پیش‌فرض (وزیرمتن)';
      customFontToggle.checked = useCustomFont;
      customFontStatus.textContent = fontName;
      customFontControls.style.display = useCustomFont ? 'block' : 'none';
      // API Key part
      if (localResult.geminiApiKey) {
        apiKeyInput.value = localResult.geminiApiKey;
      }
    });

    // Load sync settings (tone preference and model preference)
    chrome.storage.sync.get(['translationTone', 'translationModel'], (syncResult) => {
        toneSelect.value = syncResult.translationTone || 'رسمی';
        modelSelect.value = syncResult.translationModel || 'gemini-2.5-flash-preview-04-17';
        // Remove redundant font setting - handled by CSS now
        // document.querySelectorAll('.setting-description').forEach(el => el.style.fontFamily = '"Vazirmatn", sans-serif');
    });
  }

  // --- Event Listeners --- 

  // General Settings Collapsible Toggle
  generalSettingsHeader.addEventListener('click', () => {
    generalSettingsHeader.classList.toggle('active');
    if (generalSettingsContent.style.display === "block") {
      generalSettingsContent.style.display = "none";
    } else {
      generalSettingsContent.style.display = "block";
    }
  });

  // Site-specific toggle
  siteToggle.addEventListener('change', () => {
    if (!currentHost) return;
    const isEnabled = siteToggle.checked;

    chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], (result) => {
      const defaultEnabled = result.defaultEnabled !== undefined ? result.defaultEnabled : true;
      let disabledSites = result.disabledSites || [];
      let enabledSites = result.enabledSites || [];

      if (defaultEnabled) {
        disabledSites = disabledSites.filter(site => site !== currentHost);
        if (!isEnabled) disabledSites.push(currentHost);
      } else {
        enabledSites = enabledSites.filter(site => site !== currentHost);
        if (isEnabled) enabledSites.push(currentHost);
      }

      chrome.storage.sync.set({ disabledSites, enabledSites }, () => {
        notifyContentScript( 'toggleStatus', { status: isEnabled });
      });
    });
  });

  // Default mode radio buttons
  defaultEnabledRadio.addEventListener('change', setDefaultMode);
  defaultDisabledRadio.addEventListener('change', setDefaultMode);

  function setDefaultMode() {
    const defaultEnabled = defaultEnabledRadio.checked;
    chrome.storage.sync.set({ defaultEnabled }, () => {
      // Update site toggle based on new default
      chrome.storage.sync.get(['disabledSites', 'enabledSites'], (result) => {
         const disabledSites = result.disabledSites || [];
         const enabledSites = result.enabledSites || [];
         const siteShouldBeEnabled = defaultEnabled ? !disabledSites.includes(currentHost) : enabledSites.includes(currentHost);
         
         if (siteToggle.checked !== siteShouldBeEnabled) {
             siteToggle.checked = siteShouldBeEnabled;
             notifyContentScript( 'toggleStatus', { status: siteShouldBeEnabled });
         }
      });
      console.log(`Default mode set to: ${defaultEnabled ? 'Enabled' : 'Disabled'}`);
    });
  }

  // Custom Font Toggle
  customFontToggle.addEventListener('change', () => {
    const useCustom = customFontToggle.checked;
    customFontControls.style.display = useCustom ? 'block' : 'none';
    chrome.storage.local.set({ useCustomFont: useCustom }, () => {
      if (!useCustom) {
        // Clear custom font data when disabling
        clearCustomFontData(true); // true = also notify content scripts
      } else {
        // If enabling, check if font data exists and trigger update if it does
        chrome.storage.local.get(['customFontData'], (result) => {
          if (result.customFontData) {
            triggerFontUpdate();
          }
          // If no data, user must select a file
        });
      }
      console.log(`Use custom font: ${useCustom}`);
    });
  });

  // Custom Font File Input
  customFontInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    customFontInput.disabled = true; // Disable input while processing

    if (!file) {
        customFontInput.disabled = false;
        return; 
    }

    if (!file.name.toLowerCase().endsWith('.ttf')) {
      alert('لطفا یک فایل با فرمت TTF انتخاب کنید.');
      customFontInput.value = '';
      customFontInput.disabled = false;
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      alert(`فایل فونت بزرگتر از 5MB است (${(file.size / 1024 / 1024).toFixed(1)}MB). لطفا فونت کوچکتری انتخاب کنید.`);
      customFontInput.value = '';
      customFontInput.disabled = false;
      return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
      try {
        // e.target.result now directly contains the Data URL (Base64 encoded)
        const dataUrl = e.target.result; 
        
        // Validate if it's actually a TTF data url (basic check)
        if (!dataUrl.startsWith('data:font/ttf;base64,') && !dataUrl.startsWith('data:application/font-sfnt;base64,') && !dataUrl.startsWith('data:application/octet-stream;base64,')) { // Some systems might use octet-stream for ttf
            console.warn('FileReader result does not look like a TTF Data URL:', dataUrl.substring(0, 50));
             // We might still try saving it, but it's suspicious.
             // Alternatively, throw an error:
             // throw new Error('Invalid data URL format received from FileReader.');
        }

        const fontFamilyName = getFontFamilyName(file.name);

        chrome.storage.local.set({
          customFontData: dataUrl, // Save the Data URL directly
          customFontName: file.name,
          customFontFamily: fontFamilyName
        }, () => {
          customFontStatus.textContent = file.name;
          alert(`فونت '${file.name}' با موفقیت ذخیره شد.`);
          triggerFontUpdate();
          console.log(`Custom font stored: ${file.name}, Family: ${fontFamilyName}`);
          customFontInput.disabled = false;
          customFontInput.value = ''; // Clear input after success
        });
      } catch (error) {
        console.error("Error processing font file:", error);
        alert('خطا در پردازش فایل فونت. ممکن است فایل معتبر نباشد.');
        customFontInput.value = '';
        customFontInput.disabled = false;
      }
    };

    reader.onerror = function(e) {
      console.error("Error reading font file:", e);
      alert('خطا در خواندن فایل فونت.');
      customFontInput.value = '';
      customFontInput.disabled = false;
    };

    // Read the file directly as a Data URL
    reader.readAsDataURL(file);
  });

  // API Key Input
  apiKeyInput.addEventListener('input', () => {
       apiTestResultSpan.textContent = '';
  });
  apiKeyInput.addEventListener('change', () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
          chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
              console.log('Gemini API Key saved.');
              // Optional: Add visual feedback (e.g., a temporary checkmark)
          });
      } else {
          // If cleared, remove from storage
          chrome.storage.local.remove('geminiApiKey', () => {
              console.log('Gemini API Key removed.');
          });
      }
  });

  // Test API Key Button
  testApiButton.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
          apiTestResultSpan.textContent = 'کلید خالی است';
          apiTestResultSpan.style.color = 'red';
          return;
      }
      apiTestResultSpan.textContent = 'درحال تست...';
      apiTestResultSpan.style.color = 'grey';
      testApiButton.disabled = true;

      // Send message to background script to test the key
      chrome.runtime.sendMessage({ command: 'testApiKey', apiKey: apiKey })
          .then(response => {
              if (response.success) {
                  apiTestResultSpan.textContent = 'معتبر ✅';
                  apiTestResultSpan.style.color = 'green';
              } else {
                  // Display specific error from background script
                  const errorMessage = response.error || 'خطای نامشخص'; 
                  apiTestResultSpan.textContent = `نامعتبر ❌ (${errorMessage})`; 
                  apiTestResultSpan.style.color = 'red';
              }
          })
          .catch(error => {
              console.error("Error testing API key (message sending failed):", error);
              // Error sending the message itself
              apiTestResultSpan.textContent = 'خطا در ارسال پیام تست'; 
              apiTestResultSpan.style.color = 'red';
          })
          .finally(() => {
              testApiButton.disabled = false;
          });
  });

  // Tone Selection
  toneSelect.addEventListener('change', () => {
      const selectedTone = toneSelect.value;
      chrome.storage.sync.set({ translationTone: selectedTone }, () => {
          console.log(`Translation tone set to: ${selectedTone}`);
      });
  });

  // Model Selection
  modelSelect.addEventListener('change', () => {
      const selectedModel = modelSelect.value;
      chrome.storage.sync.set({ translationModel: selectedModel }, () => {
          console.log(`Translation model set to: ${selectedModel}`);
      });
  });

  // Translate Button
  translateButton.addEventListener('click', () => {
      if (translateButton.disabled) return;
      
      // 1. Get API Key from storage
      chrome.storage.local.get('geminiApiKey', (localResult) => {
          const apiKey = localResult.geminiApiKey;
          if (!apiKey) {
              alert('لطفا ابتدا کلید API گوگل خود را در تنظیمات وارد کنید.');
              // Optionally focus the API key input
              apiKeyInput.focus();
              // Open the settings if collapsed
              if (generalSettingsContent.style.display !== 'block') {
                  generalSettingsHeader.click();
              }
              return;
          }

          // 2. Get Tone and Model
          chrome.storage.sync.get(['translationTone'], (syncResult) => { // Only get tone from storage here
              const tone = syncResult.translationTone || 'رسمی';
              // *** Get the currently selected model DIRECTLY from the dropdown ***
              const model = modelSelect.value; 

              // 3. Send message to content script
              if (currentTabId) {
                  notifyContentScript('translatePage', { apiKey, tone, model });
                  // Optional: Close popup after initiating translation
                  // window.close(); 
              } else {
                  console.error("No active tab ID found to send translation request.");
                  alert("خطا: تب فعالی برای ارسال درخواست ترجمه یافت نشد.");
              }
          });
      });
  });

  // --- Helper Functions --- 
  
  function clearCustomFontData(notifyContent) {
    chrome.storage.local.remove(['customFontData', 'customFontName', 'customFontFamily'], () => {
      customFontStatus.textContent = 'پیش‌فرض (وزیرمتن)';
      customFontInput.value = ''; // Clear file input visually
      console.log('Custom font data cleared.');
      if (notifyContent) {
        triggerFontUpdate(); // Notify content script to revert to default
      }
    });
  }

  function triggerFontUpdate() {
    console.log('Triggering font update in content scripts...');
    notifyContentScript('updateFont', {}); // Send empty object, content script will fetch from storage
  }

  function notifyContentScript(command, data) {
     if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { command: command, data: data })
          .then(response => {
             // Handle potential response from content script if needed
             if (response && response.status) {
                console.log(`Content script responded to ${command}:`, response.status);
             } else if(response && response.error) {
                console.error(`Content script error for ${command}:`, response.error);
             }
          })
          .catch(error => {
             // Check if the error is due to no receiving end (content script not injected/ready)
             if (error.message?.includes("Could not establish connection") || error.message?.includes("Receiving end does not exist")) {
                console.warn(`Could not send message '${command}' to content script (tab ID: ${currentTabId}). It might not be injected or ready yet.`);
             } else {
                console.error(`Error sending message '${command}' to content script (tab ID: ${currentTabId}):`, error);
             }
          });
     } else {
        console.warn("Cannot notify content script: No active tab ID.");
     }
  }

  // Initialize
  loadInitialState();

}); // Closing parenthesis for DOMContentLoaded listener