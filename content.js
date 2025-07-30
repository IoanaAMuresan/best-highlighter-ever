// Highlight Hub Content Script
let highlightId = 0;
let activeProjects = [];
let colorSchemes = {};
let isHighlighting = false;
let selectedText = null;
let selectedRange = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  await loadSettings();
  setupEventListeners();
  restoreHighlights();
  updatePageIndicator();
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
      restoreHighlights();
      break;
  }
});

// Handle keyboard shortcuts
function handleKeyboardHighlight() {
  const selection = window.getSelection();
  if (selection.toString().trim().length > 0) {
    highlightSelection('yellow'); // Default to yellow for keyboard shortcut
  }
}

function handleKeyboardNote() {
  const selection = window.getSelection();
  if (selection.toString().trim().length > 0) {
    // Create highlight first, then add note
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

async function init() {
  await loadSettings();
  setupEventListeners();
  restoreHighlights();
}

// Load user settings and projects
async function loadSettings() {
  const result = await chrome.storage.sync.get(['projects', 'colorSchemes', 'activeProjects']);
  
  // Default projects if none exist
  if (!result.projects) {
    const defaultProjects = ['Home', 'Work', 'Side Project'];
    await chrome.storage.sync.set({ projects: defaultProjects });
    activeProjects = ['Home']; // Default active project
  } else {
    activeProjects = result.activeProjects || [result.projects[0]];
  }
  
  // Default color schemes if none exist
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

// Setup event listeners
function setupEventListeners() {
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('click', hideContextMenu);
}

// Handle text selection
function handleTextSelection(e) {
  // Small delay to avoid conflicts with double-click
  setTimeout(() => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      showHighlightOptions(e, selection);
    }
  }, 50);
}

// Show highlight options after text selection
function showHighlightOptions(e, selection) {
  // Remove any existing toolbars first
  const existingToolbars = document.querySelectorAll('.smart-highlight-toolbar');
  existingToolbars.forEach(toolbar => toolbar.remove());
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Create floating toolbar
  const toolbar = createHighlightToolbar();
  toolbar.style.left = `${rect.left + window.scrollX}px`;
  toolbar.style.top = `${rect.top + window.scrollY - 40}px`;
  
  document.body.appendChild(toolbar);
  
  // Auto-remove after 3 seconds if not used
  setTimeout(() => {
    if (toolbar.parentNode) {
      toolbar.remove();
    }
  }, 3000);
}

// Create highlight toolbar
function createHighlightToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'smart-highlight-toolbar';
  toolbar.innerHTML = `
    <div class="highlight-colors">
      <button class="color-btn" data-color="yellow" style="background: #ffeb3b"></button>
      <button class="color-btn" data-color="green" style="background: #4caf50"></button>
      <button class="color-btn" data-color="blue" style="background: #2196f3"></button>
      <button class="color-btn" data-color="pink" style="background: #e91e63"></button>
      <button class="color-btn" data-color="orange" style="background: #ff9800"></button>
      <button class="color-btn" data-color="red" style="background: #f44336"></button>
      <button class="color-btn" data-color="purple" style="background: #9c27b0"></button>
      <button class="color-btn" data-color="gray" style="background: #9e9e9e"></button>
    </div>
  `;
  
  // Add click handlers for colors
  toolbar.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = btn.dataset.color;
      highlightSelection(color);
      toolbar.remove();
    });
  });
  
  return toolbar;
}

// Highlight selected text
async function highlightSelection(color) {
  const selection = window.getSelection();
  if (selection.toString().trim().length === 0) return null;
  
  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  
  // Create highlight element
  const highlightElement = document.createElement('span');
  highlightElement.className = `smart-highlight smart-highlight-${color}`;
  highlightElement.dataset.highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  highlightElement.dataset.color = color;
  highlightElement.dataset.projects = JSON.stringify(activeProjects);
  
  try {
    range.surroundContents(highlightElement);
  } catch (e) {
    // Fallback for complex selections that span multiple elements
    try {
      const contents = range.extractContents();
      highlightElement.appendChild(contents);
      range.insertNode(highlightElement);
    } catch (e2) {
      // Last resort: create multiple highlights for each text node in the selection
      try {
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          }
        );
        
        let textNode;
        const textNodes = [];
        while (textNode = walker.nextNode()) {
          if (range.intersectsNode(textNode)) {
            textNodes.push(textNode);
          }
        }
        
        // Highlight each text node separately
        textNodes.forEach((textNode, index) => {
          const nodeRange = document.createRange();
          const nodeText = textNode.textContent;
          const fullText = selectedText;
          
          // Find the portion of this text node that's part of our selection
          let startOffset = 0;
          let endOffset = nodeText.length;
          
          if (textNode === range.startContainer) {
            startOffset = range.startOffset;
          }
          if (textNode === range.endContainer) {
            endOffset = range.endOffset;
          }
          
          nodeRange.setStart(textNode, startOffset);
          nodeRange.setEnd(textNode, endOffset);
          
          const nodeHighlight = document.createElement('span');
          nodeHighlight.className = `smart-highlight smart-highlight-${color}`;
          nodeHighlight.dataset.highlightId = `${highlightElement.dataset.highlightId}-part${index}`;
          nodeHighlight.dataset.color = color;
          nodeHighlight.dataset.projects = JSON.stringify(activeProjects);
          nodeHighlight.dataset.parentId = highlightElement.dataset.highlightId;
          
          try {
            nodeRange.surroundContents(nodeHighlight);
          } catch (e3) {
            console.warn('Could not highlight text node:', e3);
          }
        });
        
        console.log('Created multi-part highlight for complex selection');
      } catch (e3) {
        console.error('All highlighting methods failed:', e3);
        showNotification('Could not highlight this selection');
        selection.removeAllRanges();
        return null;
      }
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
    xpath: getXPath(highlightElement),
    notes: []
  };
  
  await saveHighlight(highlightData);
  
  // Add context menu listener with higher priority
  highlightElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showHighlightContextMenu(e, highlightElement, highlightData);
  }, true); // Use capture phase
  
  selection.removeAllRanges();
  updatePageIndicator();
  updateBadgeCount();
  
  return highlightData;
}

