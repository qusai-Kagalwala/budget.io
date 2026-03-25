/* ════════════════════════════════════════════
   budget.io — app.js
   ════════════════════════════════════════════ */

'use strict';

// ── CONSTANTS ──────────────────────────────────
const CAT_COLORS = {
  Salary:'#7fff6e', Freelance:'#4eaaff', Investment:'#b48eff',
  Gift:'#ffe45e',  'Other Income':'#5effd8',
  Food:'#ff5c5c',  Transport:'#ff9f43', Education:'#54a0ff',
  Shopping:'#ff6b9d', Utilities:'#ffd32a', Health:'#1dd1a1',
  Entertainment:'#c8d6e5', Rent:'#e17055', Other:'#a29bfe'
};
const CAT_EMOJI = {
  Salary:'💼', Freelance:'💻', Investment:'📈', Gift:'🎁', 'Other Income':'💰',
  Food:'🍜', Transport:'🚌', Education:'📚', Shopping:'🛍️',
  Utilities:'💡', Health:'🏥', Entertainment:'🎮', Rent:'🏠', Other:'📦'
};
const INCOME_CATS  = ['Salary','Freelance','Investment','Gift','Other Income'];
const EXPENSE_CATS = ['Food','Transport','Education','Shopping','Utilities','Health','Entertainment','Rent','Other'];

// ── STATE ──────────────────────────────────────
let transactions = load('bp_txns', []);
let goals        = load('bp_goals', {});
let theme        = load('bp_theme', 'dark');
let currentType  = 'income';
let selectedCat  = '';
let currentPage  = 'dashboard';
let filterCat    = 'all';
let chartInstance = null;
let trendInstance = null;
let viewMonth;   // YYYY-MM string
let editingId    = null;

// ── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  viewMonth = toMonthStr(now);

  applyTheme(theme);
  setTodayDate();
  buildCatChips();
  setType('income');

  document.getElementById('isRecurring').addEventListener('change', e => {
    document.getElementById('recurFreqRow').style.display = e.target.checked ? 'block' : 'none';
    document.getElementById('recurLabel').textContent = e.target.checked ? 'On' : 'Off';
  });

  updateMonthDisplay();
  renderAll();

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    save('bp_theme', theme);
  });
});

