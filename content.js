// Highlight Hub - Debug Version - Focus on Palette
// Simplified to get basic functionality working

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
  console.log('🎯 Highlight Hub: Debug version loading...');
  setupEventListeners();
  
  // Test notification
  setTimeout(() => {
    showNotification('Highlight Hub loaded!', 'success');
  }, 1000);
}

// Simple event listeners
function setupEventListeners() {
  // Handle text selection
  document.addEventListener('mouseup', handleSelection);
  
  // Hide palette on clicks
  document.addEventListener('click', hidePalette);
  
  console.log('✅ Event listeners setup');
}

// Handle text selection
function handleSelection(e) {
  console.log('🖱️ Mouse up detected');
  
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    console.log('📝 Selection:', selectedText.length, 'characters:', selectedText.substring(0, 50));
    
    if (selectedText.length > 0) {
      console.log('🎨 Showing palette...');
      showPalette(e, selection);
    } else {
      console.log('❌ No selection, hiding palette');
      hidePalette();
    }
  }, 50);
}

// Show palette - simplified version
function showPalette(e, selection) {
  // Remove existing palette
  hidePalette();
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  console.log('📐 Selection rect:', rect);
  
  if (rect.width === 0 && rect.height === 0) {
    console.log('❌ Invalid selection rect');
    return;
  }
  
  // Create palette
  const palette = document.createElement('div');
  palette.id = 'highlight-palette-debug';
  
  // Simple, visible styling
  palette.style.cssText = `
    position: fixed;
    top: ${rect.top - 60}px;
    left: ${rect.left}px;
    background: white;
    border: 3px solid red;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    padding: 15px;
    z-index: 999999;
    display: flex;
    gap: 10px;
    font-family: Arial, sans-serif;
  `;
  
  console.log('🎨 Creating color buttons...');
  
  // Create simple color buttons
  const colors = ['yellow', 'green', 'blue', 'red', 'orange'];
  colors.forEach(colorName => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 40px;
      height: 40px;
      border: 3px solid black;
      border-radius: 50%;
      background: ${colorName};
      cursor: pointer;
      margin: 0;
      padding: 0;
    `;
    btn.title = colorName;
    
    btn.onclick = (e) => {
      e.stopPropagation();
      console.log('🖍️ Color button clicked:', colorName);
      createHighlight(colorName);
      hidePalette();
    };
    
    palette.appendChild(btn);
  });
  
  // Add to page
  document.body.appendChild(palette);
  
  console.log('✅ Palette added to page');
  
  // Keep on screen
  const paletteRect = palette.getBoundingClientRect();
  if (paletteRect.right > window.innerWidth - 10) {
    palette.style.left = (window.innerWidth - paletteRect.width - 10) + 'px';
  }
  if (paletteRect.top < 10) {
    palette.style.top = (rect.bottom + 10) + 'px';
  }
  
  console.log('✅ Palette positioned');
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (palette.parentNode) {
      console.log('⏰ Auto-hiding palette');
      palette.remove();
    }
  }, 10000);
}

// Hide palette
function hidePalette() {
  const existing = document.getElementById('highlight-palette-debug');
  if (existing) {
    console.log('🚫 Hiding palette');
    existing.remove();
  }
}

// Create highlight - simplified
async function createHighlight(colorName) {
  if (isHighlighting) return;
  isHighlighting = true;
  
  console.log('🖍️ Creating highlight with color:', colorName);
  
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.toString().trim().length === 0) {
    console.log('❌ No valid selection');
    isHighlighting = false;
    return;
  }
  
  try {
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    const uniqueId = `highlight-${Date.now()}`;
    
    console.log('📝 Selected text:', selectedText);
    
    // Create highlight element
    const highlight = document.createElement('span');
    highlight.className = `smart-highlight smart-highlight-${colorName}`;
    highlight.dataset.highlightId = uniqueId;
    highlight.dataset.color = colorName;
    highlight.dataset.text = selectedText;
    
    // Simple styling
    const colorMap = {
      yellow: '#ffeb3b',
      green: '#4caf50',
      blue: '#2196f3',
      red: '#f44336',
      orange: '#ff9800'
    };
    
    highlight.style.cssText = `
      background-color: ${colorMap[colorName]} !important;
      padding: 3px 6px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      display: inline !important;
      opacity: 0.7 !important;
    `;
    
    // Try to wrap content
    try {
      range.surroundContents(highlight);
      console.log('✅ Surrounded contents successfully');
    } catch (e) {
      console.log('⚠️ SurroundContents failed, trying alternative...');
      const contents = range.extractContents();
      highlight.appendChild(contents);
      range.insertNode(highlight);
      console.log('✅ Alternative method worked');
    }
    
    // Add basic interactions
    highlight.addEventListener('click', () => {
      console.log('🖱️ Highlight clicked:', uniqueId);
      showNotification(`Clicked highlight: ${selectedText.substring(0, 30)}`, 'info');
    });
    
    highlight.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      console.log('🖱️ Right-click on highlight:', uniqueId);
      showSimpleContextMenu(e, highlight);
    });
    
    // Save to storage
    const highlightData = {
      id: uniqueId,
      text: selectedText,
      color: colorName,
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString()
    };
    
    await saveHighlight(highlightData);
    
    // Clear selection
    selection.removeAllRanges();
    
    console.log('✅ Highlight created successfully:', uniqueId);
    showNotification(`Highlighted as ${colorName}!`, 'success');
    
  } catch (error) {
    console.error('❌ Error creating highlight:', error);
    showNotification('Error creating highlight', 'error');
  }
  
  isHighlighting = false;
}

// Simple context menu
function showSimpleContextMenu(e, highlight) {
  // Remove existing menus
  document.querySelectorAll('.simple-context-menu').forEach(m => m.remove());
  
  const menu = document.createElement('div');
  menu.className = 'simple-context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${e.clientY}px;
    left: ${e.clientX}px;
    background: white;
    border: 2px solid black;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    min-width: 150px;
  `;
  
  const menuItems = [
    {
      text: '📋 Copy',
      action: () => {
        const text = highlight.dataset.text;
        navigator.clipboard.writeText(text).then(() => {
          showNotification('Copied!', 'success');
        });
      }
    },
    {
      text: '🗑️ Delete',
      action: () => {
        deleteHighlight(highlight);
      }
    }
  ];
  
  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.style.cssText = `
      padding: 10px 15px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    `;
    menuItem.textContent = item.text;
    
    menuItem.onmouseenter = () => {
      menuItem.style.backgroundColor = '#f0f0f0';
    };
    menuItem.onmouseleave = () => {
      menuItem.style.backgroundColor = 'white';
    };
    
    menuItem.onclick = (e) => {
      e.stopPropagation();
      item.action();
      menu.remove();
    };
    
    menu.appendChild(menuItem);
  });
  
  document.body.appendChild(menu);
  
  // Close menu on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

// Delete highlight
async function deleteHighlight(highlight) {
  try {
    console.log('🗑️ Deleting highlight:', highlight.dataset.highlightId);
    
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
    
    showNotification('Deleted!', 'success');
  } catch (error) {
    console.error('❌ Error deleting highlight:', error);
    showNotification('Delete failed', 'error');
  }
}

// Save highlight to storage
async function saveHighlight(highlightData) {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    highlights.push(highlightData);
    await chrome.storage.sync.set({ highlights });
    console.log('✅ Highlight saved');
  } catch (error) {
    console.error('❌ Error saving highlight:', error);
  }
}

// Simple notification
function showNotification(message, type = 'info') {
  console.log(`📢 Notification: ${message} (${type})`);
  
  const notification = document.createElement('div');
  const colors = {
    success: '#4caf50',
    error: '#f44336',
    info: '#2196f3'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    border: 2px solid white;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  switch (request.action) {
    case 'highlightSelection':
      if (request.color) {
        createHighlight(request.color);
      }
      break;
  }
});

console.log('🎯 Debug Highlight Hub loaded - Check console for activity!');
