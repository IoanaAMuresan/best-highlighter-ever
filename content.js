// Highlight Hub Content Script - Fixed Selection Issues
let highlightId = 0;
let activeProjects = [];
let colorSchemes = {};
let isHighlighting = false;
let selectedText = null;
let selectedRange = null;
let selectionTimeout;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  await loadSettings();
  setupEventListeners();
  
  // Delay restoration to allow page to fully load
  setTimeout(() => {
    restoreHighlights();
    updatePageIndicator();
  }, 1000);
}

// Listen for keyboard shortcuts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'highlight-selection':
      handleKeyboardHighlight();
      break;
    case 'add-note':
      handleKeyboardNote();
      break;
    case 'open-dashboard':
      openDashboard();
      break;
    case 'activeProjectsChanged':
      activeProjects = request.activeProjects;
      break;
    case 'settingsChanged':
      loadSettings();
      break;
    case 'restoreHighlights':
      setTimeout(restoreHighlights, 500);
      break;
    case 'dataRestored':
      setTimeout(() => {
        restoreHighlights();
        updatePageIndicator();
      }, 1000);
      break;
  }
});

// Handle keyboard shortcuts
function handleKeyboardHighlight() {
  const selection = window.getSelection();
  if (selection.toString().trim().length > 0) {
    highlightSelection('yellow');
  }
}

function handleKeyboardNote() {
  const selection = window.getSelection();
  if (selection.toString().trim().length > 0) {
    highlightSelection('yellow').then((highlightData) => {
      if (highlightData) {
        setTimeout(() => {
          const highlightElement = document.querySelector(`[data-highlight-id="${highlightData.id}"]`);
          if (highlightElement) {
            showNoteDialog(highlightElement, highlightData);
          }
        }, 100);
      }
    });
  }
}

// Load user settings and projects
async function loadSettings() {
  const result = await chrome.storage.sync.get(['projects', 'colorSchemes', 'activeProjects']);
  
  if (!result.projects) {
    const defaultProjects = ['Home', 'Work', 'Side Project'];
    await chrome.storage.sync.set({ projects: defaultProjects });
    activeProjects = ['Home'];
  } else {
    activeProjects = result.activeProjects || [result.projects[0]];
  }
  
  if (!result.colorSchemes) {
    colorSchemes = {
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
    await chrome.storage.sync.set({ colorSchemes });
  } else {
    colorSchemes = result.colorSchemes;
  }
}

// Setup event listeners - back to mouseup for reliability
function setupEventListeners() {
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('click', hideContextMenu);
}

// Handle text selection - simplified and more reliable
function handleTextSelection(e) {
  // Small delay to let selection settle
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    console.log('Selection detected:', selectedText.length, 'characters');
    
    if (selectedText.length > 0) {
      showHighlightOptions(e, selection);
    } else {
      hideContextMenu();
    }
  }, 50);
}

// Show highlight options after text selection
function showHighlightOptions(e, selection) {
  console.log('Showing highlight options...');
  
  // Remove any existing toolbars first
  hideContextMenu();
  
  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    console.log('Selection rect:', rect);
    
    // Make sure we have a valid selection
    if (rect.width === 0 && rect.height === 0) {
      console.log('Invalid selection rect, skipping');
      return;
    }
    
    // Create floating toolbar
    const toolbar = createHighlightToolbar();
    
    // Position toolbar above selection
    let left = rect.left + window.scrollX + (rect.width / 2) - 150; // Center toolbar
    let top = rect.top + window.scrollY - 60; // Position above selection
    
    // Keep toolbar on screen
    if (left < 10) left = 10;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
    if (top < 10) top = rect.bottom + window.scrollY + 10; // Position below if no room above
    
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.style.position = 'absolute';
    toolbar.style.zIndex = '10000';
    
    console.log('Toolbar positioned at:', left, top);
    
    document.body.appendChild(toolbar);
    
    // Auto-remove after 5 seconds if not used
    setTimeout(() => {
      if (toolbar.parentNode) {
        toolbar.remove();
      }
    }, 5000);
    
    console.log('Toolbar added to page');
  } catch (error) {
    console.error('Error showing highlight options:', error);
  }
}