// ── UTILITIES ──────────────────────────────────
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function fmt(n, abs = true) {
  const v = abs ? Math.abs(n) : n;
  if (Math.abs(v) >= 100000) return '₹' + (v/100000).toFixed(1) + 'L';
  if (Math.abs(v) >= 1000)   return '₹' + (v/1000).toFixed(1) + 'k';
  return '₹' + v.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 2});
}
function fmtFull(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function formatDate(d) {
  const [y,m,day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]}`;
}
function formatDateFull(d) {
  const [y,m,day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}
function dayLabel(d) {
  const date = new Date(d + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDateFull(d);
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeToggle').textContent = t === 'dark' ? '🌙' : '☀️';
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content', t === 'dark' ? '#0d0f14' : '#f2f4f8');
}
function setTodayDate() {
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
}

// ── MONTH NAVIGATION ───────────────────────────
function updateMonthDisplay() {
  const [y, m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  document.getElementById('monthName').textContent =
    d.toLocaleString('default', {month:'long'});
  document.getElementById('monthYear').textContent = y;
}
function shiftMonth(dir) {
  const [y, m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  viewMonth = toMonthStr(d);
  updateMonthDisplay();
  renderAll();
}

// ── PAGE NAVIGATION ────────────────────────────
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  currentPage = page;
  window.scrollTo(0,0);
  if (page === 'transactions') renderTransactions();
  if (page === 'stats') renderStats();
  if (page === 'goals') renderGoals();
  if (page === 'add') {
    setType(currentType);
    document.getElementById('heroAmount').focus();
  }
}

// ── TYPE & CATEGORY ────────────────────────────
function setType(t) {
  currentType = t;
  selectedCat = '';

  document.getElementById('bigBtnIncome').className  = 'ttb income'  + (t==='income'  ? ' active' : '');
  document.getElementById('bigBtnExpense').className = 'ttb expense' + (t==='expense' ? ' active' : '');
  document.getElementById('submitLabel').textContent = t === 'income' ? 'Add Income' : 'Add Expense';
  document.getElementById('submitBtn').style.background = t === 'income' ? 'var(--income)' : 'var(--expense)';
  buildCatChips();
}

function buildCatChips() {
  const cats = currentType === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const el = document.getElementById('catChips');
  el.innerHTML = cats.map(c =>
    `<button class="cat-chip${selectedCat===c?' active':''}" onclick="selectCat('${c}')">${CAT_EMOJI[c]} ${c}</button>`
  ).join('');
}

function selectCat(cat) {
  selectedCat = cat;
  buildCatChips();
}

// ── FILTER BY CAT ──────────────────────────────
function filterByCat(el, cat) {
  filterCat = cat;
  document.querySelectorAll('.fchip').forEach(f => f.classList.remove('active'));
  el.classList.add('active');
  renderTransactions();
}

// ── ADD TRANSACTION ────────────────────────────
function addTransaction() {
  const amt  = parseFloat(document.getElementById('heroAmount').value);
  const desc = document.getElementById('desc').value.trim();
  const date = document.getElementById('txDate').value;
  const note = document.getElementById('txNote').value.trim();
  const recurring = document.getElementById('isRecurring').checked;
  const recurFreq = document.getElementById('recurFreq').value;

  if (!amt || amt <= 0) { toast('Enter a valid amount ₹'); return; }
  if (!desc)            { toast('Add a description'); return; }
  if (!selectedCat)     { toast('Pick a category'); return; }
  if (!date)            { toast('Choose a date'); return; }

  const tx = {
    id: Date.now(),
    type: currentType, amt, desc, cat: selectedCat, date, note,
    recurring, recurFreq: recurring ? recurFreq : null
  };

  transactions.unshift(tx);
  save('bp_txns', transactions);

  // Reset form
  document.getElementById('heroAmount').value = '';
  document.getElementById('desc').value = '';
  document.getElementById('txNote').value = '';
  document.getElementById('isRecurring').checked = false;
  document.getElementById('recurFreqRow').style.display = 'none';
  document.getElementById('recurLabel').textContent = 'Off';
  selectedCat = '';
  buildCatChips();
  setTodayDate();

  toast(`${currentType === 'income' ? 'Income' : 'Expense'} added ✓`);
  viewMonth = tx.date.substring(0,7);
  updateMonthDisplay();
  switchPage('dashboard');
  renderAll();
}

// ── DELETE ─────────────────────────────────────
function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  save('bp_txns', transactions);
  renderAll();
  if (currentPage === 'transactions') renderTransactions();
  toast('Deleted');
}

// ── FILTERED TRANSACTIONS ──────────────────────
function monthTxns() {
  return transactions.filter(t => t.date.startsWith(viewMonth));
}

// ── RENDER ALL ─────────────────────────────────
function renderAll() {
  const txns = monthTxns();
  const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const balance = income - expense;
  const savPct  = income > 0 ? Math.round((balance/income)*100) : 0;

  // Stats
  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);
  document.getElementById('totalBalance').textContent = fmt(balance, false);
  document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--accent2)' : 'var(--danger)';
  document.getElementById('incomeCount').textContent  = txns.filter(t=>t.type==='income').length + ' entries';
  document.getElementById('expenseCount').textContent = txns.filter(t=>t.type==='expense').length + ' entries';
  document.getElementById('savingsRate').textContent  = savPct + '% saved';

  renderInsights(txns, income, expense);
  renderChart(txns);
  renderCatBars(txns, expense);
  renderRecent(txns);
}

// ── INSIGHTS ───────────────────────────────────
function renderInsights(txns, income, expense) {
  const banner = document.getElementById('insightsBanner');
  const scroll = document.getElementById('insightScroll');
  const insights = [];

  // Savings rate
  if (income > 0) {
    const r = ((income - expense) / income * 100).toFixed(0);
    if (r >= 20) insights.push({ dot:'🟢', text:`Great job! You're saving ${r}% of your income this month.` });
    else if (r > 0) insights.push({ dot:'🟡', text:`You're saving ${r}% this month. Try to hit 20%+.` });
    else insights.push({ dot:'🔴', text:`You're spending more than you earn this month. Watch out!` });
  }

  // Biggest expense category
  const catMap = {};
  txns.filter(t=>t.type==='expense').forEach(t => catMap[t.cat] = (catMap[t.cat]||0) + t.amt);
  const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  if (sorted.length > 0) {
    const [topCat, topAmt] = sorted[0];
    insights.push({ dot:'📊', text:`Biggest spend: ${CAT_EMOJI[topCat]||''} ${topCat} at ${fmtFull(topAmt)}.` });
  }

  // Recurring reminders
  const recTxns = transactions.filter(t => t.recurring && t.date.startsWith(viewMonth));
  if (recTxns.length > 0) {
    insights.push({ dot:'🔁', text:`${recTxns.length} recurring transaction${recTxns.length>1?'s':''} this month.` });
  }

  // Goal warnings
  const overGoals = [];
  Object.entries(goals).forEach(([cat, limit]) => {
    const spent = txns.filter(t=>t.type==='expense'&&t.cat===cat).reduce((s,t)=>s+t.amt,0);
    if (spent > limit) overGoals.push(cat);
    else if (spent / limit >= .8) insights.push({ dot:'⚠️', text:`${CAT_EMOJI[cat]} ${cat} budget at ${Math.round(spent/limit*100)}% — almost at limit.` });
  });
  if (overGoals.length) insights.push({ dot:'🚨', text:`Over budget in: ${overGoals.join(', ')}.` });

  if (!insights.length) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  scroll.innerHTML = insights.map(i =>
    `<div class="insight-item"><span class="ii-dot">${i.dot}</span><span>${esc(i.text)}</span></div>`
  ).join('');
}

