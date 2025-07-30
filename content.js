// Highlight Hub Content Script - Fixed Double-Click Issue
let highlightId = 0;
let activeProjects = [];
let colorSchemes = {};
let isHighlighting = false;
let selectedText = null;
let selectedRange = null;
let lastSelectionTime = 0;
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

// Setup event listeners with proper double-click handling
function setupEventListeners() {
  // Use selectionchange event to handle text selection more reliably
  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('dblclick', handleDoubleClick);
}

// Handle double-click to prevent interference
function handleDoubleClick(e) {
  // Clear any pending selection handlers
  clearTimeout(selectionTimeout);
  
  // Hide any existing toolbars
  hideContextMenu();
  
  // Prevent the selection change handler from running
  lastSelectionTime = Date.now();
  
  // Small delay to let the double-click selection settle
  setTimeout(() => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      // Check if selection is inside an existing highlight
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      
      if (parentElement.closest('.smart-highlight')) {
        // Don't show toolbar if inside existing highlight
        return;
      }
      
      showHighlightOptions(e, selection);
    }
  }, 100);
}

// Handle selection changes with debouncing
function handleSelectionChange() {
  const now = Date.now();
  
  // Ignore rapid selection changes (likely from double-click)
  if (now - lastSelectionTime < 200) {
    return;
  }
  
  // Clear existing timeout
  clearTimeout(selectionTimeout);
  
  // Debounce selection handling
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      // Check if we're selecting within an existing highlight
      try {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        
        // Don't show toolbar if selecting within an existing highlight
        if (parentElement.closest('.smart-highlight')) {
          return;
        }
        
        // Create a synthetic event for positioning
        const rect = range.getBoundingClientRect();
        const syntheticEvent = {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top,
          pageX: rect.left + rect.width / 2 + window.scrollX,
          pageY: rect.top + window.scrollY
        };
        
        showHighlightOptions(syntheticEvent, selection);
      } catch (e) {
        console.warn('Error handling selection:', e);
      }
    } else {
      // Hide toolbar when no selection
      hideContextMenu();
    }
  }, 150);
}

// Show highlight options after text selection
function showHighlightOptions(e, selection) {
  // Remove any existing toolbars first
  hideContextMenu();
  
  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Make sure we have a valid selection
    if (rect.width === 0 && rect.height === 0) {
      return;
    }
    
    // Create floating toolbar
    const toolbar = createHighlightToolbar();
    toolbar.style.left = `${rect.left + window.scrollX}px`;
    toolbar.style.top = `${rect.top + window.scrollY - 50}px`;
    
    // Ensure toolbar is visible on screen
    const toolbarRect = toolbar.getBoundingClientRect();
    if (toolbarRect.right > window.innerWidth) {
      toolbar.style.left = `${window.innerWidth - toolbarRect.width - 10 + window.scrollX}px`;
    }
    if (toolbarRect.top < 0) {
      toolbar.style.top = `${rect.bottom + window.scrollY + 10}px`;
    }
    
    document.body.appendChild(toolbar);
    
    // Auto-remove after 4 seconds if not used
    setTimeout(() => {
      if (toolbar.parentNode) {
        toolbar.remove();
      }
    }, 4000);
  } catch (error) {
    console.warn('Error showing highlight options:', error);
  }
}

