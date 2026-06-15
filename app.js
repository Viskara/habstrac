// ═══════════════════════════════════════════════════════════════
//  RECOMP TRACKER — app.js
// ═══════════════════════════════════════════════════════════════

let API_URL = localStorage.getItem('recomp_api_url') || '';
let _allLogs = [], _allTasks = [], _habits = [], _habitLogs = [],
    _measurements = [], _prs = [], _readiness = [], _checkins = [],
    _quotes = [], _recipes = [];
let _calWeekOffset = 0, _calSelectedDate = null;
let _progressTab = 'overview';

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildScoreRows();
  if (!API_URL) { showNoConnection(); return; }
  document.getElementById('api-url-input').value = API_URL;
  loadAll();
});

function showNoConnection() {
  ['logs-container','tasks-container','habits-container'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="empty-state">No database connected.<br>Go to Settings.</div>';
  });
}

function saveApiUrl() {
  const url = document.getElementById('api-url-input').value.trim();
  if (!url) return;
  localStorage.setItem('recomp_api_url', url);
  API_URL = url;
  document.getElementById('settings-status').innerText = 'Saved! Reloading…';
  setTimeout(() => { document.getElementById('settings-status').innerText = ''; loadAll(); switchTab('today'); }, 900);
}

// ── API ──────────────────────────────────────────────────────
async function apiFetch(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`, { redirect: 'follow' });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}
async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST', mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ── Load all data ────────────────────────────────────────────
async function loadAll() {
  try {
    const [logs, tasks, habits, habitLogs, measurements, prs, readiness, checkins, quotes, recipes] = await Promise.allSettled([
      apiFetch({ action: 'getLogs' }),
      apiFetch({ action: 'getTasks' }),
      apiFetch({ action: 'getHabits' }),
      apiFetch({ action: 'getHabitLogs' }),
      apiFetch({ action: 'getMeasurements' }),
      apiFetch({ action: 'getPRs' }),
      apiFetch({ action: 'getReadiness' }),
      apiFetch({ action: 'getCheckins' }),
      apiFetch({ action: 'getQuotes' }),
      apiFetch({ action: 'getRecipes' }),
    ]);
    _allLogs       = logs.status === 'fulfilled'        ? logs.value        : [];
    _allTasks      = tasks.status === 'fulfilled'       ? tasks.value       : [];
    _habits        = habits.status === 'fulfilled'      ? habits.value      : [];
    _habitLogs     = habitLogs.status === 'fulfilled'   ? habitLogs.value   : [];
    _measurements  = measurements.status === 'fulfilled'? measurements.value: [];
    _prs           = prs.status === 'fulfilled'         ? prs.value         : [];
    _readiness     = readiness.status === 'fulfilled'   ? readiness.value   : [];
    _checkins      = checkins.status === 'fulfilled'    ? checkins.value    : [];
    _quotes        = quotes.status === 'fulfilled'      ? quotes.value      : [];
    _recipes       = recipes.status === 'fulfilled'     ? recipes.value     : [];

    renderAll();
  } catch(e) { console.error('loadAll error', e); }
}

function renderAll() {
  renderToday();
  renderCalendar();
  renderHabits();
  renderProgress();
  renderConsistencyBadge();
  renderReadinessBadge();
  renderQuote();
}

// ── Dates ────────────────────────────────────────────────────
function localToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}
function localTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}
function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.round((new Date(localToday()) - new Date(dateStr)) / 86400000);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
}
function getWeekDates(offset = 0) {
  const today = new Date(localToday());
  const day = today.getDay();
  const mon = new Date(today); mon.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d.toLocaleDateString('sv-SE'); });
}

// ── Tab switching ────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(`${tab}-view`).classList.add('active');
  document.getElementById(`btn-${tab}`).classList.add('active');
  const titles = { today: 'Today', calendar: 'Calendar', habits: 'Habits', progress: 'Progress', settings: 'Settings' };
  document.getElementById('header-title').innerText = titles[tab] || '';
}

// ═══════════════════════════════════════════════════════════════
//  TODAY VIEW
// ═══════════════════════════════════════════════════════════════
const SECTION_CONFIG = [
  { key: 'Body Metrics',        label: 'Body Metrics',  color: '#a78bfa', icon: '⚖️' },
  { key: 'Nutrition',           label: 'Nutrition',     color: '#f59e0b', icon: '🥗' },
  { key: 'Workout - Push',      label: 'Push',          color: '#10b981', icon: '💪' },
  { key: 'Workout - Pull',      label: 'Pull',          color: '#10b981', icon: '🏋️' },
  { key: 'Workout - Legs',      label: 'Legs',          color: '#10b981', icon: '🦵' },
  { key: 'Workout - Full Body', label: 'Full Body',     color: '#10b981', icon: '🔥' },
  { key: 'Workout - Core',      label: 'Core',          color: '#10b981', icon: '🎯' },
  { key: 'Cardio',              label: 'Cardio',        color: '#3b82f6', icon: '🚴' },
  { key: 'Recovery',            label: 'Recovery',      color: '#6b7280', icon: '😴' },
];

function renderToday() {
  const today = localToday();
  const todayLogs  = _allLogs.filter(r => r.Date === today);
  const todayTasks = _allTasks.filter(r => r.Date === today && String(r.Status).toLowerCase() !== 'pushed');

  renderBanners(todayLogs);
  renderLogs(todayLogs, today, 'logs-container');
  renderTasks(todayTasks, today, 'tasks-container');
}

// ── Banners (smart scheduling advice) ───────────────────────
function renderBanners(todayLogs) {
  const container = document.getElementById('banners-container');
  if (!container) return;
  const msgs = [];
  const today = localToday();

  // Consecutive training days check
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i);
    const hasWorkout = _allLogs.some(r => r.Date === d && r['Log Type'] && r['Log Type'].startsWith('Workout') && String(r['Is_Completed']).toUpperCase() === 'TRUE');
    if (hasWorkout) streak++; else break;
  }
  if (streak >= 4) msgs.push({ type: 'warn', text: `🔥 You've trained ${streak} days in a row. Consider a recovery day soon.` });

  // Deload check — every 4 weeks
  const weekNum = Math.floor(daysSince(_allLogs.length ? _allLogs[0].Date : today) / 7);
  if (weekNum > 0 && weekNum % 4 === 0) {
    const alreadyDeloaded = _allLogs.some(r => r.Date >= addDays(today, -7) && r['Log Type'] === 'Recovery' && String(r['Is_Completed']).toUpperCase() === 'TRUE');
    if (!alreadyDeloaded) msgs.push({ type: 'info', text: '📉 Week 4 — consider a deload this week (reduce weight/volume by 40%).' });
  }

  // Pull imbalance
  const lastPull = _allLogs.filter(r => r['Log Type'] === 'Workout - Pull' && String(r['Is_Completed']).toUpperCase() === 'TRUE').sort((a,b) => b.Date.localeCompare(a.Date))[0];
  if (lastPull && daysSince(lastPull.Date) >= 5) msgs.push({ type: 'warn', text: `⚠️ No Pull session in ${daysSince(lastPull.Date)} days — recovery imbalance risk.` });

  // Readiness
  const todayReadiness = _readiness.find(r => r.Date === today);
  if (todayReadiness) {
    const score = Number(todayReadiness['Overall Score'] || 5);
    if (score <= 3) msgs.push({ type: 'alert', text: `😴 Low readiness score today (${score}/10). Consider going light or resting.` });
  }

  container.innerHTML = msgs.map(m => `<div class="banner ${m.type}">${m.text}</div>`).join('');
}

