/* ════════════════════════════════════════════
   budget.io — app.js  v3
   Savings Goals · Carry-Forward · Gmail Sync
   ════════════════════════════════════════════ */
'use strict';

// ── CONSTANTS ──────────────────────────────────
const CAT_COLORS = {
  Salary:'#7fff6e',Freelance:'#4eaaff',Investment:'#b48eff',Gift:'#ffe45e','Other Income':'#5effd8',
  Food:'#ff5c5c',Transport:'#ff9f43',Education:'#54a0ff',Shopping:'#ff6b9d',
  Utilities:'#ffd32a',Health:'#1dd1a1',Entertainment:'#c8d6e5',Rent:'#e17055',Other:'#a29bfe'
};
const CAT_EMOJI = {
  Salary:'💼',Freelance:'💻',Investment:'📈',Gift:'🎁','Other Income':'💰',
  Food:'🍜',Transport:'🚌',Education:'📚',Shopping:'🛍️',
  Utilities:'💡',Health:'🏥',Entertainment:'🎮',Rent:'🏠',Other:'📦'
};
const INCOME_CATS  = ['Salary','Freelance','Investment','Gift','Other Income'];
const EXPENSE_CATS = ['Food','Transport','Education','Shopping','Utilities','Health','Entertainment','Rent','Other'];
const GOAL_EMOJIS  = ['🎯','✈️','💻','🏠','🚗','📱','🎓','👗','🏖️','💍','🎸','🏋️','📷','⌚','🎮','🛒','🐾','💊','🌿','☕'];
const SG_COLORS    = ['#4eaaff','#7fff6e','#b48eff','#ff9f43','#ff6b9d','#1dd1a1','#ffe45e','#5effd8','#e17055','#c8d6e5'];

// ── STATE ──────────────────────────────────────
let transactions = load('bp_txns',    []);
let budgetGoals  = load('bp_goals',   {});
let savingsGoals = load('bp_savings', []);
let carryForward = load('bp_carry',   {});
let theme        = load('bp_theme',   'dark');
let selectedCat   = '';
let currentPage   = 'dashboard';
let filterCat     = 'all';
let chartInstance = null;
let trendInstance = null;
let chartMode     = 'doughnut';
let viewMonth;
let activeGoalId  = null;
let contributeMode = 'add'; // 'add' | 'withdraw'

// ── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  viewMonth = toMonthStr(new Date());
  applyTheme(theme);
  setTodayDate();
  buildCatChips();
  setType('income');
  buildEmojiPicker();
  updateMonthDisplay();
  checkAndInsertCarryForward();
  renderAll();

  document.getElementById('isRecurring').addEventListener('change', e => {
    document.getElementById('recurFreqRow').style.display = e.target.checked ? 'block' : 'none';
    document.getElementById('recurLabel').textContent = e.target.checked ? 'On' : 'Off';
  });
  document.getElementById('themeToggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    save('bp_theme', theme);
  });
});