// Create highlight toolbar
function createHighlightToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'smart-highlight-toolbar';
  toolbar.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 8px;
    display: flex;
    gap: 4px;
    animation: fadeInUp 0.2s ease;
  `;
  
  toolbar.innerHTML = `
    <div class="highlight-colors" style="display: flex; gap: 4px;">
      <button class="color-btn" data-color="yellow" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #ffeb3b; transition: transform 0.2s ease;" title="Important"></button>
      <button class="color-btn" data-color="green" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #4caf50; transition: transform 0.2s ease;" title="Ideas"></button>
      <button class="color-btn" data-color="blue" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #2196f3; transition: transform 0.2s ease;" title="Research"></button>
      <button class="color-btn" data-color="pink" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #e91e63; transition: transform 0.2s ease;" title="Personal"></button>
      <button class="color-btn" data-color="orange" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #ff9800; transition: transform 0.2s ease;" title="Action Items"></button>
      <button class="color-btn" data-color="red" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #f44336; transition: transform 0.2s ease;" title="Urgent"></button>
      <button class="color-btn" data-color="purple" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #9c27b0; transition: transform 0.2s ease;" title="Questions"></button>
      <button class="color-btn" data-color="gray" style="width: 32px; height: 32px; border: 2px solid white; border-radius: 50%; cursor: pointer; background: #9e9e9e; transition: transform 0.2s ease;" title="Notes"></button>
    </div>
  `;
  
  // Add hover effects
  toolbar.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });
  });
  
  // Add click handlers for colors
  toolbar.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = btn.dataset.color;
      console.log('Color button clicked:', color);
      highlightSelection(color);
      toolbar.remove();
    });
  });
  
  return toolbar;
}

// Highlight selected text - simplified
async function highlightSelection(color) {
  console.log('Highlighting selection with color:', color);
  
  const selection = window.getSelection();
  if (selection.toString().trim().length === 0) {
    console.log('No selection found');
    return null;
  }
  
  try {
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    console.log('Selected text:', selectedText);
    
    // Create highlight element
    const highlightElement = document.createElement('span');
    highlightElement.className = `smart-highlight smart-highlight-${color}`;
    highlightElement.dataset.highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    highlightElement.dataset.color = color;
    highlightElement.dataset.projects = JSON.stringify(activeProjects);
    
    // Apply highlight styles directly to ensure they work
    highlightElement.style.cssText = `
      background-color: ${getColorValue(color)} !important;
      padding: 2px 4px;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline;
    `;
    
    try {
      range.surroundContents(highlightElement);
      console.log('Successfully surrounded contents');
    } catch (e) {
      console.log('Surround failed, trying fallback method');
      // Fallback for complex selections
      try {
        const contents = range.extractContents();
        highlightElement.appendChild(contents);
        range.insertNode(highlightElement);
        console.log('Fallback method succeeded');
      } catch (e2) {
        console.error('Both highlighting methods failed:', e2);
        showNotification('Could not highlight this selection');
        selection.removeAllRanges();
        return null;
      }
    }
    
    // Save highlight data
    const highlightData = {
      id: highlightElement.dataset.highlightId,
      text: selectedText,
      color: color,
      projects: activeProjects.slice(),
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      timestamp: new Date().toISOString(),
      context: getTextContext(highlightElement),
      notes: []
    };
    
    await saveHighlight(highlightData);
    
    // Add context menu listener
    highlightElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showHighlightContextMenu(e, highlightElement, highlightData);
      return false;
    }, { capture: true, passive: false });
    
    // Add hover effect
    highlightElement.addEventListener('mouseenter', () => {
      highlightElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      highlightElement.style.transform = 'translateY(-1px)';
    });
    
    highlightElement.addEventListener('mouseleave', () => {
      highlightElement.style.boxShadow = 'none';
      highlightElement.style.transform = 'translateY(0)';
    });
    
    selection.removeAllRanges();
    updatePageIndicator();
    updateBadgeCount();
    
    console.log('Highlight created successfully');
    showNotification('Highlighted!');
    
    return highlightData;
  } catch (error) {
    console.error('Error highlighting selection:', error);
    showNotification('Error creating highlight');
    return null;
  }
}

// Get color value for inline styles
function getColorValue(color) {
  const colors = {
    yellow: 'rgba(255, 235, 59, 0.4)',
    green: 'rgba(76, 175, 80, 0.4)',
    blue: 'rgba(33, 150, 243, 0.4)',
    pink: 'rgba(233, 30, 99, 0.4)',
    orange: 'rgba(255, 152, 0, 0.4)',
    red: 'rgba(244, 67, 54, 0.4)',
    purple: 'rgba(156, 39, 176, 0.4)',
    gray: 'rgba(158, 158, 158, 0.4)'
  };
  return colors[color] || colors.yellow;
}

// Get text context around highlight for better restoration
function getTextContext(element) {
  try {
    const parent = element.parentElement;
    if (!parent) return null;
    
    const parentText = parent.textContent;
    const highlightText = element.textContent;
    const highlightIndex = parentText.indexOf(highlightText);
    
    if (highlightIndex === -1) return null;
    
    const contextStart = Math.max(0, highlightIndex - 50);
    const contextEnd = Math.min(parentText.length, highlightIndex + highlightText.length + 50);
    
    return {
      before: parentText.substring(contextStart, highlightIndex).trim(),
      after: parentText.substring(highlightIndex + highlightText.length, contextEnd).trim(),
      parentTag: parent.tagName.toLowerCase(),
      parentClass: parent.className,
      parentId: parent.id
    };
  } catch (error) {
    console.warn('Could not get context for highlight:', error);
    return null;
  }
}

// Save highlight to storage
async function saveHighlight(highlightData) {
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  highlights.push(highlightData);
  await chrome.storage.sync.set({ highlights });
}

// Show context menu for highlights
function showHighlightContextMenu(e, element, highlightData) {
  e.preventDefault();
  
  const menu = createContextMenu(element, highlightData);
  menu.style.left = `${e.pageX}px`;
  menu.style.top = `${e.pageY}px`;
  
  document.body.appendChild(menu);
  
  // Close menu on outside click
  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Create context menu
function createContextMenu(element, highlightData) {
  const menu = document.createElement('div');
  menu.className = 'smart-highlight-context-menu';
  
  const currentProject = activeProjects[0] || 'Home';
  const currentColors = colorSchemes[currentProject] || {};
  
  menu.innerHTML = `
    <div class="menu-item" data-action="copy">
      <span>📋</span> Copy
    </div>
    <div class="menu-item" data-action="copy-page">
      <span>📄</span> Copy Page Highlights
    </div>
    <div class="menu-item" data-action="share">
      <span>🔗</span> Copy Shareable Link
    </div>
    <div class="menu-item" data-action="note">
      <span>📝</span> Add Note
    </div>
    <div class="menu-item submenu-parent" data-action="color">
      <span>🎨</span> Change Color
      <div class="submenu color-submenu">
        ${Object.entries(currentColors).map(([color, label]) => 
          `<div class="menu-item color-item" data-color="${color}">
            <span class="color-dot" style="background: var(--color-${color})"></span>
            ${label}
          </div>`
        ).join('')}
      </div>
    </div>
    <div class="menu-item submenu-parent" data-action="projects">
      <span>📁</span> Projects
      <div class="submenu projects-submenu">
        ${Object.keys(colorSchemes).map(project => 
          `<div class="menu-item project-item" data-project="${project}">
            <span>${highlightData.projects.includes(project) ? '☑️' : '☐'}</span>
            ${project}
          </div>`
        ).join('')}
      </div>
    </div>
    <div class="menu-item" data-action="dashboard">
      <span>📊</span> Dashboard
    </div>
    <div class="menu-item delete" data-action="delete">
      <span>🗑️</span> Delete
    </div>
  `;
  
  // Add event listeners
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    const action = e.target.closest('.menu-item')?.dataset.action;
    const color = e.target.closest('.color-item')?.dataset.color;
    const project = e.target.closest('.project-item')?.dataset.project;
    
    if (color) {
      changeHighlightColor(element, highlightData, color);
      menu.remove();
    } else if (project) {
      toggleProjectAssignment(element, highlightData, project);
      const checkbox = e.target.closest('.project-item').querySelector('span');
      const isAssigned = highlightData.projects.includes(project);
      checkbox.textContent = isAssigned ? '☐' : '☑️';
    } else {
      switch (action) {
        case 'copy':
          copyHighlight(highlightData);
          menu.remove();
          break;
        case 'copy-page':
          copyPageHighlights();
          menu.remove();
          break;
        case 'note':
          showNoteDialog(element, highlightData);
          menu.remove();
          break;
        case 'share':
          shareHighlight(highlightData);
          menu.remove();
          break;
        case 'dashboard':
          openDashboard();
          menu.remove();
          break;
        case 'delete':
          deleteHighlight(element, highlightData);
          menu.remove();
          break;
      }
    }
  });
  
  return menu;
}

// Copy all highlights from current page
async function copyPageHighlights() {
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  const pageHighlights = highlights.filter(h => h.url === window.location.href);
  
  if (pageHighlights.length === 0) {
    showNotification('No highlights on this page');
    return;
  }
  
  const formattedHighlights = pageHighlights.map(h => {
    const notes = h.notes && h.notes.length > 0 ? `\nNotes: ${h.notes.join(' ')}` : '';
    return `"${h.text}"${notes}`;
  }).join('\n\n');
  
  const pageContent = `Highlights from: ${document.title}\nSource: ${window.location.href}\n\n${formattedHighlights}`;
  
  try {
    await navigator.clipboard.writeText(pageContent);
    showNotification(`Copied ${pageHighlights.length} highlights from this page!`);
  } catch (error) {
    console.error('Error copying page highlights:', error);
    showNotification('Failed to copy highlights');
  }
}

// Copy highlight with link
function copyHighlight(highlightData) {
  const textWithLink = `"${highlightData.text}" - [${highlightData.title}](${highlightData.url})`;
  navigator.clipboard.writeText(textWithLink).then(() => {
    showNotification('Copied with link!');
  });
}

// Change highlight color
async function changeHighlightColor(element, highlightData, newColor) {
  element.className = `smart-highlight smart-highlight-${newColor}`;
  element.dataset.color = newColor;
  element.style.backgroundColor = getColorValue(newColor);
  
  highlightData.color = newColor;
  await updateHighlight(highlightData);
  
  showNotification('Color changed!');
}

// Toggle project assignment
async function toggleProjectAssignment(element, highlightData, project) {
  const index = highlightData.projects.indexOf(project);
  if (index === -1) {
    highlightData.projects.push(project);
  } else {
    highlightData.projects.splice(index, 1);
  }
  
  element.dataset.projects = JSON.stringify(highlightData.projects);
  await updateHighlight(highlightData);
}

// Show note dialog
function showNoteDialog(element, highlightData) {
  const dialog = document.createElement('div');
  dialog.className = 'smart-highlight-note-dialog';
  dialog.innerHTML = `
    <div class="note-dialog-content">
      <h3>Add Note</h3>
      <textarea placeholder="Enter your note..." rows="4">${highlightData.notes ? highlightData.notes.join('\n') : ''}</textarea>
      <div class="note-dialog-buttons">
        <button class="cancel-btn" type="button">Cancel</button>
        <button class="save-btn" type="button">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  const textarea = dialog.querySelector('textarea');
  const saveBtn = dialog.querySelector('.save-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  
  textarea.focus();
  textarea.select();
  
  saveBtn.addEventListener('click', async () => {
    const note = textarea.value.trim();
    if (note) {
      highlightData.notes = [note];
      await updateHighlight(highlightData);
      showNotification('Note saved!');
    }
    dialog.remove();
  });
  
  cancelBtn.addEventListener('click', () => {
    dialog.remove();
  });
  
  // Close on escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      dialog.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // Close on outside click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
}

