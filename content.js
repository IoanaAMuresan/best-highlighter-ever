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

// Restore highlights on page load - improved algorithm
async function restoreHighlights() {
  console.log('🔄 Restoring highlights...');
  
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    const pageHighlights = highlights.filter(h => h.url === window.location.href);
    
    console.log(`Found ${pageHighlights.length} highlights for this page`);
    
    if (pageHighlights.length === 0) return;
    
    // Wait for page to be more stable
    await waitForPageStability();
    
    let restored = 0;
    for (const highlightData of pageHighlights) {
      if (await restoreHighlightAdvanced(highlightData)) {
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

// Wait for page stability
function waitForPageStability() {
  return new Promise((resolve) => {
    let checkCount = 0;
    const maxChecks = 10;
    let lastHeight = document.body.scrollHeight;
    
    const checkStability = () => {
      const currentHeight = document.body.scrollHeight;
      checkCount++;
      
      if (currentHeight === lastHeight || checkCount >= maxChecks) {
        resolve();
      } else {
        lastHeight = currentHeight;
        setTimeout(checkStability, 500);
      }
    };
    
    setTimeout(checkStability, 1000);
  });
}

// Advanced highlight restoration with multiple strategies
async function restoreHighlightAdvanced(highlightData) {
  // Check if already exists
  if (document.querySelector(`[data-highlight-id="${highlightData.id}"]`)) {
    return true;
  }
  
  console.log(`🔍 Attempting to restore: "${highlightData.text.substring(0, 30)}..."`);
  
  // Strategy 1: Exact text match
  if (await tryExactTextMatch(highlightData)) {
    return true;
  }
  
  // Strategy 2: Context-based matching
  if (highlightData.context && await tryContextMatch(highlightData)) {
    return true;
  }
  
  // Strategy 3: Fuzzy text matching
  if (await tryFuzzyMatch(highlightData)) {
    return true;
  }
  
  // Strategy 4: Partial match for truncated content
  if (await tryPartialMatch(highlightData)) {
    return true;
  }
  
  console.warn(`❌ Could not restore highlight: ${highlightData.id}`);
  return false;
}

// Strategy 1: Exact text match
async function tryExactTextMatch(highlightData) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
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
      return createRestoredHighlight(textNode, index, highlightText.length, highlightData);
    }
  }
  
  return false;
}

// Strategy 2: Context-based matching
async function tryContextMatch(highlightData) {
  const context = highlightData.context;
  if (!context) return false;
  
  // Find elements by context
  let candidates = [];
  
  if (context.parentId) {
    const elem = document.getElementById(context.parentId);
    if (elem) candidates.push(elem);
  }
  
  if (candidates.length === 0 && context.parentClass) {
    candidates = Array.from(document.getElementsByClassName(context.parentClass));
  }
  
  if (candidates.length === 0 && context.parentTag) {
    candidates = Array.from(document.getElementsByTagName(context.parentTag));
  }
  
  for (const candidate of candidates) {
    const candidateText = candidate.textContent;
    const targetText = highlightData.text;
    
    if (candidateText.includes(targetText)) {
      // Check context match
      const textIndex = candidateText.indexOf(targetText);
      const beforeText = candidateText.substring(Math.max(0, textIndex - 50), textIndex);
      const afterText = candidateText.substring(textIndex + targetText.length, textIndex + targetText.length + 50);
      
      const beforeMatch = !context.before || beforeText.includes(context.before.substring(-20));
      const afterMatch = !context.after || afterText.includes(context.after.substring(0, 20));
      
      if (beforeMatch && afterMatch) {
        // Find the text node within this element
        const textNodes = getTextNodesIn(candidate);
        for (const textNode of textNodes) {
          const nodeText = textNode.textContent;
          const index = nodeText.indexOf(targetText);
          if (index !== -1) {
            return createRestoredHighlight(textNode, index, targetText.length, highlightData);
          }
        }
      }
    }
  }
  
  return false;
}