// ── UTILS ──────────────────────────────────────
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function toMonthStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function prevMonth(m) {
  const [y,mo] = m.split('-').map(Number);
  const d = new Date(y, mo-2, 1);
  return toMonthStr(d);
}
function fmt(n, abs=true) {
  const v = abs ? Math.abs(n) : n;
  if (Math.abs(v) >= 100000) return '₹'+(v/100000).toFixed(1)+'L';
  if (Math.abs(v) >= 1000)   return '₹'+(v/1000).toFixed(1)+'k';
  return '₹'+v.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function fmtFull(n) {
  return '₹'+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(d) {
  const [y,m,day] = d.split('-');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]}`;
}
function formatDateFull(d) {
  const [y,m,day] = d.split('-');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}
function dayLabel(d) {
  const date = new Date(d+'T00:00:00');
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
function setTodayDate() { document.getElementById('txDate').value = new Date().toISOString().split('T')[0]; }

// ── CARRY FORWARD ──────────────────────────────
// Each month-start, check if previous month had an uncarried balance.
// If so, insert an "Opening Balance" income transaction into the new month.
function checkAndInsertCarryForward() {
  const currentM = toMonthStr(new Date());
  const prevM    = prevMonth(currentM);

  // Already carried this month?
  if (carryForward[currentM]) return;

  // Calculate previous month's net balance
  const prevTxns  = transactions.filter(t => t.date.startsWith(prevM) && t.cat !== '__carryover__');
  const prevInc   = prevTxns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const prevExp   = prevTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const prevBal   = prevInc - prevExp;

  if (prevBal === 0 || prevTxns.length === 0) {
    carryForward[currentM] = 0;
    save('bp_carry', carryForward);
    return;
  }

  // Create carryover entry for current month (first day)
  const firstDay = currentM + '-01';
  const tx = {
    id:        Date.now(),
    type:      prevBal > 0 ? 'income' : 'expense',
    amt:       Math.abs(prevBal),
    desc:      `Carried over from ${formatDate(prevM+'-01').replace(/\d+\s/,'')} ${prevM.split('-')[0]}`,
    cat:       '__carryover__',
    date:      firstDay,
    note:      'Automatic monthly carry-forward',
    recurring: false,
    recurFreq: null,
    isCarryover: true
  };

  transactions.unshift(tx);
  save('bp_txns', transactions);

  carryForward[currentM] = prevBal;
  save('bp_carry', carryForward);
}

// ── MONTH NAVIGATION ───────────────────────────
function updateMonthDisplay() {
  const [y,m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  document.getElementById('monthName').textContent = d.toLocaleString('default',{month:'long'});
  document.getElementById('monthYear').textContent = y;
}
function shiftMonth(dir) {
  const [y,m] = viewMonth.split('-').map(Number);
  viewMonth = toMonthStr(new Date(y, m-1+dir, 1));
  updateMonthDisplay();
  renderAll();
}

// ── PAGE NAV ───────────────────────────────────
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  currentPage = page;
  window.scrollTo(0,0);
  if (page === 'transactions') renderTransactions();
  if (page === 'stats')        renderStats();
  if (page === 'goals')        renderGoals();
  if (page === 'savings')      renderSavingsGoals();
  if (page === 'add') {
    setType(currentType);
    setTimeout(() => document.getElementById('heroAmount').focus(), 100);
  }
}

// ── TYPE / CAT ─────────────────────────────────
function setType(t) {
  currentType = t; selectedCat = '';
  document.getElementById('bigBtnIncome').className  = 'ttb income'  + (t==='income'  ? ' active':'');
  document.getElementById('bigBtnExpense').className = 'ttb expense' + (t==='expense' ? ' active':'');
  document.getElementById('submitLabel').textContent = t === 'income' ? 'Add Income' : 'Add Expense';
  document.getElementById('submitBtn').style.background = t === 'income' ? 'var(--income)' : 'var(--expense)';
  buildCatChips();
}
function buildCatChips() {
  const cats = currentType === 'income' ? INCOME_CATS : EXPENSE_CATS;
  document.getElementById('catChips').innerHTML = cats.map(c =>
    `<button class="cat-chip${selectedCat===c?' active':''}" onclick="selectCat('${c}')">${CAT_EMOJI[c]} ${c}</button>`
  ).join('');
}
function selectCat(cat) { selectedCat = cat; buildCatChips(); }
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

  transactions.unshift({ id:Date.now(), type:currentType, amt, desc, cat:selectedCat, date, note, recurring, recurFreq:recurring?recurFreq:null });
  save('bp_txns', transactions);

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
  viewMonth = date.substring(0,7);
  updateMonthDisplay();
  switchPage('dashboard');
  renderAll();
}

function deleteTx(id) {
  const tx = transactions.find(t => t.id === id);
  if (tx?.isCarryover) { toast("Can't delete carry-over entry"); return; }
  transactions = transactions.filter(t => t.id !== id);
  save('bp_txns', transactions);
  renderAll();
  if (currentPage === 'transactions') renderTransactions();
  toast('Deleted');
}

function monthTxns() { return transactions.filter(t => t.date.startsWith(viewMonth)); }

// ── RENDER ALL ─────────────────────────────────
function renderAll() {
  const txns    = monthTxns();
  const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const balance = income - expense;
  const savPct  = income > 0 ? Math.round((balance/income)*100) : 0;

  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);
  document.getElementById('totalBalance').textContent = fmt(balance, false);
  document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--accent2)' : 'var(--danger)';
  document.getElementById('incomeCount').textContent  = txns.filter(t=>t.type==='income').length + ' entries';
  document.getElementById('expenseCount').textContent = txns.filter(t=>t.type==='expense').length + ' entries';
  document.getElementById('savingsRate').textContent  = savPct + '% saved';

  renderCarryBanner();
  renderInsights(txns, income, expense);
  renderChart(txns);
  renderCatBars(txns, expense);
  renderRecent(txns);
  renderSavingsSnapshot();
}

function renderCarryBanner() {
  const carried = carryForward[viewMonth];
  const el = document.getElementById('carryBanner');
  if (!carried || carried === 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const sign = carried > 0 ? '↑' : '↓';
  const clr  = carried > 0 ? 'var(--income)' : 'var(--expense)';
  el.innerHTML = `<span style="color:${clr}">${sign} ${fmtFull(carried)}</span> carried over from last month`;
}

function renderInsights(txns, income, expense) {
  const banner = document.getElementById('insightsBanner');
  const scroll = document.getElementById('insightScroll');
  const insights = [];

  if (income > 0) {
    const r = ((income-expense)/income*100).toFixed(0);
    if (r >= 20) insights.push({dot:'🟢', text:`Saving ${r}% of income — great work!`});
    else if (r > 0) insights.push({dot:'🟡', text:`Saving ${r}% this month. Target 20%+.`});
    else insights.push({dot:'🔴', text:`Spending more than income this month.`});
  }

  const catMap = {};
  txns.filter(t=>t.type==='expense'&&t.cat!=='__carryover__').forEach(t=>catMap[t.cat]=(catMap[t.cat]||0)+t.amt);
  const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  if (sorted.length) insights.push({dot:'📊', text:`Biggest spend: ${CAT_EMOJI[sorted[0][0]]||''} ${sorted[0][0]} (${fmtFull(sorted[0][1])})`});

  const recCount = txns.filter(t=>t.recurring).length;
  if (recCount) insights.push({dot:'🔁', text:`${recCount} recurring transaction${recCount>1?'s':''} this month`});

  const nearGoals = [], overGoals = [];
  Object.entries(budgetGoals).forEach(([cat, limit]) => {
    const spent = txns.filter(t=>t.type==='expense'&&t.cat===cat).reduce((s,t)=>s+t.amt,0);
    if (spent > limit) overGoals.push(cat);
    else if (spent/limit >= .8) nearGoals.push(cat);
  });
  if (overGoals.length) insights.push({dot:'🚨', text:`Over budget: ${overGoals.join(', ')}`});
  if (nearGoals.length) insights.push({dot:'⚠️', text:`Near limit: ${nearGoals.join(', ')}`});

  // Savings goal tips
  savingsGoals.forEach(g => {
    if (g.deadline) {
      const monthsLeft = monthsBetween(viewMonth, g.deadline);
      if (monthsLeft > 0 && monthsLeft <= 3) {
        const needed = (g.target - g.saved) / monthsLeft;
        if (needed > 0) insights.push({dot:'★', text:`${g.emoji} ${g.name}: save ${fmt(needed)}/mo to hit deadline`});
      }
    }
  });

  if (!insights.length) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  scroll.innerHTML = insights.slice(0,4).map(i =>
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
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartInstance) chartInstance.destroy();
  const surfaceColor = getCSS('--surface');
  const surface2     = getCSS('--surface2');
  const borderColor  = getCSS('--border');
  const mutedColor   = getCSS('--muted');
  const textColor    = getCSS('--text');

  if (chartMode === 'doughnut') {
    const catMap = {};
    txns.filter(t=>t.type==='expense'&&t.cat!=='__carryover__').forEach(t=>catMap[t.cat]=(catMap[t.cat]||0)+t.amt);
    const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
    if (!entries.length) {
      canvas.style.display = 'none';
      document.getElementById('chartLegend').innerHTML =
        `<div style="color:var(--muted);font-family:'DM Mono',monospace;font-size:.78rem;width:100%;text-align:center;padding:20px">No expenses this month</div>`;
      return;
    }
    canvas.style.display = 'block'; canvas.style.maxHeight = '220px';
    chartInstance = new Chart(ctx, {
      type:'doughnut',
      data:{ labels:entries.map(e=>e[0]), datasets:[{
        data:entries.map(e=>e[1]),
        backgroundColor:entries.map(e=>CAT_COLORS[e[0]]||'#a29bfe'),
        borderWidth:3, borderColor:surfaceColor, hoverOffset:8
      }]},
      options:{
        cutout:'65%', responsive:true, maintainAspectRatio:true,
        plugins:{legend:{display:false},tooltip:{backgroundColor:surface2,titleColor:mutedColor,bodyColor:textColor,borderColor,borderWidth:1,callbacks:{label:ctx=>` ${fmtFull(ctx.raw)}`}}}
      }
    });
    document.getElementById('chartLegend').innerHTML = entries.slice(0,6).map(e =>
      `<div class="legend-item"><div class="legend-dot" style="background:${CAT_COLORS[e[0]]||'#a29bfe'}"></div><span class="legend-label">${e[0]}</span></div>`
    ).join('');
  } else {
    const monthMap = {};
    transactions.forEach(t => {
      if (t.cat === '__carryover__') return;
      const mon = t.date.substring(0,7);
      if (!monthMap[mon]) monthMap[mon] = {income:0,expense:0};
      monthMap[mon][t.type] += t.amt;
    });
    const labels = Object.keys(monthMap).sort().slice(-6);
    const monthNames = labels.map(l => { const [y,m]=l.split('-'); return new Date(y,m-1).toLocaleString('default',{month:'short'}); });
    canvas.style.display = 'block'; canvas.style.maxHeight = '220px';
    chartInstance = new Chart(ctx, {
      type:'bar',
      data:{
        labels:monthNames.length?monthNames:['—'],
        datasets:[
          {label:'Income', data:labels.map(l=>monthMap[l]?.income||0), backgroundColor:'rgba(127,255,110,.75)',borderColor:'#7fff6e',borderWidth:1.5,borderRadius:6},
          {label:'Expense',data:labels.map(l=>monthMap[l]?.expense||0),backgroundColor:'rgba(255,92,92,.65)', borderColor:'#ff5c5c',borderWidth:1.5,borderRadius:6}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:true,
        plugins:{legend:{display:false},tooltip:{backgroundColor:surface2,bodyColor:textColor,borderColor,borderWidth:1,callbacks:{label:ctx=>` ${fmtFull(ctx.raw)}`}}},
        scales:{
          x:{grid:{color:'rgba(128,128,128,.08)'},ticks:{color:'#7a7f94',font:{family:"'DM Mono'"}}},
          y:{grid:{color:'rgba(128,128,128,.08)'},ticks:{color:'#7a7f94',font:{family:"'DM Mono'"},callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)}}
        }
      }
    });
    document.getElementById('chartLegend').innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#7fff6e"></div><span class="legend-label">Income</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:#ff5c5c"></div><span class="legend-label">Expense</span></div>`;
  }
}

