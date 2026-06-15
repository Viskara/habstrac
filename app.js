let API_URL = localStorage.getItem('recomp_api_url') || '';

document.addEventListener('DOMContentLoaded', () => {
  if (!API_URL) {
    showNoConnection();
    return;
  }
  document.getElementById('api-url-input').value = API_URL;
  loadAll();
});

function showNoConnection() {
  ['logs-container','tasks-container','backlog-container','recipes-container'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="empty-state">No database connected.<br>Go to Settings.</div>';
  });
}

function saveApiUrl() {
  const inputUrl = document.getElementById('api-url-input').value.trim();
  if (!inputUrl) return;
  localStorage.setItem('recomp_api_url', inputUrl);
  API_URL = inputUrl;
  document.getElementById('settings-status').innerText = 'Saved! Reloading...';
  setTimeout(() => {
    document.getElementById('settings-status').innerText = '';
    loadAll();
    switchTab('logs');
  }, 800);
}

function loadAll() {
  loadLogs();
  loadTasks();
  loadRecipes();
}

function switchTab(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(`${tab}-view`).classList.add('active');
  document.getElementById(`btn-${tab}`).classList.add('active');
  const titles = { logs: "Today's Plan", tasks: "My Tasks", backlog: "Backlog", recipes: "Meal Prep", settings: "Settings" };
  document.getElementById('header-title').innerText = titles[tab] || '';
}

// ─── Date helper ────────────────────────────────────────────────────────────
function localToday() {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}
function localTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}
function daysSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date(localToday());
  return Math.round((now - then) / 86400000);
}