// Strategy 3: Fuzzy matching (ignoring extra whitespace/punctuation)
async function tryFuzzyMatch(highlightData) {
  const normalizeText = (text) => {
    return text.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').toLowerCase().trim();
  };
  
  const targetNormalized = normalizeText(highlightData.text);
  if (targetNormalized.length < 5) return false; // Skip very short text
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.parentElement && node.parentElement.classList.contains('smart-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let textNode;
  while (textNode = walker.nextNode()) {
    const nodeNormalized = normalizeText(textNode.textContent);
    
    if (nodeNormalized.includes(targetNormalized)) {
      // Try to find the original text boundaries
      const originalText = highlightData.text;
      const nodeText = textNode.textContent;
      
      // Look for similar text with some flexibility
      const words = originalText.split(/\s+/);
      if (words.length > 1) {
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        
        const firstIndex = nodeText.toLowerCase().indexOf(firstWord.toLowerCase());
        const lastIndex = nodeText.toLowerCase().lastIndexOf(lastWord.toLowerCase());
        
        if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
          const startIndex = firstIndex;
          const endIndex = lastIndex + lastWord.length;
          const matchedText = nodeText.substring(startIndex, endIndex);
          
          if (matchedText.length > 0 && matchedText.length < originalText.length * 2) {
            return createRestoredHighlight(textNode, startIndex, matchedText.length, highlightData);
          }
        }
      }
    }
  }
  
  return false;
}

// Strategy 4: Partial matching for truncated content
async function tryPartialMatch(highlightData) {
  const originalText = highlightData.text;
  const minLength = Math.min(20, Math.floor(originalText.length * 0.6));
  
  if (originalText.length < minLength) return false;
  
  const searchText = originalText.substring(0, minLength);
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
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
    const index = nodeText.toLowerCase().indexOf(searchText.toLowerCase());
    
    if (index !== -1) {
      // Try to extend the match
      let endIndex = index + searchText.length;
      const maxLength = Math.min(nodeText.length, originalText.length * 1.5);
      
      while (endIndex < maxLength && endIndex < nodeText.length) {
        const currentMatch = nodeText.substring(index, endIndex);
        const similarity = calculateSimilarity(originalText, currentMatch);
        
        if (similarity > 0.7) {
          endIndex++;
        } else {
          break;
        }
      }
      
      const matchLength = endIndex - index - 1;
      if (matchLength >= minLength) {
        return createRestoredHighlight(textNode, index, matchLength, highlightData);
      }
    }
  }
  
  return false;
}

// Calculate text similarity (simple implementation)
function calculateSimilarity(text1, text2) {
  const longer = text1.length > text2.length ? text1 : text2;
  const shorter = text1.length > text2.length ? text2 : text1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Calculate edit distance
function getEditDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Get all text nodes within an element
function getTextNodesIn(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
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

// Create restored highlight element
function createRestoredHighlight(textNode, startIndex, length, highlightData) {
  try {
    const range = document.createRange();
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, startIndex + length);
    
    const highlight = document.createElement('span');
    highlight.className = `smart-highlight smart-highlight-${highlightData.color}`;
    highlight.dataset.highlightId = highlightData.id;
    highlight.dataset.color = highlightData.color;
    highlight.dataset.text = highlightData.text;
    highlight.dataset.projects = JSON.stringify(highlightData.projects || []);
    
    // Apply styling with dark mode support
    const colorSetting = colorSettings[highlightData.color];
    const isDark = isDarkTheme();
    
    if (colorSetting) {
      highlight.style.cssText = `
        background-color: ${colorSetting.color} !important;
        padding: 2px 4px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        display: inline !important;
        transition: all 0.2s ease !important;
        border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;
        box-shadow: ${isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)'} !important;
      `;
    }
    
    range.surroundContents(highlight);
    setupHighlightInteractions(highlight);
    
    console.log('✅ Restored highlight:', highlightData.id);
    return true;
  } catch (error) {
    console.warn('⚠️ Could not create restored highlight:', error);
    return false;
  }
}

// Show notification with dark mode support
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  const colors = {
    success: '#4caf50',
    error: '#f44336',
    info: '#2196f3',
    warning: '#ff9800'
  };
  
  const isDark = isDarkTheme();
  
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
    box-shadow: 0 4px 20px rgba(0,0,0,${isDark ? '0.4' : '0.2'});
    animation: slideInRight 0.3s ease;
    backdrop-filter: blur(10px);
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

console.log('🎯 Highlight Hub Phase 1 Improved - Ready with hover persistence, triple-click, and dark mode!'); Highlight Hub - Phase 1: Improved Foundation
// Fixed: Hover persistence, triple-click, dark mode, better restoration

let isHighlighting = false;
let activeProjects = ['Personal'];
let hoverPaletteTimeout;
let currentHoverPalette = null;
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
  console.log('🎯 Highlight Hub: Initializing improved version...');
  await loadSettings();
  setupEventListeners();
  addGlobalStyles();
  
  // Restore highlights after DOM is stable
  setTimeout(restoreHighlights, 2000);
}

