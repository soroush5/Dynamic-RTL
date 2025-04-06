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

  let currentHost = '';

  // --- Load initial state --- 
  function loadInitialState() {
    // Get active tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          currentHost = url.hostname;
          currentSiteSpan.textContent = currentHost;

          // Load sync settings (site toggle, default mode)
          chrome.storage.sync.get(['disabledSites', 'enabledSites', 'defaultEnabled'], (syncResult) => {
            const defaultEnabled = syncResult.defaultEnabled !== undefined ? syncResult.defaultEnabled : true;
            const disabledSites = syncResult.disabledSites || [];
            const enabledSites = syncResult.enabledSites || [];

            defaultEnabledRadio.checked = defaultEnabled;
            defaultDisabledRadio.checked = !defaultEnabled;

            siteToggle.checked = defaultEnabled ? !disabledSites.includes(currentHost) : enabledSites.includes(currentHost);
            siteToggle.disabled = false;
          });
        } catch (e) {
          currentSiteSpan.textContent = 'Invalid URL';
          siteToggle.disabled = true;
          console.error("Error parsing URL:", e);
        }
      } else {
        currentSiteSpan.textContent = 'N/A';
        siteToggle.disabled = true;
      }
    });

    // Load local settings (custom font)
    chrome.storage.local.get(['useCustomFont', 'customFontName'], (localResult) => {
      const useCustomFont = localResult.useCustomFont || false;
      const fontName = localResult.customFontName || 'پیش‌فرض (وزیرمتن)';
      
      customFontToggle.checked = useCustomFont;
      customFontStatus.textContent = fontName;
      customFontControls.style.display = useCustomFont ? 'block' : 'none';
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

  // --- Helper Functions --- 

  // Function to clear custom font data from storage
  function clearCustomFontData(notifyScripts = false) {
    chrome.storage.local.remove(['useCustomFont', 'customFontData', 'customFontName', 'customFontFamily'], () => {
      customFontStatus.textContent = 'پیش‌فرض (وزیرمتن)';
      customFontInput.value = '';
      customFontToggle.checked = false;
      customFontControls.style.display = 'none';
      if (notifyScripts) {
        triggerFontUpdate();
      }
      console.log('Custom font reset to default.');
    });
  }

  // Function to send a message to the content script in the active tab
  function notifyContentScript(command, data) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tabs[0].id, { command: command, ...data })
          .catch(error => {
            if (error.message.includes('Receiving end does not exist')) {
              // console.log(`Content script not available in active tab ${tabs[0].id}`);
            } else {
              console.error(`Error sending ${command} to active tab ${tabs[0].id}:`, error);
            }
          });
      }
    });
  }
  
  // Function to notify ALL content scripts to update their font
  function triggerFontUpdate() {
      chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
              if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                  chrome.tabs.sendMessage(tab.id, { command: 'updateFont' }).catch(error => {
                      if (!error.message.includes('Receiving end does not exist')) {
                          console.error(`Error sending updateFont to tab ${tab.id} (${tab.url}):`, error);
                      }
                  });
              }
          });
      });
      // TODO: Update popup's own style if needed
  }

  // --- Initialize --- 
  loadInitialState();
}); 