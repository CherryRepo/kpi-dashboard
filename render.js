/* ============================================================
   LOADING BAR
   ============================================================ */
async function waitWithLoadingBar(startTime) {
  const loadingBar = document.getElementById('loadingBar');
  const dashboard = document.getElementById('dashboard');
  
  // Nascondi la barra e mostra la dashboard
  if (loadingBar) loadingBar.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function buildSidebar(){
  const nav = document.getElementById('navList');
  nav.innerHTML = '';
  const itemOrder = ['overview', 'ordinario', 'speciale', 'perfezionamenti', 'factoring', 'anagrafe', 'antifrode', 'ops_aml', 'bancassurance', 'digital', 'monetica'];
  const items = [{key:'overview', label:'Panoramica dimensionamento', tag:'DIM'}];
  const digitalTypes = ['digital_rapporti','digital_frodi','digital_raisin'];
  const moneticaTypes = ['monetica_bonifici_banca','monetica_cassa','monetica_cassette','monetica_bonifici_estero'];
  const factoringTypes = ['factoring_cedenti','factoring_debitori'];
  const labelMap = {
    ordinario:'Credito Ordinario & Factoring',
    speciale:'Credito Speciale',
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
      label:'OPS Incassi, Pagamenti e Monetica',
      tag:'MON'
    });
  }

  if(STATE.domainSheets.some(s=>factoringTypes.includes(s.type))){
    items.push({
      key:'factoring',
      label:'Factoring',
      tag:'FAC'
    });
  }

  items.sort((a, b) => {
    const indexA = itemOrder.indexOf(a.key);
    const indexB = itemOrder.indexOf(b.key);
    const posA = indexA === -1 ? 999 : indexA;
    const posB = indexB === -1 ? 999 : indexB;
    return posA - posB;
  });

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
    const color = ns < -0.5 ? PALETTE.danger : ns > 0.5 ? PALETTE.warn : PALETTE.info;
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
  bar.innerHTML = '';
  panels.innerHTML = '';

  const tabOrder = ['overview', 'ordinario', 'speciale', 'perfezionamenti', 'factoring', 'anagrafe', 'antifrode', 'ops_aml', 'bancassurance', 'digital', 'monetica'];
  const tabDefs = [{key:'overview', label:'Overview'}];
  const digitalTypes = ['digital_rapporti','digital_frodi','digital_raisin'];
  const moneticaTypes = ['monetica_bonifici_banca','monetica_cassa','monetica_cassette', 'monetica_bonifici_estero'];
  const factoringTypes = ['factoring_cedenti','factoring_debitori'];
  const hasDigital = STATE.domainSheets.some(s => digitalTypes.includes(s.type));
  const hasMonetica = STATE.domainSheets.some(s => moneticaTypes.includes(s.type));
  const hasFactoring = STATE.domainSheets.some(s => factoringTypes.includes(s.type));

  const labelMap = {ordinario:'Credito ordinario & factoring', speciale:'Credito speciale', perfezionamenti:'Contratti e perfezionamenti credito ordinario', anagrafe:'Anagrafe', antifrode:'Antifrode', ops_aml:'OPS AML', bancassurance:'Wealth & Bancassurance'};

  STATE.domainSheets.forEach((s, idx)=>{
    if(digitalTypes.includes(s.type) || moneticaTypes.includes(s.type) || factoringTypes.includes(s.type)) return;
    tabDefs.push({
      key:'d'+idx, 
      label:labelMap[s.type] || 'Dati (' + s.sheetName + ')', 
      type: s.type
    });
  });

  if(hasDigital) tabDefs.push({key:'digital', label:'Digital Bank', type:'digital'});
  if(hasMonetica) tabDefs.push({key:'monetica', label:'OPS Incassi, Pagamenti e Monetica', type:'monetica'});
  if(hasFactoring) tabDefs.push({key:'factoring', label:'Factoring', type:'factoring'});

  tabDefs.sort((a, b) => {
    let posA = tabOrder.indexOf(a.key);
    let posB = tabOrder.indexOf(b.key);
    
    if(posA === -1 && a.type) posA = tabOrder.indexOf(a.type);
    if(posB === -1 && b.type) posB = tabOrder.indexOf(b.type);
    
    posA = posA === -1 ? 999 : posA;
    posB = posB === -1 ? 999 : posB;
    
    return posA - posB;
  });

  tabDefs.forEach(t=>{
    const tab = el('div','tab',`<span>${t.label}</span>`);
    tab.dataset.key = t.key;
    tab.onclick = ()=>activateTab(t.key);
    bar.appendChild(tab);

    const panel = el('div','panel','');
    panel.id = 'panel-' + t.key;
    panels.appendChild(panel);
  });

  activateTab('overview');
}