// Create highlight toolbar
function createHighlightToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'smart-highlight-toolbar';
  toolbar.innerHTML = `
    <div class="highlight-colors">
      <button class="color-btn" data-color="yellow" style="background: #ffeb3b" title="Important"></button>
      <button class="color-btn" data-color="green" style="background: #4caf50" title="Ideas"></button>
      <button class="color-btn" data-color="blue" style="background: #2196f3" title="Research"></button>
      <button class="color-btn" data-color="pink" style="background: #e91e63" title="Personal"></button>
      <button class="color-btn" data-color="orange" style="background: #ff9800" title="Action Items"></button>
      <button class="color-btn" data-color="red" style="background: #f44336" title="Urgent"></button>
      <button class="color-btn" data-color="purple" style="background: #9c27b0" title="Questions"></button>
      <button class="color-btn" data-color="gray" style="background: #9e9e9e" title="Notes"></button>
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
  
  try {
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    // Check if selection spans existing highlights
    if (selectionSpansHighlights(range)) {
      showNotification('Cannot highlight across existing highlights');
      selection.removeAllRanges();
      return null;
    }
    
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
      try {
        const contents = range.extractContents();
        highlightElement.appendChild(contents);
        range.insertNode(highlightElement);
      } catch (e2) {
        console.warn('Could not highlight this selection:', e2);
        showNotification('Could not highlight this selection');
        selection.removeAllRanges();
        return null;
      }
    }
    
    // Save highlight data with improved context
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
    
    selection.removeAllRanges();
    updatePageIndicator();
    updateBadgeCount();
    
    return highlightData;
  } catch (error) {
    console.error('Error highlighting selection:', error);
    showNotification('Error creating highlight');
    return null;
  }
}

// Check if selection spans existing highlights
function selectionSpansHighlights(range) {
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        return range.intersectsNode(node) && node.classList.contains('smart-highlight') 
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  return walker.nextNode() !== null;
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

// IMPROVED HIGHLIGHT RESTORATION SYSTEM
async function restoreHighlights() {
  console.log('Starting highlight restoration...');
  
  const result = await chrome.storage.sync.get(['highlights']);
  const highlights = result.highlights || [];
  const pageHighlights = highlights.filter(h => h.url === window.location.href);
  
  console.log(`Found ${pageHighlights.length} highlights for this page`);
  
  if (pageHighlights.length === 0) return;
  
  // Wait for page to be fully loaded and stable
  await waitForPageStability();
  
  for (const highlight of pageHighlights) {
    try {
      const restored = await attemptRestore(highlight);
      if (restored) {
        console.log('Successfully restored highlight:', highlight.id);
      } else {
        console.warn('Could not restore highlight:', highlight.id, highlight.text.substring(0, 50) + '...');
      }
    } catch (e) {
      console.warn('Error restoring highlight:', highlight.id, e);
    }
  }
}

// Wait for page to be stable
function waitForPageStability() {
  return new Promise((resolve) => {
    let stabilityTimer;
    let lastHeight = document.body.scrollHeight;
    
    function checkStability() {
      const currentHeight = document.body.scrollHeight;
      if (currentHeight === lastHeight) {
        clearTimeout(stabilityTimer);
        resolve();
      } else {
        lastHeight = currentHeight;
        stabilityTimer = setTimeout(checkStability, 500);
      }
    }
    
    setTimeout(checkStability, 1000);
    setTimeout(resolve, 5000); // Force resolve after 5 seconds max
  });
}

// Attempt to restore highlight using multiple strategies
async function attemptRestore(highlightData) {
  // Check if highlight already exists
  if (document.querySelector(`[data-highlight-id="${highlightData.id}"]`)) {
    return true;
  }
  
  const strategies = [
    () => restoreByExactMatch(highlightData),
    () => restoreByFuzzyMatch(highlightData),
    () => restoreByContext(highlightData),
    () => restoreByPartialMatch(highlightData)
  ];
  
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result) return true;
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  return false;
}

// Strategy 1: Exact text match
function restoreByExactMatch(highlightData) {
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
      return createHighlightElement(node, startIndex, highlightText.length, highlightData);
    }
  }
  
  return false;
}

// Strategy 2: Fuzzy match (ignoring extra whitespace, punctuation)
function restoreByFuzzyMatch(highlightData) {
  const normalizeText = (text) => {
    return text.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').toLowerCase().trim();
  };
  
  const targetNormalized = normalizeText(highlightData.text);
  
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
    const nodeNormalized = normalizeText(node.textContent);
    
    if (nodeNormalized.includes(targetNormalized)) {
      const originalText = highlightData.text.trim();
      const startIndex = node.textContent.toLowerCase().indexOf(originalText.toLowerCase());
      if (startIndex !== -1) {
        return createHighlightElement(node, startIndex, originalText.length, highlightData);
      }
    }
  }
  
  return false;
}

// Strategy 3: Context-based matching
function restoreByContext(highlightData) {
  if (!highlightData.context) return false;
  
  const { before, after, parentTag, parentClass, parentId } = highlightData.context;
  
  let candidates = [];
  
  if (parentId) {
    const element = document.getElementById(parentId);
    if (element) candidates.push(element);
  }
  
  if (parentClass && candidates.length === 0) {
    candidates = Array.from(document.getElementsByClassName(parentClass));
  }
  
  if (candidates.length === 0) {
    candidates = Array.from(document.getElementsByTagName(parentTag || 'p'));
  }
  
  for (const candidate of candidates) {
    const candidateText = candidate.textContent;
    const targetText = highlightData.text.trim();
    
    if (candidateText.includes(targetText)) {
      const textIndex = candidateText.indexOf(targetText);
      const beforeContext = candidateText.substring(Math.max(0, textIndex - 50), textIndex);
      const afterContext = candidateText.substring(textIndex + targetText.length, textIndex + targetText.length + 50);
      
      const beforeMatch = !before || beforeContext.includes(before.substring(-20)) || before.includes(beforeContext.substring(-20));
      const afterMatch = !after || afterContext.includes(after.substring(0, 20)) || after.includes(afterContext.substring(0, 20));
      
      if (beforeMatch && afterMatch) {
        const textNodes = getTextNodes(candidate);
        for (const textNode of textNodes) {
          const nodeText = textNode.textContent;
          const startIndex = nodeText.indexOf(targetText);
          if (startIndex !== -1) {
            return createHighlightElement(textNode, startIndex, targetText.length, highlightData);
          }
        }
      }
    }
  }
  
  return false;
}

// Strategy 4: Partial match (for truncated text)
function restoreByPartialMatch(highlightData) {
  const originalText = highlightData.text.trim();
  const minLength = Math.min(20, Math.floor(originalText.length * 0.7));
  
  if (originalText.length < minLength) return false;
  
  const searchText = originalText.substring(0, minLength);
  
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
    const startIndex = nodeText.toLowerCase().indexOf(searchText.toLowerCase());
    
    if (startIndex !== -1) {
      let endIndex = startIndex + searchText.length;
      while (endIndex < nodeText.length && endIndex - startIndex < originalText.length * 1.2) {
        const currentMatch = nodeText.substring(startIndex, endIndex);
        if (currentMatch.toLowerCase().includes(originalText.toLowerCase()) || 
            originalText.toLowerCase().includes(currentMatch.toLowerCase())) {
          endIndex++;
        } else {
          break;
        }
      }
      
      const matchedText = nodeText.substring(startIndex, endIndex - 1);
      if (matchedText.length >= minLength) {
        return createHighlightElement(node, startIndex, matchedText.length, highlightData);
      }
    }
  }
  
  return false;
}

// Helper function to get all text nodes in an element
function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
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
    textNodes.push(node);
  }
  
  return textNodes;
}

// Create highlight element from text node and position
function createHighlightElement(textNode, startIndex, length, highlightData) {
  try {
    const range = document.createRange();
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, startIndex + length);
    
    const highlightElement = document.createElement('span');
    highlightElement.className = `smart-highlight smart-highlight-${highlightData.color}`;
    highlightElement.dataset.highlightId = highlightData.id;
    highlightElement.dataset.color = highlightData.color;
    highlightElement.dataset.projects = JSON.stringify(highlightData.projects);
    
    range.surroundContents(highlightElement);
    
    // Add context menu listener
    highlightElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showHighlightContextMenu(e, highlightElement, highlightData);
    }, true);
    
    return true;
  } catch (error) {
    console.warn('Could not create highlight element:', error);
    return false;
  }
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
  indicator.innerHTML = `
    <span>${highlights.length} highlights</span>
    <button onclick="copyPageHighlights()">Copy All</button>
    <button onclick="openDashboard()">Dashboard</button>
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
