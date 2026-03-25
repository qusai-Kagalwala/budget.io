/* ════════════════════════════════════════════
   budget.io — app.js
   Enhanced: savings goals, carry-forward balance,
   delete confirm, fixed light-mode chart colours,
   event listeners (no inline onclick), ESC modal
   ════════════════════════════════════════════ */
'use strict';

// ── CONSTANTS ──────────────────────────────────
const CAT_COLORS_DARK = {
  Salary:'#7fff6e', Freelance:'#4eaaff', Investment:'#b48eff',
  Gift:'#ffe45e', 'Other Income':'#5effd8',
  Food:'#ff6b6b', Transport:'#ffa94d', Education:'#74c0fc',
  Shopping:'#f783ac', Utilities:'#ffe066', Health:'#38d9a9',
  Entertainment:'#a9e34b', Rent:'#ff8787', Other:'#da77f2'
};
const CAT_COLORS_LIGHT = {
  Salary:'#2f9e44', Freelance:'#1971c2', Investment:'#7048e8',
  Gift:'#e67700', 'Other Income':'#0c8599',
  Food:'#c92a2a', Transport:'#d9480f', Education:'#1864ab',
  Shopping:'#a61e4d', Utilities:'#e67700', Health:'#087f5b',
  Entertainment:'#5c940d', Rent:'#c92a2a', Other:'#862e9c'
};

const CAT_EMOJI = {
  Salary:'💼', Freelance:'💻', Investment:'📈', Gift:'🎁', 'Other Income':'💰',
  Food:'🍜', Transport:'🚌', Education:'📚', Shopping:'🛍️',
  Utilities:'💡', Health:'🏥', Entertainment:'🎮', Rent:'🏠', Other:'📦'
};

const SAVINGS_ICONS = ['🎯','🏠','🚗','✈️','💻','📱','🎓','💍','🏋️','📚','🎮','🌴','🏦','💊','🛋️','🎸','👶','🐾'];

const INCOME_CATS  = ['Salary','Freelance','Investment','Gift','Other Income'];
const EXPENSE_CATS = ['Food','Transport','Education','Shopping','Utilities','Health','Entertainment','Rent','Other'];

// ── STATE ──────────────────────────────────────
let transactions  = load('bp_txns', []);
let goals         = load('bp_goals', {});
let savingsGoals  = load('bp_savings_goals', []);   // [{id, name, icon, target, contributions:[{date,amt,note}]}]
let theme         = load('bp_theme', 'dark');
let currentType   = 'income';
let selectedCat   = '';
let currentPage   = 'dashboard';
let filterCat     = 'all';
let chartInstance = null;
let trendInstance = null;
let chartMode     = 'doughnut';
let viewMonth;    // "YYYY-MM"
let pendingDeleteId  = null;
let contributeGoalId = null;
let editingSavingsId = null;
let selectedIcon     = SAVINGS_ICONS[0];
let activeGoalsTab   = 'budget';

// ── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  viewMonth = toMonthStr(now);
  applyTheme(theme);
  setTodayDate();
  buildCatChips();
  setType('income');
  buildIconPicker();
  bindEvents();
  updateMonthDisplay();
  renderAll();
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
  }, 1400);
});