function activateTab(key){
  STATE.activeTab = key;
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.key===key));
  document.querySelectorAll('.nav-item').forEach(t=> t.classList.toggle('active', t.dataset.key===key));
  document.querySelectorAll('.panel').forEach(p=> p.classList.toggle('active', p.id === 'panel-'+key));

  const panel = document.getElementById('panel-'+key);
  if(!panel) return;
  if(panel.dataset.built) return;
  panel.dataset.built = '1';

  if(key === 'overview'){ renderOverview(panel); return; }
  if(key === 'digital'){ renderDigital(panel); return; }
  if(key === 'monetica'){ renderMonetica(panel); return; }
  if(key === 'factoring'){ renderFactoring(panel); return; }

  const idx = Number(key.slice(1));
  const s = STATE.domainSheets[idx];

  if(s.type === 'anagrafe') renderAnagrafe(panel, s);
  else if(s.type === 'antifrode') renderAntifrode(panel, s);
  else if(s.type === 'ordinario') renderCredito(panel, s);
  else if(s.type === 'speciale') renderCreditoSpeciale(panel, s);
  else if(s.type === 'ops_aml') renderOpsAml(panel, s);
  else if(s.type === 'perfezionamenti') renderPerfezionamenti(panel, s);
  else if(s.type === 'bancassurance') renderBancassurance(panel, s);
  else renderGeneric(panel, s);
}

document.addEventListener('DOMContentLoaded', () => {
  setupFileHandling();
});

/* ============================================================
   PANEL: OVERVIEW / DIMENSIONAMENTO
   ============================================================ */