// Add global styles for dark mode compatibility
function addGlobalStyles() {
  const style = document.createElement('style');
  style.id = 'highlight-hub-styles';
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(100px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes slideOutRight {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100px); }
    }
    
    .highlight-palette, .highlight-hover-palette {
      backdrop-filter: blur(10px);
    }
    
    .highlight-context-menu {
      backdrop-filter: blur(10px);
    }
  `;
  document.head.appendChild(style);
}

// Detect if page has dark theme
function isDarkTheme() {
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
    return false;
  }
  
  // Convert RGB to brightness
  const rgb = bgColor.match(/\d+/g);
  if (rgb) {
    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    return brightness < 128;
  }
  
  return false;
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

// Setup event listeners
function setupEventListeners() {
  // Handle text selection (drag)
  document.addEventListener('mouseup', handleSelection);
  
  // Handle triple-click (paragraph selection)
  document.addEventListener('click', handleMultiClick);
  
  // Hide toolbar on outside clicks
  document.addEventListener('click', hideToolbar);
  
  console.log('✅ Event listeners setup');
}

// Track clicks for triple-click detection
let clickCount = 0;
let clickTimer = null;

function handleMultiClick(e) {
  clickCount++;
  
  if (clickTimer) {
    clearTimeout(clickTimer);
  }
  
  clickTimer = setTimeout(() => {
    if (clickCount === 3) {
      handleTripleClick(e);
    }
    clickCount = 0;
  }, 400); // 400ms window for triple-click
}

// Handle triple-click (paragraph selection)
function handleTripleClick(e) {
  if (isHighlighting) return;
  
  console.log('🖱️ Triple-click detected');
  
  // Don't interfere if we're inside an existing highlight
  if (e.target.closest('.smart-highlight')) {
    return;
  }
  
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      console.log('📝 Triple-click selection:', selectedText.substring(0, 50) + '...');
      
      // For triple-click, we need to ensure proper range handling
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Clean up the range to avoid partial element selections
        try {
          // Try to expand to word/sentence boundaries if needed
          const startContainer = range.startContainer;
          const endContainer = range.endContainer;
          
          // If we're selecting across elements, try to clean it up
          if (startContainer !== endContainer) {
            const commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
              // Try to select the full text content of the common ancestor
              const newRange = document.createRange();
              newRange.selectNodeContents(commonAncestor);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not clean up triple-click range:', error);
        }
        
        showColorPalette(e, selection);
      }
    }
  }, 50);
}

// Handle text selection (drag and double-click)
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

// Show color palette
function showColorPalette(e, selection) {
  hideToolbar();
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  if (rect.width === 0 && rect.height === 0) return;
  
  const isDark = isDarkTheme();
  const palette = document.createElement('div');
  palette.id = 'highlight-palette';
  palette.style.cssText = `
    position: fixed;
    top: ${Math.max(10, rect.top - 70)}px;
    left: ${Math.max(10, rect.left + (rect.width / 2) - 160)}px;
    background: ${isDark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
    border: 1px solid ${isDark ? '#555' : '#ddd'};
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,${isDark ? '0.5' : '0.15'});
    padding: 12px;
    z-index: 999999;
    display: flex;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: fadeInUp 0.2s ease;
    backdrop-filter: blur(10px);
  `;
  
  // Create color buttons
  Object.entries(colorSettings).forEach(([colorName, settings]) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 36px;
      height: 36px;
      border: 3px solid ${isDark ? '#666' : 'white'};
      border-radius: 50%;
      background: ${settings.color.replace('0.4', '1')};
      cursor: pointer;
      margin: 0;
      padding: 0;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.1'});
    `;
    btn.title = settings.label;
    
    // Hover effects
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.15)';
      btn.style.boxShadow = `0 4px 16px rgba(0,0,0,${isDark ? '0.5' : '0.2'})`;
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = `0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.1'})`;
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
    
    // Apply robust styling with dark mode support
    const colorSetting = colorSettings[colorName];
    const isDark = isDarkTheme();
    highlight.style.cssText = `
      background-color: ${colorSetting.color} !important;
      padding: 2px 4px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      display: inline !important;
      transition: all 0.2s ease !important;
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;
      box-shadow: ${isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)'} !important;
    `;
    
    // Wrap the content - improved for triple-click selections
    let success = false;
    
    try {
      // For complex selections (like triple-click), we need special handling
      const contents = range.extractContents();
      
      // Clean up any partial elements or nested highlights
      const walker = document.createTreeWalker(
        contents,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (node.classList && node.classList.contains('smart-highlight')) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      // Remove any existing highlights within the selection
      let existingHighlight;
      while (existingHighlight = walker.nextNode()) {
        const parent = existingHighlight.parentNode;
        while (existingHighlight.firstChild) {
          parent.insertBefore(existingHighlight.firstChild, existingHighlight);
        }
        existingHighlight.remove();
      }
      
      highlight.appendChild(contents);
      range.insertNode(highlight);
      success = true;
      console.log('✅ Advanced highlighting method successful');
    } catch (e) {
      console.log('⚠️ Advanced method failed, trying fallback...');
      
      // Fallback to simple method
      try {
        range.surroundContents(highlight);
        success = true;
        console.log('✅ Simple highlighting method successful');
      } catch (e2) {
        console.error('❌ All highlighting methods failed:', e2);
      }
    }
    
    if (!success) {
      showNotification('Could not highlight this selection', 'error');
      isHighlighting = false;
      return;
    }
    
    // Add interactive behaviors
    setupHighlightInteractions(highlight);
    
    // Save to storage with better context
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
      // Enhanced context for better restoration
      context: getEnhancedTextContext(highlight),
      // Store position info for better restoration
      position: getElementPosition(highlight)
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

// Get enhanced context for better restoration
function getEnhancedTextContext(element) {
  try {
    const parent = element.parentElement;
    if (!parent) return null;
    
    const parentText = parent.textContent;
    const highlightText = element.textContent;
    const index = parentText.indexOf(highlightText);
    
    if (index === -1) return null;
    
    // Get more context and element info
    return {
      before: parentText.substring(Math.max(0, index - 100), index),
      after: parentText.substring(index + highlightText.length, index + highlightText.length + 100),
      parentTag: parent.tagName,
      parentClass: parent.className,
      parentId: parent.id,
      parentText: parentText.substring(0, 500), // Store more parent text
      textLength: highlightText.length,
      textIndex: index
    };
  } catch (error) {
    return null;
  }
}

// Get element position for restoration
function getElementPosition(element) {
  try {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    };
  } catch (error) {
    return null;
  }
}