// ── EVENT BINDING ──────────────────────────────
function bindEvents() {
  // Header
  document.getElementById('themeToggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    save('bp_theme', theme);
    if (chartInstance) renderChart(monthTxns());
    if (trendInstance) renderTrendChart();
  });
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // Month nav
  document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // Dashboard
  document.getElementById('seeAllBtn').addEventListener('click', () => switchPage('transactions'));
  document.getElementById('chartDoughnut').addEventListener('click', (e) => setChartType('doughnut', e.currentTarget));
  document.getElementById('chartBar').addEventListener('click', (e) => setChartType('bar', e.currentTarget));

  // Add page
  document.getElementById('bigBtnIncome').addEventListener('click', () => setType('income'));
  document.getElementById('bigBtnExpense').addEventListener('click', () => setType('expense'));
  document.getElementById('submitBtn').addEventListener('click', addTransaction);
  document.getElementById('heroAmount').addEventListener('keydown', e => { if (e.key === 'Enter') addTransaction(); });
  document.getElementById('isRecurring').addEventListener('change', e => {
    document.getElementById('recurFreqRow').style.display = e.target.checked ? 'block' : 'none';
    document.getElementById('recurLabel').textContent = e.target.checked ? 'On' : 'Off';
  });

  // Transactions filters
  document.getElementById('searchInput').addEventListener('input', renderTransactions);
  document.getElementById('filterType').addEventListener('change', renderTransactions);
  document.getElementById('filterChipsRow').addEventListener('click', e => {
    const chip = e.target.closest('.fchip');
    if (!chip) return;
    document.querySelectorAll('.fchip').forEach(f => f.classList.remove('active'));
    chip.classList.add('active');
    filterCat = chip.dataset.cat;
    renderTransactions();
  });

  // Goals tabs
  document.getElementById('tabBudget').addEventListener('click', () => setGoalsTab('budget'));
  document.getElementById('tabSavings').addEventListener('click', () => setGoalsTab('savings'));

  // Budget goal modal
  document.getElementById('openBudgetGoalBtn').addEventListener('click', openGoalModal);
  document.getElementById('saveBudgetGoal').addEventListener('click', saveGoal);
  document.getElementById('cancelBudgetGoal').addEventListener('click', closeModal);
  document.getElementById('goalModal').addEventListener('click', backdropClose);

  // Savings goal modal
  document.getElementById('openSavingsGoalBtn').addEventListener('click', () => openSavingsGoalModal());
  document.getElementById('saveSavingsGoalBtn').addEventListener('click', saveSavingsGoal);
  document.getElementById('cancelSavingsGoal').addEventListener('click', closeModal);
  document.getElementById('savingsGoalModal').addEventListener('click', backdropClose);

  // Contribute modal
  document.getElementById('saveContribute').addEventListener('click', saveContribution);
  document.getElementById('cancelContribute').addEventListener('click', closeModal);
  document.getElementById('contributeModal').addEventListener('click', backdropClose);

  // Delete confirm modal
  document.getElementById('confirmOk').addEventListener('click', confirmDelete);
  document.getElementById('confirmCancel').addEventListener('click', closeModal);
  document.getElementById('confirmModal').addEventListener('click', backdropClose);

  // ESC closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function backdropClose(e) {
  if (e.target === e.currentTarget) closeModal();
}

function closeModal() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  pendingDeleteId = null;
  contributeGoalId = null;
  editingSavingsId = null;
}