// ── CHART ──────────────────────────────────────
let chartMode = 'doughnut';
function setChartType(type, btn) {
  chartMode = type;
  document.querySelectorAll('.ctt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChart(monthTxns());
}

function renderChart(txns) {
  const canvas = document.getElementById('mainChart');
  const ctx = canvas.getContext('2d');
  if (chartInstance) chartInstance.destroy();

  if (chartMode === 'doughnut') {
    const catMap = {};
    txns.filter(t=>t.type==='expense').forEach(t => catMap[t.cat] = (catMap[t.cat]||0) + t.amt);
    const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);

    if (!entries.length) {
      canvas.style.display = 'none';
      document.getElementById('chartLegend').innerHTML =
        `<div style="color:var(--muted);font-family:'DM Mono',monospace;font-size:.78rem;width:100%;text-align:center;padding:20px">No expenses yet</div>`;
      return;
    }
    canvas.style.display = 'block';
    canvas.style.maxHeight = '220px';

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entries.map(e=>e[0]),
        datasets: [{
          data: entries.map(e=>e[1]),
          backgroundColor: entries.map(e => CAT_COLORS[e[0]] || '#a29bfe'),
          borderWidth: 3,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#161921',
          hoverOffset: 8
        }]
      },
      options: {
        cutout: '65%', responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim(),
            titleColor: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),
            bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border').trim(),
            borderWidth: 1,
            callbacks: { label: ctx => ` ${fmtFull(ctx.raw)}` }
          }
        }
      }
    });

    document.getElementById('chartLegend').innerHTML = entries.slice(0,6).map(e =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${CAT_COLORS[e[0]]||'#a29bfe'}"></div>
        <span class="legend-label">${e[0]}</span>
       </div>`
    ).join('');

  } else {
    // Bar mode — monthly
    const monthMap = {};
    transactions.forEach(t => {
      const mon = t.date.substring(0,7);
      if (!monthMap[mon]) monthMap[mon] = {income:0, expense:0};
      monthMap[mon][t.type] += t.amt;
    });
    const labels = Object.keys(monthMap).sort().slice(-6);
    const monthNames = labels.map(l => {
      const [y,m] = l.split('-');
      return new Date(y,m-1).toLocaleString('default',{month:'short'});
    });

    canvas.style.display = 'block';
    canvas.style.maxHeight = '220px';

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthNames.length ? monthNames : ['—'],
        datasets: [
          { label:'Income',  data: labels.map(l=>monthMap[l]?.income||0),  backgroundColor:'rgba(127,255,110,.75)', borderColor:'#7fff6e', borderWidth:1.5, borderRadius:6 },
          { label:'Expense', data: labels.map(l=>monthMap[l]?.expense||0), backgroundColor:'rgba(255,92,92,.65)',   borderColor:'#ff5c5c', borderWidth:1.5, borderRadius:6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend:{ display:false }, tooltip:{
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim(),
          bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border').trim(),
          borderWidth:1,
          callbacks:{ label: ctx => ` ${fmtFull(ctx.raw)}` }
        }},
        scales: {
          x: { grid:{color:'rgba(128,128,128,.08)'}, ticks:{color:'#7a7f94',font:{family:"'DM Mono'"}} },
          y: { grid:{color:'rgba(128,128,128,.08)'}, ticks:{color:'#7a7f94',font:{family:"'DM Mono'"},callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)} }
        }
      }
    });

    document.getElementById('chartLegend').innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#7fff6e"></div><span class="legend-label">Income</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:#ff5c5c"></div><span class="legend-label">Expense</span></div>
    `;
  }
}

