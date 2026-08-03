/* ============================================================
   CONFIGURAZIONE LIBRERIA XLSX
   ============================================================ */

function initXLSX(callback) {
  if (typeof XLSX !== 'undefined') {
    callback();
  } else {
    alert('❌ Errore: La libreria Excel non è stata caricata.\nRicarica la pagina e riprova.');
  }
}

/* ============================================================
   CONFIGURAZIONE TEMA E STILI
   ============================================================ */

const PALETTE = {
  accent: '#6e8c9c',
  info: '#6e8c9c',
  warn: '#b89f84',
  danger: '#b5615a',
  violet: '#b89f84',
  navy: '#2e4857',
  pos: '#6f9277',
  neg: '#b5615a',
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
   STATE GLOBALE
   ============================================================ */

let STATE = {
  dimRows: [],
  dimHeaders: [],
  domainSheets: [],
  charts: {},
  activeTab: null,
  taskData: {}
};

/* ============================================================
   FORMATTATORI
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
   LOCALSTORAGE UTILITIES
   ============================================================ */

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    alert('⚠️ Spazio storage esaurito');
  }
}

function loadFromLocalStorage(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

/* ============================================================
   GESTIONE FILE
   ============================================================ */

function setupFileHandling() {
  const fileInputMain = document.getElementById('fileInputMain');
  const fileInputTask = document.getElementById('fileInputTask');
  const dropZone = document.getElementById('dropZone') || document.body;
  const btnLoadMain = document.getElementById('btnLoadMain');
  const btnLoadTask = document.getElementById('btnLoadTask');

  // Database principale
  if (btnLoadMain) btnLoadMain.onclick = () => fileInputMain.click();
  if (fileInputMain) {
    fileInputMain.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileMain(file);
    });
  }

  // Task/Metadata
  if (btnLoadTask) btnLoadTask.onclick = () => fileInputTask.click();
  if (fileInputTask) {
    fileInputTask.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileTask(file);
    });
  }

  // Drop zone per database principale
  dropZone.onclick = () => fileInputMain.click();

  ['dragover', 'dragenter'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileMain(file);
  });

  // Carica da localStorage all'avvio
  const cachedMain = loadFromLocalStorage('database_main');
  const cachedTask = loadFromLocalStorage('database_task');

  if (cachedMain) {
    STATE.dimRows = cachedMain.data.dimRows;
    STATE.dimHeaders = cachedMain.data.dimHeaders;
    STATE.domainSheets = cachedMain.data.domainSheets;
    document.getElementById('fileInfoMain').textContent = '✅ Caricato da cache';
  }

  if (cachedTask) {
    STATE.taskData = cachedTask.data;
    document.getElementById('fileInfoTask').textContent = '✅ Caricato da cache';
  }

  // Se entrambi sono cached, mostra il dashboard
  if (cachedMain && cachedTask) {
    buildTabs();
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
  }
}

function handleFileMain(file) {
  if (typeof XLSX === 'undefined') {
    alert('❌ Libreria Excel non caricata.');
    return;
  }

  const fileInfo = document.getElementById('fileInfoMain');
  const loadingBar = document.getElementById('loadingBar');
  if (fileInfo) fileInfo.textContent = '⏳ Elaborazione...';
  if (loadingBar) loadingBar.style.display = 'block';

  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  reader.onload = (e) => {
    try {
      let wb;

      if (isCSV) {
        const csv = e.target.result;
        wb = XLSX.read(csv, {
          type: 'string',
          cellDates: true,
          defval: ''
        });
      } else {
        const data = new Uint8Array(e.target.result);
        wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          defval: '',
          blankrows: false
        });
      }

      parseWorkbook(wb);

      // Salva in localStorage
      saveToLocalStorage('database_main', {
        dimRows: STATE.dimRows,
        dimHeaders: STATE.dimHeaders,
        domainSheets: STATE.domainSheets
      });

      if (fileInfo) fileInfo.textContent = '✅ ' + file.name;
      if (loadingBar) loadingBar.style.display = 'none';

      // Controlla se task è già caricato
      const cachedTask = loadFromLocalStorage('database_task');
      if (cachedTask) {
        STATE.taskData = cachedTask.data;
        buildTabs();
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
      }

    } catch (err) {
      if (fileInfo) fileInfo.textContent = '❌ Errore';
      if (loadingBar) loadingBar.style.display = 'none';
      alert('❌ Errore: ' + err.message);
    }
  };

  reader.onerror = () => {
    if (loadingBar) loadingBar.style.display = 'none';
    alert('❌ Errore nella lettura del file.');
  };

  if (isCSV) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