// ── CAT BARS ───────────────────────────────────
function renderCatBars(txns, totalExpense) {
  const el = document.getElementById('catBars');
  const expenses = txns.filter(t=>t.type==='expense'&&t.cat!=='__carryover__');
  if (!expenses.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span><p>No expenses this month</p></div>`;
    document.getElementById('catSubtitle').textContent = '';
    return;
  }
  const catMap = {};
  expenses.forEach(t => catMap[t.cat] = (catMap[t.cat]||0)+t.amt);
  const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  document.getElementById('catSubtitle').textContent = sorted.length + ' categories';
  el.innerHTML = sorted.map(([cat, amt]) => {
    const pct = totalExpense ? Math.round(amt/totalExpense*100) : 0;
    const clr = CAT_COLORS[cat] || '#a29bfe';
    return `<div class="cat-row">
      <div class="cat-info"><span class="cat-name">${CAT_EMOJI[cat]||''} ${cat}</span><span class="cat-val">${fmt(amt)}</span></div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%;background:${clr}"></div></div>
      <div class="cat-pct">${pct}%</div>
    </div>`;
  }).join('');
}

// ── RECENT ─────────────────────────────────────
function renderRecent(txns) {
  const el = document.getElementById('recentList');
  const recent = txns.slice(0,5);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">💸</span><p>No transactions this month.<br/>Tap + to add one.</p></div>`;
    return;
  }
  el.innerHTML = recent.map(t => txHTML(t)).join('');
}