// ── UTILITIES ──────────────────────────────────
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast('Storage full — export your data!'); }
}
function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function catColors() {
  return theme === 'dark' ? CAT_COLORS_DARK : CAT_COLORS_LIGHT;
}
function fmt(n, abs = true) {
  const v = abs ? Math.abs(n) : n;
  if (Math.abs(v) >= 100000) return '₹' + (v/100000).toFixed(1) + 'L';
  if (Math.abs(v) >= 1000)   return '₹' + (v/1000).toFixed(1) + 'k';
  return '₹' + v.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2});
}
function fmtFull(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  const [,m,day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]}`;
}
function formatDateFull(d) {
  const [y,m,day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}
function dayLabel(d) {
  const date      = new Date(d + 'T00:00:00');
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  if (date.toDateString() === today.toDateString())     return 'Today';
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
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function tooltipDefaults() {
  return {
    backgroundColor: cssVar('--surface2'),
    titleColor:      cssVar('--muted'),
    bodyColor:       cssVar('--text'),
    borderColor:     cssVar('--border'),
    borderWidth:     1,
    callbacks:       { label: ctx => ` ${fmtFull(ctx.raw)}` }
  };
}

// ── MONTH NAVIGATION ───────────────────────────
function updateMonthDisplay() {
  const [y, m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  document.getElementById('monthName').textContent = d.toLocaleString('default', {month:'long'});
  document.getElementById('monthYear').textContent = y;
}
function shiftMonth(dir) {
  const [y, m] = viewMonth.split('-').map(Number);
  viewMonth = toMonthStr(new Date(y, m-1+dir, 1));
  updateMonthDisplay();
  renderAll();
  if (currentPage === 'transactions') renderTransactions();
  if (currentPage === 'goals')        renderGoals();
  if (currentPage === 'stats')        renderStats();
}

// ── PAGE NAVIGATION ────────────────────────────
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  currentPage = page;
  window.scrollTo(0, 0);
  if (page === 'transactions') renderTransactions();
  if (page === 'stats')        renderStats();
  if (page === 'goals')        renderGoals();
  if (page === 'add') {
    setType(currentType);
    setTimeout(() => document.getElementById('heroAmount').focus(), 100);
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
  document.getElementById('submitBtn').style.color = '#fff';
  buildCatChips();
}
function buildCatChips() {
  const cats = currentType === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const el = document.getElementById('catChips');
  el.innerHTML = '';
  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-chip' + (selectedCat === c ? ' active' : '');
    btn.textContent = (CAT_EMOJI[c] || '') + ' ' + c;
    btn.addEventListener('click', () => {
      selectedCat = c;
      buildCatChips();
    });
    el.appendChild(btn);
  });
}

// ── ADD TRANSACTION ────────────────────────────
function addTransaction() {
  const amt  = parseFloat(document.getElementById('heroAmount').value);
  const desc = document.getElementById('desc').value.trim();
  const date = document.getElementById('txDate').value;
  const note = document.getElementById('txNote').value.trim();
  const recurring  = document.getElementById('isRecurring').checked;
  const recurFreq  = document.getElementById('recurFreq').value;

  if (!amt || amt <= 0)  { toast('Enter a valid amount ₹'); return; }
  if (!desc)             { toast('Add a description'); return; }
  if (!selectedCat)      { toast('Pick a category'); return; }
  if (!date)             { toast('Choose a date'); return; }

  const tx = {
    id: Date.now(), type: currentType, amt, desc,
    cat: selectedCat, date, note,
    recurring, recurFreq: recurring ? recurFreq : null
  };
  transactions.unshift(tx);
  save('bp_txns', transactions);

  // Reset
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
  viewMonth = tx.date.substring(0, 7);
  updateMonthDisplay();
  switchPage('dashboard');
  renderAll();
}

// ── DELETE (with confirm) ──────────────────────
function askDeleteTx(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  pendingDeleteId = id;
  document.getElementById('confirmMsg').textContent =
    `"${tx.desc}" — ${fmtFull(tx.amt)} on ${formatDate(tx.date)}`;
  document.getElementById('confirmModal').classList.add('open');
}
function confirmDelete() {
  if (!pendingDeleteId) return;
  transactions = transactions.filter(t => t.id !== pendingDeleteId);
  save('bp_txns', transactions);
  closeModal();
  renderAll();
  if (currentPage === 'transactions') renderTransactions();
  toast('Transaction deleted');
}

// ── MONTH FILTER ───────────────────────────────
function monthTxns() {
  return transactions.filter(t => t.date.startsWith(viewMonth));
}

// ── CARRY-FORWARD BALANCE ──────────────────────
// Returns the cumulative balance of all months BEFORE the current viewMonth
function carryForwardBalance() {
  const [y, m] = viewMonth.split('-').map(Number);
  const cutoff = new Date(y, m-1, 1); // first day of current month
  let balance = 0;
  transactions.forEach(t => {
    const tDate = new Date(t.date + 'T00:00:00');
    if (tDate < cutoff) {
      balance += t.type === 'income' ? t.amt : -t.amt;
    }
  });
  return balance;
}

// ── RENDER ALL ─────────────────────────────────
function renderAll() {
  const txns    = monthTxns();
  const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt, 0);
  const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt, 0);
  const carry   = carryForwardBalance();
  const balance = income - expense + carry;
  const savPct  = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);
  document.getElementById('totalBalance').textContent = fmt(balance, false);
  document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--accent2)' : 'var(--danger)';
  document.getElementById('incomeCount').textContent  = txns.filter(t=>t.type==='income').length + ' entries';
  document.getElementById('expenseCount').textContent = txns.filter(t=>t.type==='expense').length + ' entries';
  document.getElementById('savingsRate').textContent  = savPct + '% saved';

  // Carry-forward banner
  const carryBanner = document.getElementById('carryBanner');
  if (Math.abs(carry) >= 1) {
    carryBanner.classList.remove('hidden');
    document.getElementById('carryLabel').textContent = carry >= 0
      ? 'Balance carried forward from previous months'
      : 'Deficit carried forward from previous months';
    document.getElementById('carryAmt').textContent = (carry >= 0 ? '+' : '') + fmtFull(carry);
    document.getElementById('carryAmt').style.color = carry >= 0 ? 'var(--accent2)' : 'var(--danger)';
  } else {
    carryBanner.classList.add('hidden');
  }

  renderInsights(txns, income, expense, carry);
  renderChart(txns);
  renderCatBars(txns, expense);
  renderRecent(txns);
}

// ── INSIGHTS ───────────────────────────────────
function renderInsights(txns, income, expense, carry) {
  const banner  = document.getElementById('insightsBanner');
  const scroll  = document.getElementById('insightScroll');
  const insights = [];

  if (income > 0) {
    const r = Math.round((income - expense) / income * 100);
    if (r >= 20)  insights.push({ dot:'🟢', text:`Saving ${r}% of income this month — great work!` });
    else if (r > 0) insights.push({ dot:'🟡', text:`Saving ${r}% this month. Target 20%+ for a healthy buffer.` });
    else            insights.push({ dot:'🔴', text:`Spending more than earned this month. Review your expenses.` });
  }

  const catMap = {};
  txns.filter(t=>t.type==='expense').forEach(t => catMap[t.cat] = (catMap[t.cat]||0) + t.amt);
  const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  if (sorted.length) {
    const [topCat, topAmt] = sorted[0];
    insights.push({ dot:'📊', text:`Biggest spend: ${CAT_EMOJI[topCat]||''} ${topCat} at ${fmtFull(topAmt)}.` });
  }

  const recCount = transactions.filter(t => t.recurring && t.date.startsWith(viewMonth)).length;
  if (recCount) insights.push({ dot:'🔁', text:`${recCount} recurring transaction${recCount>1?'s':''} this month.` });

  const overGoals = [], warnGoals = [];
  Object.entries(goals).forEach(([cat, limit]) => {
    const spent = txns.filter(t=>t.type==='expense'&&t.cat===cat).reduce((s,t)=>s+t.amt, 0);
    if (spent > limit) overGoals.push(cat);
    else if (spent / limit >= .8) warnGoals.push(`${CAT_EMOJI[cat]} ${cat} (${Math.round(spent/limit*100)}%)`);
  });
  if (warnGoals.length)  insights.push({ dot:'⚠️', text:`Near budget limit: ${warnGoals.join(', ')}.` });
  if (overGoals.length)  insights.push({ dot:'🚨', text:`Over budget in: ${overGoals.join(', ')}.` });

  if (Math.abs(carry) >= 1) {
    insights.push({
      dot: carry >= 0 ? '↩' : '⚠️',
      text: carry >= 0
        ? `${fmtFull(carry)} balance carried forward from previous months.`
        : `${fmtFull(Math.abs(carry))} deficit carried from previous months.`
    });
  }

  if (!insights.length) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  scroll.innerHTML = insights.map(i =>
    `<div class="insight-item"><span class="ii-dot">${i.dot}</span><span>${esc(i.text)}</span></div>`
  ).join('');
}

// ── CHART ──────────────────────────────────────
function setChartType(type, btn) {
  chartMode = type;
  document.querySelectorAll('.ctt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChart(monthTxns());
}

function renderChart(txns) {
  const canvas = document.getElementById('mainChart');
  const ctx    = canvas.getContext('2d');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const colors = catColors();
  const tt = tooltipDefaults();

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
          backgroundColor: entries.map(e => colors[e[0]] || '#a29bfe'),
          borderWidth: 3,
          borderColor: cssVar('--surface'),
          hoverOffset: 8
        }]
      },
      options: {
        cutout: '65%', responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: tt }
      }
    });
    document.getElementById('chartLegend').innerHTML = entries.slice(0,6).map(e =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${colors[e[0]]||'#a29bfe'}"></div>
        <span class="legend-label">${esc(e[0])}</span>
      </div>`
    ).join('');

  } else {
    // Bar chart — use ALL transactions grouped by month (correct, this is the purpose of bar mode)
    const monthMap = {};
    transactions.forEach(t => {
      const mon = t.date.substring(0,7);
      if (!monthMap[mon]) monthMap[mon] = {income:0, expense:0};
      monthMap[mon][t.type] += t.amt;
    });
    const labels = Object.keys(monthMap).sort().slice(-6);
    const monthNames = labels.map(l => {
      const [y,m] = l.split('-');
      return new Date(y, m-1).toLocaleString('default', {month:'short'});
    });
    canvas.style.display = 'block';
    canvas.style.maxHeight = '220px';
    const incomeColor  = theme === 'dark' ? 'rgba(127,255,110,.75)' : 'rgba(26,158,16,.7)';
    const expenseColor = theme === 'dark' ? 'rgba(255,92,92,.65)'   : 'rgba(224,48,48,.6)';
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthNames.length ? monthNames : ['—'],
        datasets: [
          { label:'Income',  data: labels.map(l=>monthMap[l]?.income||0),
            backgroundColor: incomeColor,  borderColor: cssVar('--income'),  borderWidth:1.5, borderRadius:6 },
          { label:'Expense', data: labels.map(l=>monthMap[l]?.expense||0),
            backgroundColor: expenseColor, borderColor: cssVar('--expense'), borderWidth:1.5, borderRadius:6 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:true,
        plugins: { legend:{display:false}, tooltip: tt },
        scales: {
          x: { grid:{color:'rgba(128,128,128,.08)'}, ticks:{color:cssVar('--muted'), font:{family:"'DM Mono'"}} },
          y: { grid:{color:'rgba(128,128,128,.08)'}, ticks:{color:cssVar('--muted'), font:{family:"'DM Mono'"},
               callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)} }
        }
      }
    });
    document.getElementById('chartLegend').innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:${cssVar('--income')}"></div><span class="legend-label">Income</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:${cssVar('--expense')}"></div><span class="legend-label">Expense</span></div>`;
  }
}

// ── CAT BARS ───────────────────────────────────
function renderCatBars(txns, totalExpense) {
  const el       = document.getElementById('catBars');
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
  const colors = catColors();
  el.innerHTML = sorted.map(([cat, amt]) => {
    const pct = totalExpense ? Math.round(amt/totalExpense*100) : 0;
    const clr = colors[cat] || '#a29bfe';
    return `<div class="cat-row">
      <div class="cat-info">
        <span class="cat-name">${CAT_EMOJI[cat]||''} ${esc(cat)}</span>
        <span class="cat-val">${fmt(amt)}</span>
      </div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%;background:${clr}"></div></div>
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
  el.innerHTML = '';
  recent.forEach(t => el.appendChild(makeTxEl(t)));
}

