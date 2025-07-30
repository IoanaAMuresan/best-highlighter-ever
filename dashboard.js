// Smart Highlighter Dashboard Script

let allHighlights = [];
let filteredHighlights = [];
let currentView = 'list';
let currentPage = 1;
const itemsPerPage = 20;

document.addEventListener('DOMContentLoaded', async () => {
  await loadHighlights();
  await loadStats();
  await setupFilters();
  setupEventListeners();
  displayHighlights();
  
  // Handle URL hash for direct navigation
  handleHashNavigation();
});

// Load all highlights from storage
async function loadHighlights() {
  try {
    const result = await chrome.storage.local.get(['highlights']);
    allHighlights = result.highlights || [];
    filteredHighlights = [...allHighlights];
    
    // Sort by timestamp (newest first)
    filteredHighlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('Error loading highlights:', error);
    allHighlights = [];
    filteredHighlights = [];
  }
}

// Load and display statistics
async function loadStats() {
  const total = allHighlights.length;
  document.getElementById('total-count').textContent = total;
  
  // This month's highlights
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = allHighlights.filter(h => new Date(h.timestamp) >= firstDayOfMonth);
  document.getElementById('this-month-count').textContent = thisMonth.length;
  
  // Unique pages
  const uniquePages = new Set(allHighlights.map(h => h.url)).size;
  document.getElementById('unique-pages-count').textContent = uniquePages;
  
  // Highlights with notes
  const withNotes = allHighlights.filter(h => h.notes && h.notes.length > 0);
  document.getElementById('with-notes-count').textContent = withNotes.length;
}

// Setup filter dropdowns
async function setupFilters() {
  // Project filter
  const result = await chrome.storage.sync.get(['projects']);
  const projects = result.projects || ['Home', 'Work', 'Side Project'];
  
  const projectFilter = document.getElementById('project-filter');
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project;
    option.textContent = project;
    projectFilter.appendChild(option);
  });
  
  // Color filter
  const colorFilter = document.getElementById('color-filter');
  const colors = [
    { value: 'yellow', label: 'Yellow - Important' },
    { value: 'green', label: 'Green - Ideas' },
    { value: 'blue', label: 'Blue - Research' },
    { value: 'pink', label: 'Pink - Personal' },
    { value: 'orange', label: 'Orange - Action Items' },
    { value: 'red', label: 'Red - Urgent' },
    { value: 'purple', label: 'Purple - Questions' },
    { value: 'gray', label: 'Gray - Notes' }
  ];
  
  colors.forEach(color => {
    const option = document.createElement('option');
    option.value = color.value;
    option.textContent = color.label;
    colorFilter.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Search input
  document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));
  
  // Filter dropdowns
  document.getElementById('project-filter').addEventListener('change', applyFilters);
  document.getElementById('color-filter').addEventListener('change', applyFilters);
  document.getElementById('date-filter').addEventListener('change', handleDateFilter);
  
  // Date range inputs
  document.getElementById('date-from').addEventListener('change', applyFilters);
  document.getElementById('date-to').addEventListener('change', applyFilters);
  
  // Clear filters
  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
  
  // View controls
  document.getElementById('view-list-btn').addEventListener('click', () => changeView('list'));
  document.getElementById('view-cards-btn').addEventListener('click', () => changeView('cards'));
  document.getElementById('view-timeline-btn').addEventListener('click', () => changeView('timeline'));
  
  // Pagination
  document.getElementById('prev-page-btn').addEventListener('click', () => changePage(currentPage - 1));
  document.getElementById('next-page-btn').addEventListener('click', () => changePage(currentPage + 1));
  
  // Header actions
  document.getElementById('export-btn').addEventListener('click', showExportModal);
  document.getElementById('settings-btn').addEventListener('click', showSettingsModal);
  
  // Modal close buttons
  document.getElementById('close-settings').addEventListener('click', hideSettingsModal);
  document.getElementById('close-export').addEventListener('click', hideExportModal);
  
  // Export modal
  document.getElementById('do-export-btn').addEventListener('click', doExport);
  document.getElementById('cancel-export-btn').addEventListener('click', hideExportModal);
  
  // Settings modal
  setupSettingsModal();
  
  // Close modals on outside click
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });
}