// ── Render logs (workout / nutrition / metrics) ──────────────
function renderLogs(tasks, dateStr, containerId, readOnly = false) {
  const container = document.getElementById(containerId);
  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state">Nothing logged for this day.</div>';
    return;
  }

  const grouped = {};
  tasks.forEach(t => { const k = t['Log Type'] || 'Other'; if (!grouped[k]) grouped[k] = []; grouped[k].push(t); });

  const orderedKeys = SECTION_CONFIG.map(s => s.key).filter(k => grouped[k]);
  Object.keys(grouped).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k); });

  let html = '';
  orderedKeys.forEach(type => {
    const cfg = SECTION_CONFIG.find(s => s.key === type) || { label: type, color: '#9ca3af', icon: '📋' };
    const items = grouped[type];
    const allDone = items.every(t => String(t['Is_Completed']).toUpperCase() === 'TRUE');
    const isWorkoutGroup = type.startsWith('Workout');
    const anyIncomplete = items.some(t => String(t['Is_Completed']).toUpperCase() !== 'TRUE' && String(t.Status).toLowerCase() !== 'pushed');

    html += `<div class="section">
      <div class="section-header" style="border-left-color:${cfg.color}">
        <span class="section-icon">${cfg.icon}</span>
        <span class="section-label">${cfg.label}</span>
        ${allDone ? '<span class="section-badge">✓ Done</span>' : ''}
        ${isWorkoutGroup && anyIncomplete && !readOnly ? `<button class="section-push-btn" onclick="pushWorkoutGroup('${dateStr}','${type}',this.closest('.section'))">Push session ⏭</button>` : ''}
      </div>`;

    items.forEach(task => {
      const isCompleted = String(task['Is_Completed']).toUpperCase() === 'TRUE';
      const isPushed    = String(task.Status).toLowerCase() === 'pushed';
      const safeItem    = (task['Item / Exercise'] || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const pushCount   = Number(task['Push Count'] || 0);
      const pushedFrom  = task['Pushed From'] || '';
      const isWorkout   = type.startsWith('Workout');

      // PR / overload hints
      const prInfo    = getPRInfo(task);
      const overload  = getOverloadHint(task);
      const stall     = getStallHint(task);

      html += `
        <div class="card log-card ${isCompleted ? 'is-completed' : ''} ${isPushed ? 'is-pushed' : ''}"
             style="border-left-color:${cfg.color}"
             data-item="${safeItem}" data-date="${dateStr}" data-push-count="${pushCount}">
          <div class="card-main" onclick="${readOnly ? '' : 'toggleExpand(this.parentNode)'}">
            ${!readOnly ? `<input type="checkbox" ${isCompleted ? 'checked' : ''}
              onclick="event.stopPropagation(); toggleLogComplete(event,'${dateStr}','${safeItem}',this.closest('.log-card'))">` : ''}
            <div class="card-content ${isCompleted ? 'completed' : ''}">
              <div class="card-top">
                <div class="title">${task['Item / Exercise']}${prInfo.isBeat ? '<span class="pr-badge">🏆 PR!</span>' : ''}</div>
                <div class="card-actions">
                  ${!isCompleted && !readOnly ? `<button class="push-btn" onclick="event.stopPropagation();pushLog('${dateStr}','${safeItem}',this.closest('.log-card'))">⏭${pushCount > 0 ? ` <span class="push-count">${pushCount}d</span>` : ''}</button>` : ''}
                  ${!readOnly ? '<span class="expand-icon">▾</span>' : ''}
                </div>
              </div>
              <div class="details">${buildLogDetails(task)}</div>
              ${overload ? `<div class="overload-hint">💡 ${overload}</div>` : ''}
              ${stall    ? `<div class="stall-hint">⚠️ ${stall}</div>` : ''}
              ${pushedFrom ? `<div class="pushed-tag">Pushed from ${pushedFrom} · ${daysSince(pushedFrom)}d ago</div>` : ''}
            </div>
          </div>
          ${!readOnly ? `<div class="card-expand">${isWorkout ? buildWorkoutActualInputs(task, dateStr, safeItem) : buildMetricActualInput(task, dateStr, safeItem)}</div>` : ''}
        </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
}

function buildLogDetails(task) {
  const type   = task['Log Type'] || '';
  const value  = task['Weight (kg) / Value'];
  const sets   = task['Target Sets'];
  const reps   = task['Target Reps'];
  const tempo  = task['Tempo'];
  const rir    = task['Target RIR'];
  const aW     = task['Actual Weight (kg)'];
  const aSets  = task['Actual Sets'];
  const aReps  = task['Actual Reps'];
  const aRIR   = task['Actual RIR'];
  const aVal   = task['Actual Value'];
  const notes  = task['Notes'];
  let parts = [];

  if (type === 'Body Metrics' || type === 'Nutrition') {
    if (value) parts.push(`Target: <strong>${value}</strong>`);
    if (aVal)  parts.push(`Actual: <strong>${aVal}</strong>`);
  } else if (type.startsWith('Workout')) {
    if (value && Number(value) > 0) parts.push(`${value}kg`);
    if (sets) parts.push(`${sets} sets`);
    if (reps) parts.push(`${reps} reps`);
    if (tempo) parts.push(`Tempo ${tempo}`);
    if (rir !== '' && rir !== undefined && rir !== null) parts.push(`RIR ${rir}`);
    if (aW || aSets || aReps) {
      parts.push(`→ <em>${aW ? aW+'kg' : '?'} · ${aSets||'?'} sets · ${aReps||'?'} reps${aRIR !== '' && aRIR !== undefined ? ' · RIR '+aRIR : ''}</em>`);
    }
  } else if (type === 'Cardio') {
    if (sets && reps) parts.push(`${sets} × ${reps}`);
    else if (reps) parts.push(reps);
  } else if (type === 'Recovery') {
    if (reps) parts.push(reps);
  }
  let str = parts.join(' · ');
  if (notes) str += `${str ? '<br>' : ''}<span class="note-text">${notes}</span>`;
  return str;
}

function buildWorkoutActualInputs(task, dateStr, safeItem) {
  const type = task['Log Type'] || '';
  if (type === 'Body Metrics' || type === 'Nutrition') return buildMetricActualInput(task, dateStr, safeItem);
  return `<div class="actual-inputs">
    <div class="actual-label">Log actuals</div>
    <div class="input-row">
      <label>Weight (kg)<input type="number" class="actual-field" id="aw-weight-${safeItem}" placeholder="${task['Weight (kg) / Value'] || '0'}" step="0.5"></label>
      <label>Sets<input type="number" class="actual-field" id="aw-sets-${safeItem}" placeholder="${task['Target Sets'] || ''}" min="0" max="20"></label>
      <label>Reps<input type="number" class="actual-field" id="aw-reps-${safeItem}" placeholder="${task['Target Reps'] || ''}" min="0"></label>
      <label>RIR<input type="number" class="actual-field" id="aw-rir-${safeItem}" placeholder="${task['Target RIR'] || ''}" min="0" max="5"></label>
    </div>
    <textarea class="actual-notes" id="aw-notes-${safeItem}" placeholder="Session notes…">${task['Notes'] || ''}</textarea>
    <div class="expand-actions">
      <button class="btn-save" onclick="saveLogActual('${dateStr}','${safeItem}')">Save</button>
      <button class="btn-skip" onclick="skipLog('${dateStr}','${safeItem}',this.closest('.log-card'))">Skip</button>
    </div>
  </div>`;
}

function buildMetricActualInput(task, dateStr, safeItem) {
  return `<div class="actual-inputs">
    <div class="actual-label">Log actual</div>
    <div class="input-row">
      <label>${task['Item / Exercise'] || 'Value'}<input type="number" class="actual-field" id="aw-val-${safeItem}" placeholder="${task['Weight (kg) / Value'] || ''}" step="0.1"></label>
    </div>
    <textarea class="actual-notes" id="aw-notes-${safeItem}" placeholder="Notes…">${task['Notes'] || ''}</textarea>
    <div class="expand-actions">
      <button class="btn-save" onclick="saveLogActual('${dateStr}','${safeItem}')">Save</button>
    </div>
  </div>`;
}

// ── PR / Overload / Stall logic ──────────────────────────────
function getPRInfo(task) {
  const exercise = task['Item / Exercise'];
  const pr = _prs.find(p => p['Exercise'] === exercise);
  if (!pr) return { isBeat: false };
  const aW = Number(task['Actual Weight (kg)'] || 0);
  const prW = Number(pr['Best Weight (kg)'] || 0);
  return { isBeat: aW > 0 && aW > prW, prWeight: prW };
}

function getOverloadHint(task) {
  if (!task['Log Type'] || !task['Log Type'].startsWith('Workout')) return null;
  const exercise = task['Item / Exercise'];
  // Find last session for this exercise
  const prev = _allLogs.filter(r => r['Item / Exercise'] === exercise && r.Date < task.Date && r['Actual Reps']).sort((a,b) => b.Date.localeCompare(a.Date))[0];
  if (!prev) return null;
  const prevReps = parseInt(prev['Actual Reps']);
  const prevRIR  = parseInt(prev['Actual RIR']);
  const targetMax = parseInt(String(task['Target Reps']).split('-').pop());
  if (!isNaN(prevReps) && !isNaN(prevRIR) && prevReps >= targetMax && prevRIR >= 2) {
    const curW = Number(task['Weight (kg) / Value'] || 0);
    return `Try ${(curW + 2.5).toFixed(1)}kg this session (hit top of range with RIR ${prevRIR} last time)`;
  }
  return null;
}

function getStallHint(task) {
  if (!task['Log Type'] || !task['Log Type'].startsWith('Workout')) return null;
  const exercise = task['Item / Exercise'];
  const prev2 = _allLogs.filter(r => r['Item / Exercise'] === exercise && r['Actual Weight (kg)'] && r.Date < task.Date)
    .sort((a,b) => b.Date.localeCompare(a.Date)).slice(0, 2);
  if (prev2.length < 2) return null;
  if (prev2[0]['Actual Weight (kg)'] === prev2[1]['Actual Weight (kg)'] &&
      prev2[0]['Actual Reps']        === prev2[1]['Actual Reps']) {
    return `Stalled 2 sessions — consider a technique change or deload set`;
  }
  return null;
}

// ── Log actions ──────────────────────────────────────────────
function toggleExpand(card) {
  const open = card.classList.toggle('expanded');
  const icon = card.querySelector('.expand-icon');
  if (icon) icon.textContent = open ? '▴' : '▾';
}

async function toggleLogComplete(event, date, item, card) {
  const isCompleted = event.target.checked;
  card.classList.toggle('is-completed', isCompleted);
  const content = card.querySelector('.card-content');
  if (content) content.classList.toggle('completed', isCompleted);
  try {
    await apiPost({ action: 'updateLog', date, item, isCompleted, status: isCompleted ? 'Completed' : 'Planned' });
    updateSectionBadge(card);
    // Update local cache
    const row = _allLogs.find(r => r.Date === date && r['Item / Exercise'] === item);
    if (row) { row['Is_Completed'] = isCompleted; row.Status = isCompleted ? 'Completed' : 'Planned'; }
    checkHabitAutoComplete(date);
  } catch(e) { console.error(e); }
}

async function saveLogActual(date, item) {
  const weight = document.getElementById(`aw-weight-${item}`)?.value;
  const sets   = document.getElementById(`aw-sets-${item}`)?.value;
  const reps   = document.getElementById(`aw-reps-${item}`)?.value;
  const rir    = document.getElementById(`aw-rir-${item}`)?.value;
  const val    = document.getElementById(`aw-val-${item}`)?.value;
  const notes  = document.getElementById(`aw-notes-${item}`)?.value;

  try {
    const result = await apiPost({ action: 'updateLog', date, item, actualWeight: weight, actualSets: sets, actualReps: reps, actualRIR: rir, actualValue: val, notes, isCompleted: true, status: 'Completed' });
    if (result.success) {
      const card = document.querySelector(`.log-card[data-item="${item}"]`);
      if (card) {
        card.classList.add('is-completed');
        const cb = card.querySelector('input[type=checkbox]');
        if (cb) cb.checked = true;
        card.querySelector('.card-content')?.classList.add('completed');
        card.classList.remove('expanded');
        updateSectionBadge(card);
      }
      // Check PR
      if (weight) await checkAndUpdatePR(item, date, Number(weight), reps);
      showToast('✓ Saved');
      // Update cache
      const row = _allLogs.find(r => r.Date === date && r['Item / Exercise'] === item);
      if (row) { row['Actual Weight (kg)'] = weight; row['Actual Sets'] = sets; row['Actual Reps'] = reps; row['Actual RIR'] = rir; row['Is_Completed'] = true; row.Status = 'Completed'; }
      checkHabitAutoComplete(date);
    }
  } catch(e) { console.error(e); }
}

async function skipLog(date, item, card) {
  try {
    await apiPost({ action: 'updateLog', date, item, status: 'Skipped', isCompleted: false });
    card?.classList.add('is-skipped');
    showToast('Skipped');
  } catch(e) { console.error(e); }
}

async function pushLog(date, item, card) {
  const tomorrow  = localTomorrow();
  const pushCount = parseInt(card?.dataset.pushCount || 0) + 1;
  try {
    const result = await apiPost({ action: 'pushLog', date, item, pushToDate: tomorrow, pushCount });
    if (result.success) {
      card?.classList.add('is-pushed');
      showToast(`Pushed to tomorrow (${pushCount}×)`);
      await loadAll();
    }
  } catch(e) { console.error(e); }
}

// ── Push entire workout session ──────────────────────────────
async function pushWorkoutGroup(date, logType, sectionEl) {
  const tomorrow = localTomorrow();
  const items    = _allLogs.filter(r => r.Date === date && r['Log Type'] === logType && String(r['Is_Completed']).toUpperCase() !== 'TRUE');
  if (!items.length) return;
  showToast(`Pushing ${items.length} exercises…`);
  for (const item of items) {
    const pushCount = Number(item['Push Count'] || 0) + 1;
    await apiPost({ action: 'pushLog', date, item: item['Item / Exercise'], pushToDate: tomorrow, pushCount });
  }
  showToast(`${logType.replace('Workout - ','')} session pushed to tomorrow`);
  await loadAll();
}

// ── PR tracking ──────────────────────────────────────────────
async function checkAndUpdatePR(exercise, date, weight, reps) {
  const existing = _prs.find(p => p['Exercise'] === exercise);
  if (!existing || weight > Number(existing['Best Weight (kg)'] || 0)) {
    await apiPost({ action: 'updatePR', exercise, date, weight, reps });
    const idx = _prs.findIndex(p => p['Exercise'] === exercise);
    const obj = { Exercise: exercise, Date: date, 'Best Weight (kg)': weight, 'Best Reps': reps };
    if (idx > -1) _prs[idx] = obj; else _prs.push(obj);
  }
}

// ── Section badge ────────────────────────────────────────────
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

// ── Tasks ────────────────────────────────────────────────────
function renderTasks(tasks, dateStr, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const catColors = ['#f472b6','#fb923c','#facc15','#34d399','#60a5fa','#a78bfa','#f87171'];
  let colorIdx = 0;
  const catColorMap = {};
  const grouped = {};
  tasks.forEach(t => { const c = t['Category'] || 'General'; if (!grouped[c]) grouped[c] = []; grouped[c].push(t); });

  let html = '<div class="section-title">Tasks</div>';
  if (!tasks.length) { html += '<div class="empty-state" style="padding:16px 0">No tasks today.</div>'; }

  Object.entries(grouped).forEach(([cat, items]) => {
    if (!catColorMap[cat]) catColorMap[cat] = catColors[colorIdx++ % catColors.length];
    const color = catColorMap[cat];
    html += `<div class="section"><div class="section-header" style="border-left-color:${color}"><span class="section-icon">📌</span><span class="section-label">${cat}</span></div>`;
    items.forEach(task => {
      const isCompleted = String(task.Status).toLowerCase() === 'completed';
      const safeId = (task['Task ID'] || task['Task'] || '').replace(/[^a-zA-Z0-9]/g, '_');
      const subtasks = (task['Sub-tasks'] || '').split('|').map(s => s.trim()).filter(Boolean);
      const pushCount = Number(task['Push Count'] || 0);
      const pushedFrom = task['Pushed From'] || '';

      html += `<div class="card task-card ${isCompleted ? 'is-completed' : ''}" style="border-left-color:${color}" data-task-id="${task['Task ID'] || ''}" data-push-count="${pushCount}">
        <div class="card-main" onclick="toggleExpand(this.parentNode)">
          <input type="checkbox" ${isCompleted ? 'checked' : ''} onclick="event.stopPropagation();toggleTaskComplete(event,'${dateStr}','${task['Task ID'] || ''}',this.closest('.task-card'))">
          <div class="card-content ${isCompleted ? 'completed' : ''}">
            <div class="card-top">
              <div class="title">${task['Task'] || ''}</div>
              <div class="card-actions">
                ${!isCompleted ? `<button class="push-btn" onclick="event.stopPropagation();pushTask('${dateStr}','${task['Task ID'] || ''}',this.closest('.task-card'))">⏭${pushCount > 0 ? ` <span class="push-count">${pushCount}d</span>` : ''}</button>` : ''}
                <span class="expand-icon">▾</span>
              </div>
            </div>
            ${task['Notes'] ? `<div class="details note-text">${task['Notes']}</div>` : ''}
            ${pushedFrom ? `<div class="pushed-tag">Pushed · ${daysSince(pushedFrom)}d ago</div>` : ''}
          </div>
        </div>
        <div class="card-expand"><div class="actual-inputs">
          ${subtasks.length ? `<div class="actual-label">Subtasks</div>
            <div class="subtask-list" id="subtasks-${safeId}">
              ${subtasks.map(s => `<label class="subtask-item"><input type="checkbox" onchange="updateSubtaskProgress('${safeId}')"> ${s}</label>`).join('')}
            </div>
            <div class="subtask-progress" id="prog-${safeId}">0 / ${subtasks.length} done</div>` : ''}
          <div class="actual-label" style="margin-top:${subtasks.length?'10px':'0'}">Time spent</div>
          <div class="input-row"><label>Minutes<input type="number" class="actual-field" id="task-time-${safeId}" placeholder="0" min="0"></label></div>
          <textarea class="actual-notes" id="task-notes-${safeId}" placeholder="Session notes…">${task['Notes'] || ''}</textarea>
          <div class="expand-actions">
            <button class="btn-save" onclick="saveTaskActual('${dateStr}','${task['Task ID'] || ''}','${safeId}')">Save</button>
            <button class="btn-skip" onclick="pushTask('${dateStr}','${task['Task ID'] || ''}',this.closest('.task-card'))">Push</button>
          </div>
        </div></div>
      </div>`;
    });
    html += `</div>`;
  });

  html += `<button class="btn-add-task" onclick="showAddTaskModal('${dateStr}')">+ Add Task</button>`;
  container.innerHTML = html;
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
    card.querySelector('.card-content')?.classList.toggle('completed', isCompleted);
    const row = _allTasks.find(r => r['Task ID'] === taskId);
    if (row) row.Status = isCompleted ? 'Completed' : 'Planned';
    checkHabitAutoComplete(date);
  } catch(e) { console.error(e); }
}

async function saveTaskActual(date, taskId, safeId) {
  const time  = document.getElementById(`task-time-${safeId}`)?.value;
  const notes = document.getElementById(`task-notes-${safeId}`)?.value;
  try {
    const result = await apiPost({ action: 'updateTask', date, taskId, timeSpent: time, notes, status: 'Completed' });
    if (result.success) { showToast('✓ Saved'); await loadAll(); }
  } catch(e) { console.error(e); }
}

async function pushTask(date, taskId, card) {
  const tomorrow  = localTomorrow();
  const pushCount = parseInt(card?.dataset.pushCount || 0) + 1;
  try {
    const result = await apiPost({ action: 'pushTask', date, taskId, pushToDate: tomorrow, pushCount });
    if (result.success) { showToast('Pushed to tomorrow'); await loadAll(); }
  } catch(e) { console.error(e); }
}

// ── Add task modal ───────────────────────────────────────────
function showAddTaskModal(dateStr) {
  const modal = document.getElementById('add-task-modal');
  if (!modal) return;
  modal.dataset.date = dateStr;
  modal.classList.add('open');
}
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

async function submitAddTask() {
  const modal    = document.getElementById('add-task-modal');
  const date     = modal.dataset.date || localToday();
  const category = document.getElementById('new-task-category').value.trim();
  const task     = document.getElementById('new-task-name').value.trim();
  const subtasks = document.getElementById('new-task-subtasks').value.trim().replace(/\n/g, '|');
  const notes    = document.getElementById('new-task-notes').value.trim();
  if (!task) { alert('Task name is required.'); return; }
  try {
    const result = await apiPost({ action: 'addTask', date, category, task, subtasks, notes });
    if (result.success) {
      closeModal('add-task-modal');
      ['new-task-category','new-task-name','new-task-subtasks','new-task-notes'].forEach(id => { document.getElementById(id).value = ''; });
      await loadAll();
    }
  } catch(e) { console.error(e); }
}

// ═══════════════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════════════
function renderCalendar() {
  const today   = localToday();
  const dates   = getWeekDates(_calWeekOffset);
  const start   = dates[0], end = dates[6];

  // Week label
  const fmt = d => new Date(d+'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  document.getElementById('week-label').textContent = `${fmt(start)} – ${fmt(end)}`;

  // Build strip
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let strip = '';
  dates.forEach((date, i) => {
    const isToday    = date === today;
    const isSelected = date === _calSelectedDate;
    const isPast     = date < today;
    const dayLogs    = _allLogs.filter(r => r.Date === date);
    const dayTasks   = _allTasks.filter(r => r.Date === date);
    const allDone    = dayLogs.length > 0 && dayLogs.every(r => String(r['Is_Completed']).toUpperCase() === 'TRUE');

    const dots = getDayDots(dayLogs, dayTasks);
    strip += `<div class="day-pill ${isToday?'today':''} ${isSelected?'selected':''} ${isPast&&!isToday?'past':''}" onclick="selectCalDay('${date}')">
      <span class="day-name">${dayNames[i]}</span>
      <span class="day-num">${new Date(date+'T12:00:00').getDate()}</span>
      <div class="day-dots">${dots}</div>
      ${allDone ? '<span class="day-check">✓</span>' : ''}
    </div>`;
  });
  document.getElementById('week-strip').innerHTML = strip;

  // If a day is selected, render its plan
  if (_calSelectedDate) renderCalDay(_calSelectedDate);
}

function getDayDots(logs, tasks) {
  const colors = new Set();
  logs.forEach(r => {
    const type = r['Log Type'] || '';
    if (type.startsWith('Workout')) colors.add('#10b981');
    else if (type === 'Nutrition') colors.add('#f59e0b');
    else if (type === 'Cardio')    colors.add('#3b82f6');
    else if (type === 'Body Metrics') colors.add('#a78bfa');
  });
  if (tasks.length) colors.add('#f472b6');
  return Array.from(colors).map(c => `<span class="day-dot" style="background:${c}"></span>`).join('');
}

function selectCalDay(date) {
  _calSelectedDate = date;
  renderCalendar();
  renderCalDay(date);
}

function renderCalDay(date) {
  const container  = document.getElementById('cal-plan');
  const dayLogs    = _allLogs.filter(r => r.Date === date);
  const dayTasks   = _allTasks.filter(r => r.Date === date);
  const today      = localToday();
  const readOnly   = date !== today;
  const label      = date === today ? 'Today' : new Date(date+'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<div class="cal-day-header">${label}</div>`;

  // Temp containers
  const logsEl  = document.createElement('div'); logsEl.id  = 'cal-logs-inner';
  const tasksEl = document.createElement('div'); tasksEl.id = 'cal-tasks-inner';

  container.innerHTML = html;
  container.appendChild(logsEl);
  container.appendChild(tasksEl);

  renderLogs(dayLogs, date, 'cal-logs-inner', readOnly);
  renderTasks(dayTasks, date, 'cal-tasks-inner');
}

function shiftWeek(dir) {
  _calWeekOffset += dir;
  renderCalendar();
}

// ═══════════════════════════════════════════════════════════════
//  HABITS
// ═══════════════════════════════════════════════════════════════
function renderHabits() {
  const container = document.getElementById('habits-container');
  if (!_habits.length) {
    container.innerHTML = '<div class="empty-state">No habits found.<br>Add them to your Habits sheet.</div>';
    return;
  }

  const today = localToday();
  let html = '';

  _habits.forEach(habit => {
    const name   = habit['Habit Name'] || '';
    const color  = habit['Color'] || '#10b981';
    const icon   = habit['Icon'] || '✅';
    const linked = habit['Linked Log Type'] || '';
    const type   = habit['Type'] || 'manual';

    // Build 84-day history (12 weeks)
    const days = Array.from({ length: 84 }, (_, i) => addDays(today, -(83 - i)));
    const streak   = calcStreak(name, days, today, linked, type);
    const bestStreak = calcBestStreak(name, days, linked, type);

    const todayDone = isHabitDone(name, today, linked, type);

    html += `<div class="habit-card" style="border-left-color:${color}">
      <div class="habit-top">
        <div>
          <div class="habit-name">${icon} ${name}</div>
          <div class="streak-best">Best streak: ${bestStreak} days</div>
        </div>
        <div class="habit-streak">
          <span class="streak-num" style="color:${color}">${streak}</span>
          <span class="streak-label">day<br>streak</span>
        </div>
      </div>
      <div class="habit-grid">
        ${days.map((d, i) => {
          const done = isHabitDone(name, d, linked, type);
          const isT  = d === today;
          return `<div class="habit-cell ${done?'done':''} ${isT?'today-cell':''}" title="${d}"></div>`;
        }).join('')}
      </div>
      ${type === 'manual' ? `
        <div class="habit-check-row">
          <span class="habit-check-label">Mark today as done</span>
          <button class="habit-check-btn ${todayDone?'checked':''}" 
            onclick="toggleHabit('${name}','${today}',this)">${todayDone ? '✓ Done' : 'Mark Done'}</button>
        </div>` : `<div style="font-size:0.78rem;color:var(--text3);">Auto-tracked from ${linked || 'logs'}</div>`}
    </div>`;
  });

  container.innerHTML = html;
}

function isHabitDone(name, date, linkedLogType, type) {
  if (type === 'manual') {
    return _habitLogs.some(r => r['Habit Name'] === name && r.Date === date && String(r.Completed).toUpperCase() === 'TRUE');
  }
  // Auto: check linked log type
  if (linkedLogType) {
    return _allLogs.some(r => r.Date === date && r['Log Type'] === linkedLogType && String(r['Is_Completed']).toUpperCase() === 'TRUE');
  }
  return false;
}

function calcStreak(name, days, today, linked, type) {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i] > today) continue;
    if (isHabitDone(name, days[i], linked, type)) streak++;
    else break;
  }
  return streak;
}

function calcBestStreak(name, days, linked, type) {
  let best = 0, cur = 0;
  days.forEach(d => {
    if (isHabitDone(name, d, linked, type)) { cur++; best = Math.max(best, cur); } else cur = 0;
  });
  return best;
}

async function toggleHabit(name, date, btn) {
  const isDone = btn.classList.contains('checked');
  const newVal = !isDone;
  try {
    await apiPost({ action: 'logHabit', habitName: name, date, completed: newVal });
    btn.classList.toggle('checked', newVal);
    btn.textContent = newVal ? '✓ Done' : 'Mark Done';
    // Update local cache
    const existing = _habitLogs.find(r => r['Habit Name'] === name && r.Date === date);
    if (existing) existing.Completed = newVal;
    else _habitLogs.push({ 'Habit Name': name, Date: date, Completed: newVal });
    renderHabits();
  } catch(e) { console.error(e); }
}

function checkHabitAutoComplete(date) {
  // Re-render habits after log changes to update auto-tracked habits
  renderHabits();
}

// ═══════════════════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════════════════
function switchProgressTab(tab) {
  _progressTab = tab;
  document.querySelectorAll('.progress-sub').forEach(el => el.style.display = 'none');
  document.getElementById(`progress-${tab}`).style.display = 'block';
  document.querySelectorAll('.tab-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  renderProgressTab(tab);
}

function renderProgress() { renderProgressTab(_progressTab); }

function renderProgressTab(tab) {
  if (tab === 'overview')  renderOverview();
  if (tab === 'body')      renderBody();
  if (tab === 'prs')       renderPRs();
  if (tab === 'insights')  renderInsights();
  if (tab === 'journal')   renderJournal();
  if (tab === 'backlog')   renderBacklog();
}

// ── Overview ─────────────────────────────────────────────────
function renderOverview() {
  const el    = document.getElementById('progress-overview');
  const today = localToday();
  const week  = getWeekDates(0);
  const weekLogs  = _allLogs.filter(r => week.includes(r.Date));
  const weekTasks = _allTasks.filter(r => week.includes(r.Date));

  const workoutsPlanned   = weekLogs.filter(r => r['Log Type'] && r['Log Type'].startsWith('Workout') && r['Target Sets']).length;
  const workoutsDone      = weekLogs.filter(r => r['Log Type'] && r['Log Type'].startsWith('Workout') && String(r['Is_Completed']).toUpperCase() === 'TRUE').length;
  const tasksDone         = weekTasks.filter(r => String(r.Status).toLowerCase() === 'completed').length;
  const tasksTotal        = weekTasks.length;

  // Protein compliance
  const proteinRows = weekLogs.filter(r => r['Item / Exercise'] === 'Protein (g)');
  const proteinHit  = proteinRows.filter(r => Number(r['Actual Value'] || 0) >= Number(r['Weight (kg) / Value'] || 999)).length;
  const proteinPct  = proteinRows.length ? Math.round(proteinHit / proteinRows.length * 100) : null;

  // Latest bodyweight
  const bwRows = _allLogs.filter(r => r['Item / Exercise'] === 'Bodyweight (kg)' && r['Actual Value']).sort((a,b) => b.Date.localeCompare(a.Date));
  const latestBW  = bwRows[0] ? Number(bwRows[0]['Actual Value']) : null;
  const firstBW   = bwRows[bwRows.length - 1] ? Number(bwRows[bwRows.length-1]['Actual Value']) : null;
  const bwDelta   = latestBW && firstBW ? (latestBW - firstBW).toFixed(1) : null;

  // 30-day consistency
  const last30 = Array.from({length:30},(_,i)=>addDays(today,-i));
  const daysWithActivity = last30.filter(d => _allLogs.some(r => r.Date === d && String(r['Is_Completed']).toUpperCase() === 'TRUE')).length;
  const consistency30 = Math.round(daysWithActivity / 30 * 100);

  // 7-day BW trend
  const bw7 = Array.from({length:7},(_,i) => {
    const d = addDays(today, -(6-i));
    const row = _allLogs.filter(r => r.Date === d && r['Item / Exercise'] === 'Bodyweight (kg)' && r['Actual Value']).sort((a,b)=>b.Date.localeCompare(a.Date))[0];
    return { date: d, val: row ? Number(row['Actual Value']) : null };
  });
  const bwMax = Math.max(...bw7.map(b => b.val || 0)) || 100;
  const bwMin = Math.min(...bw7.filter(b=>b.val).map(b=>b.val)) || 80;
  const bwRange = bwMax - bwMin || 1;

  // Last check-in
  const lastCheckin = _checkins.sort((a,b)=>b.Date?.localeCompare(a.Date))[0];

  // Last readiness
  const todayReadiness = _readiness.find(r => r.Date === today);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="border-left-color:#10b981">
        <div class="stat-value" style="color:#10b981">${workoutsDone}<span style="font-size:1rem;color:var(--text3)">/${workoutsPlanned}</span></div>
        <div class="stat-label">Workouts this week</div>
      </div>
      <div class="stat-card" style="border-left-color:#f472b6">
        <div class="stat-value" style="color:#f472b6">${tasksDone}<span style="font-size:1rem;color:var(--text3)">/${tasksTotal}</span></div>
        <div class="stat-label">Tasks this week</div>
      </div>
      <div class="stat-card" style="border-left-color:#a78bfa">
        <div class="stat-value" style="color:#a78bfa">${consistency30}%</div>
        <div class="stat-label">30-day consistency</div>
        <div class="stat-sub">${daysWithActivity} active days</div>
      </div>
      <div class="stat-card" style="border-left-color:#f59e0b">
        <div class="stat-value" style="color:#f59e0b">${proteinPct !== null ? proteinPct+'%' : '—'}</div>
        <div class="stat-label">Protein compliance</div>
      </div>
      ${latestBW ? `<div class="stat-card full" style="border-left-color:#3b82f6">
        <div class="stat-value" style="color:#3b82f6">${latestBW}kg <span style="font-size:0.9rem;color:${bwDelta>=0?'var(--red)':'var(--accent)'}">${bwDelta !== null ? (bwDelta>=0?'+':'')+bwDelta+'kg' : ''}</span></div>
        <div class="stat-label">Bodyweight (total change)</div>
      </div>` : ''}
    </div>

    <div class="trend-card">
      <div class="trend-title">Bodyweight — 7 days</div>
      <div class="trend-chart">
        ${bw7.map(b => {
          const pct = b.val ? Math.max(8, ((b.val - bwMin) / bwRange) * 52 + 8) : 4;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center">
            <div class="trend-bar" style="width:100%;height:${pct}px;background:${b.val?'var(--accent)':'rgba(255,255,255,0.06)'}">
              ${b.val ? `<span class="bw-value">${b.val}</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="trend-labels">${bw7.map(b=>`<div class="trend-label">${new Date(b.date+'T12:00:00').toLocaleDateString('en-AU',{weekday:'narrow'})}</div>`).join('')}</div>
    </div>

    ${todayReadiness ? `<div class="summary-card">
      <div class="summary-title">Today's Readiness</div>
      <div class="summary-row"><span class="summary-key">Sleep</span><span class="summary-val">${todayReadiness['Sleep Quality']}/5</span></div>
      <div class="summary-row"><span class="summary-key">Soreness</span><span class="summary-val">${todayReadiness['Soreness']}/5</span></div>
      <div class="summary-row"><span class="summary-key">Stress</span><span class="summary-val">${todayReadiness['Stress']}/5</span></div>
      <div class="summary-row"><span class="summary-key">Hours slept</span><span class="summary-val">${todayReadiness['Sleep Hours'] || '—'}</span></div>
      <div class="summary-row"><span class="summary-key">Overall</span><span class="summary-val" style="color:var(--accent)">${todayReadiness['Overall Score']}/10</span></div>
    </div>` : ''}

    ${lastCheckin ? `<div class="checkin-card">
      <div class="section-title">Last Check-in · ${lastCheckin.Date}</div>
      <div class="checkin-q">What went well</div><div class="checkin-a">${lastCheckin['Went Well'] || '—'}</div>
      <div class="checkin-q" style="margin-top:8px">Improve</div><div class="checkin-a">${lastCheckin['Improve'] || '—'}</div>
      <div class="checkin-q" style="margin-top:8px">Goal</div><div class="checkin-a">${lastCheckin['Goal'] || '—'}</div>
    </div>` : ''}
  `;
}

// ── Body ─────────────────────────────────────────────────────
function renderBody() {
  const el = document.getElementById('progress-body');
  const latest = _measurements.sort((a,b)=>b.Date?.localeCompare(a.Date))[0];
  const prev   = _measurements.sort((a,b)=>b.Date?.localeCompare(a.Date))[1];
  const fields = ['Chest (cm)','Waist (cm)','Hips (cm)','Arms (cm)','Thighs (cm)','Neck (cm)'];

  let html = '<div class="trend-card">';
  if (!latest) { html += '<div class="empty-state">No measurements yet. Log them in Settings.</div>'; }
  else {
    html += `<div class="trend-title">Latest measurements · ${latest.Date}</div>`;
    html += fields.map(f => {
      const val  = latest[f];
      const pVal = prev ? prev[f] : null;
      const delta = (val && pVal) ? (Number(val) - Number(pVal)).toFixed(1) : null;
      return val ? `<div class="measurement-row">
        <span class="measurement-label">${f}</span>
        <span class="measurement-val">${val}
          ${delta !== null ? `<span class="measurement-delta ${Number(delta)>0?'delta-up':'delta-down'}">${Number(delta)>0?'+':''}${delta}</span>` : ''}
        </span>
      </div>` : '';
    }).join('');
  }
  html += '</div>';

  // TDEE estimate
  const bwRows = _allLogs.filter(r => r['Item / Exercise'] === 'Bodyweight (kg)' && r['Actual Value']).sort((a,b)=>b.Date.localeCompare(a.Date));
  const calRows = _allLogs.filter(r => r['Item / Exercise'] === 'Calories (kcal)').sort((a,b)=>b.Date.localeCompare(a.Date));
  if (bwRows.length >= 2 && calRows.length >= 7) {
    const bwChange  = Number(bwRows[0]['Actual Value']) - Number(bwRows[bwRows.length-1]['Actual Value']);
    const days      = daysSince(bwRows[bwRows.length-1].Date) || 1;
    const avgCals   = calRows.slice(0, 7).reduce((s,r) => s + Number(r['Weight (kg) / Value'] || 0), 0) / Math.min(7, calRows.length);
    const calDeficit = (bwChange * 7700) / days;
    const tdee       = Math.round(avgCals - calDeficit);
    if (tdee > 0) {
      html += `<div class="summary-card"><div class="summary-title">Estimated TDEE</div>
        <div class="summary-row"><span class="summary-key">Based on ${days} days of data</span><span class="summary-val" style="color:var(--accent)">${tdee} kcal/day</span></div>
        <div class="summary-row"><span class="summary-key">Avg intake</span><span class="summary-val">${Math.round(avgCals)} kcal</span></div>
        <div class="summary-row"><span class="summary-key">BW change</span><span class="summary-val">${bwChange.toFixed(1)}kg</span></div>
      </div>`;
    }
  }
  el.innerHTML = html;
}

// ── PRs ──────────────────────────────────────────────────────
function renderPRs() {
  const el = document.getElementById('progress-prs');
  if (!_prs.length) { el.innerHTML = '<div class="empty-state">No PRs yet. Log some workouts!</div>'; return; }
  let html = '<div class="trend-card"><div class="trend-title">Personal Records</div>';
  _prs.sort((a,b)=>b.Date?.localeCompare(a.Date)).forEach(pr => {
    html += `<div class="pr-row">
      <div><div class="pr-exercise">${pr['Exercise']}</div><div class="pr-date">${pr['Date']}</div></div>
      <div style="text-align:right"><div class="pr-detail">${pr['Best Weight (kg)']}kg × ${pr['Best Reps']} reps</div></div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── Insights ─────────────────────────────────────────────────
function renderInsights() {
  const el = document.getElementById('progress-insights');
  const insights = [];
  const today = localToday();

  // Sleep vs performance correlation
  const readinessWithSleep = _readiness.filter(r => r['Sleep Hours'] && r['Overall Score']);
  if (readinessWithSleep.length >= 5) {
    const highSleep  = readinessWithSleep.filter(r => Number(r['Sleep Hours']) >= 7);
    const lowSleep   = readinessWithSleep.filter(r => Number(r['Sleep Hours']) < 7);
    if (highSleep.length && lowSleep.length) {
      const avgHighScore = highSleep.reduce((s,r)=>s+Number(r['Overall Score']),0)/highSleep.length;
      const avgLowScore  = lowSleep.reduce((s,r)=>s+Number(r['Overall Score']),0)/lowSleep.length;
      const diff = (avgHighScore - avgLowScore).toFixed(1);
      if (Number(diff) > 0.5) insights.push({ label: 'Sleep & Performance', text: `Your readiness score is ${diff} points higher on days you sleep 7h+. Prioritise sleep.` });
    }
  }

  // Most consistent habit
  if (_habits.length) {
    const streaks = _habits.map(h => ({
      name: h['Habit Name'],
      streak: calcStreak(h['Habit Name'], Array.from({length:84},(_,i)=>addDays(today,-(83-i))), today, h['Linked Log Type'], h['Type'])
    })).sort((a,b)=>b.streak-a.streak);
    if (streaks[0]?.streak > 3) insights.push({ label: 'Top Habit', text: `${streaks[0].name} is your most consistent habit — ${streaks[0].streak} days straight. Keep it up.` });
  }

  // Protein vs bodyweight
  const proteinRows = _allLogs.filter(r => r['Item / Exercise'] === 'Protein (g)');
  const hitDays = proteinRows.filter(r => Number(r['Actual Value']||0) >= Number(r['Weight (kg) / Value']||999)).map(r=>r.Date);
  const missDays = proteinRows.filter(r => r['Actual Value'] && Number(r['Actual Value']||0) < Number(r['Weight (kg) / Value']||999)).map(r=>r.Date);
  if (hitDays.length >= 3 && missDays.length >= 3) {
    insights.push({ label: 'Protein Compliance', text: `You hit your protein target ${hitDays.length} of ${proteinRows.filter(r=>r['Actual Value']).length} logged days. ${hitDays.length > missDays.length ? 'Great consistency.' : 'Try meal prepping to hit targets more reliably.'}` });
  }

  // Stalled exercises
  const stalledExercises = [];
  const exercises = [...new Set(_allLogs.filter(r=>r['Log Type']?.startsWith('Workout')).map(r=>r['Item / Exercise']))];
  exercises.forEach(ex => {
    const rows = _allLogs.filter(r=>r['Item / Exercise']===ex && r['Actual Weight (kg)']).sort((a,b)=>b.Date.localeCompare(a.Date)).slice(0,3);
    if (rows.length >= 3 && rows[0]['Actual Weight (kg)'] === rows[1]['Actual Weight (kg)'] && rows[1]['Actual Weight (kg)'] === rows[2]['Actual Weight (kg)']) stalledExercises.push(ex);
  });
  if (stalledExercises.length) insights.push({ label: 'Stalled Lifts', text: `${stalledExercises.join(', ')} ${stalledExercises.length===1?'has':'have'} been stuck for 3+ sessions. Consider technique review, deload, or rep range change.` });

  if (!insights.length) { el.innerHTML = '<div class="empty-state">Log more data to unlock insights.</div>'; return; }
  el.innerHTML = insights.map(i => `<div class="insight-card"><div class="insight-label">${i.label}</div><div class="insight-text">${i.text}</div></div>`).join('');
}

// ── Journal ──────────────────────────────────────────────────
function renderJournal() {
  const el     = document.getElementById('progress-journal');
  const today  = localToday();
  const quote  = _quotes.length ? _quotes[Math.floor(Math.random() * _quotes.length)] : null;

  let html = `
    <div class="modal-field">
      <label style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--text3);display:block;margin-bottom:5px;">Today's Note</label>
      <textarea class="journal-write" id="journal-input" placeholder="How did today go? Energy, focus, mood…"></textarea>
      <button class="btn-primary" onclick="saveJournal()">Save Note</button>
    </div>
    <div class="section-title" style="margin-top:16px">Past entries</div>`;

  const entries = _allLogs.filter(r => r['Log Type'] === 'Journal').sort((a,b)=>b.Date.localeCompare(a.Date)).slice(0,10);
  if (!entries.length) html += '<div class="empty-state" style="padding:12px 0">No entries yet.</div>';
  entries.forEach(e => {
    html += `<div class="journal-entry"><div class="journal-date">${e.Date}</div><div class="journal-text">${e['Notes'] || ''}</div></div>`;
  });
  el.innerHTML = html;
}

async function saveJournal() {
  const text  = document.getElementById('journal-input')?.value?.trim();
  const today = localToday();
  if (!text) return;
  try {
    await apiPost({ action: 'addJournalEntry', date: today, text });
    showToast('Journal saved');
    document.getElementById('journal-input').value = '';
    await loadAll();
    renderJournal();
  } catch(e) { console.error(e); }
}

// ── Backlog ──────────────────────────────────────────────────
function renderBacklog() {
  const el = document.getElementById('progress-backlog');
  const pushedLogs  = _allLogs.filter(r  => String(r.Status).toLowerCase()  === 'pushed');
  const pushedTasks = _allTasks.filter(r => String(r.Status).toLowerCase() === 'pushed');

  const all = [
    ...pushedLogs.map(r  => ({ type:'log',  label: r['Item / Exercise'], category: r['Log Type'],  pushedFrom: r['Pushed From']||r.Date, pushCount: r['Push Count']||0, date: r.Date, item: r['Item / Exercise'] })),
    ...pushedTasks.map(r => ({ type:'task', label: r['Task'],            category: r['Category'],  pushedFrom: r['Pushed From']||r.Date, pushCount: r['Push Count']||0, date: r.Date, taskId: r['Task ID'] }))
  ].sort((a,b) => daysSince(b.pushedFrom) - daysSince(a.pushedFrom));

  if (!all.length) { el.innerHTML = '<div class="empty-state">Nothing in the backlog. You\'re on top of it 💪</div>'; return; }

  el.innerHTML = all.map(item => {
    const days   = daysSince(item.pushedFrom);
    const urgency = days >= 3 ? 'urgent' : days >= 1 ? 'warning' : '';
    return `<div class="backlog-item ${urgency}">
      <div class="backlog-meta">
        <span class="backlog-cat">${item.category || 'Task'}</span>
        <span class="backlog-age ${urgency}">${days}d overdue</span>
      </div>
      <div class="backlog-label">${item.label}</div>
      <div class="backlog-actions">
        <button class="btn-reschedule" onclick="rescheduleToToday('${item.type}','${item.date}','${item.item||item.taskId}')">Do today</button>
        <button class="btn-push-again" onclick="pushAgain('${item.type}','${item.date}','${item.item||item.taskId}')">Push again</button>
      </div>
    </div>`;
  }).join('');
}

async function rescheduleToToday(type, date, identifier) {
  const today  = localToday();
  const action = type === 'log' ? 'pushLog' : 'pushTask';
  const payload = type === 'log' ? { action, date, item: identifier, pushToDate: today } : { action, date, taskId: identifier, pushToDate: today };
  try { await apiPost(payload); showToast('Moved to today!'); await loadAll(); } catch(e) { console.error(e); }
}
async function pushAgain(type, date, identifier) {
  const tomorrow = localTomorrow();
  const action   = type === 'log' ? 'pushLog' : 'pushTask';
  const payload  = type === 'log' ? { action, date, item: identifier, pushToDate: tomorrow } : { action, date, taskId: identifier, pushToDate: tomorrow };
  try { await apiPost(payload); showToast('Pushed to tomorrow'); await loadAll(); } catch(e) { console.error(e); }
}

// ═══════════════════════════════════════════════════════════════
//  READINESS
// ═══════════════════════════════════════════════════════════════
function buildScoreRows() {
  ['sleep','soreness','stress'].forEach(key => {
    const el = document.getElementById(`score-${key}`);
    if (!el) return;
    el.innerHTML = [1,2,3,4,5].map(n =>
      `<div class="score-btn" data-key="${key}" data-val="${n}" onclick="selectScore('${key}',${n},this)">${n}</div>`
    ).join('');
  });
}
function selectScore(key, val, btn) {
  document.querySelectorAll(`.score-btn[data-key="${key}"]`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function getScore(key) {
  const sel = document.querySelector(`.score-btn[data-key="${key}"].selected`);
  return sel ? Number(sel.dataset.val) : null;
}
function openReadinessModal() { document.getElementById('readiness-modal').classList.add('open'); }
async function saveReadiness() {
  const sleep    = getScore('sleep');
  const soreness = getScore('soreness');
  const stress   = getScore('stress');
  const hours    = document.getElementById('sleep-hours')?.value;
  const notes    = document.getElementById('readiness-notes')?.value;
  const overall  = sleep && soreness && stress ? Math.round(((sleep + (6-soreness) + (6-stress)) / 3) * 2) : null;
  const today    = localToday();
  try {
    await apiPost({ action: 'saveReadiness', date: today, sleep, soreness, stress, sleepHours: hours, notes, overallScore: overall });
    closeModal('readiness-modal');
    showToast(`Readiness: ${overall}/10`);
    _readiness = _readiness.filter(r => r.Date !== today);
    _readiness.push({ Date: today, 'Sleep Quality': sleep, Soreness: soreness, Stress: stress, 'Sleep Hours': hours, Notes: notes, 'Overall Score': overall });
    renderReadinessBadge();
    renderBanners(_allLogs.filter(r => r.Date === today));
  } catch(e) { console.error(e); }
}
function renderReadinessBadge() {
  const today    = localToday();
  const todayR   = _readiness.find(r => r.Date === today);
  const badge    = document.getElementById('readiness-badge');
  if (!badge) return;
  if (todayR) {
    const score = Number(todayR['Overall Score'] || 0);
    const color = score >= 7 ? 'var(--accent)' : score >= 4 ? 'var(--amber)' : 'var(--red)';
    badge.textContent = `Readiness ${score}/10`;
    badge.style.color = color;
    badge.style.background = score >= 7 ? 'var(--accent-dim)' : score >= 4 ? 'var(--amber-dim)' : 'var(--red-dim)';
  } else {
    badge.textContent = 'Log Readiness';
    badge.style.color = ''; badge.style.background = '';
  }
}
function renderConsistencyBadge() {
  const today   = localToday();
  const last30  = Array.from({length:30},(_,i)=>addDays(today,-i));
  const active  = last30.filter(d => _allLogs.some(r => r.Date === d && String(r['Is_Completed']).toUpperCase() === 'TRUE')).length;
  const pct     = Math.round(active/30*100);
  const badge   = document.getElementById('consistency-badge');
  if (badge) badge.textContent = `${pct}%`;
}

// ── Quote ────────────────────────────────────────────────────
function renderQuote() {
  const el = document.getElementById('quote-container');
  if (!el || !_quotes.length) return;
  const q = _quotes[new Date().getDate() % _quotes.length]; // rotate daily
  el.innerHTML = `<div class="quote-card"><div class="quote-text">"${q['Quote'] || ''}"</div>${q['Author'] ? `<div class="quote-author">— ${q['Author']}</div>` : ''}</div>`;
}

// ── Measurements ─────────────────────────────────────────────
async function saveMeasurements() {
  const today = localToday();
  const fields = ['chest','waist','hips','arms','thighs','neck'];
  const payload = { action: 'saveMeasurements', date: today };
  fields.forEach(f => { payload[f] = document.getElementById(`m-${f}`)?.value || ''; });
  try {
    await apiPost(payload);
    showToast('Measurements saved');
    await loadAll();
  } catch(e) { console.error(e); }
}

// ── Check-in ─────────────────────────────────────────────────
async function saveCheckin() {
  const today   = localToday();
  const well    = document.getElementById('ci-well')?.value?.trim();
  const improve = document.getElementById('ci-improve')?.value?.trim();
  const goal    = document.getElementById('ci-goal')?.value?.trim();
  try {
    await apiPost({ action: 'saveCheckin', date: today, wentWell: well, improve, goal });
    showToast('Check-in saved');
    ['ci-well','ci-improve','ci-goal'].forEach(id => { document.getElementById(id).value = ''; });
    await loadAll();
  } catch(e) { console.error(e); }
}

// ── Utils ────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}