// ── CAT BARS ───────────────────────────────────
function renderCatBars(txns, totalExpense) {
  const el = document.getElementById('catBars');
  const expenses = txns.filter(t=>t.type==='expense');
  if (!expenses.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span><p>No expenses this month</p></div>`;
    document.getElementById('catSubtitle').textContent = '';
    return;
  }
  const catMap = {};
  expenses.forEach(t => catMap[t.cat] = (catMap[t.cat]||0) + t.amt);
  const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  document.getElementById('catSubtitle').textContent = sorted.length + ' categories';

  el.innerHTML = sorted.map(([cat, amt]) => {
    const pct = totalExpense ? Math.round(amt/totalExpense*100) : 0;
    const clr = CAT_COLORS[cat] || '#a29bfe';
    return `
      <div class="cat-row">
        <div class="cat-info">
          <span class="cat-name">${CAT_EMOJI[cat]||''} ${cat}</span>
          <span class="cat-val">${fmt(amt)}</span>
        </div>
        <div class="cat-bar-wrap">
          <div class="cat-bar" style="width:${pct}%;background:${clr}"></div>
        </div>
        <div class="cat-pct">${pct}%</div>
      </div>`;
  }).join('');
}

// ── RECENT LIST ────────────────────────────────
function renderRecent(txns) {
  const el = document.getElementById('recentList');
  const recent = txns.slice(0, 5);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">💸</span><p>No transactions this month.<br/>Tap + to add one.</p></div>`;
    return;
  }
  el.innerHTML = recent.map(t => txHTML(t)).join('');
}

