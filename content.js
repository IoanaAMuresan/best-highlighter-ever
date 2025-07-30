// Highlight Hub - Phase 1: Foundation
// Focus: Bulletproof highlighting that works everywhere and persists

let isHighlighting = false;
let activeProjects = ['Personal'];
let colorSettings = {
  yellow: { color: 'rgba(255, 235, 59, 0.4)', label: 'Important' },
  green: { color: 'rgba(76, 175, 80, 0.4)', label: 'Ideas' },
  blue: { color: 'rgba(33, 150, 243, 0.4)', label: 'Research' },
  pink: { color: 'rgba(233, 30, 99, 0.4)', label: 'Personal' },
  orange: { color: 'rgba(255, 152, 0, 0.4)', label: 'Action Items' },
  red: { color: 'rgba(244, 67, 54, 0.4)', label: 'Urgent' },
  purple: { color: 'rgba(156, 39, 176, 0.4)', label: 'Questions' },
  gray: { color: 'rgba(158, 158, 158, 0.4)', label: 'Notes' }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  console.log('🎯 Highlight Hub: Initializing Phase 1...');
  await loadSettings();
  setupEventListeners();
  
  // Restore highlights after DOM is stable
  setTimeout(restoreHighlights, 2000);
}

// Load settings
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['activeProjects', 'colorSettings']);
    activeProjects = result.activeProjects || ['Personal'];
    if (result.colorSettings) {
      colorSettings = { ...colorSettings, ...result.colorSettings };
    }
    console.log('✅ Settings loaded');
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
}

// Setup event listeners for both drag and double-click
function setupEventListeners() {
  // Handle text selection (drag)
  document.addEventListener('mouseup', handleSelection);
  
  // Handle double-click
  document.addEventListener('dblclick', handleDoubleClick);
  
  // Hide toolbar on outside clicks
  document.addEventListener('click', hideToolbar);
  
  console.log('✅ Event listeners setup');
}

// Handle text selection (drag highlighting)
function handleSelection(e) {
  if (isHighlighting) return;
  
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      console.log('📝 Text selected:', selectedText.substring(0, 50) + '...');
      
      // Don't show toolbar if we're inside an existing highlight
      if (e.target.closest('.smart-highlight')) {
        return;
      }
      
      showColorPalette(e, selection);
    } else {
      hideToolbar();
    }
  }, 50);
}

// Handle double-click highlighting
function handleDoubleClick(e) {
  if (isHighlighting) return;
  
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      console.log('🖱️ Double-click selection:', selectedText.substring(0, 50) + '...');
      
      // Don't interfere if we're inside an existing highlight
      if (e.target.closest('.smart-highlight')) {
        return;
      }
      
      showColorPalette(e, selection);
    }
  }, 100);
}