// Handle date filter changes
function handleDateFilter() {
  const dateFilter = document.getElementById('date-filter').value;
  const customRange = document.getElementById('custom-date-range');
  
  if (dateFilter === 'custom') {
    customRange.style.display = 'flex';
  } else {
    customRange.style.display = 'none';
  }
  
  applyFilters();
}

// Apply all filters
function applyFilters() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  const projectFilter = document.getElementById('project-filter').value;
  const colorFilter = document.getElementById('color-filter').value;
  const dateFilter = document.getElementById('date-filter').value;
  const dateFrom = document.getElementById('date-from').value;
  const dateTo = document.getElementById('date-to').value;
  
  filteredHighlights = allHighlights.filter(highlight => {
    // Search filter
    if (searchTerm) {
      const searchableText = [
        highlight.text,
        highlight.title,
        highlight.url,
        ...(highlight.notes || [])
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }
    
    // Project filter
    if (projectFilter && !highlight.projects.includes(projectFilter)) {
      return false;
    }
    
    // Color filter
    if (colorFilter && highlight.color !== colorFilter) {
      return false;
    }
    
    // Date filter
    const highlightDate = new Date(highlight.timestamp);
    const now = new Date();
    
    switch (dateFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (highlightDate < today) return false;
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (highlightDate < weekAgo) return false;
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (highlightDate < monthAgo) return false;
        break;
      case 'custom':
        if (dateFrom && highlightDate < new Date(dateFrom)) return false;
        if (dateTo && highlightDate > new Date(dateTo + 'T23:59:59')) return false;
        break;
    }
    
    return true;
  });
  
  currentPage = 1;
  displayHighlights();
}

// Clear all filters
function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('project-filter').value = '';
  document.getElementById('color-filter').value = '';
  document.getElementById('date-filter').value = '';
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  document.getElementById('custom-date-range').style.display = 'none';
  
  filteredHighlights = [...allHighlights];
  currentPage = 1;
  displayHighlights();
}

// Change view mode
function changeView(view) {
  currentView = view;
  
  // Update active button
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`view-${view}-btn`).classList.add('active');
  
  displayHighlights();
}

// Display highlights based on current view and page
function displayHighlights() {
  const container = document.getElementById('highlights-container');
  const loading = document.getElementById('loading');
  const emptyState = document.getElementById('empty-state');
  
  loading.style.display = 'none';
  emptyState.style.display = 'none';
  
  if (filteredHighlights.length === 0) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    document.getElementById('pagination').style.display = 'none';
    return;
  }
  
  // Pagination
  const totalPages = Math.ceil(filteredHighlights.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageHighlights = filteredHighlights.slice(startIndex, endIndex);
  
  // Render highlights
  container.innerHTML = '';
  container.className = `highlights-${currentView}`;
  
  pageHighlights.forEach(highlight => {
    const element = createHighlightElement(highlight);
    container.appendChild(element);
  });
  
  // Update pagination
  updatePagination(currentPage, totalPages);
}