// ── FULL TRANSACTION LIST ──────────────────────
function renderTransactions() {
  const search = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const typeF  = document.getElementById('filterType')?.value || 'all';
  const el     = document.getElementById('txGroupedList');

  const filtered = monthTxns().filter(t => {
    const matchSearch = !search || t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search);
    const matchType   = typeF === 'all' || t.type === typeF;
    const matchCat    = filterCat === 'all' || t.cat === filterCat;
    return matchSearch && matchType && matchCat;
  });

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span><p>No transactions found</p></div>`;
    return;
  }

  const groups = {};
  filtered.forEach(t => { (groups[t.date] = groups[t.date]||[]).push(t); });
  const sortedDates = Object.keys(groups).sort((a,b) => b.localeCompare(a));

  el.innerHTML = '';
  sortedDates.forEach(date => {
    const dayTotal = groups[date].reduce((s,t) => t.type==='expense' ? s-t.amt : s+t.amt, 0);
    const label = document.createElement('div');
    label.className = 'tx-group-label';
    label.innerHTML = `<span>${esc(dayLabel(date))}</span>
      <span style="color:${dayTotal>=0?'var(--income)':'var(--expense)'}">
        ${dayTotal>=0?'+':''}${fmt(dayTotal,false)}
      </span>`;
    el.appendChild(label);
    const list = document.createElement('div');
    list.className = 'tx-list';
    groups[date].forEach(t => list.appendChild(makeTxEl(t)));
    el.appendChild(list);
  });
}

function makeTxEl(t) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  div.innerHTML = `
    <div class="tx-icon ${t.type}">${CAT_EMOJI[t.cat]||'💳'}</div>
    <div class="tx-info">
      <div class="tx-desc">${esc(t.desc)}${t.recurring ? '<span class="tx-recurring-badge">🔁 recurring</span>' : ''}</div>
      <div class="tx-meta">${esc(t.cat)} · ${formatDate(t.date)}</div>
      ${t.note ? `<div class="tx-note">${esc(t.note)}</div>` : ''}
    </div>
    <div class="tx-right">
      <div class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}${fmtFull(t.amt)}</div>
      <button class="tx-del" aria-label="Delete transaction">✕</button>
    </div>`;
  div.querySelector('.tx-del').addEventListener('click', e => {
    e.stopPropagation();
    askDeleteTx(t.id);
  });
  return div;
}

// ── GOALS TAB ──────────────────────────────────
function setGoalsTab(tab) {
  activeGoalsTab = tab;
  document.getElementById('tabBudget').classList.toggle('active', tab === 'budget');
  document.getElementById('tabSavings').classList.toggle('active', tab === 'savings');
  document.getElementById('panelBudget').style.display  = tab === 'budget'  ? 'block' : 'none';
  document.getElementById('panelSavings').style.display = tab === 'savings' ? 'block' : 'none';
}

// ── BUDGET GOALS ───────────────────────────────
function openGoalModal() {
  document.getElementById('goalModal').classList.add('open');
  document.getElementById('goalAmount').value = '';
}
function saveGoal() {
  const cat = document.getElementById('goalCat').value;
  const amt = parseFloat(document.getElementById('goalAmount').value);
  if (!amt || amt <= 0) { toast('Enter a valid limit'); return; }
  goals[cat] = amt;
  save('bp_goals', goals);
  closeModal();
  renderGoals();
  toast(`Budget goal set for ${cat} ✓`);
}
function deleteGoal(cat) {
  delete goals[cat];
  save('bp_goals', goals);
  renderGoals();
  toast('Budget goal removed');
}
function renderBudgetGoals() {
  const el    = document.getElementById('goalsList');
  const txns  = monthTxns();
  const entries = Object.entries(goals);
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span><p>No budget goals yet.<br/>Set a monthly limit below.</p></div>`;
    return;
  }
  el.innerHTML = '';
  entries.forEach(([cat, limit]) => {
    const spent     = txns.filter(t=>t.type==='expense'&&t.cat===cat).reduce((s,t)=>s+t.amt, 0);
    const pct       = Math.min(Math.round(spent/limit*100), 100);
    const over      = spent > limit;
    const warn      = !over && pct >= 80;
    const cls       = over ? 'over' : warn ? 'warn' : 'ok';
    const remaining = limit - spent;
    const statusText = over
      ? `Over by ${fmtFull(spent - limit)}`
      : warn ? `Only ${fmtFull(remaining)} left`
      : `${fmtFull(remaining)} remaining`;
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-header">
        <span class="goal-cat">${CAT_EMOJI[cat]||''} ${esc(cat)}</span>
        <span class="goal-amounts"><strong>${fmtFull(spent)}</strong> / ${fmtFull(limit)}</span>
      </div>
      <div class="goal-bar-wrap"><div class="goal-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="goal-status ${cls}">${esc(statusText)} · ${pct}%</div>
      <div class="goal-actions">
        <button class="goal-del-btn">Remove goal</button>
      </div>`;
    card.querySelector('.goal-del-btn').addEventListener('click', () => deleteGoal(cat));
    el.appendChild(card);
  });
}

// ── SAVINGS GOALS ──────────────────────────────
function buildIconPicker() {
  const el = document.getElementById('iconPicker');
  el.innerHTML = '';
  SAVINGS_ICONS.forEach(icon => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-opt' + (icon === selectedIcon ? ' active' : '');
    btn.textContent = icon;
    btn.addEventListener('click', () => {
      selectedIcon = icon;
      document.querySelectorAll('.icon-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    el.appendChild(btn);
  });
}

function openSavingsGoalModal(id = null) {
  editingSavingsId = id;
  document.getElementById('savingsModalTitle').textContent = id ? 'Edit Savings Goal' : 'New Savings Goal';
  if (id) {
    const g = savingsGoals.find(g => g.id === id);
    if (!g) return;
    document.getElementById('savingsGoalName').value   = g.name;
    document.getElementById('savingsGoalTarget').value = g.target;
    selectedIcon = g.icon;
    buildIconPicker();
  } else {
    document.getElementById('savingsGoalName').value   = '';
    document.getElementById('savingsGoalTarget').value = '';
    selectedIcon = SAVINGS_ICONS[0];
    buildIconPicker();
  }
  document.getElementById('savingsGoalModal').classList.add('open');
}

function saveSavingsGoal() {
  const name   = document.getElementById('savingsGoalName').value.trim();
  const target = parseFloat(document.getElementById('savingsGoalTarget').value);
  if (!name)             { toast('Enter a goal name'); return; }
  if (!target || target <= 0) { toast('Enter a valid target amount'); return; }

  if (editingSavingsId) {
    const g = savingsGoals.find(g => g.id === editingSavingsId);
    if (g) { g.name = name; g.target = target; g.icon = selectedIcon; }
  } else {
    savingsGoals.push({ id: Date.now(), name, icon: selectedIcon, target, contributions: [] });
  }
  save('bp_savings_goals', savingsGoals);
  closeModal();
  renderSavingsGoals();
  toast(editingSavingsId ? 'Goal updated ✓' : 'Savings goal created ✓');
}

function deleteSavingsGoal(id) {
  savingsGoals = savingsGoals.filter(g => g.id !== id);
  save('bp_savings_goals', savingsGoals);
  renderSavingsGoals();
  toast('Savings goal removed');
}

// ── CONTRIBUTE TO SAVINGS GOAL ─────────────────
function openContributeModal(id) {
  const g = savingsGoals.find(g => g.id === id);
  if (!g) return;
  contributeGoalId = id;
  const saved = g.contributions.reduce((s,c) => s+c.amt, 0);
  const pct   = g.target > 0 ? Math.min(Math.round(saved/g.target*100), 100) : 0;
  document.getElementById('contributeTitle').textContent = `Add to "${g.name}"`;
  document.getElementById('contributeGoalInfo').innerHTML = `
    <span class="cgi-icon">${g.icon}</span>
    <div class="cgi-details">
      <span class="cgi-name">${esc(g.name)}</span>
      <span class="cgi-progress">${fmtFull(saved)} saved of ${fmtFull(g.target)} · ${pct}%</span>
    </div>`;
  document.getElementById('contributeAmt').value  = '';
  document.getElementById('contributeNote').value = '';
  document.getElementById('contributeModal').classList.add('open');
  setTimeout(() => document.getElementById('contributeAmt').focus(), 200);
}

function saveContribution() {
  const amt  = parseFloat(document.getElementById('contributeAmt').value);
  const note = document.getElementById('contributeNote').value.trim();
  if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }
  const g = savingsGoals.find(g => g.id === contributeGoalId);
  if (!g) return;
  g.contributions.push({
    id:   Date.now(),
    date: new Date().toISOString().split('T')[0],
    amt,
    note
  });
  save('bp_savings_goals', savingsGoals);
  closeModal();
  renderSavingsGoals();
  const totalSaved = g.contributions.reduce((s,c) => s+c.amt, 0);
  if (totalSaved >= g.target) {
    setTimeout(() => toast(`🎉 Goal "${g.name}" complete!`), 300);
  } else {
    toast(`Added ${fmtFull(amt)} to ${g.name} ✓`);
  }
}

function withdrawFromGoal(id) {
  const g = savingsGoals.find(g => g.id === id);
  if (!g || !g.contributions.length) { toast('No contributions to withdraw'); return; }
  const last = g.contributions[g.contributions.length - 1];
  g.contributions.pop();
  save('bp_savings_goals', savingsGoals);
  renderSavingsGoals();
  toast(`Removed last contribution of ${fmtFull(last.amt)}`);
}

// ── CARRY-FORWARD FOR SAVINGS ──────────────────
// Gets cumulative saved amount — contributions are permanent (don't reset monthly)
function getSavingsCarrySummary() {
  const totalSaved = savingsGoals.reduce((s, g) => s + g.contributions.reduce((a,c) => a+c.amt, 0), 0);
  const totalTarget = savingsGoals.reduce((s, g) => s + g.target, 0);
  return { totalSaved, totalTarget, count: savingsGoals.length };
}

function renderSavingsGoals() {
  const el = document.getElementById('savingsGoalsList');
  const summaryEl = document.getElementById('savingsCarrySummary');

  // Carry-forward summary
  if (savingsGoals.length) {
    const { totalSaved, totalTarget } = getSavingsCarrySummary();
    const overallPct = totalTarget > 0 ? Math.min(Math.round(totalSaved/totalTarget*100), 100) : 0;
    summaryEl.classList.remove('hidden');
    summaryEl.innerHTML = `
      <strong>↩ Cumulative savings across all goals</strong><br>
      ${fmtFull(totalSaved)} saved of ${fmtFull(totalTarget)} total target · ${overallPct}% overall
    `;
  } else {
    summaryEl.classList.add('hidden');
  }

  if (!savingsGoals.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🎯</span><p>No savings goals yet.<br/>Create your first goal below.</p></div>`;
    return;
  }
  el.innerHTML = '';
  savingsGoals.forEach(g => {
    const saved     = g.contributions.reduce((s,c) => s+c.amt, 0);
    const remaining = Math.max(g.target - saved, 0);
    const pct       = g.target > 0 ? Math.min(Math.round(saved/g.target*100), 100) : 0;
    const complete  = saved >= g.target;

    // Contributions carry forward (all-time) — show last 3
    const recentContribs = [...g.contributions].reverse().slice(0, 3);
    const historyHTML = recentContribs.length ? `
      <div class="sg-history">
        <div class="sg-history-title">Recent contributions</div>
        ${recentContribs.map(c => `
          <div class="sg-hist-item">
            <span>${esc(c.note || 'Contribution')}</span>
            <span>
              <span class="sg-hist-amt">+${fmtFull(c.amt)}</span>
              <span class="sg-hist-meta"> · ${formatDate(c.date)}</span>
            </span>
          </div>`).join('')}
      </div>` : '';

    const card = document.createElement('div');
    card.className = 'savings-goal-card';
    card.innerHTML = `
      <div class="sg-top">
        <div class="sg-icon-name">
          <span class="sg-icon">${g.icon}</span>
          <div>
            <div class="sg-name">${esc(g.name)}<span class="carry-pill">↩ carries forward</span></div>
            <div class="sg-target">Target: ${fmtFull(g.target)}</div>
          </div>
        </div>
        <div class="sg-actions">
          <button class="sg-action-btn edit-btn" aria-label="Edit goal">✏️</button>
          <button class="sg-action-btn del-btn" aria-label="Delete goal">✕</button>
        </div>
      </div>
      <div class="sg-progress-wrap">
        <div class="sg-bar-wrap">
          <div class="sg-bar ${complete ? 'complete' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="sg-stats">
          <div class="sg-stat">
            <span class="sg-stat-label">Saved</span>
            <span class="sg-stat-val saved">${fmtFull(saved)}</span>
          </div>
          <div class="sg-stat" style="text-align:center">
            <span class="sg-stat-label">Progress</span>
            <span class="sg-stat-val">${pct}%</span>
          </div>
          <div class="sg-stat" style="text-align:right">
            <span class="sg-stat-label">${complete ? 'Status' : 'Remaining'}</span>
            <span class="sg-stat-val ${complete ? 'complete' : 'remaining'}">${complete ? '🎉 Done!' : fmtFull(remaining)}</span>
          </div>
        </div>
        ${complete ? '<div class="sg-complete-badge">🎉 Goal achieved!</div>' : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-add small savings-btn contribute-btn" style="flex:1;min-width:120px">＋ Add Money</button>
        ${g.contributions.length ? `<button class="sg-action-btn withdraw-btn" style="padding:10px 14px">↩ Undo last</button>` : ''}
      </div>
      ${historyHTML}`;

    card.querySelector('.contribute-btn').addEventListener('click', () => openContributeModal(g.id));
    card.querySelector('.edit-btn').addEventListener('click', () => openSavingsGoalModal(g.id));
    card.querySelector('.del-btn').addEventListener('click', () => deleteSavingsGoal(g.id));
    const wBtn = card.querySelector('.withdraw-btn');
    if (wBtn) wBtn.addEventListener('click', () => withdrawFromGoal(g.id));
    el.appendChild(card);
  });
}