// ── FULL TRANSACTION LIST ──────────────────────
function renderTransactions() {
  const search = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const typeF  = document.getElementById('filterType')?.value || 'all';
  const el     = document.getElementById('txGroupedList');

  let filtered = monthTxns().filter(t => {
    const matchSearch = !search || t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search);
    const matchType   = typeF === 'all' || t.type === typeF;
    const matchCat    = filterCat === 'all' || t.cat === filterCat;
    return matchSearch && matchType && matchCat;
  });

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span><p>No transactions found</p></div>`;
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(t => { (groups[t.date] = groups[t.date]||[]).push(t); });
  const sortedDates = Object.keys(groups).sort((a,b)=>b.localeCompare(a));

  el.innerHTML = sortedDates.map(date => {
    const dayTotal = groups[date].reduce((s,t) => t.type==='expense' ? s-t.amt : s+t.amt, 0);
    return `
      <div class="tx-group-label">
        <span>${dayLabel(date)}</span>
        <span style="color:${dayTotal>=0?'var(--income)':'var(--expense)'}">${dayTotal>=0?'+':''}${fmt(dayTotal,false)}</span>
      </div>
      <div class="tx-list">
        ${groups[date].map(t => txHTML(t)).join('')}
      </div>`;
  }).join('');
}

function txHTML(t) {
  return `
    <div class="tx-item">
      <div class="tx-icon ${t.type}">${CAT_EMOJI[t.cat]||'💳'}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.desc)}${t.recurring ? '<span class="tx-recurring-badge">🔁 recurring</span>' : ''}</div>
        <div class="tx-meta">${t.cat} · ${formatDate(t.date)}</div>
        ${t.note ? `<div class="tx-note">${esc(t.note)}</div>` : ''}
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}${fmtFull(t.amt)}</div>
        <button class="tx-del" onclick="deleteTx(${t.id})" aria-label="Delete">✕</button>
      </div>
    </div>`;
}

// ── GOALS ──────────────────────────────────────
function openGoalModal() {
  document.getElementById('goalModal').classList.add('open');
  document.getElementById('goalAmount').value = '';
}
function closeGoalModal(e) {
  if (!e || e.target === document.getElementById('goalModal')) {
    document.getElementById('goalModal').classList.remove('open');
  }
}
function saveGoal() {
  const cat = document.getElementById('goalCat').value;
  const amt = parseFloat(document.getElementById('goalAmount').value);
  if (!amt || amt <= 0) { toast('Enter a valid limit'); return; }
  goals[cat] = amt;
  save('bp_goals', goals);
  closeGoalModal();
  renderGoals();
  toast(`Goal set for ${cat} ✓`);
}
function deleteGoal(cat) {
  delete goals[cat];
  save('bp_goals', goals);
  renderGoals();
  toast('Goal removed');
}
function renderGoals() {
  const el = document.getElementById('goalsList');
  const txns = monthTxns();
  const entries = Object.entries(goals);
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🎯</span><p>No goals set yet.<br/>Set a monthly limit below.</p></div>`;
    return;
  }
  el.innerHTML = entries.map(([cat, limit]) => {
    const spent = txns.filter(t=>t.type==='expense'&&t.cat===cat).reduce((s,t)=>s+t.amt,0);
    const pct   = Math.min(Math.round(spent/limit*100), 100);
    const over  = spent > limit;
    const warn  = !over && pct >= 80;
    const cls   = over ? 'over' : warn ? 'warn' : 'ok';
    const remaining = limit - spent;
    const statusText = over
      ? `Over by ${fmtFull(spent - limit)}`
      : warn ? `Only ${fmtFull(remaining)} left`
      : `${fmtFull(remaining)} remaining`;
    return `
      <div class="goal-card">
        <div class="goal-header">
          <span class="goal-cat">${CAT_EMOJI[cat]||''} ${cat}</span>
          <span class="goal-amounts"><strong>${fmtFull(spent)}</strong> / ${fmtFull(limit)}</span>
        </div>
        <div class="goal-bar-wrap">
          <div class="goal-bar ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="goal-status ${cls}">${statusText} · ${pct}%</div>
        <div class="goal-actions">
          <button class="goal-del-btn" onclick="deleteGoal('${cat}')">Remove goal</button>
        </div>
      </div>`;
  }).join('');
}