// Create highlight element
function createHighlightElement(highlight) {
  const element = document.createElement('div');
  element.className = 'highlight-item';
  element.dataset.highlightId = highlight.id;
  
  const formattedDate = new Date(highlight.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const projectBadges = highlight.projects.map(project => 
    `<span class="project-badge">${project}</span>`
  ).join('');
  
  const notesSection = highlight.notes && highlight.notes.length > 0 ? `
    <div class="highlight-notes">
      <h4>📝 Notes:</h4>
      <p>${highlight.notes.join('<br>')}</p>
    </div>
  ` : '';
  
  element.innerHTML = `
    <div class="highlight-header">
      <div class="highlight-content">
        <div class="highlight-text color-${highlight.color}">${highlight.text}</div>
        <div class="highlight-meta">
          <a href="${highlight.url}" target="_blank" class="highlight-source" title="${highlight.title}">
            ${highlight.title || highlight.url}
          </a>
          <span>•</span>
          <span>${formattedDate}</span>
          <div class="highlight-projects">${projectBadges}</div>
        </div>
        ${notesSection}
      </div>
      <div class="highlight-actions">
        <button onclick="copyHighlight('${highlight.id}')" title="Copy">📋</button>
        <button onclick="editNote('${highlight.id}')" title="Edit Note">📝</button>
        <button onclick="shareHighlight('${highlight.id}')" title="Share">📤</button>
        <button onclick="deleteHighlight('${highlight.id}')" class="delete" title="Delete">🗑️</button>
      </div>
    </div>
  `;
  
  return element;
}

// Update pagination controls
function updatePagination(current, total) {
  const pagination = document.getElementById('pagination');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const pageInfo = document.getElementById('page-info');
  
  if (total <= 1) {
    pagination.style.display = 'none';
    return;
  }
  
  pagination.style.display = 'flex';
  prevBtn.disabled = current <= 1;
  nextBtn.disabled = current >= total;
  pageInfo.textContent = `Page ${current} of ${total}`;
}

// Change page
function changePage(page) {
  const totalPages = Math.ceil(filteredHighlights.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  displayHighlights();
}

// Copy highlight text
async function copyHighlight(highlightId) {
  const highlight = allHighlights.find(h => h.id === highlightId);
  if (!highlight) return;
  
  try {
    await navigator.clipboard.writeText(highlight.text);
    showNotification('Copied to clipboard!');
  } catch (error) {
    console.error('Error copying:', error);
    showNotification('Failed to copy');
  }
}

// Edit note for highlight
function editNote(highlightId) {
  const highlight = allHighlights.find(h => h.id === highlightId);
  if (!highlight) return;
  
  const currentNote = highlight.notes ? highlight.notes.join('\n') : '';
  const newNote = prompt('Edit note:', currentNote);
  
  if (newNote !== null) {
    highlight.notes = newNote.trim() ? [newNote.trim()] : [];
    saveHighlight(highlight);
    displayHighlights();
    loadStats();
    showNotification('Note updated!');
  }
}

// Share highlight
function shareHighlight(highlightId) {
  const highlight = allHighlights.find(h => h.id === highlightId);
  if (!highlight) return;
  
  const shareUrl = `${highlight.url}#highlight-${highlight.id}`;
  const subject = encodeURIComponent(`Check out this highlight from "${highlight.title}"`);
  const body = encodeURIComponent(`"${highlight.text}"\n\nSource: ${shareUrl}\n\nShared via Smart Highlighter`);
  
  const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
  window.open(mailtoUrl);
}

// Delete highlight
async function deleteHighlight(highlightId) {
  if (!confirm('Are you sure you want to delete this highlight?')) return;
  
  try {
    // Remove from storage
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || [];
    const updatedHighlights = highlights.filter(h => h.id !== highlightId);
    await chrome.storage.local.set({ highlights: updatedHighlights });
    
    // Update local arrays
    allHighlights = updatedHighlights;
    filteredHighlights = filteredHighlights.filter(h => h.id !== highlightId);
    
    // Refresh display
    displayHighlights();
    loadStats();
    showNotification('Highlight deleted!');
  } catch (error) {
    console.error('Error deleting highlight:', error);
    showNotification('Failed to delete highlight');
  }
}

// Save highlight to storage
async function saveHighlight(highlight) {
  try {
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || [];
    const index = highlights.findIndex(h => h.id === highlight.id);
    
    if (index !== -1) {
      highlights[index] = highlight;
    } else {
      highlights.push(highlight);
    }
    
    await chrome.storage.local.set({ highlights });
  } catch (error) {
    console.error('Error saving highlight:', error);
  }
}

// Show/hide modals
function showExportModal() {
  document.getElementById('export-modal').style.display = 'flex';
}

function hideExportModal() {
  document.getElementById('export-modal').style.display = 'none';
}

function showSettingsModal() {
  document.getElementById('settings-modal').style.display = 'flex';
  loadSettingsData();
}

function hideSettingsModal() {
  document.getElementById('settings-modal').style.display = 'none';
}

// Setup settings modal
function setupSettingsModal() {
  // Add project functionality
  document.getElementById('add-project-btn').addEventListener('click', addProject);
  document.getElementById('new-project-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addProject();
  });
  
  // Data management
  document.getElementById('export-all-btn').addEventListener('click', exportAllData);
  document.getElementById('import-data-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', importData);
  document.getElementById('clear-all-btn').addEventListener('click', clearAllData);
}

// Load settings data
async function loadSettingsData() {
  try {
    const result = await chrome.storage.sync.get(['projects', 'colorSchemes']);
    const projects = result.projects || ['Home', 'Work', 'Side Project'];
    const colorSchemes = result.colorSchemes || {};
    
    // Display projects
    const projectsList = document.getElementById('projects-list');
    projectsList.innerHTML = projects.map(project => `
      <div class="project-item">
        <span>${project}</span>
        <button onclick="removeProject('${project}')" class="danger-btn">Remove</button>
      </div>
    `).join('');
    
    // Display color schemes
    const colorSchemesContainer = document.getElementById('color-schemes-container');
    colorSchemesContainer.innerHTML = Object.entries(colorSchemes).map(([project, colors]) => `
      <div class="color-scheme">
        <h4>${project}</h4>
        <div class="color-labels">
          ${Object.entries(colors).map(([color, label]) => `
            <div class="color-label-item">
              <span class="color-dot" style="background: var(--color-${color})"></span>
              <input type="text" value="${label}" onchange="updateColorLabel('${project}', '${color}', this.value)">
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Add new project
async function addProject() {
  const input = document.getElementById('new-project-input');
  const projectName = input.value.trim();
  
  if (!projectName) return;
  
  try {
    const result = await chrome.storage.sync.get(['projects', 'colorSchemes']);
    const projects = result.projects || [];
    const colorSchemes = result.colorSchemes || {};
    
    if (projects.includes(projectName)) {
      alert('Project already exists!');
      return;
    }
    
    projects.push(projectName);
    colorSchemes[projectName] = {
      'yellow': 'Important',
      'green': 'Ideas',
      'blue': 'Research',
      'pink': 'Personal',
      'orange': 'Action Items',
      'red': 'Urgent',
      'purple': 'Questions',
      'gray': 'Notes'
    };
    
    await chrome.storage.sync.set({ projects, colorSchemes });
    input.value = '';
    loadSettingsData();
    setupFilters();
    showNotification('Project added!');
  } catch (error) {
    console.error('Error adding project:', error);
  }
}

// Remove project
async function removeProject(projectName) {
  if (!confirm(`Remove project "${projectName}"?`)) return;
  
  try {
    const result = await chrome.storage.sync.get(['projects', 'colorSchemes', 'activeProjects']);
    const projects = result.projects || [];
    const colorSchemes = result.colorSchemes || {};
    const activeProjects = result.activeProjects || [];
    
    const updatedProjects = projects.filter(p => p !== projectName);
    delete colorSchemes[projectName];
    const updatedActiveProjects = activeProjects.filter(p => p !== projectName);
    
    await chrome.storage.sync.set({ 
      projects: updatedProjects, 
      colorSchemes,
      activeProjects: updatedActiveProjects.length > 0 ? updatedActiveProjects : ['Home']
    });
    
    loadSettingsData();
    setupFilters();
    showNotification('Project removed!');
  } catch (error) {
    console.error('Error removing project:', error);
  }
}

// Update color label
async function updateColorLabel(project, color, newLabel) {
  try {
    const result = await chrome.storage.sync.get(['colorSchemes']);
    const colorSchemes = result.colorSchemes || {};
    
    if (!colorSchemes[project]) colorSchemes[project] = {};
    colorSchemes[project][color] = newLabel;
    
    await chrome.storage.sync.set({ colorSchemes });
    showNotification('Color label updated!');
  } catch (error) {
    console.error('Error updating color label:', error);
  }
}

// Export functionality
function doExport() {
  const format = document.querySelector('input[name="export-format"]:checked').value;
  const useCurrentFilters = document.getElementById('export-current-filters').checked;
  
  const dataToExport = useCurrentFilters ? filteredHighlights : allHighlights;
  
  switch (format) {
    case 'json':
      exportAsJSON(dataToExport);
      break;
    case 'csv':
      exportAsCSV(dataToExport);
      break;
    case 'txt':
      exportAsText(dataToExport);
      break;
    case 'md':
      exportAsMarkdown(dataToExport);
      break;
  }
  
  hideExportModal();
}

// Export as JSON
function exportAsJSON(highlights) {
  const exportData = {
    exportDate: new Date().toISOString(),
    totalHighlights: highlights.length,
    highlights: highlights
  };
  
  downloadFile(JSON.stringify(exportData, null, 2), 'highlights.json', 'application/json');
}

// Export as CSV
function exportAsCSV(highlights) {
  const headers = ['Text', 'Color', 'Projects', 'Notes', 'URL', 'Title', 'Date'];
  const rows = highlights.map(h => [
    `"${h.text.replace(/"/g, '""')}"`,
    h.color,
    h.projects.join(';'),
    (h.notes || []).join(';'),
    h.url,
    `"${(h.title || '').replace(/"/g, '""')}"`,
    new Date(h.timestamp).toISOString()
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadFile(csvContent, 'highlights.csv', 'text/csv');
}

// Export as plain text
function exportAsText(highlights) {
  const content = highlights.map(h => {
    const date = new Date(h.timestamp).toLocaleDateString();
    const projects = h.projects.join(', ');
    const notes = h.notes && h.notes.length > 0 ? `\nNotes: ${h.notes.join(' ')}` : '';
    
    return `"${h.text}"\nSource: ${h.title} (${h.url})\nProjects: ${projects}\nDate: ${date}${notes}\n\n---\n`;
  }).join('\n');
  
  downloadFile(content, 'highlights.txt', 'text/plain');
}

// Export as Markdown
function exportAsMarkdown(highlights) {
  const content = `# Smart Highlighter Export\n\nExported on ${new Date().toLocaleDateString()}\nTotal highlights: ${highlights.length}\n\n` +
    highlights.map(h => {
      const date = new Date(h.timestamp).toLocaleDateString();
      const projects = h.projects.join(', ');
      const notes = h.notes && h.notes.length > 0 ? `\n\n**Notes:** ${h.notes.join(' ')}` : '';
      
      return `## ${h.title || 'Untitled'}\n\n> ${h.text}\n\n**Source:** [${h.title || h.url}](${h.url})  \n**Projects:** ${projects}  \n**Date:** ${date}${notes}`;
    }).join('\n\n---\n\n');
  
  downloadFile(content, 'highlights.md', 'text/markdown');
}

// Download file helper
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export all data
function exportAllData() {
  exportAsJSON(allHighlights);
  showNotification('Data exported!');
}

// Import data
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.highlights && Array.isArray(data.highlights)) {
      const result = await chrome.storage.local.get(['highlights']);
      const existingHighlights = result.highlights || [];
      
      // Merge highlights (avoid duplicates)
      const existingIds = new Set(existingHighlights.map(h => h.id));
      const newHighlights = data.highlights.filter(h => !existingIds.has(h.id));
      
      const mergedHighlights = [...existingHighlights, ...newHighlights];
      await chrome.storage.local.set({ highlights: mergedHighlights });
      
      await loadHighlights();
      await loadStats();
      displayHighlights();
      
      showNotification(`Imported ${newHighlights.length} new highlights!`);
    } else {
      alert('Invalid file format');
    }
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Error importing file');
  }
  
  // Reset file input
  event.target.value = '';
}

// Clear all data
async function clearAllData() {
  if (!confirm('Are you sure you want to delete ALL highlights? This cannot be undone!')) return;
  
  try {
    await chrome.storage.local.set({ highlights: [] });
    allHighlights = [];
    filteredHighlights = [];
    displayHighlights();
    loadStats();
    showNotification('All highlights deleted!');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
}

// Handle URL hash navigation
function handleHashNavigation() {
  const hash = window.location.hash.substring(1);
  if (hash === 'settings') {
    showSettingsModal();
  } else if (hash === 'help') {
    // Could show help modal in future
  }
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #323232;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    font-size: 14px;
    animation: slideInRight 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Make functions global for onclick handlers
window.copyHighlight = copyHighlight;
window.editNote = editNote;
window.shareHighlight = shareHighlight;
window.deleteHighlight = deleteHighlight;
window.removeProject = removeProject;
window.updateColorLabel = updateColorLabel;
