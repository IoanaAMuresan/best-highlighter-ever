// Smart Highlighter Content Script
let highlightId = 0;
let activeProjects = [];
let colorSchemes = {};
let isHighlighting = false;

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
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('click', hideContextMenu);
}

// Handle text selection
function handleTextSelection(e) {
  const selection = window.getSelection();
  if (selection.toString().trim().length > 0) {
    showHighlightOptions(e, selection);
  }
}

// Show highlight options after text selection
function showHighlightOptions(e, selection) {
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
  if (selection.toString().trim().length === 0) return;
  
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
    // Fallback for complex selections
    const contents = range.extractContents();
    highlightElement.appendChild(contents);
    range.insertNode(highlightElement);
  }
  
  // Save highlight data
  const highlightData = {
    id: highlightElement.dataset.highlightId,
    text: selectedText,
    color: color,
    projects: activeProjects.slice(),
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    xpath: getXPath(highlightElement),
    notes: []
  };
  
  await saveHighlight(highlightData);
  
  // Add context menu listener
  highlightElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showHighlightContextMenu(e, highlightElement, highlightData);
  });
  
  selection.removeAllRanges();
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
  const result = await chrome.storage.local.get(['highlights']);
  const highlights = result.highlights || [];
  highlights.push(highlightData);
  await chrome.storage.local.set({ highlights });
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
    <div class="menu-item" data-action="share">
      <span>📤</span> Send
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
        case 'note':
          showNoteDialog(element, highlightData);
          menu.remove();
          break;
        case 'share':
          shareHighlight(highlightData);
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

// Copy highlight text
function copyHighlight(highlightData) {
  navigator.clipboard.writeText(highlightData.text).then(() => {
    showNotification('Copied to clipboard!');
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
      <textarea placeholder="Enter your note..." rows="4">${highlightData.notes.join('\n')}</textarea>
      <div class="note-dialog-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="save-btn">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  const textarea = dialog.querySelector('textarea');
  const saveBtn = dialog.querySelector('.save-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  
  textarea.focus();
  
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
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      dialog.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

// Share highlight
function shareHighlight(highlightData) {
  const shareUrl = `${highlightData.url}#highlight-${highlightData.id}`;
  const subject = `Check out this highlight from "${highlightData.title}"`;
  const body = `"${highlightData.text}"\n\nSource: ${shareUrl}`;
  
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl);
}

// Delete highlight
async function deleteHighlight(element, highlightData) {
  if (confirm('Delete this highlight?')) {
    // Remove from storage
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || [];
    const updatedHighlights = highlights.filter(h => h.id !== highlightData.id);
    await chrome.storage.local.set({ highlights: updatedHighlights });
    
    // Remove element
    const parent = element.parentNode;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    element.remove();
    
    showNotification('Highlight deleted!');
  }
}

// Update highlight in storage
async function updateHighlight(highlightData) {
  const result = await chrome.storage.local.get(['highlights']);
  const highlights = result.highlights || [];
  const index = highlights.findIndex(h => h.id === highlightData.id);
  
  if (index !== -1) {
    highlights[index] = highlightData;
    await chrome.storage.local.set({ highlights });
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
  const result = await chrome.storage.local.get(['highlights']);
  const highlights = result.highlights || [];
  const pageHighlights = highlights.filter(h => h.url === window.location.href);
  
  for (const highlight of pageHighlights) {
    try {
      restoreHighlight(highlight);
    } catch (e) {
      console.warn('Could not restore highlight:', highlight.id, e);
    }
  }
}

// Restore individual highlight
function restoreHighlight(highlightData) {
  // This is a simplified restoration - in practice, you'd need more sophisticated text matching
  // For now, we'll skip restoration and focus on new highlights
  // TODO: Implement robust highlight restoration using text matching algorithms
}

// Hide context menu
function hideContextMenu() {
  const existingMenus = document.querySelectorAll('.smart-highlight-context-menu');
  existingMenus.forEach(menu => menu.remove());
  
  const existingToolbars = document.querySelectorAll('.smart-highlight-toolbar');
  existingToolbars.forEach(toolbar => toolbar.remove());
}
