/* ============================================================
   CONFIGURAZIONE LIBRERIA XLSX
   ============================================================ */

function initXLSX(callback) {
  if (typeof XLSX !== 'undefined') {
    console.log('✅ XLSX caricato correttamente');
    callback();
  } else {
    console.error('❌ XLSX non disponibile');
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

// Configurazione Chart.js
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
};

/* ============================================================
   FORMATTATORI
   ============================================================ */

const fmtInt = new Intl.NumberFormat('it-IT');
const fmtDec = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});
const fmtDate = (d) => d instanceof Date && !isNaN(d) ? d.toLocaleDateString('it-IT') : '—';

/* ============================================================
   GESTIONE FILE
   ============================================================ */

function setupFileHandling() {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone') || document.body;
  const btnLoad = document.getElementById('btnLoad');
  const btnReplace = document.getElementById('btnReplace');

  // Click sui pulsanti
  if (btnLoad) btnLoad.onclick = () => fileInput.click();
  if (btnReplace) btnReplace.onclick = () => fileInput.click();
  
  // Click sulla drop zone
  dropZone.onclick = () => fileInput.click();

  // Drag & drop
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
    if (file) handleFile(file);
  });

  // Change input
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });
}

function handleFile(file) {
  console.log('📂 File selezionato:', file.name);
  
  if (typeof XLSX === 'undefined') {
    alert('❌ Libreria Excel non caricata.');
    return;
  }

  const fileInfo = document.getElementById('fileInfo');
  if (fileInfo) fileInfo.textContent = '⏳ Elaborazione: ' + file.name;

  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  reader.onload = (e) => {
    try {
      console.log('📖 Inizio lettura:', isCSV ? 'CSV' : 'XLSX');
      const startTime = performance.now();
      
      let wb;

      if (isCSV) {
        // ⚡ CSV: leggi come testo e converti
        const csv = e.target.result;
        wb = XLSX.read(csv, {
          type: 'string',
          cellDates: true,
          defval: ''
        });
      } else {
        // XLSX: leggi come array buffer
        const data = new Uint8Array(e.target.result);
        wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          defval: '',
          blankrows: false
        });
      }

      console.log('✅ File caricato in', (performance.now() - startTime).toFixed(0) + 'ms');
      console.log('📄 Fogli:', wb.SheetNames);

      parseWorkbook(wb);

      const totalTime = (performance.now() - startTime).toFixed(0);
      if (fileInfo) fileInfo.textContent = '✅ ' + file.name + ' (' + totalTime + 'ms)';
      console.log('✅ Completato in', totalTime + 'ms');

    } catch (err) {
      console.error('❌ Errore:', err);
      if (fileInfo) fileInfo.textContent = '❌ Errore';
      alert('❌ Errore: ' + err.message);
    }
  };

  reader.onerror = () => {
    alert('❌ Errore nella lettura del file.');
  };

  // ⚡ Leggi come stringa per CSV, buffer per XLSX
  if (isCSV) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

/* ============================================================
   INIZIALIZZAZIONE
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Pagina caricata');
  initXLSX(() => {
    setupFileHandling();
  });
});


/* ============================================================
   PARSE WORKBOOK -> classify sheets
   ============================================================ */