// ─── FETCH ───────────────────────────────────────────────────────────────────
async function apiFetch(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`, { redirect: 'follow' });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ─── LOGS (workout / nutrition / metrics) ────────────────────────────────────
async function loadLogs() {
  setLoading('logs-container');
  try {
    const data = await apiFetch({ action: 'getLogs' });
    const today = localToday();
    const todayRows = data.filter(r => r.Date === today);
    renderLogs(todayRows, today);

    // Also rebuild backlog from full data
    const backlogRows = data.filter(r => String(r.Status).toLowerCase() === 'pushed');
    loadTasksForBacklog(backlogRows);
  } catch(err) {
    console.error(err);
    document.getElementById('logs-container').innerHTML = `<div class="error-state"><strong>Error loading logs.</strong><br>${err.message}</div>`;
  }
}

const SECTION_CONFIG = [
  { key: 'Body Metrics',       label: 'Body Metrics',  color: '#a78bfa', icon: '⚖️' },
  { key: 'Nutrition',          label: 'Nutrition',     color: '#f59e0b', icon: '🥗' },
  { key: 'Workout - Push',     label: 'Push',          color: '#10b981', icon: '💪' },
  { key: 'Workout - Pull',     label: 'Pull',          color: '#10b981', icon: '🏋️' },
  { key: 'Workout - Legs',     label: 'Legs',          color: '#10b981', icon: '🦵' },
  { key: 'Workout - Full Body',label: 'Full Body',     color: '#10b981', icon: '🔥' },
  { key: 'Workout - Core',     label: 'Core',          color: '#10b981', icon: '🎯' },
  { key: 'Cardio',             label: 'Cardio',        color: '#3b82f6', icon: '🚴' },
  { key: 'Recovery',           label: 'Recovery',      color: '#6b7280', icon: '😴' },
];

function renderLogs(tasks, dateStr) {
  const container = document.getElementById('logs-container');
  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state">Nothing planned for today.</div>';
    return;
  }

  const grouped = {};
  tasks.forEach(t => {
    const type = t['Log Type'] || 'Other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(t);
  });

  const orderedKeys = SECTION_CONFIG.map(s => s.key).filter(k => grouped[k]);
  Object.keys(grouped).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k); });

  let html = '';
  orderedKeys.forEach(type => {
    const cfg = SECTION_CONFIG.find(s => s.key === type) || { label: type, color: '#9ca3af', icon: '📋' };
    const items = grouped[type];
    const allDone = items.every(t => String(t['Is_Completed']).toUpperCase() === 'TRUE' || String(t['Status']).toLowerCase() === 'completed');

    html += `<div class="section">
      <div class="section-header" style="border-left-color:${cfg.color}">
        <span class="section-icon">${cfg.icon}</span>
        <span class="section-label">${cfg.label}</span>
        ${allDone ? '<span class="section-badge">✓ Done</span>' : ''}
      </div>`;

    items.forEach(task => {
      const isCompleted = String(task['Is_Completed']).toUpperCase() === 'TRUE' || String(task['Status']).toLowerCase() === 'completed';
      const isPushed = String(task['Status']).toLowerCase() === 'pushed';
      const safeItem = (task['Item / Exercise'] || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const pushCount = task['Push Count'] || 0;
      const pushedFrom = task['Pushed From'] || '';
      const isWorkout = type.startsWith('Workout');

      html += `
        <div class="card log-card ${isCompleted ? 'is-completed' : ''} ${isPushed ? 'is-pushed' : ''}" 
             style="border-left-color:${cfg.color}" 
             data-item="${safeItem}" data-date="${dateStr}" data-type="${type}">
          <div class="card-main" onclick="toggleExpand(this.parentNode)">
            <input type="checkbox" ${isCompleted ? 'checked' : ''} 
              onclick="event.stopPropagation(); toggleLogComplete(event, '${dateStr}', '${safeItem}', this.parentNode.parentNode.parentNode)">
            <div class="card-content ${isCompleted ? 'completed' : ''}">
              <div class="card-top">
                <div class="title">${task['Item / Exercise']}</div>
                <div class="card-actions">
                  ${!isCompleted ? `<button class="push-btn" title="Push to tomorrow" onclick="event.stopPropagation(); pushLog('${dateStr}', '${safeItem}', this.closest('.log-card'))">
                    ⏭ ${pushCount > 0 ? `<span class="push-count">${pushCount}d</span>` : ''}
                  </button>` : ''}
                  <span class="expand-icon">▾</span>
                </div>
              </div>
              <div class="details">${buildLogDetails(task)}</div>
              ${pushedFrom ? `<div class="pushed-tag">Pushed from ${pushedFrom} · ${daysSince(pushedFrom)} days ago</div>` : ''}
            </div>
          </div>

          <div class="card-expand">
            ${isWorkout ? buildWorkoutActualInputs(task, dateStr, safeItem) : buildMetricActualInput(task, dateStr, safeItem)}
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

function buildLogDetails(task) {
  const type = task['Log Type'] || '';
  const value = task['Weight (kg) / Value'];
  const sets = task['Target Sets'];
  const reps = task['Target Reps'];
  const tempo = task['Tempo'];
  const rir = task['Target RIR'];
  const notes = task['Notes'];
  let parts = [];

  if (type === 'Body Metrics' || type === 'Nutrition') {
    if (value) parts.push(`Target: <strong>${value}</strong>`);
    const actual = task['Actual Value'];
    if (actual) parts.push(`Actual: <strong>${actual}</strong>`);
  } else if (type.startsWith('Workout')) {
    if (value && Number(value) > 0) parts.push(`${value}kg`);
    if (sets) parts.push(`${sets} sets`);
    if (reps) parts.push(`${reps} reps`);
    if (tempo) parts.push(`Tempo ${tempo}`);
    if (rir !== '' && rir !== undefined) parts.push(`RIR ${rir}`);
  } else if (type === 'Cardio') {
    if (sets && reps) parts.push(`${sets} × ${reps}`);
    else if (reps) parts.push(reps);
  } else if (type === 'Recovery') {
    if (reps) parts.push(reps);
  }

  let str = parts.join(' · ');
  if (notes) str += `${str ? '<br>' : ''}<em class="note-text">${notes}</em>`;
  return str;
}

function buildWorkoutActualInputs(task, dateStr, safeItem) {
  const type = task['Log Type'] || '';
  const isMetric = type === 'Body Metrics' || type === 'Nutrition';
  if (isMetric) return buildMetricActualInput(task, dateStr, safeItem);

  return `
    <div class="actual-inputs">
      <div class="actual-label">Log actuals</div>
      <div class="input-row">
        <label>Weight (kg)<input type="number" class="actual-field" id="aw-weight-${safeItem}" placeholder="${task['Weight (kg) / Value'] || '0'}" step="0.5"></label>
        <label>Sets<input type="number" class="actual-field" id="aw-sets-${safeItem}" placeholder="${task['Target Sets'] || ''}" min="0" max="20"></label>
        <label>Reps<input type="number" class="actual-field" id="aw-reps-${safeItem}" placeholder="${task['Target Reps'] || ''}" min="0"></label>
        <label>RIR<input type="number" class="actual-field" id="aw-rir-${safeItem}" placeholder="${task['Target RIR'] || ''}" min="0" max="5"></label>
      </div>
      <textarea class="actual-notes" id="aw-notes-${safeItem}" placeholder="Notes (optional)…">${task['Notes'] || ''}</textarea>
      <div class="expand-actions">
        <button class="btn-save" onclick="saveLogActual('${dateStr}','${safeItem}')">Save</button>
        <button class="btn-skip" onclick="skipLog('${dateStr}','${safeItem}', this.closest('.log-card'))">Skip</button>
      </div>
    </div>`;
}

function buildMetricActualInput(task, dateStr, safeItem) {
  const unit = task['Item / Exercise'] || '';
  return `
    <div class="actual-inputs">
      <div class="actual-label">Log actual</div>
      <div class="input-row">
        <label>${unit}<input type="number" class="actual-field" id="aw-val-${safeItem}" placeholder="${task['Weight (kg) / Value'] || ''}" step="0.1"></label>
      </div>
      <textarea class="actual-notes" id="aw-notes-${safeItem}" placeholder="Notes (optional)…">${task['Notes'] || ''}</textarea>
      <div class="expand-actions">
        <button class="btn-save" onclick="saveLogActual('${dateStr}','${safeItem}')">Save</button>
      </div>
    </div>`;
}

function toggleExpand(card) {
  const isOpen = card.classList.toggle('expanded');
  const icon = card.querySelector('.expand-icon');
  if (icon) icon.textContent = isOpen ? '▴' : '▾';
}

async function toggleLogComplete(event, date, item, card) {
  const cb = event.target;
  const isCompleted = cb.checked;
  const content = card.querySelector('.card-content');
  if (content) content.classList.toggle('completed', isCompleted);

  try {
    await apiPost({ action: 'updateLog', date, item, isCompleted, status: isCompleted ? 'Completed' : 'Planned' });
    updateSectionBadge(card);
  } catch(e) {
    console.error(e);
  }
}

async function saveLogActual(date, item) {
  const weight = document.getElementById(`aw-weight-${item}`)?.value;
  const sets = document.getElementById(`aw-sets-${item}`)?.value;
  const reps = document.getElementById(`aw-reps-${item}`)?.value;
  const rir = document.getElementById(`aw-rir-${item}`)?.value;
  const val = document.getElementById(`aw-val-${item}`)?.value;
  const notes = document.getElementById(`aw-notes-${item}`)?.value;

  try {
    const result = await apiPost({
      action: 'updateLog', date, item,
      actualWeight: weight, actualSets: sets, actualReps: reps, actualRIR: rir,
      actualValue: val, notes, isCompleted: true, status: 'Completed'
    });
    if (result.success) {
      const card = document.querySelector(`.log-card[data-item="${item}"]`);
      if (card) {
        card.classList.add('is-completed');
        const cb = card.querySelector('input[type=checkbox]');
        if (cb) cb.checked = true;
        const content = card.querySelector('.card-content');
        if (content) content.classList.add('completed');
        card.classList.remove('expanded');
        updateSectionBadge(card);
      }
    }
  } catch(e) { console.error(e); }
}

async function skipLog(date, item, card) {
  try {
    await apiPost({ action: 'updateLog', date, item, status: 'Skipped', isCompleted: false });
    if (card) card.classList.add('is-skipped');
  } catch(e) { console.error(e); }
}

async function pushLog(date, item, card) {
  const tomorrow = localTomorrow();
  const pushCount = parseInt(card.dataset.pushCount || 0) + 1;
  try {
    const result = await apiPost({ action: 'pushLog', date, item, pushToDate: tomorrow, pushCount });
    if (result.success) {
      card.classList.add('is-pushed');
      const pushBtn = card.querySelector('.push-btn');
      if (pushBtn) {
        pushBtn.innerHTML = `⏭ <span class="push-count">${pushCount}d</span>`;
      }
      showToast(`Pushed to tomorrow (${pushCount} push${pushCount > 1 ? 'es' : ''})`);
    }
  } catch(e) { console.error(e); }
}

function updateSectionBadge(card) {
  const section = card.closest('.section');
  if (!section) return;
  const allCbs = section.querySelectorAll('input[type=checkbox]');
  const allChecked = Array.from(allCbs).every(cb => cb.checked);
  let badge = section.querySelector('.section-badge');
  const header = section.querySelector('.section-header');
  if (allChecked && !badge && header) {
    badge = document.createElement('span');
    badge.className = 'section-badge';
    badge.textContent = '✓ Done';
    header.appendChild(badge);
  } else if (!allChecked && badge) {
    badge.remove();
  }
}

// ─── TASKS (Guitar, Reading, etc.) ──────────────────────────────────────────
async function loadTasks() {
  setLoading('tasks-container');
  try {
    const data = await apiFetch({ action: 'getTasks' });
    const today = localToday();
    const todayTasks = data.filter(r => r.Date === today && String(r.Status).toLowerCase() !== 'pushed');
    renderTasks(todayTasks, today, 'tasks-container');

    // Backlog from tasks too
    const pushedTasks = data.filter(r => String(r.Status).toLowerCase() === 'pushed');
    renderBacklogTasks(pushedTasks);
  } catch(err) {
    console.error(err);
    document.getElementById('tasks-container').innerHTML = `<div class="error-state">${err.message}</div>`;
  }
}

function renderTasks(tasks, dateStr, containerId) {
  const container = document.getElementById(containerId);

  const addBtn = `
    <button class="btn-add-task" onclick="showAddTaskModal('${dateStr}')">+ Add Task</button>`;

  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state">No tasks for today.</div>${addBtn}`;
    return;
  }

  // Group by category
  const grouped = {};
  tasks.forEach(t => {
    const cat = t['Category'] || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  const catColors = ['#f472b6','#fb923c','#facc15','#34d399','#60a5fa','#a78bfa','#f87171'];
  let colorIdx = 0;
  const catColorMap = {};

  let html = '';
  Object.entries(grouped).forEach(([cat, items]) => {
    if (!catColorMap[cat]) catColorMap[cat] = catColors[colorIdx++ % catColors.length];
    const color = catColorMap[cat];
    html += `<div class="section">
      <div class="section-header" style="border-left-color:${color}">
        <span class="section-icon">📌</span>
        <span class="section-label">${cat}</span>
      </div>`;

    items.forEach(task => {
      const isCompleted = String(task['Status']).toLowerCase() === 'completed';
      const safeId = encodeURIComponent(task['Task'] || '').replace(/%/g,'_');
      const subtasks = (task['Sub-tasks'] || '').split('|').map(s => s.trim()).filter(Boolean);
      const pushCount = task['Push Count'] || 0;
      const pushedFrom = task['Pushed From'] || '';

      html += `
        <div class="card task-card ${isCompleted ? 'is-completed' : ''}" 
             style="border-left-color:${color}"
             data-task-id="${task['Task ID'] || ''}" data-date="${dateStr}">
          <div class="card-main" onclick="toggleExpand(this.parentNode)">
            <input type="checkbox" ${isCompleted ? 'checked' : ''}
              onclick="event.stopPropagation(); toggleTaskComplete(event, '${dateStr}', '${task['Task ID'] || ''}', this.closest('.task-card'))">
            <div class="card-content ${isCompleted ? 'completed' : ''}">
              <div class="card-top">
                <div class="title">${task['Task'] || ''}</div>
                <div class="card-actions">
                  ${!isCompleted ? `<button class="push-btn" title="Push to tomorrow" 
                    onclick="event.stopPropagation(); pushTask('${dateStr}', '${task['Task ID'] || ''}', this.closest('.task-card'))">
                    ⏭ ${pushCount > 0 ? `<span class="push-count">${pushCount}d</span>` : ''}
                  </button>` : ''}
                  <span class="expand-icon">▾</span>
                </div>
              </div>
              ${task['Notes'] ? `<div class="details note-text">${task['Notes']}</div>` : ''}
              ${pushedFrom ? `<div class="pushed-tag">Pushed · ${daysSince(pushedFrom)}d ago</div>` : ''}
            </div>
          </div>

          <div class="card-expand">
            <div class="actual-inputs">
              ${subtasks.length ? `
                <div class="actual-label">Subtasks</div>
                <div class="subtask-list" id="subtasks-${safeId}">
                  ${subtasks.map((s,i) => `
                    <label class="subtask-item">
                      <input type="checkbox" onchange="updateSubtaskProgress('${safeId}')"> ${s}
                    </label>`).join('')}
                </div>
                <div class="subtask-progress" id="prog-${safeId}">0 / ${subtasks.length} done</div>
              ` : ''}
              <div class="actual-label" style="margin-top:${subtasks.length ? '12px' : '0'}">Time spent</div>
              <div class="input-row">
                <label>Minutes<input type="number" class="actual-field" id="task-time-${safeId}" placeholder="0" min="0"></label>
              </div>
              <textarea class="actual-notes" id="task-notes-${safeId}" placeholder="Session notes…">${task['Notes'] || ''}</textarea>
              <div class="expand-actions">
                <button class="btn-save" onclick="saveTaskActual('${dateStr}', '${task['Task ID'] || ''}', '${safeId}')">Save</button>
                <button class="btn-skip" onclick="pushTask('${dateStr}', '${task['Task ID'] || ''}', this.closest('.task-card'))">Push to tomorrow</button>
              </div>
            </div>
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html + addBtn;
}

function updateSubtaskProgress(safeId) {
  const list = document.getElementById(`subtasks-${safeId}`);
  const prog = document.getElementById(`prog-${safeId}`);
  if (!list || !prog) return;
  const all = list.querySelectorAll('input[type=checkbox]');
  const done = Array.from(all).filter(cb => cb.checked).length;
  prog.textContent = `${done} / ${all.length} done`;
}

async function toggleTaskComplete(event, date, taskId, card) {
  const isCompleted = event.target.checked;
  try {
    await apiPost({ action: 'updateTask', date, taskId, status: isCompleted ? 'Completed' : 'Planned' });
    card.classList.toggle('is-completed', isCompleted);
    const content = card.querySelector('.card-content');
    if (content) content.classList.toggle('completed', isCompleted);
  } catch(e) { console.error(e); }
}

async function saveTaskActual(date, taskId, safeId) {
  const time = document.getElementById(`task-time-${safeId}`)?.value;
  const notes = document.getElementById(`task-notes-${safeId}`)?.value;
  const subtasks = document.getElementById(`subtasks-${safeId}`);
  let subtasksDone = [];
  if (subtasks) {
    subtasks.querySelectorAll('input[type=checkbox]').forEach((cb, i) => {
      if (cb.checked) subtasksDone.push(i);
    });
  }
  try {
    const result = await apiPost({ action: 'updateTask', date, taskId, timeSpent: time, notes, subtasksDone: subtasksDone.join(','), status: 'Completed' });
    if (result.success) {
      showToast('Saved!');
      loadTasks();
    }
  } catch(e) { console.error(e); }
}

async function pushTask(date, taskId, card) {
  const tomorrow = localTomorrow();
  const pushCount = parseInt(card.dataset.pushCount || 0) + 1;
  try {
    const result = await apiPost({ action: 'pushTask', date, taskId, pushToDate: tomorrow, pushCount });
    if (result.success) {
      card.classList.add('is-pushed');
      showToast(`Pushed to tomorrow`);
      setTimeout(() => loadTasks(), 600);
    }
  } catch(e) { console.error(e); }
}

// ─── ADD TASK MODAL ──────────────────────────────────────────────────────────
function showAddTaskModal(dateStr) {
  const modal = document.getElementById('add-task-modal');
  if (!modal) return;
  modal.dataset.date = dateStr;
  modal.classList.add('open');
}
function closeAddTaskModal() {
  const modal = document.getElementById('add-task-modal');
  if (modal) modal.classList.remove('open');
}
async function submitAddTask() {
  const modal = document.getElementById('add-task-modal');
  const date = modal.dataset.date || localToday();
  const category = document.getElementById('new-task-category').value.trim();
  const task = document.getElementById('new-task-name').value.trim();
  const subtasks = document.getElementById('new-task-subtasks').value.trim();
  const notes = document.getElementById('new-task-notes').value.trim();

  if (!task) { alert('Task name is required.'); return; }

  try {
    const result = await apiPost({ action: 'addTask', date, category, task, subtasks, notes });
    if (result.success) {
      closeAddTaskModal();
      // Clear fields
      ['new-task-category','new-task-name','new-task-subtasks','new-task-notes'].forEach(id => {
        document.getElementById(id).value = '';
      });
      loadTasks();
    }
  } catch(e) { console.error(e); }
}

// ─── BACKLOG ─────────────────────────────────────────────────────────────────
let _backlogLogs = [];
let _backlogTasks = [];

function loadTasksForBacklog(pushedLogRows) {
  _backlogLogs = pushedLogRows;
  renderBacklog();
}
function renderBacklogTasks(pushedTaskRows) {
  _backlogTasks = pushedTaskRows;
  renderBacklog();
}
function renderBacklog() {
  const container = document.getElementById('backlog-container');
  if (!container) return;

  const allItems = [
    ..._backlogLogs.map(r => ({
      type: 'log',
      label: r['Item / Exercise'],
      category: r['Log Type'],
      pushedFrom: r['Pushed From'] || r['Date'],
      pushCount: r['Push Count'] || 0,
      date: r['Date'],
      item: r['Item / Exercise']
    })),
    ..._backlogTasks.map(r => ({
      type: 'task',
      label: r['Task'],
      category: r['Category'],
      pushedFrom: r['Pushed From'] || r['Date'],
      pushCount: r['Push Count'] || 0,
      date: r['Date'],
      taskId: r['Task ID']
    }))
  ].sort((a,b) => daysSince(b.pushedFrom) - daysSince(a.pushedFrom));

  if (!allItems.length) {
    container.innerHTML = '<div class="empty-state">No pushed items. You\'re on top of it. 💪</div>';
    return;
  }

  let html = '<div class="backlog-list">';
  allItems.forEach(item => {
    const days = daysSince(item.pushedFrom);
    const urgency = days >= 3 ? 'urgent' : days >= 1 ? 'warning' : '';
    html += `
      <div class="backlog-item ${urgency}">
        <div class="backlog-meta">
          <span class="backlog-category">${item.category || 'Task'}</span>
          <span class="backlog-age ${urgency}">${days}d overdue</span>
        </div>
        <div class="backlog-label">${item.label}</div>
        <div class="backlog-actions">
          <button class="btn-reschedule" onclick="rescheduleToToday('${item.type}', '${item.date}', '${item.item || item.taskId}')">
            Do today
          </button>
          <button class="btn-push-again" onclick="pushAgain('${item.type}', '${item.date}', '${item.item || item.taskId}')">
            Push again
          </button>
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

async function rescheduleToToday(type, date, identifier) {
  const today = localToday();
  const action = type === 'log' ? 'pushLog' : 'pushTask';
  const payload = type === 'log'
    ? { action, date, item: identifier, pushToDate: today }
    : { action, date, taskId: identifier, pushToDate: today };
  try {
    await apiPost(payload);
    showToast('Moved to today!');
    loadAll();
  } catch(e) { console.error(e); }
}

async function pushAgain(type, date, identifier) {
  const tomorrow = localTomorrow();
  const action = type === 'log' ? 'pushLog' : 'pushTask';
  const payload = type === 'log'
    ? { action, date, item: identifier, pushToDate: tomorrow }
    : { action, date, taskId: identifier, pushToDate: tomorrow };
  try {
    await apiPost(payload);
    showToast('Pushed to tomorrow');
    loadAll();
  } catch(e) { console.error(e); }
}

// ─── RECIPES ─────────────────────────────────────────────────────────────────
async function loadRecipes() {
  setLoading('recipes-container');
  try {
    const data = await apiFetch({ action: 'getRecipes' });
    renderRecipes(data);
  } catch(err) {
    document.getElementById('recipes-container').innerHTML = `<div class="error-state">${err.message}</div>`;
  }
}

function renderRecipes(recipes) {
  const container = document.getElementById('recipes-container');
  if (!recipes || !recipes.length) {
    container.innerHTML = '<div class="empty-state">No recipes found.</div>';
    return;
  }
  let html = '';
  recipes.forEach(recipe => {
    const name = recipe['Recipe Name'] ?? 'Unnamed';
    const calories = recipe['Calories (kcal)'] ?? '—';
    const protein = recipe['Protein (g)'] ?? '—';
    const method = recipe['Ingredients / Method'] ?? '';
    html += `
      <div class="card recipe-card">
        <div class="title">${name}</div>
        <div class="macro-pill"><strong>${calories}</strong> kcal · <strong>${protein}g</strong> protein</div>
        <div class="details">${method}</div>
      </div>`;
  });
  container.innerHTML = html;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function setLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="loader">Loading…</div>';
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}