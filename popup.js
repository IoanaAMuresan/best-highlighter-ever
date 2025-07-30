// Smart Highlighter Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadProjects();
  setupEventListeners();
});

// Load highlight statistics
async function loadStats() {
  try {
    const result = await chrome.storage.sync.get(['highlights']);
    const highlights = result.highlights || [];
    
    // Total highlights
    document.getElementById('total-highlights').textContent = highlights.length;
    
    // This week's highlights
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const thisWeekHighlights = highlights.filter(h => 
      new Date(h.timestamp) > oneWeekAgo
    );
    
    document.getElementById('this-week').textContent = thisWeekHighlights.length;
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('total-highlights').textContent = '0';
    document.getElementById('this-week').textContent = '0';
  }
}

// Load projects
async function loadProjects() {
  try {
    const result = await chrome.storage.sync.get(['projects', 'activeProjects']);
    const projects = result.projects || ['Home', 'Work', 'Side Project'];
    const activeProjects = result.activeProjects || ['Home'];
    
    const projectSelector = document.getElementById('project-selector');
    projectSelector.innerHTML = '';
    
    projects.forEach(project => {
      const tag = document.createElement('div');
      tag.className = `project-tag ${activeProjects.includes(project) ? 'active' : ''}`;
      tag.textContent = project;
      tag.dataset.project = project;
      
      tag.addEventListener('click', () => toggleProject(project, tag));
      
      projectSelector.appendChild(tag);
    });
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

// Toggle project active state
async function toggleProject(project, element) {
  try {
    const result = await chrome.storage.sync.get(['activeProjects']);
    let activeProjects = result.activeProjects || ['Home'];
    
    const index = activeProjects.indexOf(project);
    if (index === -1) {
      activeProjects.push(project);
      element.classList.add('active');
    } else {
      activeProjects.splice(index, 1);
      element.classList.remove('active');
    }
    
    // Ensure at least one project is active
    if (activeProjects.length === 0) {
      activeProjects = ['Home'];
      document.querySelector('[data-project="Home"]')?.classList.add('active');
    }
    
    await chrome.storage.sync.set({ activeProjects });
    
    // Notify content scripts of the change
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'activeProjectsChanged',
        activeProjects: activeProjects
      }).catch(() => {
        // Ignore errors if content script isn't available
      });
    }
  } catch (error) {
    console.error('Error toggling project:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Open dashboard
  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html')
    });
    window.close();
  });
  
  // Export highlights
  document.getElementById('export-highlights').addEventListener('click', async () => {
    try {
      const result = await chrome.storage.sync.get(['highlights']);
      const highlights = result.highlights || [];
      
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
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-highlights-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      window.close();
    } catch (error) {
      console.error('Error exporting highlights:', error);
      alert('Error exporting highlights. Please try again.');
    }
  });
  
  // Settings link
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html#settings')
    });
    window.close();
  });
  
  // Help link
  document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html#help')
    });
    window.close();
  });
}
