// Smart Highlighter Background Script

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set up default settings
  await initializeDefaultSettings();
  
  // Create context menus
  createContextMenus();
  
  console.log('Smart Highlighter installed successfully!');
});

// Initialize default settings
async function initializeDefaultSettings() {
  const result = await chrome.storage.sync.get(['projects', 'colorSchemes', 'activeProjects']);
  
  if (!result.projects) {
    const defaultProjects = ['Home', 'Work', 'Side Project'];
    await chrome.storage.sync.set({ projects: defaultProjects });
  }
  
  if (!result.activeProjects) {
    await chrome.storage.sync.set({ activeProjects: ['Home'] });
  }
  
  if (!result.colorSchemes) {
    const defaultColorSchemes = {
      'Home': {
        'yellow': 'Important',
        'green': 'Ideas', 
        'blue': 'To Research',
        'pink': 'Personal',
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
      'Side Project': {
        'yellow': 'Features to Build',
        'green': 'Marketing Ideas',
        'blue': 'Technical Notes',
        'pink': 'User Feedback',
        'orange': 'Bugs',
        'red': 'Priority',
        'purple': 'Research',
        'gray': 'Ideas'
      }
    };
    await chrome.storage.sync.set({ colorSchemes: defaultColorSchemes });
  }
}

// Create context menus
function createContextMenus() {
  // Remove any existing menus
  chrome
