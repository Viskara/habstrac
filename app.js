// Initialize from local storage
let API_URL = localStorage.getItem('recomp_api_url') || '';

document.addEventListener('DOMContentLoaded', () => {
  if (!API_URL) {
    document.getElementById('logs-container').innerHTML = '<div style="text-align:center; padding:20px;">No database connected.<br>Go to Settings.</div>';
    document.getElementById('recipes-container').innerHTML = '<div style="text-align:center; padding:20px;">No database connected.<br>Go to Settings.</div>';
    document.getElementById('api-url-input').value = '';
    return;
  }
  
  document.getElementById('api-url-input').value = API_URL;
  loadLogs();
  loadRecipes();
});

function saveApiUrl() {
  const inputUrl = document.getElementById('api-url-input').value.trim();
  if (inputUrl) {
    localStorage.setItem('recomp_api_url', inputUrl);
    API_URL = inputUrl;
    document.getElementById('settings-status').innerText = 'Saved! Reloading data...';
    setTimeout(() => {
      document.getElementById('settings-status').innerText = '';
      document.getElementById('logs-container').innerHTML = '<div class="loader">Loading today\'s setup...</div>';
      document.getElementById('recipes-container').innerHTML = '<div class="loader">Loading prep specs...</div>';
      loadLogs();
      loadRecipes();
      switchTab('logs');
    }, 800);
  }
}

function switchTab(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  
  document.getElementById(`${tab}-view`).classList.add('active');
  document.getElementById(`btn-${tab}`).classList.add('active');
  
  const titles = {
    'logs': "Today's Plan",
    'recipes': "Prep & Recipes",
    'settings': "Settings"
  };
  document.getElementById('header-title').innerText = titles[tab];
}

async function loadLogs() {
  if (!API_URL) return;
  try {
    const response = await fetch(`${API_URL}?action=getLogs`, {
      redirect: 'follow'
    });
    const data = await response.json();

    // If the backend returned an error object instead of an array, throw it
    if (data && data.error) {
      throw new Error(data.error);
    }
    
    // Get today's date in YYYY-MM-DD local time
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today - offset)).toISOString().split('T')[0];
    
    const todaysTasks = data.filter(row => row.Date === localISOTime);
    renderLogs(todaysTasks, localISOTime);
  } catch (err) {
    console.error('Logs fetch error:', err);
    document.getElementById('logs-container').innerHTML = `
      <div style="text-align:center; padding:20px; color: #ff6b6b;">
        <p><strong>Error loading data.</strong></p>
        <p style="font-size: 0.9rem; color: var(--muted);">If you see a CORS error in the console, your Google Apps Script is likely returning an HTML login or error page instead of JSON.</p>
        <p style="font-size: 0.9rem; color: var(--muted);">Ensure your script is deployed as a <strong>New Version</strong>, executed as <strong>"Me"</strong>, and access is set to <strong>"Anyone"</strong>.</p>
      </div>`;
  }
}

async function loadRecipes() {
  if (!API_URL) return;
  try {
    const response = await fetch(`${API_URL}?action=getRecipes`, {
      redirect: 'follow'
    });
    const data = await response.json();

    // If the backend returned an error object instead of an array, throw it
    if (data && data.error) {
      throw new Error(data.error);
    }
    renderRecipes(data);
  } catch (err) {
    console.error('Recipes fetch error:', err);
    document.getElementById('recipes-container').innerHTML = `
      <div style="text-align:center; padding:20px; color: #ff6b6b;">Error loading recipes. Check console and deployment settings.</div>`;
  }
}

function renderLogs(tasks, dateStr) {
  const container = document.getElementById('logs-container');
  if (tasks.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">No tasks logged for today. Rest up.</div>';
    return;
  }

  let html = '';
  tasks.forEach(task => {
    const isCompleted = String(task['Is_Completed']).toUpperCase() === 'TRUE';
    const checkedHtml = isCompleted ? 'checked' : '';
    const textClass = isCompleted ? 'completed' : '';
    const typeClass = task['Log Type'].includes('Nutrition') ? 'nutrition' : '';
    
    let detailsStr = '';
    if (task['Target Reps'] || task['Tempo']) {
      detailsStr = `Sets: ${task['Target Sets']} | Reps: ${task['Target Reps']} <br> Tempo: ${task['Tempo']} | Target RIR: ${task['Target RIR']}`;
    } else if (task['Weight (kg) / Value']) {
      detailsStr = `Target: ${task['Weight (kg) / Value']}`;
    }
    
    if (task['Notes']) detailsStr += `<br><em>${task['Notes']}</em>`;

    const safeItemName = task['Item / Exercise'].replace(/'/g, "\\'");

    html += `
      <div class="card ${typeClass}">
        <input type="checkbox" ${checkedHtml} onchange="toggleComplete('${dateStr}', '${safeItemName}', this.checked, this.parentNode)">
        <div class="card-content ${textClass}">
          <div class="title">${task['Item / Exercise']}</div>
          <div class="details">${detailsStr}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderRecipes(recipes) {
  const container = document.getElementById('recipes-container');
  let html = '';
  
  recipes.forEach(recipe => {
    html += `
      <div class="card recipe">
        <div class="title">${recipe['Recipe Name']}</div>
        <div class="macro-pill">
          <strong>${recipe['Calories (kcal)']}</strong> kcal &bull; <strong>${recipe['Protein (g)']}g</strong> Protein
        </div>
        <div class="details">${recipe['Ingredients / Method']}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function toggleComplete(date, item, isCompleted, cardElement) {
  const contentDiv = cardElement.querySelector('.card-content');
  if (isCompleted) {
    contentDiv.classList.add('completed');
  } else {
    contentDiv.classList.remove('completed');
  }

  const payload = {
    action: 'updateLog',
    date: date,
    item: item,
    isCompleted: isCompleted
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!result.success) {
      alert('Sync failed. Try again.');
    }
  } catch (err) {
    console.error('Network error during sync');
  }
}