// ── ALL TRANSACTIONS ───────────────────────────
function renderTransactions() {
  const search = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const typeF  = document.getElementById('filterType')?.value||'all';
  const el     = document.getElementById('txGroupedList');
  let filtered = monthTxns().filter(t => {
    if (t.cat === '__carryover__') return false;
    const matchS = !search || t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search);
    const matchT = typeF==='all' || t.type===typeF;
    const matchC = filterCat==='all' || t.cat===filterCat;
    return matchS && matchT && matchC;
  });
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span><p>No transactions found</p></div>`;
    return;
  }
  const groups = {};
  filtered.forEach(t => (groups[t.date]=groups[t.date]||[]).push(t));
  const sortedDates = Object.keys(groups).sort((a,b)=>b.localeCompare(a));
  el.innerHTML = sortedDates.map(date => {
    const dayTotal = groups[date].reduce((s,t)=>t.type==='expense'?s-t.amt:s+t.amt,0);
    return `<div class="tx-group-label">
      <span>${dayLabel(date)}</span>
      <span style="color:${dayTotal>=0?'var(--income)':'var(--expense)'}">${dayTotal>=0?'+':''}${fmt(dayTotal,false)}</span>
    </div>
    <div class="tx-list">${groups[date].map(t=>txHTML(t)).join('')}</div>`;
  }).join('');
}

function txHTML(t) {
  const isCarry = t.isCarryover || t.cat === '__carryover__';
  const iconClass = isCarry ? 'carryover' : t.type;
  const emoji = isCarry ? '↕' : (CAT_EMOJI[t.cat]||'💳');
  const amtClass = isCarry ? 'carryover' : t.type;
  const sign = t.type==='income' ? '+' : '-';
  const delBtn = isCarry ? '' : `<button class="tx-del" onclick="deleteTx(${t.id})">✕</button>`;
  return `<div class="tx-item">
    <div class="tx-icon ${iconClass}">${emoji}</div>
    <div class="tx-info">
      <div class="tx-desc">${esc(t.desc)}${t.recurring?'<span class="tx-recurring-badge">🔁</span>':''}</div>
      <div class="tx-meta">${isCarry?'Carry-over':t.cat} · ${formatDate(t.date)}</div>
      ${t.note?`<div class="tx-note">${esc(t.note)}</div>`:''}
    </div>
    <div class="tx-right">
      <div class="tx-amount ${amtClass}">${sign}${fmtFull(t.amt)}</div>
      ${delBtn}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════