// Generate XPath for element location
function getXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = element.previousSibling;
    
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    
    const tagName = element.nodeName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    element = element.parentNode;
  }
  
  return '/' + parts.join('/');
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
  const currentColorLabel = currentColors[highlightData.color] || highlightData.color;
  
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
      // Update the menu item
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
          console.log('Opening dashboard from context menu');
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

// Update page indicator
function copyHighlight(highlightData) {
  const textWithLink = `"${highlightData.text}" - [${highlightData.title}](${highlightData.url})`;
  navigator.clipboard.writeText(textWithLink).then(() => {
    showNotification('Copied with link!');
  });
}

// Change highlight color
async function changeHighlightColor(element, highlightData, newColor) {
  // Update element classes
  element.className = `smart-highlight smart-highlight-${newColor}`;
  element.dataset.color = newColor;
  
  // Update stored data
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
      highlightData.notes = [note]; // Replace existing notes for now
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

// Share highlight - now just copies shareable link
function shareHighlight(highlightData) {
  const shareUrl = `${highlightData.url}#highlight-${highlightData.id}`;
  const shareText = `"${highlightData.text}"\n\nSource: ${shareUrl}`;
  
  navigator.clipboard.writeText(shareText).then(() => {
    showNotification('Shareable link copied!');
  });
}

// Delete highlight - no confirmation
async function deleteHighlight(element, highlightData) {
  try {
    // Remove from storage
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
    
    // Update indicators (with error handling)
    try {
      updatePageIndicator();
      updateBadgeCount();
    } catch (e) {
      console.warn('Could not update indicators:', e);
    }
    
    showNotification('Highlight deleted!');
  } catch (error) {
    console.error('Error deleting highlight:', error);
    showNotification('Failed to delete highlight');
  }
}

// Open dashboard
function openDashboard() {
  try {
    // Use chrome.runtime API to open dashboard in new tab
    chrome.runtime.sendMessage({ action: 'openDashboard' }, () => {
      if (chrome.runtime.lastError) {
        // Fallback: try direct approach
        const dashboardUrl = chrome.runtime.getURL('dashboard.html');
        window.open(dashboardUrl, '_blank');
      }
    });
  } catch (error) {
    console.error('Error opening dashboard:', error);
    // Last resort fallback
    try {
      const dashboardUrl = chrome.runtime.getURL('dashboard.html');
      window.open(dashboardUrl, '_blank');
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
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

// Restore highlights on page load
async function restoreHighlights() {
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  const pageHighlights = highlights.filter(h => h.url === window.location.href);
  
  for (const highlight of pageHighlights) {
    try {
      await restoreHighlight(highlight);
    } catch (e) {
      console.warn('Could not restore highlight:', highlight.id, e);
    }
  }
}

// Restore individual highlight using text matching
async function restoreHighlight(highlightData) {
  // Wait a bit for page to fully load
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simple text matching restoration
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip if parent is already a highlight
        if (node.parentElement && node.parentElement.classList.contains('smart-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );
  
  const textNodes = [];
  let node;
  
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Look for text nodes that contain our highlight text
  for (const textNode of textNodes) {
    const nodeText = textNode.textContent;
    const highlightText = highlightData.text.trim();
    
    if (nodeText.includes(highlightText)) {
      try {
        const startIndex = nodeText.indexOf(highlightText);
        if (startIndex !== -1) {
          // Create range for the exact text
          const range = document.createRange();
          range.setStart(textNode, startIndex);
          range.setEnd(textNode, startIndex + highlightText.length);
          
          // Create highlight element
          const highlightElement = document.createElement('span');
          highlightElement.className = `smart-highlight smart-highlight-${highlightData.color}`;
          highlightElement.dataset.highlightId = highlightData.id;
          highlightElement.dataset.color = highlightData.color;
          highlightElement.dataset.projects = JSON.stringify(highlightData.projects);
          
          try {
            range.surroundContents(highlightElement);
            
            // Add context menu listener with higher priority
            highlightElement.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              showHighlightContextMenu(e, highlightElement, highlightData);
            }, true); // Use capture phase
            
            console.log('Restored highlight:', highlightData.id);
            return; // Successfully restored, stop looking
          } catch (e) {
            console.warn('Could not surround contents for highlight:', highlightData.id, e);
            
            // Try alternative approach - extract and wrap
            try {
              const contents = range.extractContents();
              highlightElement.appendChild(contents);
              range.insertNode(highlightElement);
              
              // Add context menu listener with higher priority
              highlightElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                showHighlightContextMenu(e, highlightElement, highlightData);
              }, true); // Use capture phase
              
              console.log('Restored highlight (alternative method):', highlightData.id);
              return;
            } catch (e2) {
              console.warn('Alternative method also failed:', e2);
            }
          }
        }
      } catch (e) {
        console.warn('Error processing text node for highlight:', highlightData.id, e);
      }
    }
  }
  
  console.warn('Could not find text to restore highlight:', highlightData.id, highlightData.text);
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
function hideContextMenu() {
  const existingMenus = document.querySelectorAll('.smart-highlight-context-menu');
  existingMenus.forEach(menu => menu.remove());
  
  const existingToolbars = document.querySelectorAll('.smart-highlight-toolbar');
  existingToolbars.forEach(toolbar => toolbar.remove());
}
