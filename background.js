// Highlight Hub Background Script - Improved with Data Protection

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Highlight Hub installation/update detected:', details.reason);
  
  try {
    // Create backup before any initialization for updates
    if (details.reason === 'update') {
      await createUpdateBackup();
    }
    
    // Set up default settings
    await initializeDefaultSettings();
    
    // Create context menus
    createContextMenus();
    
    // Update badge count
    await updateBadgeCount();
    
    console.log('Highlight Hub initialized successfully!');
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

// Create backup during updates
async function createUpdateBackup() {
  try {
    const result = await chrome.storage.sync.get(['highlights', 'projects', 'colorSchemes', 'activeProjects']);
    const backup = {
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      data: result,
      type: 'update_backup'
    };
    
    // Store in local storage as fallback during updates
    await chrome.storage.local.set({ 
      'update_backup': backup,
      'backup_timestamp': Date.now()
    });
    
    console.log('Update backup created successfully');
  } catch (error) {
    console.error('Failed to create update backup:', error);
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: command });
    }
  });
});

// Initialize default settings with better error handling
async function initializeDefaultSettings() {
  try {
    const result = await chrome.storage.sync.get(['projects', 'colorSchemes', 'activeProjects']);
    
    if (!result.projects) {
      const defaultProjects = ['Personal', 'Work', 'Research'];
      await chrome.storage.sync.set({ projects: defaultProjects });
    }
    
    if (!result.activeProjects) {
      await chrome.storage.sync.set({ activeProjects: ['Personal'] });
    }
    
    if (!result.colorSchemes) {
      const defaultColorSchemes = {
        'Personal': {
          'yellow': 'Important',
          'green': 'Ideas', 
          'blue': 'To Research',
          'pink': 'Fun',
          'orange': 'Action Items',
          'red': 'Urgent',
          'purple': 'Questions',
          'gray': 'Notes'
        },
        'Work': {
          'yellow': 'Action Items',
          'green': 'Client Feedback',
          'blue': 'Meeting Notes',
          'pink': 'Follow Up',
          'orange': 'Important',
          'red': 'Urgent',
          'purple': 'Questions',
          'gray': 'Reference'
        },
        'Research': {
          'yellow': 'Key Findings',
          'green': 'Hypotheses',
          'blue': 'Data',
          'pink': 'Insights',
          'orange': 'To Investigate',
          'red': 'Critical',
          'purple': 'Questions',
          'gray': 'Background'
        }
      };
      await chrome.storage.sync.set({ colorSchemes: defaultColorSchemes });
    }
  } catch (error) {
    console.error('Error initializing default settings:', error);
  }
}

// Create context menus with error handling
function createContextMenus() {
  try {
    // Remove any existing menus
    chrome.contextMenus.removeAll(() => {
      // Create main menu for selected text
      chrome.contextMenus.create({
        id: 'smart-highlight-selection',
        title: 'Highlight with Smart Highlighter',
        contexts: ['selection']
      });
      
      // Create submenu for different colors
      const colors = [
        { id: 'yellow', title: 'Important (Yellow)' },
        { id: 'green', title: 'Ideas (Green)' },
        { id: 'blue', title: 'Research (Blue)' },
        { id: 'pink', title: 'Personal (Pink)' },
        { id: 'orange', title: 'Action Items (Orange)' },
        { id: 'red', title: 'Urgent (Red)' },
        { id: 'purple', title: 'Questions (Purple)' },
        { id: 'gray', title: 'Notes (Gray)' }
      ];
      
      colors.forEach(color => {
        chrome.contextMenus.create({
          id: `highlight-${color.id}`,
          parentId: 'smart-highlight-selection',
          title: color.title,
          contexts: ['selection']
        });
      });
      
      // Separator
      chrome.contextMenus.create({
        id: 'separator1',
        parentId: 'smart-highlight-selection',
        type: 'separator',
        contexts: ['selection']
      });
      
      // Open dashboard
      chrome.contextMenus.create({
        id: 'open-dashboard',
        parentId: 'smart-highlight-selection',
        title: 'Open Highlights Dashboard',
        contexts: ['selection']
      });
    });
  } catch (error) {
    console.error('Error creating context menus:', error);
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId.startsWith('highlight-')) {
      const color = info.menuItemId.replace('highlight-', '');
      
      // Send message to content script to highlight with specific color
      chrome.tabs.sendMessage(tab.id, {
        action: 'highlightSelection',
        color: color,
        text: info.selectionText
      });
    } else if (info.menuItemId === 'open-dashboard') {
      // Open dashboard in new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
      });
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
});

// Handle messages from content scripts with better error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'openDashboard':
          chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
          });
          break;
          
        case 'shareHighlight':
          await handleShareHighlight(request.data, sender.tab);
          break;
          
        case 'updateBadge':
          await updateBadgeCount();
          break;
          
        case 'getActiveProjects':
          const projectData = await getActiveProjects();
          sendResponse(projectData);
          break;
          
        case 'updateActiveProjects':
          const updateResult = await updateActiveProjects(request.projects);
          sendResponse(updateResult);
          break;
          
        case 'exportHighlights':
          const exportData = await exportHighlights(request.filters);
          sendResponse(exportData);
          break;

        case 'createBackup':
          const backup = await createManualBackup();
          sendResponse(backup);
          break;

        case 'restoreFromBackup':
          const restoreResult = await restoreFromBackup(request.backupData);
          sendResponse(restoreResult);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Indicates async response
});

