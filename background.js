// Highlight Hub Background Script

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set up default settings
  await initializeDefaultSettings();
  
  // Create context menus
  createContextMenus();
  
  // Update badge count
  updateBadgeCount();
  
  console.log('Highlight Hub installed successfully!');
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: command });
    }
  });
});

// Initialize default settings
async function initializeDefaultSettings() {
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
}

// Create context menus
function createContextMenus() {
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
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
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
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openDashboard':
      chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
      });
      break;
      
    case 'shareHighlight':
      handleShareHighlight(request.data, sender.tab);
      break;
      
    case 'updateBadge':
      await updateBadgeCount();
      break;
      
    case 'getActiveProjects':
      getActiveProjects().then(sendResponse);
      return true; // Indicates async response
      
    case 'updateActiveProjects':
      updateActiveProjects(request.projects).then(sendResponse);
      return true;
      
    case 'exportHighlights':
      exportHighlights(request.filters).then(sendResponse);
      return true;
  }
});

// Get active projects
async function getActiveProjects() {
  const result = await chrome.storage.sync.get(['activeProjects', 'projects']);
  return {
    activeProjects: result.activeProjects || ['Home'],
    allProjects: result.projects || ['Home', 'Work', 'Side Project']
  };
}

// Update active projects
async function updateActiveProjects(projects) {
  await chrome.storage.sync.set({ activeProjects: projects });
  return { success: true };
}

// Handle share highlight request
async function handleShareHighlight(highlightData, tab) {
  const shareUrl = `${highlightData.url}#highlight-${highlightData.id}`;
  const subject = encodeURIComponent(`Check out this highlight from "${highlightData.title}"`);
  const body = encodeURIComponent(`"${highlightData.text}"\n\nSource: ${shareUrl}\n\nShared via Smart Highlighter`);
  
  const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
  
  // Open email client
  chrome.tabs.create({ url: mailtoUrl });
}

// Export highlights
async function exportHighlights(filters = {}) {
  const result = await chrome.storage.local.get(['highlights']);
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

// Update badge count
async function updateBadgeCount() {
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  
  chrome.action.setBadgeText({
    text: highlights.length > 0 ? highlights.length.toString() : ''
  });
  
  chrome.action.setBadgeBackgroundColor({
    color: '#667eea'
  });
}

// Cleanup old highlights periodically (optional)
chrome.alarms.create('cleanupHighlights', { periodInMinutes: 60 * 24 }); // Daily

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupHighlights') {
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || [];
    
    // Remove highlights older than 1 year (optional cleanup)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const recentHighlights = highlights.filter(h => 
      new Date(h.timestamp) > oneYearAgo
    );
    
    if (recentHighlights.length !== highlights.length) {
      await chrome.storage.local.set({ highlights: recentHighlights });
      console.log(`Cleaned up ${highlights.length - recentHighlights.length} old highlights`);
    }
  }
});