function renderOverview(panel) {
  const rows = STATE.dimRows;
  if (!rows.length) {
    panel.innerHTML = '<div class="no-data">Nessun dato di dimensionamento nel primo foglio.</div>';
    return;
  }

  const totHC = rows.reduce((a, r) => a + (Number(r.HC) || 0), 0);
  const totFteAsIs = rows.reduce((a, r) => a + (Number(r['FTE AS IS - in forza']) || 0), 0);
  const totFteStim = rows.reduce((a, r) => a + (Number(r['FTE Stimati']) || 0), 0);
  const totNS = rows.reduce((a, r) => a + (Number(r['Need/Surplus']) || 0), 0);
  const nDeficit = rows.filter(r => (Number(r['Need/Surplus']) || 0) < 0).length;
  const nSurplus = rows.filter(r => (Number(r['Need/Surplus']) || 0) > 0).length;


  const uo1Options = [...new Set(rows.map(r => r.uo1livello_descrizione).filter(Boolean))];

  panel.innerHTML = `
    <div class="panel-head">
      <h2>Overview</h2>
      <span class="meta">${rows.length} strutture censite</span>
    </div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Headcount totale</div>
        <div class="val">${fmtInt.format(totHC)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">FTE as-is</div>
        <div class="val">${fmtDec.format(totFteAsIs)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.warn}">
        <div class="lbl">FTE stimati</div>
        <div class="val">${fmtDec.format(totFteStim)}</div>
      </div>
      <div class="kpi" style="--kc:${totNS >= 0 ? PALETTE.warn : PALETTE.danger}">
        <div class="lbl">Need / Surplus netto</div>
        <div class="val">${totNS > 0 ? '+' : ''}${fmtDec.format(totNS)}</div>
        <div class="sub">${nDeficit} strutture in deficit · ${nSurplus} in surplus</div>
      </div>
    </div>
    <div class="filters">
      <select id="ovFilterUo1">
        <option value="">Tutte le direzioni (UO1)</option>
        ${uo1Options.map(o => `<option value="${o}">${o}</option>`).join('')}
      </select>
      <input class="textfilter" id="ovSearch" placeholder="Cerca struttura...">
    </div>
    <div id="ovAreaGrid" class="area-grid"></div>
    <p class="hint" style="margin:6px 0 18px">
      Delta FTE = FTE Need − FTE as-is. Verde: capacità adeguata o in surplus · Ambra: fabbisogno aggiuntivo.
    </p>
    <h3 style="font-family:var(--font-display);font-size:14px;color:var(--navy-2);margin:4px 0 10px">
      Vista tabellare dettagliata
    </h3>
    <div class="table-wrap scroll">
      <table class="dt" id="ovTable"></table>
    </div>
  `;

  function draw() {
    const uo1 = document.getElementById('ovFilterUo1').value;
    const q = document.getElementById('ovSearch').value.toLowerCase();
    let f = rows.filter(r =>
      (!uo1 || r.uo1livello_descrizione === uo1) &&
      (!q || String(r['UO LAST'] || '').toLowerCase().includes(q))
    );

    // grouped area tables (visual style: banner per area + pill values)
    const areaGrid = document.getElementById('ovAreaGrid');
    const areaOrder = [...new Set(f.map(r => r.uo1livello_descrizione || '(area non specificata)'))];
    areaGrid.innerHTML = areaOrder.map(area => {
      const areaRows = f.filter(r =>
        (r.uo1livello_descrizione || '(area non specificata)') === area
      );
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
                <th>UO</th>
                <th class="spacer"></th>
                <th>FTE AS-IS</th><th>FTE NEED</th><th>Delta FTE</th>
              </tr>
            </thead>
            <tbody>
              ${areaRows
                .map(
                  r => `
                <tr>
                  <td>${r['UO LAST'] || ''}</td>
                  <td class="tdspacer"></td>
                  <td class="numcell">${pillFte(r['FTE AS IS - in forza'])}</td>
                  <td class="numcell">${pillFte(r['FTE Stimati'])}</td>
                  <td class="numcell">${pillDelta(r['Need/Surplus'])}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const table = document.getElementById('ovTable');
    table.innerHTML = `
      <thead>
        <tr class="table-header-org">
          <th>Struttura</th>
          <th>UO1</th>
          <th>UO2</th>
          <th>HC</th>
          <th>HC in forza</th>
        </tr>
        <tr class="table-header-lending">
          <th>FTE as-is</th>
          <th>FTE Need</th>
          <th>Delta FTE</th>
        </tr>
      </thead>
      <tbody>
        ${f
          .map(r => {
            const ns = Number(r['Need/Surplus']) || 0;
            return `
            <tr class="table-row-org">
              <td>${r['UO LAST'] || ''}</td>
              <td>${r.uo1livello_descrizione || ''}</td>
              <td>${r.uo2livello_descrizione || ''}</td>
              <td>${r.HC ?? ''}</td>
              <td>${r['HC - in forza'] ?? ''}</td>
            </tr>
            <tr class="table-row-lending">
              <td>${
                r['FTE AS IS - in forza'] != null
                  ? fmtDec.format(r['FTE AS IS - in forza'])
                  : ''
              }</td>
              <td>${r['FTE Stimati'] != null ? fmtDec.format(r['FTE Stimati']) : ''}</td>
              <td>
                <span class="badge ${ns < 0 ? 'danger' : 'pos'}">
                  ${ns > 0 ? '+' : ''}${fmtDec.format(ns)}
                </span>
              </td>
            </tr>`;
          })
          .join('')}
      </tbody>
    `;
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
          <th class="group-label" colspan="4">Dimensionamento struttura</th>
        </tr>
        <tr class="col-label-row">
          <th style="text-align:center">HC</th><th style="text-align:center">FTE AS-IS</th><th style="text-align:center">FTE NEED</th><th style="text-align:center">Delta FTE</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="numcell"><span class="pill">${r.HC ?? '—'}</span></td>
          <td class="numcell">${pillFte(r['FTE AS IS - in forza'])}</td>
          <td class="numcell">${pillFte(r['FTE Stimati'])}</td>
          <td class="numcell">${pillDelta(r['Need/Surplus'])}</td>
        </tr>
      </tbody>
    </table>`;
}


/* ============================================================
   Shared: tabella HTML per le task associate a uno sheet
   ============================================================ */
function renderTaskTable(tasks) {
  if (!tasks || tasks.length === 0) {
    return '<p class="hint">Nessuna task associata a questa UO.</p>';
  }
  
  return `
    <div class="section-title">Task associate <span class="count-badge">${tasks.length} task</span></div>
    <div class="table-wrap">
      <table class="task-table">
        <thead>
          <tr>
            <th style="text-align:left">ID Task</th>
            <th style="text-align:left">Nome Task</th>
            <th style="text-align:center">Pezzi</th>
            <th style="text-align:center">Tempi (min)</th>
            <th style="text-align:center">FTE Teorico</th>
            <th style="text-align:center">FTE AS-IS Ripartito</th>
            <th style="text-align:center">Ripartizione</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
            <tr>
              <td style="text-align:left">${t.id_task || '—'}</td>
              <td style="text-align:left">${t.nome_task || '—'}</td>
              <td style="text-align:center">${t.pezzi !== null ? fmtDec.format(t.pezzi) : '—'}</td>
              <td style="text-align:center">${t.tempi !== null ? fmtDec.format(t.tempi) : '—'}</td>
              <td style="text-align:center">${t.fte_teorico !== null ? fmtDec.format(t.fte_teorico) : '—'}</td>
              <td style="text-align:center">${t.fte_asis_ripartito !== null ? fmtDec.format(t.fte_asis_ripartito) : '—'}</td>
              <td style="text-align:center; color:${PALETTE.info}; font-weight:500">${t.ripartizione !== null ? fmtDec.format(t.ripartizione * 100) + '%' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderKPITable(taskData) {
  if (!taskData) {
    return '<p class="hint">Nessun dato task disponibile.</p>';
  }
  
  return `
    <div class="table-wrap" style="height:45px;">
      <table class="task-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background-color:${PALETTE.grid};">
            <th style="text-align:center; padding:4px; border:none;">Pezzi Teorico</th>
            <th style="text-align:center; padding:4px; border:none;">FTE Teorico</th>
            <th style="text-align:center; padding:4px; border:none;">Pezzi Actual</th>
            <th style="text-align:center; padding:4px; border:none;">FTE Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color:#fff; line-height:1; height:auto;">
            <td style="text-align:center; padding:4px; border:none;">${taskData.pezzi !== null ? fmtDec.format(taskData.pezzi) : '—'}</td>
            <td style="text-align:center; padding:4px; border:none;">${taskData.fte_teorico !== null ? fmtDec.format(taskData.fte_teorico) : '—'}</td>
            <td style="text-align:center; padding:4px; border:none;">${taskData.pezzi_actual !== null ? fmtDec.format(taskData.pezzi_actual) : '—'}</td>
            <td style="text-align:center; padding:4px; border:none;">${taskData.fte_actual !== null ? fmtDec.format(taskData.fte_actual) : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>

  `;
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
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Colonne</div><div class="val">${headers.length}</div></div>
    </div>
    <p class="hint">Questo foglio non corrisponde alla firma di colonne attesa per Anagrafe, Antifrode o Credito & Factoring. Anteprima delle prime 50 righe:</p>
    <div class="table-wrap scroll">
      <table class="dt"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${sample.map(r=>`<tr>${headers.map(h=>`<td>${r[h]??''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  `;
}