// ── GOALS MASTER RENDER ────────────────────────
function renderGoals() {
  renderBudgetGoals();
  renderSavingsGoals();
  setGoalsTab(activeGoalsTab);
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
  if (trendInstance) { trendInstance.destroy(); trendInstance = null; }

  const monthMap = {};
  transactions.forEach(t => {
    const mon = t.date.substring(0,7);
    if (!monthMap[mon]) monthMap[mon] = {income:0, expense:0};
    monthMap[mon][t.type] += t.amt;
  });
  const labels     = Object.keys(monthMap).sort().slice(-8);
  const monthNames = labels.map(l => {
    const [y,m] = l.split('-');
    return new Date(y, m-1).toLocaleString('default', {month:'short'});
  });
  const incomeColor  = theme === 'dark' ? '#7fff6e' : '#2f9e44';
  const expenseColor = theme === 'dark' ? '#ff5c5c' : '#c92a2a';
  const tt = tooltipDefaults();

  trendInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthNames.length ? monthNames : ['—'],
      datasets: [
        { label:'Income',  data: labels.map(l=>monthMap[l]?.income||0),
          borderColor: incomeColor,  backgroundColor: incomeColor  + '15',
          borderWidth:2, pointRadius:4, pointBackgroundColor: incomeColor,  tension:.35, fill:true },
        { label:'Expense', data: labels.map(l=>monthMap[l]?.expense||0),
          borderColor: expenseColor, backgroundColor: expenseColor + '15',
          borderWidth:2, pointRadius:4, pointBackgroundColor: expenseColor, tension:.35, fill:true }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip: tt },
      scales: {
        x: { grid:{color:'rgba(128,128,128,.06)'}, ticks:{color:cssVar('--muted'), font:{family:"'DM Mono'",size:10}} },
        y: { grid:{color:'rgba(128,128,128,.06)'}, ticks:{color:cssVar('--muted'), font:{family:"'DM Mono'",size:10},
             callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)} }
      }
    }
  });
}

