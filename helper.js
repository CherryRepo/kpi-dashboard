/* ============================================================
   GENERAL SETTINGS
   ============================================================ */

const PALETTE = {
  accent: '#a4b8c1',
  info: '#6e8c9c',
  warn: '#b89f84',
  danger: '#b5615a',
  violet: '#dbcab6', 
  navy: '#2e4857',
  pos: '#6f9277',
  neg: '#9fb8d6', 
  text: '#6e8c9c', 
  grid: 'rgba(46,72,87,0.08)'
};

const CHART_SERIES = [
  '#2e4857', '#6e8c9c', '#a4b8c1', '#dbcab6',
  '#b89f84', '#6f9277', '#b5615a', '#9fb8d6'
];

Chart.defaults.color = PALETTE.text;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.borderColor = PALETTE.grid;

/* ============================================================
   FORMATTERS
   ============================================================ */

const fmtInt = new Intl.NumberFormat('it-IT');
const fmtDec = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});
const fmtCurrency = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});
const fmtDate = (d) => d instanceof Date && !isNaN(d) ? d.toLocaleDateString('it-IT') : '—';

/* ============================================================
   GENERIC HELPERS
   ============================================================ */

function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function monthKey(d) {
  if (!d) return null;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function countBy(rows, key) {
  const m = new Map();
  rows.forEach(r => {
    let v = r[key];
    if (v === null || v === undefined || v === '') v = '(non specificato)';
    m.set(v, (m.get(v) || 0) + 1);
  });
  return m;
}

function sumBy(rows, groupKey, valKey) {
  const m = new Map();
  rows.forEach(r => {
    let v = r[groupKey];
    if (v === null || v === undefined || v === '') v = '(non specificato)';
    const n = Number(r[valKey]) || 0;
    m.set(v, (m.get(v) || 0) + n);
  });
  return m;
}

function avgBy(rows, groupKey, valKey) {
  const sums = new Map(), counts = new Map();
  rows.forEach(r => {
    let v = r[groupKey];
    if (v === null || v === undefined || v === '') v = '(non specificato)';
    const n = Number(r[valKey]);
    if (isNaN(n)) return;
    sums.set(v, (sums.get(v) || 0) + n);
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const out = new Map();
  sums.forEach((s, k) => out.set(k, s / counts.get(k)));
  return out;
}

function mapToSorted(m, desc = true) {
  return [...m.entries()].sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]);
}

function topN(arr, n) {
  return arr.slice(0, n);
}

function distinctCount(rows, idKey = 'ndg') {
  return new Set(rows.map(r => r[idKey])).size;
}

function countDistinctBy(rows, groupKey, idKey = 'ndg') {
  const m = new Map();
  rows.forEach(r => {
    let g = r[groupKey];
    if (g === null || g === undefined || g === '') g = '(non specificato)';
    if (!m.has(g)) m.set(g, new Set());
    m.get(g).add(r[idKey]);
  });
  const out = new Map();
  m.forEach((set, k) => out.set(k, set.size));
  return out;
}

function pillFte(v) {
  if (v === null || v === undefined || v === '') return '<span class="pill">—</span>';
  return `<span class="pill">${fmtDec.format(Number(v))}</span>`;
}

function pillDelta(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) < 0.05) return '<span class="pill pos"><span class="arrow">■</span>-</span>';
  if (n < 0) return `<span class="pill neg"><span class="arrow">▼</span>(${fmtDec.format(Math.abs(n))})</span>`;
  return `<span class="pill pos"><span class="arrow">▲</span>${fmtDec.format(n)}</span>`;
}

function destroyChart(id) {
  if (STATE.charts[id]) {
    STATE.charts[id].destroy();
    delete STATE.charts[id];
  }
}

function mkChart(id, cfg) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  STATE.charts[id] = new Chart(ctx, cfg);
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}