// ── SAVINGS GOALS ─────────────────────────────
// ══════════════════════════════════════════════

// Emoji picker
function buildEmojiPicker() {
  document.getElementById('emojiPicker').innerHTML = GOAL_EMOJIS.map(e =>
    `<button class="ep-btn${e==='🎯'?' active':''}" onclick="selectEmoji('${e}',this)">${e}</button>`
  ).join('');
}
function selectEmoji(emoji, btn) {
  document.getElementById('sgEmoji').value = emoji;
  document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Open modal
function openSavingsModal() {
  document.getElementById('sgName').value = '';
  document.getElementById('sgTarget').value = '';
  document.getElementById('sgDeadline').value = '';
  document.getElementById('sgEmoji').value = '🎯';
  document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.ep-btn')?.classList.add('active');
  openModal('savingsModal');
}

// Create goal
function createSavingsGoal() {
  const name   = document.getElementById('sgName').value.trim();
  const target = parseFloat(document.getElementById('sgTarget').value);
  const emoji  = document.getElementById('sgEmoji').value || '🎯';
  const deadline = document.getElementById('sgDeadline').value;

  if (!name)           { toast('Enter a goal name'); return; }
  if (!target || target <= 0) { toast('Enter a target amount'); return; }

  const idx = savingsGoals.length % SG_COLORS.length;
  const goal = {
    id:       Date.now(),
    name, emoji, target,
    deadline: deadline || null,
    saved:    0,
    color:    SG_COLORS[idx],
    history:  [],
    createdAt: new Date().toISOString()
  };

  savingsGoals.push(goal);
  save('bp_savings', savingsGoals);
  closeModal('savingsModal');
  renderSavingsGoals();
  renderSavingsSnapshot();
  toast(`${emoji} ${name} goal created ✓`);
}

// Render all savings goals
function renderSavingsGoals() {
  const el = document.getElementById('savingsList');
  if (!savingsGoals.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">★</span><p>No savings goals yet.<br/>Create one below!</p></div>`;
    return;
  }

  el.innerHTML = savingsGoals.map(g => {
    const pct      = g.target > 0 ? Math.min(Math.round(g.saved / g.target * 100), 100) : 0;
    const remaining = Math.max(g.target - g.saved, 0);
    const complete  = g.saved >= g.target;
    const deadlineStr = g.deadline ? deadlineLabel(g.deadline) : '';
    const monthsLeft  = g.deadline ? monthsBetween(viewMonth, g.deadline) : null;
    const monthlyNeed = (monthsLeft && monthsLeft > 0 && remaining > 0) ? fmt(remaining / monthsLeft) : null;

    return `<div class="savings-goal-card">
      <div class="sg-header">
        <div class="sg-title-row">
          <span class="sg-emoji">${g.emoji}</span>
          <div>
            <div class="sg-name">${esc(g.name)}</div>
            ${g.deadline ? `<div class="sg-deadline">📅 ${deadlineStr}${monthlyNeed&&!complete?` · ${monthlyNeed}/mo needed`:''}</div>` : ''}
          </div>
        </div>
        <button class="sg-del" onclick="deleteSavingsGoal(${g.id})">✕</button>
      </div>
      <div class="sg-amounts">
        <span class="sg-saved" style="color:${g.color}">${fmtFull(g.saved)}</span>
        <span class="sg-target">of ${fmtFull(g.target)}</span>
      </div>
      <div class="sg-bar-wrap">
        <div class="sg-bar${complete?' complete':''}" style="width:${pct}%;background:${complete?'var(--income)':g.color}"></div>
      </div>
      <div class="sg-stats">
        <span class="sg-pct" style="color:${complete?'var(--income)':g.color}">${pct}%</span>
        ${complete
          ? `<span class="sg-complete-badge">🎉 Goal reached!</span>`
          : `<span class="sg-remaining">${fmtFull(remaining)} to go</span>`}
      </div>
      <div class="sg-actions">
        <button class="sg-btn add" onclick="openContribute(${g.id},'add')">
          <span class="sg-btn-icon">+</span><span>Add</span>
        </button>
        <button class="sg-btn withdraw" onclick="openContribute(${g.id},'withdraw')">
          <span class="sg-btn-icon">−</span><span>Withdraw</span>
        </button>
        <button class="sg-btn history" onclick="openHistory(${g.id})">
          <span class="sg-btn-icon">≡</span><span>History</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

// Dashboard snapshot
function renderSavingsSnapshot() {
  const el = document.getElementById('savingsSnapshot');
  if (!savingsGoals.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><span class="emoji" style="font-size:1.5rem">★</span><p style="font-size:.76rem">No savings goals yet</p></div>`;
    return;
  }
  el.innerHTML = savingsGoals.slice(0,4).map(g => {
    const pct = g.target > 0 ? Math.min(Math.round(g.saved/g.target*100),100) : 0;
    return `<div class="sg-snap-item">
      <div class="sg-snap-emoji">${g.emoji}</div>
      <div class="sg-snap-info">
        <div class="sg-snap-name">${esc(g.name)}</div>
        <div class="sg-snap-bar-wrap">
          <div class="sg-snap-bar" style="width:${pct}%;background:${g.color}"></div>
        </div>
      </div>
      <div class="sg-snap-right">
        <div class="sg-snap-pct" style="color:${g.color}">${pct}%</div>
        <div class="sg-snap-saved">${fmt(g.saved)}</div>
      </div>
    </div>`;
  }).join('');
}

// Contribute / Withdraw
function openContribute(goalId, mode) {
  activeGoalId   = goalId;
  contributeMode = mode;
  const g = savingsGoals.find(g => g.id === goalId);
  if (!g) return;
  document.getElementById('contributeTitle').textContent = mode === 'add' ? `Add to "${g.name}"` : `Withdraw from "${g.name}"`;
  document.getElementById('contributeBtn').textContent   = mode === 'add' ? 'Add Money' : 'Withdraw';
  document.getElementById('contributeBtn').style.background = mode === 'add' ? 'var(--income)' : 'var(--expense)';
  document.getElementById('contributeAmt').value  = '';
  document.getElementById('contributeNote').value = '';
  openModal('contributeModal');
}

function submitContribution() {
  const amt  = parseFloat(document.getElementById('contributeAmt').value);
  const note = document.getElementById('contributeNote').value.trim() || (contributeMode === 'add' ? 'Contribution' : 'Withdrawal');
  if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }

  const idx = savingsGoals.findIndex(g => g.id === activeGoalId);
  if (idx === -1) return;

  const g = savingsGoals[idx];
  if (contributeMode === 'withdraw' && amt > g.saved) {
    toast(`Can't withdraw more than saved (${fmtFull(g.saved)})`); return;
  }

  const delta = contributeMode === 'add' ? amt : -amt;
  g.saved = Math.max(0, g.saved + delta);
  g.history = g.history || [];
  g.history.unshift({
    id:   Date.now(),
    type: contributeMode,
    amt,
    note,
    date: new Date().toISOString().split('T')[0]
  });

  savingsGoals[idx] = g;
  save('bp_savings', savingsGoals);
  closeModal('contributeModal');
  renderSavingsGoals();
  renderSavingsSnapshot();

  const verb = contributeMode === 'add' ? 'Added' : 'Withdrew';
  toast(`${verb} ${fmtFull(amt)} ${contributeMode === 'add' ? 'to' : 'from'} ${g.name} ✓`);
  if (g.saved >= g.target) toast(`🎉 Goal "${g.name}" complete!`);
}

// History
function openHistory(goalId) {
  const g = savingsGoals.find(g => g.id === goalId);
  if (!g) return;
  activeGoalId = goalId;
  document.getElementById('historyTitle').textContent = `${g.emoji} ${g.name}`;
  const el = document.getElementById('historyList');
  const hist = g.history || [];
  if (!hist.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><span class="emoji">📋</span><p>No history yet</p></div>`;
  } else {
    el.innerHTML = hist.map(h => {
      const clr = h.type === 'add' ? 'var(--income)' : 'var(--expense)';
      const sign = h.type === 'add' ? '+' : '-';
      return `<div class="hist-item">
        <div class="hist-dot" style="background:${clr}"></div>
        <div class="hist-info">
          <div class="hist-note">${esc(h.note)}</div>
          <div class="hist-date">${formatDateFull(h.date)}</div>
        </div>
        <div class="hist-amt" style="color:${clr}">${sign}${fmtFull(h.amt)}</div>
      </div>`;
    }).join('');
  }
  openModal('historyModal');
}

// Delete savings goal
function deleteSavingsGoal(id) {
  if (!confirm('Delete this savings goal? All history will be lost.')) return;
  savingsGoals = savingsGoals.filter(g => g.id !== id);
  save('bp_savings', savingsGoals);
  renderSavingsGoals();
  renderSavingsSnapshot();
  toast('Goal deleted');
}

// ── BUDGET GOALS ───────────────────────────────
function openGoalModal() {
  document.getElementById('goalAmount').value = '';
  openModal('goalModal');
}
function saveGoal() {
  const cat = document.getElementById('goalCat').value;
  const amt = parseFloat(document.getElementById('goalAmount').value);
  if (!amt || amt <= 0) { toast('Enter a valid limit'); return; }
  budgetGoals[cat] = amt;
  save('bp_goals', budgetGoals);
  closeModal('goalModal');
  renderGoals();
  toast(`Limit set for ${cat} ✓`);
}
function deleteGoal(cat) {
  delete budgetGoals[cat];
  save('bp_goals', budgetGoals);
  renderGoals();
  toast('Goal removed');
}
function renderGoals() {
  const el = document.getElementById('goalsList');
  const txns = monthTxns();
  const entries = Object.entries(budgetGoals);
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🎯</span><p>No budget limits set.<br/>Add one below.</p></div>`;
    return;
  }
  el.innerHTML = entries.map(([cat, limit]) => {
    const spent = txns.filter(t=>t.type==='expense'&&t.cat===cat).reduce((s,t)=>s+t.amt,0);
    const pct   = Math.min(Math.round(spent/limit*100), 100);
    const over  = spent > limit;
    const warn  = !over && pct >= 80;
    const cls   = over ? 'over' : warn ? 'warn' : 'ok';
    const remaining = limit - spent;
    const statusText = over ? `Over by ${fmtFull(spent-limit)}` : warn ? `Only ${fmtFull(remaining)} left` : `${fmtFull(remaining)} remaining`;
    return `<div class="goal-card">
      <div class="goal-header">
        <span class="goal-cat">${CAT_EMOJI[cat]||''} ${cat}</span>
        <span class="goal-amounts"><strong>${fmtFull(spent)}</strong> / ${fmtFull(limit)}</span>
      </div>
      <div class="goal-bar-wrap"><div class="goal-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="goal-status ${cls}">${statusText} · ${pct}%</div>
      <button class="goal-del-btn" onclick="deleteGoal('${cat}')">Remove</button>
    </div>`;
  }).join('');
}

// ── STATS ──────────────────────────────────────
function renderStats() {
  renderTrendChart();
  renderTopDays();
  renderStatBlocks();
}
function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  if (trendInstance) trendInstance.destroy();
  const monthMap = {};
  transactions.forEach(t => {
    if (t.cat==='__carryover__') return;
    const mon = t.date.substring(0,7);
    if (!monthMap[mon]) monthMap[mon] = {income:0,expense:0};
    monthMap[mon][t.type] += t.amt;
  });
  const labels = Object.keys(monthMap).sort().slice(-8);
  const monthNames = labels.map(l => { const [y,m]=l.split('-'); return new Date(y,m-1).toLocaleString('default',{month:'short'}); });
  trendInstance = new Chart(canvas.getContext('2d'), {
    type:'line',
    data:{
      labels:monthNames.length?monthNames:['—'],
      datasets:[
        {label:'Income', data:labels.map(l=>monthMap[l]?.income||0), borderColor:'#7fff6e',backgroundColor:'rgba(127,255,110,.08)',borderWidth:2,pointRadius:4,pointBackgroundColor:'#7fff6e',tension:.35,fill:true},
        {label:'Expense',data:labels.map(l=>monthMap[l]?.expense||0),borderColor:'#ff5c5c',backgroundColor:'rgba(255,92,92,.08)', borderWidth:2,pointRadius:4,pointBackgroundColor:'#ff5c5c',tension:.35,fill:true}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:getCSS('--surface2'),bodyColor:getCSS('--text'),borderColor:getCSS('--border'),borderWidth:1,callbacks:{label:ctx=>` ${fmtFull(ctx.raw)}`}}},
      scales:{
        x:{grid:{color:'rgba(128,128,128,.06)'},ticks:{color:'#7a7f94',font:{family:"'DM Mono'",size:10}}},
        y:{grid:{color:'rgba(128,128,128,.06)'},ticks:{color:'#7a7f94',font:{family:"'DM Mono'",size:10},callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)}}
      }
    }
  });
}
function renderTopDays() {
  const el = document.getElementById('topDays');
  const txns = monthTxns().filter(t=>t.type==='expense'&&t.cat!=='__carryover__');
  if (!txns.length) { el.innerHTML=`<div class="empty-state" style="padding:20px"><span class="emoji">📅</span><p>No data</p></div>`; return; }
  const dayMap = {};
  txns.forEach(t => dayMap[t.date]=(dayMap[t.date]||0)+t.amt);
  const sorted = Object.entries(dayMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el.innerHTML = sorted.map(([date,amt]) =>
    `<div class="top-day-row"><span class="tdr-date">${formatDateFull(date)}</span><span class="tdr-amt">-${fmtFull(amt)}</span></div>`
  ).join('');
}
function renderStatBlocks() {
  const el = document.getElementById('statsGrid');
  const txns = monthTxns();
  const inc  = txns.filter(t=>t.type==='income'&&!t.isCarryover).reduce((s,t)=>s+t.amt,0);
  const exp  = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const amts = txns.filter(t=>t.type==='expense').map(t=>t.amt);
  const avgExp = amts.length ? amts.reduce((a,b)=>a+b,0)/amts.length : 0;
  const maxExp = amts.length ? Math.max(...amts) : 0;
  const totalSaved = savingsGoals.reduce((s,g)=>s+g.saved,0);
  const goalsCount = savingsGoals.length;
  el.innerHTML = [
    {label:'Avg Expense',      value:fmtFull(avgExp)},
    {label:'Largest Expense',  value:fmtFull(maxExp)},
    {label:'Total Saved',      value:fmtFull(totalSaved)},
    {label:'Savings Goals',    value:goalsCount},
  ].map(s=>`<div class="stat-block"><div class="sb-label">${s.label}</div><div class="sb-value">${s.value}</div></div>`).join('');
}

// ── EXPORT ─────────────────────────────────────
function exportCSV() {
  if (!transactions.length) { toast('No transactions to export'); return; }
  const header = ['Date','Type','Description','Category','Amount','Note','Recurring'];
  const rows   = transactions.filter(t=>!t.isCarryover).map(t =>
    [t.date,t.type,`"${t.desc}"`,t.cat,t.amt.toFixed(2),`"${t.note||''}"`,t.recurring?t.recurFreq:'no']
  );
  const csv = [header,...rows].map(r=>r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
    download: `budget-${viewMonth}.csv`
  });
  a.click();
  toast('Exported ✓');
}

// ── MODALS ─────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id, event) {
  if (event && event.target !== document.getElementById(id)) return;
  document.getElementById(id).classList.remove('open');
}

// ── HELPERS ────────────────────────────────────
function getCSS(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function monthsBetween(from, to) {
  const [fy,fm] = from.split('-').map(Number);
  const [ty,tm] = to.split('-').map(Number);
  return (ty-fy)*12 + (tm-fm);
}
function deadlineLabel(deadline) {
  const monthsLeft = monthsBetween(toMonthStr(new Date()), deadline);
  if (monthsLeft < 0) return `Deadline passed`;
  if (monthsLeft === 0) return `Due this month`;
  if (monthsLeft === 1) return `1 month left`;
  return `${monthsLeft} months left`;
}

// ── TOAST ──────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