// Setup interactions for a highlight element
function setupHighlightInteractions(highlight) {
  // Hover effects
  highlight.addEventListener('mouseenter', () => {
    const isDark = isDarkTheme();
    highlight.style.boxShadow = `0 2px 12px rgba(0,0,0,${isDark ? '0.4' : '0.15'})`;
    highlight.style.transform = 'translateY(-1px)';
    
    // Show hover palette after delay
    clearTimeout(hoverPaletteTimeout);
    hoverPaletteTimeout = setTimeout(() => {
      showHighlightHoverPalette(highlight);
    }, 800); // 800ms delay
  });
  
  highlight.addEventListener('mouseleave', () => {
    highlight.style.boxShadow = 'none';
    highlight.style.transform = 'translateY(0)';
    
    // Clear hover timeout
    clearTimeout(hoverPaletteTimeout);
    
    // Delay hiding the palette to allow mouse movement to it
    setTimeout(() => {
      if (currentHoverPalette && !currentHoverPalette.matches(':hover')) {
        hideHighlightHoverPalette();
      }
    }, 200);
  });
  
  // Right-click context menu
  highlight.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showHighlightContextMenu(e, highlight);
  });
}

// Show hover palette (persistent on hover)
function showHighlightHoverPalette(highlight) {
  hideHighlightHoverPalette();
  
  const rect = highlight.getBoundingClientRect();
  const isDark = isDarkTheme();
  const palette = document.createElement('div');
  palette.id = 'highlight-hover-palette';
  palette.className = 'highlight-hover-palette';
  currentHoverPalette = palette;
  
  palette.style.cssText = `
    position: fixed;
    top: ${rect.top - 70}px;
    left: ${rect.left + (rect.width / 2) - 140}px;
    background: ${isDark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
    border: 1px solid ${isDark ? '#555' : '#ddd'};
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,${isDark ? '0.5' : '0.2'});
    padding: 8px;
    z-index: 999999;
    display: flex;
    gap: 4px;
    align-items: center;
    backdrop-filter: blur(10px);
    animation: fadeInUp 0.2s ease;
  `;
  
  // Color change buttons
  Object.entries(colorSettings).forEach(([colorName, settings]) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 28px;
      height: 28px;
      border: 2px solid ${isDark ? '#666' : 'white'};
      border-radius: 50%;
      background: ${settings.color.replace('0.4', '1')};
      cursor: pointer;
      margin: 0;
      padding: 0;
      transition: all 0.1s ease;
    `;
    btn.title = `Change to ${settings.label}`;
    
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.1)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)';
    };
    
    btn.onclick = () => {
      changeHighlightColor(highlight, colorName);
      hideHighlightHoverPalette();
    };
    palette.appendChild(btn);
  });
  
  // Delete button with trash icon
  const deleteBtn = document.createElement('button');
  deleteBtn.style.cssText = `
    background: ${isDark ? '#d32f2f' : '#f44336'};
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 14px;
    margin-left: 8px;
    transition: all 0.1s ease;
  `;
  deleteBtn.innerHTML = '🗑️'; // Trash can emoji
  deleteBtn.title = 'Delete highlight';
  
  deleteBtn.onmouseenter = () => {
    deleteBtn.style.background = '#c62828';
    deleteBtn.style.transform = 'scale(1.05)';
  };
  deleteBtn.onmouseleave = () => {
    deleteBtn.style.background = isDark ? '#d32f2f' : '#f44336';
    deleteBtn.style.transform = 'scale(1)';
  };
  
  deleteBtn.onclick = () => {
    deleteHighlight(highlight);
    hideHighlightHoverPalette();
  };
  palette.appendChild(deleteBtn);
  
  // Keep hover state when mouse enters palette
  palette.addEventListener('mouseenter', () => {
    clearTimeout(hoverPaletteTimeout);
  });
  
  palette.addEventListener('mouseleave', () => {
    setTimeout(() => {
      hideHighlightHoverPalette();
    }, 200);
  });
  
  document.body.appendChild(palette);
  
  // Keep palette within screen bounds
  const paletteRect = palette.getBoundingClientRect();
  if (paletteRect.left < 10) {
    palette.style.left = '10px';
  }
  if (paletteRect.right > window.innerWidth - 10) {
    palette.style.left = (window.innerWidth - paletteRect.width - 10) + 'px';
  }
  if (paletteRect.top < 10) {
    palette.style.top = (rect.bottom + 10) + 'px';
  }
}

// Hide hover palette
function hideHighlightHoverPalette() {
  if (currentHoverPalette) {
    currentHoverPalette.remove();
    currentHoverPalette = null;
  }
}

// Show context menu for highlights
function showHighlightContextMenu(e, highlight) {
  // Remove existing menus
  document.querySelectorAll('.highlight-context-menu').forEach(m => m.remove());
  
  const isDark = isDarkTheme();
  const menu = document.createElement('div');
  menu.className = 'highlight-context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${e.clientY}px;
    left: ${e.clientX}px;
    background: ${isDark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
    color: ${isDark ? '#fff' : '#000'};
    border: 1px solid ${isDark ? '#555' : '#ddd'};
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,${isDark ? '0.5' : '0.15'});
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    min-width: 200px;
    overflow: hidden;
    backdrop-filter: blur(10px);
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
      border-bottom: ${index < menuItems.length - 1 ? `1px solid ${isDark ? '#555' : '#eee'}` : 'none'};
      transition: background-color 0.1s;
      ${item.danger ? 'color: #f44336;' : ''}
    `;
    menuItem.textContent = item.text;
    
    menuItem.onmouseenter = () => {
      menuItem.style.backgroundColor = item.danger ? 
        (isDark ? 'rgba(211, 47, 47, 0.2)' : '#ffebee') : 
        (isDark ? 'rgba(255, 255, 255, 0.1)' : '#f5f5f5');
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

//