function handleFileTask(file) {
  if (typeof XLSX === 'undefined') {
    alert('❌ Libreria Excel non caricata.');
    return;
  }

  const fileInfo = document.getElementById('fileInfoTask');
  const loadingBar = document.getElementById('loadingBar');
  if (fileInfo) fileInfo.textContent = '⏳ Elaborazione...';
  if (loadingBar) loadingBar.style.display = 'block';

  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  reader.onload = (e) => {
    try {
      let wb;

      if (isCSV) {
        const csv = e.target.result;
        wb = XLSX.read(csv, {
          type: 'string',
          cellDates: true,
          defval: ''
        });
      } else {
        const data = new Uint8Array(e.target.result);
        wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          defval: '',
          blankrows: false
        });
      }

      parseTaskWorkbook(wb);

      // Salva in localStorage
      saveToLocalStorage('database_task', STATE.taskData);

      if (fileInfo) fileInfo.textContent = '✅ ' + file.name;
      if (loadingBar) loadingBar.style.display = 'none';

      // Controlla se main è già caricato
      const cachedMain = loadFromLocalStorage('database_main');
      if (cachedMain) {
        STATE.dimRows = cachedMain.data.dimRows;
        STATE.dimHeaders = cachedMain.data.dimHeaders;
        STATE.domainSheets = cachedMain.data.domainSheets;
        buildTabs();
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
      }

    } catch (err) {
      if (fileInfo) fileInfo.textContent = '❌ Errore';
      if (loadingBar) loadingBar.style.display = 'none';
      alert('❌ Errore: ' + err.message);
    }
  };

  reader.onerror = () => {
    if (loadingBar) loadingBar.style.display = 'none';
    alert('❌ Errore nella lettura del file.');
  };

  if (isCSV) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

/* ============================================================
   PARSE TASK WORKBOOK
   ============================================================ */

function parseTaskWorkbook(wb) {
  const sheetNames = wb.SheetNames;
  STATE.taskData = {};

  sheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    STATE.taskData[sheetName] = rows;
  });
}

/* ============================================================
   UTILITY: Accedere ai dati di task
   ============================================================ */

function getTaskDataForSheet(sheetName) {
  if (!STATE.taskData) return null;

  if (STATE.taskData[sheetName]) {
    return STATE.taskData[sheetName];
  }

  const normalized = String(sheetName).toLowerCase().trim();
  const key = Object.keys(STATE.taskData).find(k =>
    String(k).toLowerCase().includes(normalized) ||
    normalized.includes(String(k).toLowerCase())
  );

  return key ? STATE.taskData[key] : null;
}

function getTaskDataByFilter(sheetName, filterFn) {
  const data = getTaskDataForSheet(sheetName);
  return data ? data.filter(filterFn) : [];
}

/* ============================================================
   PARSE WORKBOOK -> classify sheets
   ============================================================ */

function parseWorkbook(wb) {
  const sheetNames = wb.SheetNames;
  if (sheetNames.length < 1) {
    alert('Il workbook non contiene fogli.');
    return;
  }

  const dimSheet = wb.Sheets[sheetNames[0]];
  const dimJson = XLSX.utils.sheet_to_json(dimSheet, { defval: null });
  STATE.dimRows = dimJson;
  STATE.dimHeaders = dimJson.length ? Object.keys(dimJson[0]) : [];

  STATE.domainSheets = [];
  for (let i = 1; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const type = classifySheet(name);
    const dimRow = findDimRow(name);
    STATE.domainSheets.push({ sheetName: name, type, headers, rows, dimRow });
  }

  const typeOrder = ['ordinario', 'speciale', 'perfezionamenti', 'anagrafe', 'antifrode', 'ops_aml', 'bancassurance', 'generic'];
  STATE.domainSheets.sort((a, b) => {
    const orderA = typeOrder.indexOf(a.type);
    const orderB = typeOrder.indexOf(b.type);
    return (orderA === -1 ? Infinity : orderA) - (orderB === -1 ? Infinity : orderB);
  });
}

function classifySheet(sheetName) {
  const name = String(sheetName).toLowerCase().trim();

  if (name.includes('10001100023100042100130v1')) return 'digital_rapporti';
  if (name.includes('10001100023100042100130v2')) return 'digital_frodi';
  if (name.includes('10001100023100042100130v3')) return 'digital_raisin';
  if (name.includes('10001100023100042100129')) return 'bancassurance';
  if (name.includes('10001100023100036v1')) return 'monetica_bonifici_banca';
  if (name.includes('10001100023100036v2')) return 'monetica_cassa';
  if (name.includes('10001100023100036v3')) return 'monetica_cassette';
  if (name.includes('10001100023100036v4')) return 'monetica_bonifici_estero';
  if (name.includes('10001100023100034')) return 'ops_aml';
  if (name.includes('10001100023100044')) return 'antifrode';
  if (name.includes('100011000231')) return 'anagrafe';
  if (name.includes('10004100067100079')) return 'perfezionamenti';
  if (name.includes('10004100067100080v1')) return 'factoring_cedenti';
  if (name.includes('10004100067100080v2')) return 'factoring_debitori';
  if (name.includes('10004100051')) return 'speciale';
  if (name.includes('10004100052')) return 'ordinario';
  return 'generic';
}

function findDimRow(sheetName) {
  if (!STATE.dimRows.length) return null;
  let row = STATE.dimRows.find(r => String(r.ID) === String(sheetName));
  if (!row) {
    row = STATE.dimRows.find(r => String(r.ID).startsWith(String(sheetName).slice(0, 8)));
  }
  return row || null;
}

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

/* ============================================================
   TASK DATA ENRICHMENT
   ============================================================ */
function enrichSheetWithTaskData(s) {
  const taskData = getTaskDataForSheet(s.sheetName);
  const taskActive = getTaskDataByFilter(s.sheetName, row => row.status === 'active');
  
  return {
    ...s,
    taskData: taskData,
    taskActive: taskActive,
    taskCount: taskActive ? taskActive.length : 0
  };
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  initXLSX(() => {
    setupFileHandling();
  });
});