// ── STATS PAGE ─────────────────────────────────
function renderStats() {
  renderTrendChart();
  renderTopDays();
  renderStatBlocks();
}

function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (trendInstance) trendInstance.destroy();

  const monthMap = {};
  transactions.forEach(t => {
    const mon = t.date.substring(0,7);
    if (!monthMap[mon]) monthMap[mon] = {income:0, expense:0};
    monthMap[mon][t.type] += t.amt;
  });
  const labels = Object.keys(monthMap).sort().slice(-8);
  const monthNames = labels.map(l => {
    const [y,m] = l.split('-');
    return new Date(y,m-1).toLocaleString('default',{month:'short'});
  });

  trendInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthNames.length ? monthNames : ['—'],
      datasets: [
        {
          label: 'Income', data: labels.map(l=>monthMap[l]?.income||0),
          borderColor: '#7fff6e', backgroundColor: 'rgba(127,255,110,.08)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#7fff6e',
          tension: .35, fill: true
        },
        {
          label: 'Expense', data: labels.map(l=>monthMap[l]?.expense||0),
          borderColor: '#ff5c5c', backgroundColor: 'rgba(255,92,92,.08)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#ff5c5c',
          tension: .35, fill: true
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false}, tooltip:{
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim(),
        bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border').trim(),
        borderWidth:1,
        callbacks:{ label: ctx => ` ${fmtFull(ctx.raw)}` }
      }},
      scales: {
        x: { grid:{color:'rgba(128,128,128,.06)'}, ticks:{color:'#7a7f94',font:{family:"'DM Mono'",size:10}} },
        y: { grid:{color:'rgba(128,128,128,.06)'}, ticks:{color:'#7a7f94',font:{family:"'DM Mono'",size:10},callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)} }
      }
    }
  });
}

function renderTopDays() {
  const el = document.getElementById('topDays');
  const txns = monthTxns().filter(t=>t.type==='expense');
  if (!txns.length) { el.innerHTML = `<div class="empty-state"><span class="emoji">📅</span><p>No data</p></div>`; return; }
  const dayMap = {};
  txns.forEach(t => dayMap[t.date] = (dayMap[t.date]||0) + t.amt);
  const sorted = Object.entries(dayMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el.innerHTML = sorted.map(([date, amt]) =>
    `<div class="top-day-row">
       <span class="tdr-date">${formatDateFull(date)}</span>
       <span class="tdr-amt">-${fmtFull(amt)}</span>
     </div>`
  ).join('');
}

function renderStatBlocks() {
  const el = document.getElementById('statsGrid');
  const txns = monthTxns();
  const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const allAmts = txns.filter(t=>t.type==='expense').map(t=>t.amt);
  const avgExp  = allAmts.length ? allAmts.reduce((a,b)=>a+b,0)/allAmts.length : 0;
  const maxExp  = allAmts.length ? Math.max(...allAmts) : 0;
  const txnCount = txns.length;
  const recCount = txns.filter(t=>t.recurring).length;

  el.innerHTML = [
    { label:'Avg Transaction', value: fmtFull(avgExp) },
    { label:'Largest Expense', value: fmtFull(maxExp) },
    { label:'Total Transactions', value: txnCount },
    { label:'Recurring', value: recCount },
  ].map(s =>
    `<div class="stat-block">
       <div class="sb-label">${s.label}</div>
       <div class="sb-value">${s.value}</div>
     </div>`
  ).join('');
}

// ── EXPORT CSV ─────────────────────────────────
function exportCSV() {
  if (!transactions.length) { toast('No transactions to export'); return; }
  const header = ['Date','Type','Description','Category','Amount','Note','Recurring'];
  const rows   = transactions.map(t =>
    [t.date, t.type, `"${t.desc}"`, t.cat, t.amt.toFixed(2), `"${t.note||''}"`, t.recurring ? t.recurFreq : 'no']
  );
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `budget-${viewMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported ✓');
}

// ── TOAST ──────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