function parseWorkbook(wb){
  const sheetNames = wb.SheetNames;
  if(sheetNames.length < 1){ alert('Il workbook non contiene fogli.'); return; }

  // sheet 0 = dimensionamento
  const dimSheet = wb.Sheets[sheetNames[0]];
  const dimJson = XLSX.utils.sheet_to_json(dimSheet, {defval:null});
  STATE.dimRows = dimJson;
  STATE.dimHeaders = dimJson.length ? Object.keys(dimJson[0]) : [];

  STATE.domainSheets = [];
  for(let i=1;i<sheetNames.length;i++){
    const name = sheetNames[i];
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
    if(!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const type = classifySheet(name);
    const dimRow = findDimRow(name);
    STATE.domainSheets.push({sheetName:name, type, headers, rows, dimRow});
  }

  const typeOrder = ['credito','perfezionamenti','anagrafe','antifrode','ops_aml','bancassurance', 'generic'];
  STATE.domainSheets.sort((a, b) => {
    const orderA = typeOrder.indexOf(a.type);
    const orderB = typeOrder.indexOf(b.type);
    return (orderA === -1 ? Infinity : orderA) - (orderB === -1 ? Infinity : orderB);
  });

  buildTabs();
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}

function classifySheet(sheetName) {
  const name = String(sheetName).toLowerCase().trim();

    // Digital Bank, Monetica - tre sorgenti
  if (name.includes('10001100023100042100130v1')) return 'digital_rapporti';
  if (name.includes('10001100023100042100130v2')) return 'digital_frodi';
  if (name.includes('10001100023100042100130v3')) return 'digital_raisin';
  if (name.includes('10001100023100042100129')) return 'bancassurance';
  if (name.includes('10001100023100036v1')) return 'monetica_bonifici';
  if (name.includes('10001100023100036v2')) return 'monetica_cassa';
  if (name.includes('10001100023100036v3')) return 'monetica_cassette';
  if (name.includes('10001100023100034')) return 'ops_aml';
  if (name.includes('10001100023100044')) return 'antifrode';
  if (name.includes('100011000231')) return 'anagrafe';
  if (name.includes('10004100067100079')) return 'perfezionamenti';
  if (name.includes('10004100052')) return 'credito';
  return 'generic';
}

function findDimRow(sheetName){
  if(!STATE.dimRows.length) return null;
  let row = STATE.dimRows.find(r => String(r.ID) === String(sheetName));
  if(!row){
    // fallback: some IDs may be stored with float precision issues
    row = STATE.dimRows.find(r => String(r.ID).startsWith(String(sheetName).slice(0,8)));
  }
  return row || null;
}

/* ============================================================
   GENERIC HELPERS
   ============================================================ */
function toDate(v){
  if(v === null || v === undefined || v === '') return null;
  if(v instanceof Date) return isNaN(v) ? null : v;
  if(typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
function monthKey(d){
  if(!d) return null;
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function countBy(rows, key){
  const m = new Map();
  rows.forEach(r=>{
    let v = r[key];
    if(v === null || v === undefined || v === '') v = '(non specificato)';
    m.set(v, (m.get(v)||0)+1);
  });
  return m;
}
function sumBy(rows, groupKey, valKey){
  const m = new Map();
  rows.forEach(r=>{
    let v = r[groupKey];
    if(v === null || v === undefined || v === '') v = '(non specificato)';
    const n = Number(r[valKey])||0;
    m.set(v, (m.get(v)||0)+n);
  });
  return m;
}
function avgBy(rows, groupKey, valKey){
  const sums = new Map(), counts = new Map();
  rows.forEach(r=>{
    let v = r[groupKey];
    if(v === null || v === undefined || v === '') v = '(non specificato)';
    const n = Number(r[valKey]);
    if(isNaN(n)) return;
    sums.set(v, (sums.get(v)||0)+n);
    counts.set(v, (counts.get(v)||0)+1);
  });
  const out = new Map();
  sums.forEach((s,k)=> out.set(k, s / counts.get(k)));
  return out;
}
function mapToSorted(m, desc=true){
  return [...m.entries()].sort((a,b)=> desc ? b[1]-a[1] : a[1]-b[1]);
}
function topN(arr, n){ return arr.slice(0,n); }
function distinctCount(rows, idKey='ndg'){
  return new Set(rows.map(r=>r[idKey])).size;
}
function countDistinctBy(rows, groupKey, idKey='ndg'){
  const m = new Map();
  rows.forEach(r=>{
    let g = r[groupKey];
    if(g===null || g===undefined || g==='') g = '(non specificato)';
    if(!m.has(g)) m.set(g, new Set());
    m.get(g).add(r[idKey]);
  });
  const out = new Map();
  m.forEach((set,k)=> out.set(k, set.size));
  return out;
}
function pillFte(v){
  if(v===null || v===undefined || v==='') return '<span class="pill">—</span>';
  return `<span class="pill">${fmtDec.format(Number(v))}</span>`;
}
function pillDelta(v){
  const n = Number(v)||0;
  if(Math.abs(n) < 0.05) return '<span class="pill pos"><span class="arrow">■</span>-</span>';
  if(n < 0) return `<span class="pill neg"><span class="arrow">▼</span>(${fmtDec.format(Math.abs(n))})</span>`;
  return `<span class="pill pos"><span class="arrow">▲</span>${fmtDec.format(n)}</span>`;
}
function destroyChart(id){
  if(STATE.charts[id]){ STATE.charts[id].destroy(); delete STATE.charts[id]; }
}
function mkChart(id, cfg){
  destroyChart(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  STATE.charts[id] = new Chart(ctx, cfg);
}
function el(tag, cls, html){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html !== undefined) e.innerHTML = html;
  return e;
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function buildSidebar(){
  const nav = document.getElementById('navList');
  nav.innerHTML = '';
  const items = [{key:'overview', label:'Panoramica dimensionamento', tag:'DIM'}];
  const digitalTypes = ['digital_rapporti','digital_frodi','digital_raisin'];
  const moneticaTypes = ['monetica_bonifici','monetica_cassa','monetica_cassette'];
  const labelMap = {
    credito:'Credito Ordinario & Factoring',
    perfezionamenti:'Perfezionamenti credito ordinario',
    anagrafe:'Anagrafe',
    antifrode:'Antifrode',
    ops_aml:'OPS AML',
    bancassurance:'Wealth & Bancassurance',
    generic:'Foglio dati'
  };
  STATE.domainSheets.forEach((s, idx)=>{
    if(digitalTypes.includes(s.type) || moneticaTypes.includes(s.type)) return;
    const structLabel = s.dimRow 
      ? (s.dimRow['UO LAST'] || s.dimRow.nucleo_descrizione || s.sheetName)
      : s.sheetName;
    items.push({
      key:'d'+idx,
      label:(labelMap[s.type] || 'Foglio dati') + ' — ' + structLabel,
      tag:s.type.slice(0,3).toUpperCase()
    });
  });

  if(STATE.domainSheets.some(s=>digitalTypes.includes(s.type))){
    items.push({
      key:'digital',
      label:'Digital Bank',
      tag:'DIG'
    });
  }

  if(STATE.domainSheets.some(s=>moneticaTypes.includes(s.type))){
    items.push({
      key:'monetica',
      label:'Monetica',
      tag:'MON'
    });
  }

  items.forEach(it=>{
    const div = el('div','nav-item',`<span class="dot"></span><span>${it.label}</span><small>${it.tag}</small>`);
    div.dataset.key = it.key;
    div.onclick = ()=>activateTab(it.key);
    nav.appendChild(div);
  });

  const tree = document.getElementById('treeView');
  tree.innerHTML = '';

  if(!STATE.dimRows.length){
    tree.appendChild(el('div','hint','Nessun dimensionamento disponibile'));
    return;
  }

  const maxAbs = Math.max(1, ...STATE.dimRows.map(r=>Math.abs(Number(r['Need/Surplus'])||0)));

  STATE.dimRows.forEach(r=>{
    const ns = Number(r['Need/Surplus'])||0;
    const depth = ['uo1livello_descrizione','uo2livello_descrizione','uo3livello_descrizione','uo4livello_descrizione','nucleo_descrizione'].filter(k=>r[k] && String(r[k]).trim() !== '').length;
    const color = ns < -0.5 ? PALETTE.danger : ns > 0.5 ? PALETTE.warn : PALETTE.accent;
    const barH = 6 + Math.round((Math.abs(ns)/maxAbs)*16);

    const row = el('div','tree-row');
    row.style.paddingLeft = (8 + Math.max(0,depth-1)*14) + 'px';
    row.title = 'HC: ' + (r.HC ?? '—') + ' · FTE Stimati: ' + (r['FTE Stimati']!=null ? fmtDec.format(r['FTE Stimati']) : '—') + ' · Need/Surplus: ' + fmtDec.format(ns);

    row.innerHTML = `<span class="tree-bar" style="background:${color};height:${barH}px"></span><span class="tree-label">${r['UO LAST'] || ''}</span><span class="tree-val">${ns>0?'+':''}${fmtDec.format(ns)}</span>`;
    tree.appendChild(row);
  });
}

/* ============================================================
   TABS
   ============================================================ */
function buildTabs(){
  const bar = document.getElementById('tabsBar');
  const panels = document.getElementById('panels');
  bar.innerHTML = ''; panels.innerHTML = '';

  const tabDefs = [{key:'overview', label:'Overview'}];
  const digitalTypes = ['digital_rapporti','digital_frodi','digital_raisin'];
  const moneticaTypes = ['monetica_bonifici','monetica_cassa','monetica_cassette'];
  const hasDigital = STATE.domainSheets.some(s => digitalTypes.includes(s.type));
  const hasMonetica = STATE.domainSheets.some(s => moneticaTypes.includes(s.type));

  const labelMap = {credito:'Credito & Factoring', perfezionamenti:'Perfezionamenti credito ordinario', anagrafe:'Anagrafe', antifrode:'Antifrode', ops_aml:'OPS AML', bancassurance:'Wealth & Bancassurance'};

  STATE.domainSheets.forEach((s, idx)=>{
    if(digitalTypes.includes(s.type) || moneticaTypes.includes(s.type)) return;
    tabDefs.push({key:'d'+idx, label:labelMap[s.type] || 'Dati (' + s.sheetName + ')'});
  });

  if(hasDigital) tabDefs.push({key:'digital', label:'Digital Bank'});
  if(hasMonetica) tabDefs.push({key:'monetica', label:'Monetica'});

  tabDefs.forEach(t=>{
    const tab = el('div','tab',`<span>${t.label}</span>`);
    tab.dataset.key = t.key;
    tab.onclick = ()=>activateTab(t.key);
    bar.appendChild(tab);

    const panel = el('div','panel','');
    panel.id = 'panel-' + t.key;
    panels.appendChild(panel);
  });
}


function activateTab(key){
  STATE.activeTab = key;
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.key===key));
  document.querySelectorAll('.nav-item').forEach(t=> t.classList.toggle('active', t.dataset.key===key));
  document.querySelectorAll('.panel').forEach(p=> p.classList.toggle('active', p.id === 'panel-'+key));

  const panel = document.getElementById('panel-'+key);
  if(panel.dataset.built) return;
  panel.dataset.built = '1';

  if(key === 'overview'){ renderOverview(panel); return; }
  if(key === 'digital'){ renderDigital(panel); return; }
  if(key === 'monetica'){ renderMonetica(panel); return; }

  const idx = Number(key.slice(1));
  const s = STATE.domainSheets[idx];

  if(s.type === 'anagrafe') renderAnagrafe(panel, s);
  else if(s.type === 'antifrode') renderAntifrode(panel, s);
  else if(s.type === 'credito') renderCredito(panel, s);
  else if(s.type === 'ops_aml') renderOpsAml(panel, s);
  else if(s.type === 'perfezionamenti') renderPerfezionamenti(panel, s);
  else if(s.type === 'bancassurance') renderBancassurance(panel, s);
  else renderGeneric(panel, s);
}

document.addEventListener('DOMContentLoaded', setupFileHandling);

/* ============================================================
   PANEL: OVERVIEW / DIMENSIONAMENTO
   ============================================================ */
function renderOverview(panel){
  const rows = STATE.dimRows;
  if(!rows.length){ panel.innerHTML = '<div class="no-data">Nessun dato di dimensionamento nel primo foglio.</div>'; return; }

  const totHC = rows.reduce((a,r)=> a + (Number(r.HC)||0), 0);
  const totFteAsIs = rows.reduce((a,r)=> a + (Number(r['FTE AS IS - in forza'])||0), 0);
  const totFteStim = rows.reduce((a,r)=> a + (Number(r['FTE Stimati'])||0), 0);
  const totNS = rows.reduce((a,r)=> a + (Number(r['Need/Surplus'])||0), 0);
  const nDeficit = rows.filter(r=> (Number(r['Need/Surplus'])||0) < -0.5).length;
  const nSurplus = rows.filter(r=> (Number(r['Need/Surplus'])||0) > 0.5).length;

  const uo1Options = [...new Set(rows.map(r=>r.uo1livello_descrizione).filter(Boolean))];

  panel.innerHTML = `
    <div class="panel-head"><h2>Overview</h2><span class="meta">${rows.length} strutture censite</span></div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Headcount totale</div><div class="val">${fmtInt.format(totHC)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">FTE as-is</div><div class="val">${fmtDec.format(totFteAsIs)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">FTE stimati</div><div class="val">${fmtDec.format(totFteStim)}</div></div>
      <div class="kpi" style="--kc:${totNS>=0?PALETTE.warn:PALETTE.danger}"><div class="lbl">Need / Surplus netto</div><div class="val">${totNS>0?'+':''}${fmtDec.format(totNS)}</div>
        <div class="sub">${nDeficit} strutture in deficit · ${nSurplus} in surplus</div></div>
    </div>
    <div class="filters">
      <select id="ovFilterUo1"><option value="">Tutte le direzioni (UO1)</option>${uo1Options.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>
      <input class="textfilter" id="ovSearch" placeholder="Cerca struttura...">
    </div>
    <div id="ovAreaGrid" class="area-grid"></div>
    <p class="hint" style="margin:6px 0 18px">Delta FTE = FTE Need − FTE as-is. Verde: capacità adeguata o in surplus · Ambra: fabbisogno aggiuntivo.</p>
    <h3 style="font-family:var(--font-display);font-size:14px;color:var(--navy-2);margin:4px 0 10px">Vista tabellare dettagliata</h3>
    <div class="table-wrap scroll">
      <table class="dt" id="ovTable"></table>
    </div>
  `;

  function draw(){
    const uo1 = document.getElementById('ovFilterUo1').value;
    const q = document.getElementById('ovSearch').value.toLowerCase();
    let f = rows.filter(r=> (!uo1 || r.uo1livello_descrizione===uo1) && (!q || String(r['UO LAST']||'').toLowerCase().includes(q)));

    // grouped area tables (visual style: banner per area + pill values)
    const areaGrid = document.getElementById('ovAreaGrid');
    const areaOrder = [...new Set(f.map(r=>r.uo1livello_descrizione || '(area non specificata)'))];
    areaGrid.innerHTML = areaOrder.map(area=>{
      const areaRows = f.filter(r=> (r.uo1livello_descrizione || '(area non specificata)') === area);
      return `
      <div class="area-block">
        <table class="area-table">
          <thead>
            <tr class="area-name-row">
              <th>${area}</th>
              <th class="spacer"></th>
              <th class="group-label" colspan="3">Totale struttura</th>
            </tr>
            <tr class="col-label-row">
              <th></th><th></th><th>FTE AS-IS</th><th>FTE NEED</th><th>Delta FTE</th>
            </tr>
          </thead>
          <tbody>
            ${areaRows.map(r=>`
              <tr>
                <td>${r['UO LAST']||''}</td>
                <td class="tdspacer"></td>
                <td class="numcell">${pillFte(r['FTE AS IS - in forza'])}</td>
                <td class="numcell">${pillFte(r['FTE Stimati'])}</td>
                <td class="numcell">${pillDelta(r['Need/Surplus'])}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');

    const table = document.getElementById('ovTable');
    table.innerHTML = `<thead><tr><th>Struttura</th><th>UO1</th><th>UO2</th><th>HC</th><th>HC in forza</th><th>FTE as-is</th><th>FTE Need</th><th>Delta FTE</th></tr></thead>
      <tbody>${f.map(r=>{
        const ns = Number(r['Need/Surplus'])||0;
        return `<tr><td>${r['UO LAST']||''}</td><td>${r.uo1livello_descrizione||''}</td><td>${r.uo2livello_descrizione||''}</td>
          <td>${r.HC??''}</td><td>${r['HC - in forza']??''}</td><td>${r['FTE AS IS - in forza']!=null?fmtDec.format(r['FTE AS IS - in forza']):''}</td>
          <td>${r['FTE Stimati']!=null?fmtDec.format(r['FTE Stimati']):''}</td>
          <td><span class="badge ${ns<0?'neg':'pos'}">${ns>0?'+':''}${fmtDec.format(ns)}</span></td></tr>`;
      }).join('')}</tbody>`;
  }
  document.getElementById('ovFilterUo1').onchange = draw;
  document.getElementById('ovSearch').oninput = draw;
  draw();
}

/* ============================================================
   Shared: struttura header card for domain panels
   ============================================================ */
function structHeaderHtml(s, panelTitle){
  const r = s.dimRow;
  const head = `<div class="panel-head"><h2>${panelTitle}</h2><span class="meta">ID ${s.sheetName}</span></div>`;
  if(!r){
    return head + `<div class="hint" style="margin-bottom:18px">Dimensionamento non trovato per ID ${s.sheetName}.</div>`;
  }
  return head + `
    <table class="area-table" style="max-width:720px;margin-bottom:22px">
      <thead>
        <tr class="area-name-row">
          <th>${r['UO LAST']||s.sheetName}</th>
          <th class="spacer"></th>
          <th class="group-label" colspan="4">Dimensionamento struttura</th>
        </tr>
        <tr class="col-label-row">
          <th></th><th></th><th>HC</th><th>FTE AS-IS</th><th>FTE NEED</th><th>Delta FTE</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${r.uo1livello_descrizione||''}</td>
          <td class="tdspacer"></td>
          <td class="numcell"><span class="pill">${r.HC ?? '—'}</span></td>
          <td class="numcell">${pillFte(r['FTE AS IS - in forza'])}</td>
          <td class="numcell">${pillFte(r['FTE Stimati'])}</td>
          <td class="numcell">${pillDelta(r['Need/Surplus'])}</td>
        </tr>
      </tbody>
    </table>`;
}

/* ============================================================
   PANEL: ANAGRAFE
   ============================================================ */
function renderAnagrafe(panel, s){
  const ALLOWED_BU = ['', '-', 'smes'];
  const isAllowedBU = (v)=>{
    const t = (v===null||v===undefined) ? '' : String(v).trim().toLowerCase();
    return ALLOWED_BU.includes(t);
  };
  const rows = s.rows.filter(r=> isAllowedBU(r.des_business_unit));
  const excludedCount = s.rows.length - rows.length;
  const dates = rows.map(r=> toDate(r.dta_censimento)).filter(Boolean);
  const naturaCounts = topN(mapToSorted(countBy(rows, 'des_natura_giuridica')), 12);
  const statusCounts = mapToSorted(countBy(rows, 'des_status_generic'));

  const byMonth = new Map();
  dates.forEach(d=>{ const k = monthKey(d); byMonth.set(k, (byMonth.get(k)||0)+1); });
  const months = [...byMonth.keys()].sort();

  const minD = dates.length ? new Date(Math.min(...dates)) : null;
  const maxD = dates.length ? new Date(Math.max(...dates)) : null;
  const nDeceduti = rows.filter(r=> toDate(r.dta_decesso)).length;

  panel.innerHTML = structHeaderHtml(s, 'Anagrafe clienti') + `
    <p class="panel-sub">Vista filtrata: Business Unit vuota, "-" o "SMEs" &middot; ${fmtInt.format(excludedCount)} nominativi esclusi sulle altre BU (${fmtInt.format(s.rows.length)} totali nel foglio)</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Nominativi censiti</div><div class="val">${fmtInt.format(rows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">Nature giuridiche distinte</div><div class="val">${new Set(rows.map(r=>r.des_natura_giuridica)).size}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Periodo censimento</div><div class="val" style="font-size:15px">${fmtDate(minD)} → ${fmtDate(maxD)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Deceduti registrati</div><div class="val">${fmtInt.format(nDeceduti)}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Trend censimenti nel tempo</h3><p class="card-sub">conteggio mensile per data censimento</p><canvas id="anTrendChart"></canvas>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Natura giuridica (top 12)</h3><p class="card-sub">forma societaria dei nominativi censiti</p><canvas id="anNaturaChart"></canvas></div>
      <div class="card"><h3>Stato cliente</h3><p class="card-sub">${statusCounts.length? 'des_status_generic' : 'dato non disponibile'}</p><canvas id="anStatusChart"></canvas></div>
    </div>
  `;

  mkChart('anTrendChart', {type:'line', data:{labels:months, datasets:[{label:'Censimenti', data:months.map(m=>byMonth.get(m)), borderColor:PALETTE.accent, backgroundColor:'rgba(47,111,179,0.12)', fill:true, tension:.3}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('anNaturaChart', {type:'bar', data:{labels:naturaCounts.map(x=>x[0]), datasets:[{label:'Nominativi', data:naturaCounts.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('anStatusChart', {type:'pie', data:{labels:statusCounts.map(x=>x[0]), datasets:[{data:statusCounts.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
}

/* ============================================================
   PANEL: ANTIFRODE
   ============================================================ */
function renderAntifrode(panel, s){
  const rows = s.rows;
  const countKey = rows[0].hasOwnProperty('conteggio') ? 'conteggio' : Object.keys(rows[0]).find(k=> typeof rows[0][k] === 'number');
  const total = rows.reduce((a,r)=> a + (Number(r[countKey])||0), 0);

  const byClass = sumBy(rows, 'classificazione', countKey);
  const byCluster = sumBy(rows, 'cluster_frode', countKey);
  const confermate = byClass.get('FRODE CONFERMATA') || 0;
  const tassoConferma = total ? (confermate/total*100) : 0;

  const byMonthClass = new Map(); // month -> classificazione -> sum
  rows.forEach(r=>{
    const d = toDate(r.mese);
    const k = d ? monthKey(d) : String(r.mese);
    const cl = r.classificazione || '(n.d.)';
    if(!byMonthClass.has(k)) byMonthClass.set(k, new Map());
    const mm = byMonthClass.get(k);
    mm.set(cl, (mm.get(cl)||0) + (Number(r[countKey])||0));
  });
  const months = [...byMonthClass.keys()].sort();
  const classifications = [...new Set(rows.map(r=>r.classificazione).filter(Boolean))];

  const clusterSorted = mapToSorted(byCluster);
  const classSorted = mapToSorted(byClass);

  panel.innerHTML = structHeaderHtml(s, 'Antifrode') + `
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Segnalazioni totali</div><div class="val">${fmtInt.format(total)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Frodi confermate</div><div class="val">${fmtInt.format(confermate)}</div><div class="sub">${fmtDec.format(tassoConferma)}% del totale</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Falsi positivi</div><div class="val">${fmtInt.format(byClass.get('FALSO POSITIVO FRODE')||0)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">Cluster di frode monitorati</div><div class="val">${clusterSorted.length}</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Andamento mensile per classificazione</h3><p class="card-sub">frodi confermate / falsi positivi / non classificabili</p><canvas id="afTrendChart"></canvas></div>
      <div class="card"><h3>Distribuzione per classificazione</h3><canvas id="afClassChart"></canvas></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card" style="grid-column:1/-1"><h3>Volumi per cluster di frode</h3><p class="card-sub">tipologia di frode rilevata</p><canvas id="afClusterChart"></canvas></div>
    </div>
  `;

  const classColors = {'FRODE CONFERMATA':PALETTE.danger, 'FALSO POSITIVO FRODE':PALETTE.warn, 'NON CLASSIFICABILE':PALETTE.info};
  mkChart('afTrendChart', {type:'bar', data:{labels:months, datasets: classifications.map((c,i)=>({
      label:c, data: months.map(m=> byMonthClass.get(m).get(c)||0),
      backgroundColor: classColors[c] || CHART_SERIES[i%CHART_SERIES.length]
    }))},
    options:{plugins:{legend:{position:'bottom', labels:{boxWidth:10,font:{size:10.5}}}}, scales:{x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{color:PALETTE.grid}}}}});

  mkChart('afClassChart', {type:'doughnut', data:{labels:classSorted.map(x=>x[0]), datasets:[{data:classSorted.map(x=>x[1]), backgroundColor: classSorted.map(x=> classColors[x[0]] || PALETTE.info)}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('afClusterChart', {type:'bar', data:{labels:clusterSorted.map(x=>x[0]), datasets:[{label:'Conteggio', data:clusterSorted.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});
}

/* ============================================================
   PANEL: CREDITO ORDINARIO & FACTORING
   ============================================================ */
function renderCredito(panel, s){
  const ALLOWED_TIPO_ISTRUTTORIA = [
    "Relationship Bank Business",
    "Rinegoziazioni - Consolidamenti - Rifinanziamenti BUSINESS",
    "Relationship Bank",
    "Relationship Bank Individuals",
    "Rinegoziazioni - Consolidamenti - Rifinanziamenti INDIVIDUALS",
    "Pratica Tecnica e Revoca Affidamenti",
    "RINEGOZIAZIONI - CONSOLIDAMENTI - RIFINANZIAMENTI",
    "Small Business"
  ];
  const rows = s.rows.filter(r=> ALLOWED_TIPO_ISTRUTTORIA.includes(r.des_tipo_istruttoria));
  const excludedCount = s.rows.length - rows.length;
  const total = rows.length;

  const isCompleted = (r)=> String(r.des_stato_istruttoria||'').toLowerCase().includes('complet');
  const completedRows = rows.filter(isCompleted);
  const inLavRows = rows.filter(r=> !isCompleted(r));

  const giorni = rows.map(r=> Number(r.nro_giorni_lavorazione)).filter(v=> !isNaN(v));
  const avgGiorni = giorni.length ? giorni.reduce((a,b)=>a+b,0)/giorni.length : 0;

  const byOrgano = mapToSorted(countBy(rows, 'des_organo_delib'));
  const byScopo = topN(mapToSorted(countBy(rows, 'des_scopo_pratica')), 12);
  const avgGiorniByOrgano = avgBy(rows, 'des_organo_delib', 'nro_giorni_lavorazione');

  const buckets = [[0,5],[6,10],[11,20],[21,30],[31,Infinity]];
  const bucketLabels = ['0-5 gg','6-10 gg','11-20 gg','21-30 gg','>30 gg'];
  const bucketCounts = buckets.map(([lo,hi])=> giorni.filter(g=> g>=lo && g<=hi).length);

  // ---- pratiche in lavorazione ----
  const giorniInLav = inLavRows.map(r=> Number(r.nro_giorni_lavorazione)).filter(v=> !isNaN(v));
  const avgGiorniInLav = giorniInLav.length ? giorniInLav.reduce((a,b)=>a+b,0)/giorniInLav.length : 0;
  const giorniCoda = inLavRows.map(r=> Number(r.nro_giorni_coda)).filter(v=> !isNaN(v));
  const avgGiorniCoda = giorniCoda.length ? giorniCoda.reduce((a,b)=>a+b,0)/giorniCoda.length : 0;
  const byStatoInLav = mapToSorted(countBy(inLavRows, 'des_stato_istruttoria'));

  const opKey = 'des_ndg_operatore_lavorazione';
  const opGroups = new Map();
  inLavRows.forEach(r=>{
    const op = r[opKey] || '(non assegnato)';
    if(!opGroups.has(op)) opGroups.set(op, []);
    opGroups.get(op).push(r);
  });
  const opStats = [...opGroups.entries()].map(([op, list])=>{
    const gg = list.map(r=>Number(r.nro_giorni_lavorazione)).filter(v=>!isNaN(v));
    const avgGg = gg.length ? gg.reduce((a,b)=>a+b,0)/gg.length : 0;
    return {op, count:list.length, avgGg};
  }).sort((a,b)=> b.count - a.count).slice(0,15);

  // ---- pratiche completate ----
  const byTipoDeliberaCompleted = mapToSorted(countBy(completedRows, 'des_tipo_delibera'));
  const positiva = byTipoDeliberaCompleted.find(x=>String(x[0]).toLowerCase().includes('positiv'))?.[1] || 0;
  const negativa = byTipoDeliberaCompleted.find(x=>String(x[0]).toLowerCase().includes('negativ'))?.[1] || 0;
  const pctPositiva = completedRows.length ? positiva/completedRows.length*100 : 0;
  const giorniCompleted = completedRows.map(r=> Number(r.nro_giorni_lavorazione)).filter(v=> !isNaN(v));
  const avgGiorniCompleted = giorniCompleted.length ? giorniCompleted.reduce((a,b)=>a+b,0)/giorniCompleted.length : 0;

  const monthKeyOf = (r)=>{
    const d = toDate(r.dta_delibera) || toDate(r.dta_istruttoria);
    return d ? monthKey(d) : null;
  };
  const byMonthDelibera = new Map(); // month -> {pos, neg, altro}
  completedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    const tipo = String(r.des_tipo_delibera||'').toLowerCase();
    if(!byMonthDelibera.has(k)) byMonthDelibera.set(k, {pos:0, neg:0, altro:0});
    const m = byMonthDelibera.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const deliberaMonths = [...byMonthDelibera.keys()].sort();

  panel.innerHTML = structHeaderHtml(s, 'Credito Ordinario & Factoring') + `
    <p class="panel-sub">Vista filtrata: 8 tipologie di istruttoria selezionate &middot; ${fmtInt.format(excludedCount)} pratiche escluse (${fmtInt.format(s.rows.length)} totali nel foglio)</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Pratiche totali</div><div class="val">${fmtInt.format(total)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">In lavorazione</div><div class="val">${fmtInt.format(inLavRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Completate</div><div class="val">${fmtInt.format(completedRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorni)} gg</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Pratiche per organo deliberante</h3><canvas id="crOrganoChart"></canvas></div>
      <div class="card"><h3>Tempo medio lavorazione per organo</h3><p class="card-sub">giorni, nro_giorni_lavorazione</p><canvas id="crOrganoTempoChart"></canvas></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Scopo pratica (top 12)</h3><canvas id="crScopoChart"></canvas></div>
      <div class="card"><h3>Distribuzione tempi di lavorazione</h3><p class="card-sub">fasce giorni lavorazione, tutte le pratiche</p><canvas id="crTempiChart"></canvas></div>
    </div>

    <div class="section-title">Pratiche in lavorazione <span class="count-badge">${fmtInt.format(inLavRows.length)} pratiche</span></div>
    <p class="section-desc">Pratiche non ancora completate (stato istruttoria diverso da "Completa").</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Pratiche in lavorazione</div><div class="val">${fmtInt.format(inLavRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorniInLav)} gg</div></div>
      <div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">Tempo medio in coda</div><div class="val">${fmtDec.format(avgGiorniCoda)} gg</div></div>
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Operatori coinvolti</div><div class="val">${opStats.length}</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Stato istruttoria (in lavorazione)</h3><p class="card-sub">dettaglio stati non completati</p><canvas id="crStatoInLavChart"></canvas></div>
      <div class="card">
        <h3>Pratiche per operatore di lavorazione</h3><p class="card-sub">top 15 per numero di pratiche in carico</p>
        <div class="table-wrap" style="border:none">
          <table class="op-table">
            <thead><tr><th>Operatore</th><th style="text-align:right">Pratiche</th><th style="text-align:right">Giorni medi</th></tr></thead>
            <tbody>${opStats.map(o=>`<tr><td>${o.op}</td><td class="num">${fmtInt.format(o.count)}</td><td class="num">${fmtDec.format(o.avgGg)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="section-title">Pratiche completate <span class="count-badge">${fmtInt.format(completedRows.length)} pratiche</span></div>
    <p class="section-desc">Il tipo delibera (positiva/negativa) è significativo solo per le pratiche con stato istruttoria "Completa".</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Completate</div><div class="val">${fmtInt.format(completedRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.pos||'#1c8a45'}"><div class="lbl">Delibere positive</div><div class="val">${fmtInt.format(positiva)}</div><div class="sub">${fmtDec.format(pctPositiva)}% delle completate</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Delibere negative</div><div class="val">${fmtInt.format(negativa)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorniCompleted)} gg</div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Completate per mese: positive vs negative</h3><p class="card-sub">conteggio mensile su data delibera, solo pratiche completate</p>
      <canvas id="crDeliberaTrendChart"></canvas>
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Tipo delibera</h3><p class="card-sub">solo pratiche completate</p><canvas id="crTipoChart"></canvas></div>
    </div>
  `;

  mkChart('crOrganoChart', {type:'bar', data:{labels:byOrgano.map(x=>x[0]), datasets:[{label:'Pratiche', data:byOrgano.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});

  const organoTempoSorted = mapToSorted(avgGiorniByOrgano);
  mkChart('crOrganoTempoChart', {type:'bar', data:{labels:organoTempoSorted.map(x=>x[0]), datasets:[{label:'Giorni medi', data:organoTempoSorted.map(x=>Number(x[1].toFixed(1))), backgroundColor:PALETTE.violet}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});

  mkChart('crScopoChart', {type:'bar', data:{labels:byScopo.map(x=>x[0]), datasets:[{label:'Pratiche', data:byScopo.map(x=>x[1]), backgroundColor:PALETTE.accent}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('crTempiChart', {type:'bar', data:{labels:bucketLabels, datasets:[{label:'Pratiche', data:bucketCounts, backgroundColor: bucketLabels.map((_,i)=> CHART_SERIES[i])}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('crStatoInLavChart', {type:'pie', data:{labels:byStatoInLav.map(x=>x[0]), datasets:[{data:byStatoInLav.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('crDeliberaTrendChart', {type:'bar', data:{labels:deliberaMonths, datasets:[
      {label:'Positive', data:deliberaMonths.map(m=>byMonthDelibera.get(m).pos), backgroundColor:'#1c8a45'},
      {label:'Negative', data:deliberaMonths.map(m=>byMonthDelibera.get(m).neg), backgroundColor:PALETTE.danger},
      {label:'Altro', data:deliberaMonths.map(m=>byMonthDelibera.get(m).altro), backgroundColor:PALETTE.text}
    ]},
    options:{plugins:{legend:{position:'bottom', labels:{boxWidth:10,font:{size:10.5}}}}, scales:{x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{color:PALETTE.grid}}}}});

  mkChart('crTipoChart', {type:'doughnut', data:{labels:byTipoDeliberaCompleted.map(x=>x[0]), datasets:[{data:byTipoDeliberaCompleted.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
}

/* ============================================================
   PANEL: OPS AML
   ============================================================ */
function renderOpsAml(panel, s){
  const rows = s.rows;
  const isAlto = (r)=> String(r.fascia_rischio||'').toLowerCase().includes('alt'); // copre "Alto"/"Alta"
  const altoRows = rows.filter(isAlto);
  const isDone = (r)=> !!toDate(r.data_uscita);
  const completedAlto = altoRows.filter(isDone);
  const pendingAlto = altoRows.filter(r=> !isDone(r));

  // tutti i conteggi sono su NDG distinti (un cliente può avere più righe/cicli di verifica)
  const totalNdg = distinctCount(rows);
  const altoNdg = distinctCount(altoRows);
  const completedAltoNdg = distinctCount(completedAlto);
  const pendingAltoNdg = distinctCount(pendingAlto);

  const byFascia = mapToSorted(countDistinctBy(rows, 'fascia_rischio'));

  // tempo medio di lavorazione (data_uscita - data_inserimento) per le completate a rischio alto
  const giorniAlto = completedAlto.map(r=>{
    const din = toDate(r.data_inserimento);
    const dout = toDate(r.data_uscita);
    if(!din || !dout) return null;
    return Math.round((dout - din) / 86400000);
  }).filter(v=> v!==null && v>=0);
  const avgGiorniAlto = giorniAlto.length ? giorniAlto.reduce((a,b)=>a+b,0)/giorniAlto.length : 0;

  // scadute: rischio alto, ancora in lavorazione, con data_scadenza_adv nel passato (conteggio NDG distinti)
  const today = new Date();
  const scaduteRows = pendingAlto.filter(r=>{ const d = toDate(r.data_scadenza_adv); return d && d < today; });
  const scaduteNdg = distinctCount(scaduteRows);

  // trend mensile completate a rischio alto (per data_uscita, NDG distinti per mese)
  const byMonthSet = new Map();
  completedAlto.forEach(r=>{
    const d = toDate(r.data_uscita);
    const k = monthKey(d);
    if(!byMonthSet.has(k)) byMonthSet.set(k, new Set());
    byMonthSet.get(k).add(r.ndg);
  });
  const months = [...byMonthSet.keys()].sort();

  const byBU = topN(mapToSorted(countDistinctBy(altoRows, 'business_unit')), 12);
  const byCluster = topN(mapToSorted(countDistinctBy(altoRows, 'cluster')), 12);
  const byWorkflow = mapToSorted(countDistinctBy(altoRows, 'workflow'));
  const byTipoVerifica = mapToSorted(countDistinctBy(altoRows, 'tipo_verifica'));

  const pctAlto = totalNdg ? altoNdg/totalNdg*100 : 0;
  const pctCompletateAlto = altoNdg ? completedAltoNdg/altoNdg*100 : 0;

  panel.innerHTML = structHeaderHtml(s, 'OPS AML') + `
    <p class="panel-sub">Conteggi su NDG distinti (un cliente può comparire più volte per cicli di verifica diversi).</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">NDG totali</div><div class="val">${fmtInt.format(totalNdg)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">NDG rischio alto</div><div class="val">${fmtInt.format(altoNdg)}</div><div class="sub">${fmtDec.format(pctAlto)}% del totale</div></div>
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Verifiche completate (alto)</div><div class="val">${fmtInt.format(completedAltoNdg)}</div><div class="sub">${fmtDec.format(pctCompletateAlto)}% del rischio alto</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">In lavorazione (alto)</div><div class="val">${fmtInt.format(pendingAltoNdg)}</div></div>
    </div>

    <div class="section-title">Adeguate verifiche a rischio alto nel tempo <span class="count-badge">${fmtInt.format(altoNdg)} NDG</span></div>
    <p class="section-desc">Focus sulle posizioni in fascia di rischio alto: avanzamento delle adeguate verifiche completate (data uscita valorizzata) e tempi di lavorazione.</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorniAlto)} gg</div><div class="sub">data uscita − data inserimento</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Scadute e non completate</div><div class="val">${fmtInt.format(scaduteNdg)}</div><div class="sub">data scadenza ADV superata</div></div>
      <div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">Cluster coinvolti</div><div class="val">${byCluster.length}</div></div>
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Business unit coinvolte</div><div class="val">${byBU.length}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Verifiche completate per mese</h3><p class="card-sub">rischio alto, NDG distinti per mese su data uscita</p>
      <canvas id="amlTrendChart"></canvas>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Rischio alto per Business Unit</h3><p class="card-sub">NDG distinti</p><canvas id="amlBuChart"></canvas></div>
      <div class="card"><h3>Rischio alto per cluster</h3><p class="card-sub">NDG distinti</p><canvas id="amlClusterChart"></canvas></div>
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Stato workflow (rischio alto)</h3><p class="card-sub">NDG distinti</p><canvas id="amlWorkflowChart"></canvas></div>
      <div class="card"><h3>Tipo verifica (rischio alto)</h3><p class="card-sub">NDG distinti</p><canvas id="amlTipoChart"></canvas></div>
    </div>
  `;

  mkChart('amlTrendChart', {type:'bar', data:{labels:months, datasets:[{label:'NDG completati', data:months.map(m=>byMonthSet.get(m).size), backgroundColor:PALETTE.danger}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('amlBuChart', {type:'bar', data:{labels:byBU.map(x=>x[0]), datasets:[{label:'NDG', data:byBU.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('amlClusterChart', {type:'bar', data:{labels:byCluster.map(x=>x[0]), datasets:[{label:'NDG', data:byCluster.map(x=>x[1]), backgroundColor:PALETTE.violet}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('amlWorkflowChart', {type:'pie', data:{labels:byWorkflow.map(x=>x[0]), datasets:[{data:byWorkflow.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('amlTipoChart', {type:'doughnut', data:{labels:byTipoVerifica.map(x=>x[0]), datasets:[{data:byTipoVerifica.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
}


/* ============================================================
   PANEL: DIGITAL
   ============================================================ */
const DIGITAL_BANK_ID = '10001100023100042100130';

function renderDigital(panel){

  const rapporti = STATE.domainSheets.find(s=>s.type==='digital_rapporti');
  const frodi = STATE.domainSheets.find(s=>s.type==='digital_frodi');
  const raisin = STATE.domainSheets.find(s=>s.type==='digital_raisin');

  const rapportiRows = rapporti ? rapporti.rows : [];
  const frodiRows = frodi ? frodi.rows : [];
  const raisinRows = raisin ? raisin.rows : [];

  // ============================================================
  // RAPPORTI DIGITAL CON CATEGORIE
  // ============================================================

  const rapportiAperti = rapportiRows.filter(r=>{
    const d = toDate(r.dta_rapporto_apert);
    return d && d.getFullYear()===2026;
  });

  // Estrai categorie uniche
  const categoriSet = new Set(rapportiAperti.map(r=>r.des_categoria_rapporto).filter(Boolean));
  const categoriArray = Array.from(categoriSet).sort();
  const categoriColorMap = Object.fromEntries(
    categoriArray.map((c,i) => [c, CHART_SERIES[i % CHART_SERIES.length]])
  );

  const rapportiChiusi = rapportiRows.filter(r=>{
    const d = toDate(r.dta_rapporto_estinzione);
    return d && d.getFullYear()===2026;
  });

  // trend mensile rapporti aperti/chiusi PER CATEGORIA
  const apertiMonthByCateg = {};
  rapportiAperti.forEach(r=>{
    const d = toDate(r.dta_rapporto_apert);
    const k = monthKey(d);
    const categ = r.des_categoria_rapporto || 'N.D.';
    
    if(!apertiMonthByCateg[k]) apertiMonthByCateg[k] = {};
    apertiMonthByCateg[k][categ] = (apertiMonthByCateg[k][categ] || 0) + 1;
  });

  const chiusiMonth = {};
  rapportiChiusi.forEach(r=>{
    const d = toDate(r.dta_rapporto_estinzione);
    const k = monthKey(d);
    chiusiMonth[k] = (chiusiMonth[k]||0)+1;
  });

  // ============================================================
  // FRODI DIGITAL
  // ============================================================

  const frodi2026 = frodiRows.filter(r=>{
    const d = toDate(r['Campo personalizzato (Data operazione (FR))']);
    return d && d.getFullYear()===2026;
  });

  const frodiMonth = {};
  frodi2026.forEach(r=>{
    const d = toDate(r['Campo personalizzato (Data operazione (FR))']);
    const k = monthKey(d);
    frodiMonth[k] = (frodiMonth[k]||0)+1;
  });

  const byClusterFrode = mapToSorted(
    countBy(
      frodi2026,
      'Campo personalizzato (Cluster Frode Banca)'
    )
  );

  // ============================================================
  // RAISIN
  // ============================================================

  const raisin2026 = raisinRows.filter(r=>{
    const d = toDate(r.data_inserimento);
    return d && d.getFullYear()===2026;
  });

  const raisinMonth = {};
  raisin2026.forEach(r=>{
    const d = toDate(r.data_inserimento);
    const k = monthKey(d);
    raisinMonth[k] = (raisinMonth[k]||0)+1;
  });

  const months = [...new Set([
    ...Object.keys(apertiMonthByCateg),
    ...Object.keys(chiusiMonth),
    ...Object.keys(frodiMonth),
    ...Object.keys(raisinMonth)
  ])].sort();

  const digitalDimRow = findDimRow(DIGITAL_BANK_ID);
  panel.innerHTML = structHeaderHtml({sheetName: DIGITAL_BANK_ID, dimRow: digitalDimRow}, 'Digital Bank') + `
    <p class="panel-sub">Monitoraggio KPI Digital Bank su dati 2026.</p>

    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Rapporti aperti 2026</div>
        <div class="val">${fmtInt.format(rapportiAperti.length)}</div>
      </div>

      <div class="kpi" style="--kc:${PALETTE.warn}">
        <div class="lbl">Rapporti chiusi 2026</div>
        <div class="val">${fmtInt.format(rapportiChiusi.length)}</div>
      </div>

      <div class="kpi" style="--kc:${PALETTE.danger}">
        <div class="lbl">Frodi segnalate 2026</div>
        <div class="val">${fmtInt.format(frodi2026.length)}</div>
      </div>

      <div class="kpi" style="--kc:${PALETTE.accent}">
        <div class="lbl">Bonifici Raisin controllati 2026</div>
        <div class="val">${fmtInt.format(raisin2026.length)}</div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card">
        <h3>Rapporti aperti per mese</h3>
        <p class="card-sub">Nuovi rapporti Digital Bank - 2026</p>
        <canvas id="digitalApertiChart"></canvas>
      </div>

      <div class="card">
        <h3>Rapporti chiusi per mese</h3>
        <p class="card-sub">Rapporti estinti - 2026</p>
        <canvas id="digitalChiusiChart"></canvas>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Frodi segnalate per mese</h3>
        <p class="card-sub">Data operazione frode - 2026</p>
        <canvas id="digitalFrodiChart"></canvas>
      </div>

      <div class="card">
        <h3>Cluster frode</h3>
        <p class="card-sub">Distribuzione segnalazioni 2026</p>
        <canvas id="digitalClusterChart"></canvas>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Bonifici Raisin controllati per mese</h3>
      <p class="card-sub">Numero bonifici analizzati - 2026</p>
      <canvas id="digitalRaisinChart"></canvas>
    </div>
  `;

  // ============================================================
  // CHART: RAPPORTI APERTI STACKED PER CATEGORIA
  // ============================================================

  const datasetsAperti = categoriArray.map(categ => ({
    label: categ,
    data: months.map(m => apertiMonthByCateg[m]?.[categ] || 0),
    backgroundColor: categoriColorMap[categ],
    borderColor: categoriColorMap[categ],
    borderWidth: 0
  }));

  mkChart('digitalApertiChart',{
    type:'bar',
    data:{
      labels:months,
      datasets: datasetsAperti
    },
    options:{
      scales:{
        x:{stacked:true},
        y:{stacked:true}
      }
    }
  });

  mkChart('digitalChiusiChart',{
    type:'bar',
    data:{
      labels:months,
      datasets:[{
        label:'Rapporti chiusi',
        data:months.map(m=>chiusiMonth[m]||0),
        backgroundColor:PALETTE.warn
      }]
    }
  });

  mkChart('digitalFrodiChart',{
    type:'line',
    data:{
      labels:months,
      datasets:[{
        label:'Frodi',
        data:months.map(m=>frodiMonth[m]||0),
        borderColor:PALETTE.danger
      }]
    }
  });

  mkChart('digitalClusterChart',{
    type:'doughnut',
    data:{
      labels:byClusterFrode.map(x=>x[0]),
      datasets:[{
        data:byClusterFrode.map(x=>x[1]),
        backgroundColor:CHART_SERIES
      }]
    }
  });

  mkChart('digitalRaisinChart',{
    type:'bar',
    data:{
      labels:months,
      datasets:[{
        label:'Bonifici Raisin',
        data:months.map(m=>raisinMonth[m]||0),
        backgroundColor:PALETTE.accent
      }]
    }
  });
}

/* ============================================================
   PANEL: CREDITO ORDINARIO & FACTORING
   ============================================================ */
function renderPerfezionamenti(panel, s){
  
  const rows = s.rows;

  // ============================================================
  // PERFEZIONAMENTI 2026
  // ============================================================

  const perfezionati2026 = rows.filter(r => {
    const d = toDate(r.dta_operativa);
    return d && d.getFullYear() === 2026;
  });

  // Estrai business unit uniche
  const buSet = new Set(perfezionati2026.map(r => r.des_business_unit).filter(Boolean));
  const buArray = Array.from(buSet).sort();
  const buColorMap = Object.fromEntries(
    buArray.map((bu, i) => [bu, CHART_SERIES[i % CHART_SERIES.length]])
  );

  // Trend mensile per BU
  const perfByMonthBU = {};
  perfezionati2026.forEach(r => {
    const d = toDate(r.dta_operativa);
    const k = monthKey(d);
    const bu = r.des_business_unit || 'N.D.';
    
    if (!perfByMonthBU[k]) perfByMonthBU[k] = {};
    perfByMonthBU[k][bu] = (perfByMonthBU[k][bu] || 0) + 1;
  });

  // ============================================================
  // GIORNI MEDI DELIBERA → OPERATIVA
  // ============================================================

  const giorniDelibOp = perfezionati2026.map(r => {
    const dDelibera = toDate(r.dta_delibera);
    const dOperativa = toDate(r.dta_operativa);
    
    if (!dDelibera || !dOperativa) return null;
    
    const diffMs = dOperativa.getTime() - dDelibera.getTime();
    const diffGg = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return {mese: monthKey(dOperativa), giorni: diffGg};
  }).filter(v => v !== null && v.giorni >= 0);

  const giorniByMonth = {};
  giorniDelibOp.forEach(item => {
    if (!giorniByMonth[item.mese]) giorniByMonth[item.mese] = [];
    giorniByMonth[item.mese].push(item.giorni);
  });

  const avgGiorniByMonth = {};
  Object.keys(giorniByMonth).forEach(k => {
    const vals = giorniByMonth[k];
    avgGiorniByMonth[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  // Union di tutti i mesi
  const months = [...new Set([
    ...Object.keys(perfByMonthBU),
    ...Object.keys(giorniByMonth)
  ])].sort();

  // ============================================================
  // AGGREGAZIONI
  // ============================================================

  const byBU = mapToSorted(countBy(perfezionati2026, 'des_business_unit'));
  const avgGiorniOverall = giorniDelibOp.length ? giorniDelibOp.reduce((a, b) => a + b.giorni, 0) / giorniDelibOp.length : 0;

  const dimRow = findDimRow(s.sheetName);
  
  panel.innerHTML = structHeaderHtml(s, 'Perfezionamenti 2026') + `
    <p class="panel-sub">Pratiche completate perfezionate nel 2026 (dta_operativa)</p>
    
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Pratiche perfezionate 2026</div>
        <div class="val">${fmtInt.format(perfezionati2026.length)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.accent}">
        <div class="lbl">Business unit</div>
        <div class="val">${fmtInt.format(buArray.length)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.violet}">
        <div class="lbl">Tempo medio lavorazione</div>
        <div class="val">${fmtDec.format(avgGiorniOverall)} gg</div>
        <div class="sub">delibera → operativa</div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Perfezionamenti per mese e business unit</h3>
        <p class="card-sub">dta_operativa 2026, suddiviso per des_business_unit</p>
        <canvas id="crPerfezionatiChart"></canvas>
      </div>

      <div class="card">
        <h3>Giorni medi delibera → operativa</h3>
        <p class="card-sub">per mese, 2026</p>
        <canvas id="crGiorniDelibOpChart"></canvas>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Perfezionamenti per business unit</h3>
      <p class="card-sub">Pratiche 2026</p>
      <canvas id="crBuChart"></canvas>
    </div>
  `;

  // ============================================================
  // CHART: PERFEZIONAMENTI STACKED PER BU
  // ============================================================

  const datasetsPerfezionati = buArray.map(bu => ({
    label: bu,
    data: months.map(m => perfByMonthBU[m]?.[bu] || 0),
    backgroundColor: buColorMap[bu],
    borderColor: buColorMap[bu],
    borderWidth: 0
  }));

  mkChart('crPerfezionatiChart', {
    type: 'bar',
    data: {
      labels: months,
      datasets: datasetsPerfezionati
    },
    options: {
      scales: {
        x: {stacked: true, grid: {display: false}},
        y: {stacked: true, grid: {color: PALETTE.grid}}
      },
      plugins: {
        legend: {position: 'bottom', labels: {boxWidth: 10, font: {size: 10.5}}}
      }
    }
  });

  // ============================================================
  // CHART: GIORNI MEDI
  // ============================================================

  mkChart('crGiorniDelibOpChart', {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Giorni medi',
        data: months.map(m => {
          const val = avgGiorniByMonth[m];
          return val ? Number(val.toFixed(1)) : 0;
        }),
        borderColor: PALETTE.violet,
        backgroundColor: 'rgba(184,159,132,0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: PALETTE.violet
      }]
    },
    options: {
      plugins: {
        legend: {display: false}
      },
      scales: {
        x: {grid: {display: false}},
        y: {grid: {color: PALETTE.grid}}
      }
    }
  });

  // ============================================================
  // CHART: BUSINESS UNIT
  // ============================================================

  mkChart('crBuChart', {
    type: 'bar',
    data: {
      labels: byBU.map(x => x[0]),
      datasets: [{
        label: 'Pratiche',
        data: byBU.map(x => x[1]),
        backgroundColor: PALETTE.info
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: {display: false}
      },
      scales: {
        x: {grid: {color: PALETTE.grid}},
        y: {grid: {display: false}, ticks: {font: {size: 10}}}
      }
    }
  });
}

/* ============================================================ PANEL: BANCASSURANCE ============================================================ */
function renderBancassurance(panel, s){
  const rows = s.rows;
  const bancassurance = rows.filter(r => r && r.data_ordine);
  const statiSet = new Set(bancassurance.map(r => r.descrizione_stato).filter(Boolean));
  const statiArray = Array.from(statiSet).sort();
  const statoColorMap = Object.fromEntries(statiArray.map((stato, i) => [stato, CHART_SERIES[i % CHART_SERIES.length]]));
  const ordiniByMonthStato = {};
  bancassurance.forEach(r => { const d = toDate(r.data_ordine); const k = monthKey(d); const stato = r.descrizione_stato || 'N.D.'; if (!ordiniByMonthStato[k]) ordiniByMonthStato[k] = {}; ordiniByMonthStato[k][stato] = (ordiniByMonthStato[k][stato] || 0) + 1; });
  const volumeByMonth = {};
  bancassurance.forEach(r => { const d = toDate(r.data_ordine); const k = monthKey(d); volumeByMonth[k] = (volumeByMonth[k] || 0) + (parseFloat(r.tot_generale_euro) || 0); });
  const months = [...new Set([...Object.keys(ordiniByMonthStato), ...Object.keys(volumeByMonth)])].sort();
  const byStato = Object.entries(bancassurance.reduce((acc, r) => { const stato = r.descrizione_stato || 'N.D.'; acc[stato] = (acc[stato] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const volumeTotal = Object.values(volumeByMonth).reduce((a, b) => a + b, 0);
  const volumeAvg = months.length ? volumeTotal / months.length : 0;
  
  panel.innerHTML = structHeaderHtml(s, 'Bancassurance') + `<p class="panel-sub">Ordini Bancassurance con data_ordine</p><div class="kpi-row"><div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Ordini totali</div><div class="val">${fmtInt.format(bancassurance.length)}</div></div><div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Volume totale</div><div class="val">€ ${fmtInt.format(volumeTotal)}</div></div><div class="kpi" style="--kc:${PALETTE.violet}"><div class="lbl">Volume medio mensile</div><div class="val">€ ${fmtInt.format(volumeAvg)}</div></div></div><div class="grid cols-2"><div class="card"><h3>Ordini mensili per stato</h3><p class="card-sub">data_ordine, suddiviso per descrizione_stato</p><canvas id="baOrdiniChart"></canvas></div><div class="card"><h3>Volume mensile</h3><p class="card-sub">tot_generale_euro per mese</p><canvas id="baVolumeChart"></canvas></div></div>`;

  mkChart('baOrdiniChart', { type: 'bar', data: { labels: months, datasets: statiArray.map(stato => ({ label: stato, data: months.map(m => ordiniByMonthStato[m]?.[stato] || 0), backgroundColor: statoColorMap[stato], borderColor: statoColorMap[stato], borderWidth: 0 })) }, options: { scales: { x: {stacked: true, grid: {display: false}}, y: {stacked: true, grid: {color: PALETTE.grid}} }, plugins: { legend: {position: 'bottom', labels: {boxWidth: 10, font: {size: 10.5}}} } } });

  mkChart('baVolumeChart', { type: 'bar', data: { labels: months, datasets: [{ label: 'Volume (€)', data: months.map(m => volumeByMonth[m] || 0), backgroundColor: PALETTE.pos, borderColor: PALETTE.pos, borderWidth: 0 }] }, options: { scales: { x: {grid: {display: false}}, y: {grid: {color: PALETTE.grid}} }, plugins: { legend: {display: false} } } });
}

/* ============================================================
   PANEL: MONETICA
   ============================================================ */
const MONETICA_ID = '10001100023100036';

function renderMonetica(panel){
  const bonifici = STATE.domainSheets.find(s=>s.type==='monetica_bonifici');
  const cassa = STATE.domainSheets.find(s=>s.type==='monetica_cassa');
  const cassette = STATE.domainSheets.find(s=>s.type==='monetica_cassette');

  const bonificiRows = bonifici ? bonifici.rows : [];
  const cassaRows = cassa ? cassa.rows : [];
  const cassetteRows = cassette ? cassette.rows : [];

  /* ============================================================ BONIFICI ============================================================ */
  const bonifici2026 = bonificiRows.filter(r=>{
    const d = toDate(r.data_valuta_fissa_al_beneficiario) || toDate(r.data_regolamento);
    return d && d.getFullYear()===2026;
  });

  const bonificiMonth = {};
  const volumeMonth = {};
  bonifici2026.forEach(r=>{
    const d = toDate(r.data_valuta_fissa_al_beneficiario) || toDate(r.data_regolamento);
    const k = monthKey(d);
    bonificiMonth[k] = (bonificiMonth[k]||0)+1;
    volumeMonth[k] = (volumeMonth[k]||0)+(parseFloat(r.importo_bonifico)||0);
  });

  /* ============================================================ CASSA ============================================================ */
  const cambiali76 = r => String(r.tg04_causale1||'').includes('76');
  const operTesoreria = r => ['00','4M','5C','5R'].some(c => String(r.tg04_causale1||'').includes(c));
  const assCircolari = r => String(r.tg04_causale1||'').includes('11');

  const cassa2026 = cassaRows.filter(r=>{
    const d = toDate(r.d_data_cont);
    return d && d.getFullYear()===2026;
  });

  const totCambiali = cassa2026.filter(cambiali76).length;
  const totTesoreria = cassa2026.filter(operTesoreria).length;
  const totCircolari = cassa2026.filter(assCircolari).length;

  // Grafico numero operazioni per mese e tipo
  const cassaMonthByType = {};
  cassa2026.forEach(r=>{
    const d = toDate(r.d_data_cont);
    const k = monthKey(d);
    if(!cassaMonthByType[k]) cassaMonthByType[k] = {cambiali:0, tesoreria:0, circolari:0};
    
    if(cambiali76(r)) cassaMonthByType[k].cambiali++;
    else if(operTesoreria(r)) cassaMonthByType[k].tesoreria++;      // ✅ else if!
    else if(assCircolari(r)) cassaMonthByType[k].circolari++;       // ✅ else if!
  });

  // Grafico importi per mese e tipo
  const cassaVolMonthByType = {};
  cassa2026.forEach(r=>{
    const d = toDate(r.d_data_cont);
    const k = monthKey(d);
    const importo = Math.abs(parseFloat(r.e_importo1)||0);
    if(!cassaVolMonthByType[k]) cassaVolMonthByType[k] = {cambiali:0, tesoreria:0, circolari:0};
    
    if(cambiali76(r)) cassaVolMonthByType[k].cambiali += importo;
    else if(operTesoreria(r)) cassaVolMonthByType[k].tesoreria += importo;    // ✅ else if!
    else if(assCircolari(r)) cassaVolMonthByType[k].circolari += importo;     // ✅ else if!
  });

  // Operazioni per filiale e tipo
  const operByFilialeType = {};
  cassa2026.forEach(r=>{
    const fil = r.descrizione_filiale || 'N.D.';
    if(!operByFilialeType[fil]) operByFilialeType[fil] = {cambiali:0, tesoreria:0, circolari:0};
    
    if(cambiali76(r)) operByFilialeType[fil].cambiali++;
    else if(operTesoreria(r)) operByFilialeType[fil].tesoreria++;    // ✅ else if!
    else if(assCircolari(r)) operByFilialeType[fil].circolari++;     // ✅ else if!
  });

  // Preparazione dati per il grafico filiale (non stacked)
  const filialeDatasets = [
    {label:'Cambiali', data:filialArray.map(f=>operByFilialeType[f]?.cambiali||0), backgroundColor:PALETTE.info},
    {label:'Tesoreria', data:filialArray.map(f=>operByFilialeType[f]?.tesoreria||0), backgroundColor:PALETTE.warn},
    {label:'Circolari', data:filialArray.map(f=>operByFilialeType[f]?.circolari||0), backgroundColor:PALETTE.violet}
  ];

  /* ============================================================ CASSETTE ============================================================ */
  const cassette2026 = cassetteRows.filter(r=>{
    const d = toDate(r.dta_rapporto_apert);
    return d && d.getFullYear()===2026;
  });

  const cassetteMonth = {};
  cassette2026.forEach(r=>{
    const d = toDate(r.dta_rapporto_apert);
    const k = monthKey(d);
    cassetteMonth[k] = (cassetteMonth[k]||0)+1;
  });

  const byBuCassette = mapToSorted(countBy(cassette2026, 'des_business_unit'));

  // Union mesi
  const months = [...new Set([
    ...Object.keys(bonificiMonth),
    ...Object.keys(cassaMonthByType),
    ...Object.keys(cassetteMonth)
  ])].sort();

  const moneticaDimRow = findDimRow(MONETICA_ID);
  panel.innerHTML = structHeaderHtml({sheetName: MONETICA_ID, dimRow: moneticaDimRow}, 'Monetica') + `
    <p class="panel-sub">Monitoraggio KPI Monetica su dati 2026.</p>

    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Bonifici 2026</div>
        <div class="val">${fmtInt.format(bonifici2026.length)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.accent}">
        <div class="lbl">Volume bonifici</div>
        <div class="val">€ ${fmtInt.format(Object.values(volumeMonth).reduce((a,b)=>a+b,0))}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.warn}">
        <div class="lbl">Cassette aperte 2026</div>
        <div class="val">${fmtInt.format(cassette2026.length)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.danger}">
        <div class="lbl">Operazioni cassa 2026</div>
        <div class="val">${fmtInt.format(cassa2026.length)}</div>
      </div>
    </div>

    <div class="section-title">Bonifici <span class="count-badge">${fmtInt.format(bonifici2026.length)} operazioni</span></div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Bonifici per mese</h3>
        <p class="card-sub">Numero operazioni - 2026</p>
        <canvas id="monBonificiChart"></canvas>
      </div>
      <div class="card">
        <h3>Volume bonifici per mese</h3>
        <p class="card-sub">Importo totale - 2026</p>
        <canvas id="monVolumeBonificiChart"></canvas>
      </div>
    </div>

    <div class="section-title">Cassa <span class="count-badge">${fmtInt.format(cassa2026.length)} operazioni</span></div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Cambiali (76)</div>
        <div class="val">${fmtInt.format(totCambiali)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.accent}">
        <div class="lbl">Operazioni tesoreria</div>
        <div class="val">${fmtInt.format(totTesoreria)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.violet}">
        <div class="lbl">Ass. circolari (11)</div>
        <div class="val">${fmtInt.format(totCircolari)}</div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Operazioni per mese per tipo</h3>
        <p class="card-sub">Cambiali, tesoreria, circolari - 2026</p>
        <canvas id="monCassaOperChart"></canvas>
      </div>
      <div class="card">
        <h3>Volume per mese per tipo</h3>
        <p class="card-sub">Importi (abs) - 2026</p>
        <canvas id="monCassaVolChart"></canvas>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Operazioni per filiale e tipo</h3>
      <p class="card-sub">Distribuzione per descrizione filiale - 2026</p>
      <canvas id="monFilialeChart"></canvas>
    </div>

    <div class="section-title">Cassette <span class="count-badge">${fmtInt.format(cassette2026.length)} rapporti</span></div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Cassette aperte per mese</h3>
        <p class="card-sub">Nuove cassette - 2026</p>
        <canvas id="monCassetteChart"></canvas>
      </div>
      <div class="card">
        <h3>Cassette per business unit</h3>
        <p class="card-sub">Distribuzione - 2026</p>
        <canvas id="monBuCassetteChart"></canvas>
      </div>
    </div>
  `;

  mkChart('monBonificiChart',{type:'bar', data:{labels:months, datasets:[{label:'Bonifici',data:months.map(m=>bonificiMonth[m]||0),backgroundColor:PALETTE.info}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monVolumeBonificiChart',{type:'bar', data:{labels:months, datasets:[{label:'Volume (€)',data:months.map(m=>volumeMonth[m]||0),backgroundColor:PALETTE.accent}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monCassaOperChart',{type:'bar', data:{labels:months, datasets:[{label:'Cambiali',data:months.map(m=>cassaMonthByType[m]?.cambiali||0),backgroundColor:PALETTE.navy},{label:'Tesoreria',data:months.map(m=>cassaMonthByType[m]?.tesoreria||0),backgroundColor:PALETTE.warn},{label:'Circolari',data:months.map(m=>cassaMonthByType[m]?.circolari||0),backgroundColor:PALETTE.pos}]}, options:{scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:PALETTE.grid}}}, plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10.5}}}}}});

  mkChart('monCassaVolChart',{type:'bar', data:{labels:months, datasets:[{label:'Cambiali',data:months.map(m=>cassaVolMonthByType[m]?.cambiali||0),backgroundColor:PALETTE.navy},{label:'Tesoreria',data:months.map(m=>cassaVolMonthByType[m]?.tesoreria||0),backgroundColor:PALETTE.warn},{label:'Circolari',data:months.map(m=>cassaVolMonthByType[m]?.circolari||0),backgroundColor:PALETTE.pos}]}, options:{scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:PALETTE.grid}}}, plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10.5}}}}}});

  mkChart('monFilialeChart',{type:'bar', data:{labels:filialArray, datasets:[{label:'Cambiali',data:filialArray.map(f=>operByFilialeType[f]?.cambiali||0),backgroundColor:PALETTE.navy},{label:'Tesoreria',data:filialArray.map(f=>operByFilialeType[f]?.tesoreria||0),backgroundColor:PALETTE.warn},{label:'Circolari',data:filialArray.map(f=>operByFilialeType[f]?.circolari||0),backgroundColor:PALETTE.pos}]}, options:{scales:{x:{grid:{display:false}},y:{grid:{color:PALETTE.grid}, ticks:{font:{size:10}}}}, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('monCassetteChart',{type:'bar', data:{labels:months, datasets:[{label:'Cassette',data:months.map(m=>cassetteMonth[m]||0),backgroundColor:PALETTE.warn}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monBuCassetteChart',{type:'bar', data:{labels:byBuCassette.map(x=>x[0]), datasets:[{label:'Cassette',data:byBuCassette.map(x=>x[1]),backgroundColor:PALETTE.violet}]}, options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false},ticks:{font:{size:10}}}}}});
}

/* ============================================================
   PANEL: GENERIC (unrecognized sheet)
   ============================================================ */
function renderGeneric(panel, s){
  const rows = s.rows;
  const headers = s.headers;
  const sample = rows.slice(0,50);
  panel.innerHTML = structHeaderHtml(s, 'Foglio dati non classificato') + `
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Righe</div><div class="val">${fmtInt.format(rows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.accent}"><div class="lbl">Colonne</div><div class="val">${headers.length}</div></div>
    </div>
    <p class="hint">Questo foglio non corrisponde alla firma di colonne attesa per Anagrafe, Antifrode o Credito & Factoring. Anteprima delle prime 50 righe:</p>
    <div class="table-wrap scroll">
      <table class="dt"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${sample.map(r=>`<tr>${headers.map(h=>`<td>${r[h]??''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  `;
}