function renderTopDays() {
  const el   = document.getElementById('topDays');
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
  const el     = document.getElementById('statsGrid');
  const txns   = monthTxns();
  const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt, 0);
  const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt, 0);
  const allAmts = txns.filter(t=>t.type==='expense').map(t=>t.amt);
  const avgExp  = allAmts.length ? allAmts.reduce((a,b)=>a+b,0)/allAmts.length : 0;
  const maxExp  = allAmts.length ? allAmts.reduce((a,b)=>Math.max(a,b), 0) : 0; // safe, no spread
  const carry   = carryForwardBalance();
  const { totalSaved } = getSavingsCarrySummary();

  el.innerHTML = [
    { label:'Avg Expense',      value: fmtFull(avgExp) },
    { label:'Largest Expense',  value: fmtFull(maxExp) },
    { label:'Transactions',     value: txns.length },
    { label:'Recurring',        value: txns.filter(t=>t.recurring).length },
    { label:'Carried Forward',  value: (carry >= 0 ? '+' : '') + fmtFull(carry) },
    { label:'Total Savings',    value: fmtFull(totalSaved) },
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
    [t.date, t.type, `"${(t.desc||'').replace(/"/g,'""')}"`, t.cat,
     t.amt.toFixed(2), `"${(t.note||'').replace(/"/g,'""')}"`,
     t.recurring ? t.recurFreq : 'no']
  );
  const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