// Share highlight
function shareHighlight(highlightData) {
  const shareUrl = `${highlightData.url}#highlight-${highlightData.id}`;
  const shareText = `"${highlightData.text}"\n\nSource: ${shareUrl}`;
  
  navigator.clipboard.writeText(shareText).then(() => {
    showNotification('Shareable link copied!');
  });
}

// Delete highlight
async function deleteHighlight(element, highlightData) {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    const updatedHighlights = highlights.filter(h => h.id !== highlightData.id);
    await chrome.storage.sync.set({ highlights: updatedHighlights });
    
    // Remove element
    const parent = element.parentNode;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    element.remove();
    
    updatePageIndicator();
    updateBadgeCount();
    
    showNotification('Highlight deleted!');
  } catch (error) {
    console.error('Error deleting highlight:', error);
    showNotification('Failed to delete highlight');
  }
}

// Open dashboard
function openDashboard() {
  const dashboardUrl = chrome.runtime.getURL('dashboard.html');
  try {
    window.open(dashboardUrl, '_blank');
  } catch (error) {
    console.error('Error opening dashboard:', error);
    chrome.runtime.sendMessage({ action: 'openDashboard' });
  }
}

// Update highlight in storage
async function updateHighlight(highlightData) {
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  const index = highlights.findIndex(h => h.id === highlightData.id);
  
  if (index !== -1) {
    highlights[index] = highlightData;
    await chrome.storage.sync.set({ highlights });
  }
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'smart-highlight-notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// SIMPLIFIED HIGHLIGHT RESTORATION - focus on reliability over complexity
async function restoreHighlights() {
  console.log('Starting highlight restoration...');
  
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  const pageHighlights = highlights.filter(h => h.url === window.location.href);
  
  console.log(`Found ${pageHighlights.length} highlights for this page`);
  
  if (pageHighlights.length === 0) return;
  
  // Wait a bit for page to load
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  for (const highlight of pageHighlights) {
    try {
      const restored = restoreBySimpleMatch(highlight);
      if (restored) {
        console.log('Successfully restored highlight:', highlight.id);
      } else {
        console.warn('Could not restore highlight:', highlight.id, highlight.text.substring(0, 30) + '...');
      }
    } catch (e) {
      console.warn('Error restoring highlight:', highlight.id, e);
    }
  }
}

// Simple text matching restoration
function restoreBySimpleMatch(highlightData) {
  // Check if highlight already exists
  if (document.querySelector(`[data-highlight-id="${highlightData.id}"]`)) {
    return true;
  }
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement && node.parentElement.classList.contains('smart-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    const nodeText = node.textContent;
    const highlightText = highlightData.text.trim();
    
    const startIndex = nodeText.indexOf(highlightText);
    if (startIndex !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, startIndex);
        range.setEnd(node, startIndex + highlightText.length);
        
        const highlightElement = document.createElement('span');
        highlightElement.className = `smart-highlight smart-highlight-${highlightData.color}`;
        highlightElement.dataset.highlightId = highlightData.id;
        highlightElement.dataset.color = highlightData.color;
        highlightElement.dataset.projects = JSON.stringify(highlightData.projects);
        
        // Apply styles directly
        highlightElement.style.cssText = `
          background-color: ${getColorValue(highlightData.color)} !important;
          padding: 2px 4px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline;
        `;
        
        range.surroundContents(highlightElement);
        
        // Add context menu listener
        highlightElement.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showHighlightContextMenu(e, highlightElement, highlightData);
        }, true);
        
        // Add hover effect
        highlightElement.addEventListener('mouseenter', () => {
          highlightElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          highlightElement.style.transform = 'translateY(-1px)';
        });
        
        highlightElement.addEventListener('mouseleave', () => {
          highlightElement.style.boxShadow = 'none';
          highlightElement.style.transform = 'translateY(0)';
        });
        
        return true;
      } catch (error) {
        console.warn('Could not create highlight element:', error);
      }
    }
  }
  
  return false;
}

// Update page indicator
function updatePageIndicator() {
  const existingIndicator = document.querySelector('.highlight-hub-page-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  const highlights = document.querySelectorAll('.smart-highlight');
  if (highlights.length === 0) return;
  
  const indicator = document.createElement('div');
  indicator.className = 'highlight-hub-page-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s ease;
  `;
  
  indicator.innerHTML = `
    <span>${highlights.length} highlights</span>
    <button onclick="copyPageHighlights()" style="background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Copy All</button>
    <button onclick="openDashboard()" style="background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Dashboard</button>
  `;
  
  document.body.appendChild(indicator);
}

// Update badge count
function updateBadgeCount() {
  try {
    chrome.runtime.sendMessage({ action: 'updateBadge' });
  } catch (error) {
    console.warn('Could not update badge:', error);
  }
}

// Make functions globally accessible
window.copyPageHighlights = copyPageHighlights;
window.openDashboard = openDashboard;

// Hide context menu
function hideContextMenu() {
  const existingMenus = document.querySelectorAll('.smart-highlight-context-menu');
  existingMenus.forEach(menu => menu.remove());
  
  const existingToolbars = document.querySelectorAll('.smart-highlight-toolbar');
  existingToolbars.forEach(toolbar => toolbar.remove());
}