// Show color palette
function showColorPalette(e, selection) {
  hideToolbar();
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  if (rect.width === 0 && rect.height === 0) return;
  
  const palette = document.createElement('div');
  palette.id = 'highlight-palette';
  palette.style.cssText = `
    position: fixed;
    top: ${Math.max(10, rect.top - 70)}px;
    left: ${Math.max(10, rect.left + (rect.width / 2) - 160)}px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    padding: 12px;
    z-index: 999999;
    display: flex;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: fadeInUp 0.2s ease;
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  
  // Create color buttons
  Object.entries(colorSettings).forEach(([colorName, settings]) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 36px;
      height: 36px;
      border: 3px solid white;
      border-radius: 50%;
      background: ${settings.color.replace('0.4', '1')};
      cursor: pointer;
      margin: 0;
      padding: 0;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    btn.title = settings.label;
    
    // Hover effects
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.15)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    };
    
    btn.onclick = (e) => {
      e.stopPropagation();
      createHighlight(colorName);
      hideToolbar();
    };
    
    palette.appendChild(btn);
  });
  
  document.body.appendChild(palette);
  
  // Keep palette within screen bounds
  const paletteRect = palette.getBoundingClientRect();
  if (paletteRect.right > window.innerWidth - 10) {
    palette.style.left = (window.innerWidth - paletteRect.width - 10) + 'px';
  }
  if (paletteRect.bottom > window.innerHeight - 10) {
    palette.style.top = (rect.top - paletteRect.height - 10) + 'px';
  }
  
  console.log('🎨 Color palette shown');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (palette.parentNode) {
      palette.remove();
    }
  }, 5000);
}

// Hide toolbar/palette
function hideToolbar() {
  const existing = document.getElementById('highlight-palette');
  if (existing) {
    existing.remove();
  }
}

// Create highlight - the core function
async function createHighlight(colorName) {
  if (isHighlighting) return;
  isHighlighting = true;
  
  console.log('🖍️ Creating highlight with color:', colorName);
  
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.toString().trim().length === 0) {
    isHighlighting = false;
    return;
  }
  
  try {
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    const uniqueId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create highlight element
    const highlight = document.createElement('span');
    highlight.className = `smart-highlight smart-highlight-${colorName}`;
    highlight.dataset.highlightId = uniqueId;
    highlight.dataset.color = colorName;
    highlight.dataset.text = selectedText;
    highlight.dataset.projects = JSON.stringify(activeProjects);
    
    // Apply robust styling
    const colorSetting = colorSettings[colorName];
    highlight.style.cssText = `
      background-color: ${colorSetting.color} !important;
      padding: 2px 4px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      display: inline !important;
      transition: all 0.2s ease !important;
      border: 1px solid transparent !important;
    `;
    
    // Wrap the content - try multiple methods for reliability
    let success = false;
    
    // Method 1: surroundContents (works for simple selections)
    try {
      range.surroundContents(highlight);
      success = true;
      console.log('✅ Method 1 (surroundContents) successful');
    } catch (e) {
      console.log('⚠️ Method 1 failed, trying Method 2...');
      
      // Method 2: extractContents and insert (works for complex selections)
      try {
        const contents = range.extractContents();
        highlight.appendChild(contents);
        range.insertNode(highlight);
        success = true;
        console.log('✅ Method 2 (extractContents) successful');
      } catch (e2) {
        console.log('⚠️ Method 2 failed, trying Method 3...');
        
        // Method 3: Clone and replace (nuclear option)
        try {
          const clonedContents = range.cloneContents();
          highlight.appendChild(clonedContents);
          range.deleteContents();
          range.insertNode(highlight);
          success = true;
          console.log('✅ Method 3 (clone and replace) successful');
        } catch (e3) {
          console.error('❌ All highlighting methods failed:', e3);
        }
      }
    }
    
    if (!success) {
      showNotification('Could not highlight this selection', 'error');
      isHighlighting = false;
      return;
    }
    
    // Add interactive behaviors
    setupHighlightInteractions(highlight);
    
    // Save to storage
    const highlightData = {
      id: uniqueId,
      text: selectedText,
      color: colorName,
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      timestamp: new Date().toISOString(),
      projects: [...activeProjects],
      notes: [],
      // Store context for better restoration
      context: getTextContext(highlight)
    };
    
    await saveHighlight(highlightData);
    
    // Clear selection
    selection.removeAllRanges();
    
    console.log('✅ Highlight created and saved:', uniqueId);
    showNotification(`Highlighted as ${colorSettings[colorName].label}`, 'success');
    
  } catch (error) {
    console.error('❌ Error creating highlight:', error);
    showNotification('Error creating highlight', 'error');
  }
  
  isHighlighting = false;
}

// Setup interactions for a highlight element
function setupHighlightInteractions(highlight) {
  // Hover effects
  highlight.addEventListener('mouseenter', () => {
    highlight.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    highlight.style.transform = 'translateY(-1px)';
  });
  
  highlight.addEventListener('mouseleave', () => {
    highlight.style.boxShadow = 'none';
    highlight.style.transform = 'translateY(0)';
  });
  
  // Right-click context menu
  highlight.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showHighlightContextMenu(e, highlight);
  });
  
  // Hover to show palette (requirement)
  let hoverTimeout;
  highlight.addEventListener('mouseenter', () => {
    hoverTimeout = setTimeout(() => {
      showHighlightPalette(highlight);
    }, 1000); // Show after 1 second hover
  });
  
  highlight.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    hideHighlightPalette();
  });
}

// Show palette on hover (requirement)
function showHighlightPalette(highlight) {
  hideHighlightPalette();
  
  const rect = highlight.getBoundingClientRect();
  const palette = document.createElement('div');
  palette.id = 'highlight-hover-palette';
  palette.style.cssText = `
    position: fixed;
    top: ${rect.top - 60}px;
    left: ${rect.left + (rect.width / 2) - 120}px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    padding: 8px;
    z-index: 999999;
    display: flex;
    gap: 4px;
    align-items: center;
  `;
  
  // Color change buttons
  Object.entries(colorSettings).forEach(([colorName, settings]) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 24px;
      height: 24px;
      border: 2px solid white;
      border-radius: 50%;
      background: ${settings.color.replace('0.4', '1')};
      cursor: pointer;
      margin: 0;
      padding: 0;
    `;
    btn.title = `Change to ${settings.label}`;
    btn.onclick = () => {
      changeHighlightColor(highlight, colorName);
      hideHighlightPalette();
    };
    palette.appendChild(btn);
  });
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    margin-left: 8px;
  `;
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete highlight';
  deleteBtn.onclick = () => {
    deleteHighlight(highlight);
    hideHighlightPalette();
  };
  palette.appendChild(deleteBtn);
  
  document.body.appendChild(palette);
}

// Hide hover palette
function hideHighlightPalette() {
  const existing = document.getElementById('highlight-hover-palette');
  if (existing) {
    existing.remove();
  }
}

// Show context menu for highlights
function showHighlightContextMenu(e, highlight) {
  // Remove existing menus
  document.querySelectorAll('.highlight-context-menu').forEach(m => m.remove());
  
  const menu = document.createElement('div');
  menu.className = 'highlight-context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${e.clientY}px;
    left: ${e.clientX}px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    min-width: 200px;
    overflow: hidden;
  `;
  
  const menuItems = [
    {
      text: '📋 Copy Highlight',
      action: () => copyHighlight(highlight)
    },
    {
      text: '📄 Copy All Page Highlights',
      action: () => copyAllPageHighlights()
    },
    {
      text: '📝 Add Note',
      action: () => showNoteDialog(highlight)
    },
    {
      text: '📁 Assign Project',
      action: () => showProjectDialog(highlight)
    },
    {
      text: '🗑️ Delete',
      action: () => deleteHighlight(highlight),
      danger: true
    },
    {
      text: '📊 Open Dashboard',
      action: () => openDashboard()
    }
  ];
  
  menuItems.forEach((item, index) => {
    const menuItem = document.createElement('div');
    menuItem.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: ${index < menuItems.length - 1 ? '1px solid #eee' : 'none'};
      transition: background-color 0.1s;
      ${item.danger ? 'color: #f44336;' : ''}
    `;
    menuItem.textContent = item.text;
    
    menuItem.onmouseenter = () => {
      menuItem.style.backgroundColor = item.danger ? '#ffebee' : '#f5f5f5';
    };
    menuItem.onmouseleave = () => {
      menuItem.style.backgroundColor = 'transparent';
    };
    
    menuItem.onclick = (e) => {
      e.stopPropagation();
      item.action();
      menu.remove();
    };
    
    menu.appendChild(menuItem);
  });
  
  document.body.appendChild(menu);
  
  // Position menu to stay on screen
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth - 10) {
    menu.style.left = (e.clientX - menuRect.width) + 'px';
  }
  if (menuRect.bottom > window.innerHeight - 10) {
    menu.style.top = (e.clientY - menuRect.height) + 'px';
  }
  
  // Close menu on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

// Copy highlight in the required format
function copyHighlight(highlight) {
  const text = highlight.dataset.text;
  const pageTitle = document.title;
  const pageUrl = window.location.href;
  const formatted = `"${text}" / ${pageTitle} / ${pageUrl}`;
  
  navigator.clipboard.writeText(formatted).then(() => {
    showNotification('Highlight copied to clipboard!', 'success');
  }).catch(() => {
    showNotification('Failed to copy highlight', 'error');
  });
}

// Copy all page highlights
async function copyAllPageHighlights() {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    const pageHighlights = highlights.filter(h => h.url === window.location.href);
    
    if (pageHighlights.length === 0) {
      showNotification('No highlights on this page', 'info');
      return;
    }
    
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    const formatted = pageHighlights.map(h => 
      `"${h.text}" / ${pageTitle} / ${pageUrl}`
    ).join('\n\n');
    
    await navigator.clipboard.writeText(formatted);
    showNotification(`Copied ${pageHighlights.length} highlights!`, 'success');
  } catch (error) {
    console.error('Error copying page highlights:', error);
    showNotification('Failed to copy highlights', 'error');
  }
}

// Change highlight color
async function changeHighlightColor(highlight, newColor) {
  const oldColor = highlight.dataset.color;
  
  // Update element
  highlight.className = `smart-highlight smart-highlight-${newColor}`;
  highlight.dataset.color = newColor;
  highlight.style.backgroundColor = colorSettings[newColor].color;
  
  // Update storage
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    const index = highlights.findIndex(h => h.id === highlight.dataset.highlightId);
    
    if (index !== -1) {
      highlights[index].color = newColor;
      await chrome.storage.sync.set({ highlights });
      
      showNotification(`Changed to ${colorSettings[newColor].label}`, 'success');
      console.log('✅ Highlight color changed:', oldColor, '->', newColor);
    }
  } catch (error) {
    console.error('❌ Error changing highlight color:', error);
    showNotification('Failed to change color', 'error');
  }
}

// Delete highlight
async function deleteHighlight(highlight) {
  try {
    // Remove from storage
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    const updatedHighlights = highlights.filter(h => h.id !== highlight.dataset.highlightId);
    await chrome.storage.sync.set({ highlights: updatedHighlights });
    
    // Remove from page
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    highlight.remove();
    
    showNotification('Highlight deleted', 'success');
    console.log('✅ Highlight deleted:', highlight.dataset.highlightId);
  } catch (error) {
    console.error('❌ Error deleting highlight:', error);
    showNotification('Failed to delete highlight', 'error');
  }
}

// Get text context for better restoration
function getTextContext(element) {
  try {
    const parent = element.parentElement;
    if (!parent) return null;
    
    const parentText = parent.textContent;
    const highlightText = element.textContent;
    const index = parentText.indexOf(highlightText);
    
    if (index === -1) return null;
    
    return {
      before: parentText.substring(Math.max(0, index - 50), index),
      after: parentText.substring(index + highlightText.length, index + highlightText.length + 50),
      parentTag: parent.tagName,
      parentClass: parent.className,
      parentId: parent.id
    };
  } catch (error) {
    return null;
  }
}

// Save highlight to storage
async function saveHighlight(highlightData) {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    highlights.push(highlightData);
    await chrome.storage.sync.set({ highlights });
    console.log('✅ Highlight saved to storage');
  } catch (error) {
    console.error('❌ Error saving highlight:', error);
    throw error;
  }
}

// Restore highlights on page load
async function restoreHighlights() {
  console.log('🔄 Restoring highlights...');
  
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    const pageHighlights = highlights.filter(h => h.url === window.location.href);
    
    console.log(`Found ${pageHighlights.length} highlights for this page`);
    
    if (pageHighlights.length === 0) return;
    
    let restored = 0;
    for (const highlightData of pageHighlights) {
      if (await restoreHighlight(highlightData)) {
        restored++;
      }
    }
    
    console.log(`✅ Restored ${restored}/${pageHighlights.length} highlights`);
    
    if (restored > 0) {
      showNotification(`Restored ${restored} highlights`, 'success');
    }
  } catch (error) {
    console.error('❌ Error restoring highlights:', error);
  }
}

// Restore individual highlight
async function restoreHighlight(highlightData) {
  // Check if already exists
  if (document.querySelector(`[data-highlight-id="${highlightData.id}"]`)) {
    return true;
  }
  
  // Simple text matching approach
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if already highlighted
        if (node.parentElement && node.parentElement.classList.contains('smart-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let textNode;
  while (textNode = walker.nextNode()) {
    const nodeText = textNode.textContent;
    const highlightText = highlightData.text;
    const index = nodeText.indexOf(highlightText);
    
    if (index !== -1) {
      try {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + highlightText.length);
        
        const highlight = document.createElement('span');
        highlight.className = `smart-highlight smart-highlight-${highlightData.color}`;
        highlight.dataset.highlightId = highlightData.id;
        highlight.dataset.color = highlightData.color;
        highlight.dataset.text = highlightText;
        highlight.dataset.projects = JSON.stringify(highlightData.projects || []);
        
        // Apply styling
        const colorSetting = colorSettings[highlightData.color];
        if (colorSetting) {
          highlight.style.cssText = `
            background-color: ${colorSetting.color} !important;
            padding: 2px 4px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            display: inline !important;
            transition: all 0.2s ease !important;
          `;
        }
        
        range.surroundContents(highlight);
        setupHighlightInteractions(highlight);
        
        console.log('✅ Restored highlight:', highlightData.id);
        return true;
      } catch (error) {
        console.warn('⚠️ Could not restore highlight:', error);
      }
    }
  }
  
  return false;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  const colors = {
    success: '#4caf50',
    error: '#f44336',
    info: '#2196f3',
    warning: '#ff9800'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: slideInRight 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Placeholder functions for later phases
function showNoteDialog(highlight) {
  showNotification('Note dialog - coming in Phase 2!', 'info');
}

function showProjectDialog(highlight) {
  showNotification('Project dialog - coming in Phase 2!', 'info');
}

function openDashboard() {
  const url = chrome.runtime.getURL('dashboard.html');
  window.open(url, '_blank');
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'restoreHighlights':
      restoreHighlights();
      break;
    case 'highlightSelection':
      if (request.color) {
        createHighlight(request.color);
      }
      break;
  }
});

console.log('🎯 Highlight Hub Phase 1 loaded - Foundation ready!');
