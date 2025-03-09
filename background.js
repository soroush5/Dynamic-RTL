'use strict';

// Initialize extension settings when installed
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.get(['disabledSites'], function(result) {
    if (!result.disabledSites) {
      chrome.storage.sync.set({ disabledSites: [] });
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
        
        chrome.storage.sync.get(['disabledSites'], function(result) {
          const disabledSites = result.disabledSites || [];
          const isEnabled = !disabledSites.includes(hostname);
          
          sendResponse({
            hostname: hostname,
            isEnabled: isEnabled
          });
        });
      }
    });
    return true; // Keep the message channel open for the async response
  }
  
  if (message.action === 'toggleSite') {
    const hostname = message.hostname;
    const enabled = message.enabled;
    
    chrome.storage.sync.get(['disabledSites'], function(result) {
      let disabledSites = result.disabledSites || [];
      
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
        // Send message to content script to update its state
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'toggleSite',
              enabled: enabled
            });
          }
        });
        
        sendResponse({ success: true });
      });
    });
    return true; // Keep the message channel open for the async response
  }
}); 