// Create manual backup
async function createManualBackup() {
  try {
    const result = await chrome.storage.sync.get(['highlights', 'projects', 'colorSchemes', 'activeProjects']);
    const backup = {
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      data: result,
      type: 'manual'
    };
    
    // Store in local storage
    await chrome.storage.local.set({
      'manual_backup': backup,
      'manual_backup_timestamp': Date.now()
    });
    
    return backup;
  } catch (error) {
    console.error('Error creating manual backup:', error);
    throw error;
  }
}

// Restore from backup
async function restoreFromBackup(backupData) {
  try {
    if (!backupData || !backupData.data) {
      throw new Error('Invalid backup data');
    }
    
    await chrome.storage.sync.set(backupData.data);
    
    // Notify all tabs of the restoration
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'dataRestored'
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    });
    
    await updateBadgeCount();
    
    return { success: true };
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw error;
  }
}

// Get active projects
async function getActiveProjects() {
  try {
    const result = await chrome.storage.sync.get(['activeProjects', 'projects']);
    return {
      activeProjects: result.activeProjects || ['Personal'],
      allProjects: result.projects || ['Personal', 'Work', 'Research']
    };
  } catch (error) {
    console.error('Error getting active projects:', error);
    return {
      activeProjects: ['Personal'],
      allProjects: ['Personal', 'Work', 'Research']
    };
  }
}

// Update active projects
async function updateActiveProjects(projects) {
  try {
    await chrome.storage.sync.set({ activeProjects: projects });
    return { success: true };
  } catch (error) {
    console.error('Error updating active projects:', error);
    return { success: false, error: error.message };
  }
}

// Handle share highlight request
async function handleShareHighlight(highlightData, tab) {
  try {
    const shareUrl = `${highlightData.url}#highlight-${highlightData.id}`;
    const subject = encodeURIComponent(`Check out this highlight from "${highlightData.title}"`);
    const body = encodeURIComponent(`"${highlightData.text}"\n\nSource: ${shareUrl}\n\nShared via Smart Highlighter`);
    
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    
    // Open email client
    chrome.tabs.create({ url: mailtoUrl });
  } catch (error) {
    console.error('Error handling share highlight:', error);
  }
}

// Export highlights
async function exportHighlights(filters = {}) {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    let highlights = result.highlights || [];
    
    // Apply filters
    if (filters.project) {
      highlights = highlights.filter(h => h.projects.includes(filters.project));
    }
    
    if (filters.color) {
      highlights = highlights.filter(h => h.color === filters.color);
    }
    
    if (filters.dateFrom) {
      highlights = highlights.filter(h => new Date(h.timestamp) >= new Date(filters.dateFrom));
    }
    
    if (filters.dateTo) {
      highlights = highlights.filter(h => new Date(h.timestamp) <= new Date(filters.dateTo));
    }
    
    if (filters.url) {
      highlights = highlights.filter(h => h.url.includes(filters.url));
    }
    
    // Format for export
    const exportData = {
      exportDate: new Date().toISOString(),
      totalHighlights: highlights.length,
      highlights: highlights.map(h => ({
        text: h.text,
        color: h.color,
        projects: h.projects,
        notes: h.notes,
        url: h.url,
        title: h.title,
        timestamp: h.timestamp
      }))
    };
    
    return exportData;
  } catch (error) {
    console.error('Error exporting highlights:', error);
    throw error;
  }
}

// Handle tab updates to restore highlights
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Send message to content script to restore highlights
    chrome.tabs.sendMessage(tabId, {
      action: 'restoreHighlights',
      url: tab.url
    }).catch(() => {
      // Ignore errors (content script might not be ready)
    });
  }
});

// Handle storage changes to sync across tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.activeProjects || changes.colorSchemes)) {
    // Notify all tabs of settings changes
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsChanged',
          changes: changes
        }).catch(() => {
          // Ignore errors for tabs without content script
        });
      });
    });
  }
});

// Update badge count with error handling
async function updateBadgeCount() {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    
    chrome.action.setBadgeText({
      text: highlights.length > 0 ? highlights.length.toString() : ''
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#667eea'
    });
  } catch (error) {
    console.error('Error updating badge count:', error);
  }
}

// Cleanup old highlights periodically (optional)
chrome.alarms.create('cleanupHighlights', { periodInMinutes: 60 * 24 }); // Daily

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupHighlights') {
    try {
      const result = await chrome.storage.sync.get(['highlights']);
      const highlights = result.highlights || [];
      
      // Remove highlights older than 1 year (optional cleanup)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const recentHighlights = highlights.filter(h => 
        new Date(h.timestamp) > oneYearAgo
      );
      
      if (recentHighlights.length !== highlights.length) {
        await chrome.storage.sync.set({ highlights: recentHighlights });
        console.log(`Cleaned up ${highlights.length - recentHighlights.length} old highlights`);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
});

// Handle extension startup - check for recovery scenarios
chrome.runtime.onStartup.addListener(async () => {
  try {
    await checkDataIntegrity();
  } catch (error) {
    console.error('Error during startup check:', error);
  }
});

// Check data integrity and offer recovery if needed
async function checkDataIntegrity() {
  try {
    const syncResult = await chrome.storage.sync.get(['highlights']);
    const localResult = await chrome.storage.local.get(['update_backup', 'manual_backup']);
    
    const highlights = syncResult.highlights || [];
    
    // If no highlights but backups exist, data might have been lost
    if (highlights.length === 0 && (localResult.update_backup || localResult.manual_backup)) {
      console.log('Data recovery scenario detected - backups available');
      // This will be handled by the backup manager in the dashboard
    }
  } catch (error) {
    console.error('Error checking data integrity:', error);
  }
}
