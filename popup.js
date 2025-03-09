'use strict';

document.addEventListener('DOMContentLoaded', function() {
  const siteToggle = document.getElementById('site-toggle');
  const currentSiteElement = document.getElementById('current-site');
  
  let currentHostname = '';
  
  // Get current tab information
  chrome.runtime.sendMessage({ action: 'getCurrentTabInfo' }, function(response) {
    if (response) {
      currentHostname = response.hostname;
      currentSiteElement.textContent = currentHostname;
      siteToggle.checked = response.isEnabled;
    }
  });
  
  // Handle toggle change
  siteToggle.addEventListener('change', function() {
    const isEnabled = this.checked;
    
    chrome.runtime.sendMessage({
      action: 'toggleSite',
      hostname: currentHostname,
      enabled: isEnabled
    }, function(response) {
      if (response && response.success) {
        console.log(`Site ${currentHostname} is now ${isEnabled ? 'enabled' : 'disabled'}`);
      }
    });
  });
}); 