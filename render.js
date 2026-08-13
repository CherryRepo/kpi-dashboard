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
  const itemOrder = ['overview', 'ordinario', 'speciale', 'perfezionamenti', 'factoring', 'specialty', 'fidi', 'anagrafe', 'antifrode', 'ops_aml', 'bancassurance', 'digital', 'monetica'];
  const items = [{key:'overview', label:'Panoramica dimensionamento', tag:'DIM'}];
  const digitalTypes = ['digital_rapporti','digital_frodi','digital_raisin'];
  const moneticaTypes = ['monetica_bonifici_banca','monetica_cassa','monetica_cassette','monetica_bonifici_estero'];
  const factoringTypes = ['factoring_cedenti','factoring_debitori'];
  const fidiTypes = ['fidi','fidi_collegamenti'];
  const specialtyTypes = ['specialty_censimenti','specialty_adv','specialty_rapporti','specialty_perfezionamenti'];
  const labelMap = {
    ordinario:'Credito ordinario & factoring',
    speciale:'Credito speciale',
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
    items.push({ key:'digital', label:'Digital Bank', tag:'DIG' });
  }
  if(STATE.domainSheets.some(s=>moneticaTypes.includes(s.type))){
    items.push({ key:'monetica', label:'OPS Incassi, Pagamenti e Monetica', tag:'MON' });
  }
  if(STATE.domainSheets.some(s=>factoringTypes.includes(s.type))){
    items.push({ key:'factoring', label:'Factoring', tag:'FAC' });
  }
  if(STATE.domainSheets.some(s=>fidiTypes.includes(s.type))){
    items.push({ key:'fidi', label:'Segreteria Fidi', tag:'FIDI' });
  }
  if(STATE.domainSheets.some(s=>specialtyTypes.includes(s.type))){
    items.push({ key:'specialty', label:'Specialty Finance', tag:'SPF' });
  }

  items.sort((a, b) => {
    const posA = itemOrder.indexOf(a.key) === -1 ? 999 : itemOrder.indexOf(a.key);
    const posB = itemOrder.indexOf(b.key) === -1 ? 999 : itemOrder.indexOf(b.key);
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
  const bar     = document.getElementById('tabsBar');
  const panels  = document.getElementById('panels');
  bar.innerHTML    = '';
  panels.innerHTML = '';

  /* ── tipi per raggruppamento ── */
  const digitalTypes   = ['digital_rapporti','digital_frodi','digital_raisin'];
  const moneticaTypes  = ['monetica_bonifici_banca','monetica_cassa','monetica_cassette','monetica_bonifici_estero'];
  const factoringTypes = ['factoring_cedenti','factoring_debitori'];
  const fidiTypes = ['fidi','fidi_collegamenti'];
  const specialtyTypes = ['specialty_censimenti','specialty_adv','specialty_rapporti','specialty_perfezionamenti'];

  /* tipi che finiscono nel menu Lending */
  const lendingTypes   = ['ordinario','factoring','perfezionamenti','speciale','specialty','fidi'];

  const hasDigital   = STATE.domainSheets.some(s => digitalTypes.includes(s.type));
  const hasMonetica  = STATE.domainSheets.some(s => moneticaTypes.includes(s.type));
  const hasFactoring = STATE.domainSheets.some(s => factoringTypes.includes(s.type));
  const hasFidi = STATE.domainSheets.some(s => fidiTypes.includes(s.type));
  const hasSpecialty = STATE.domainSheets.some(s => specialtyTypes.includes(s.type));

  const labelMap = {
    ordinario      : 'Credito Ordinario & Factoring',
    speciale       : 'Credito Speciale',
    perfezionamenti: 'Contratti e Perfezionamenti Credito Ordinario',
    factoring      : 'Factoring',
    specialty      : 'Specialty Finance',
    fidi           : 'Segreteria Fidi',
    anagrafe       : 'Anagrafe',
    antifrode      : 'Antifrode',
    ops_aml        : 'OPS AML',
    bancassurance  : 'Wealth & Bancassurance'
  };

  /* ordine interno ai due menu */
  const lendingOrder    = ['perfezionamenti','factoring','fidi','specialty','ordinario','speciale'];
  const operationsOrder = ['anagrafe','antifrode','ops_aml','monetica','digital','bancassurance'];

  /* raccoglie tab per i due gruppi */
  const lendingTabs    = [];
  const operationsTabs = [];

  STATE.domainSheets.forEach((s, idx)=>{
    if(digitalTypes.includes(s.type) || moneticaTypes.includes(s.type) || factoringTypes.includes(s.type) || fidiTypes.includes(s.type) || specialtyTypes.includes(s.type)) return;
    const tab = { key:'d'+idx, label: labelMap[s.type] || ('Dati (' + s.sheetName + ')'), type: s.type };
    if(lendingTypes.includes(s.type)) lendingTabs.push(tab);
    else                              operationsTabs.push(tab);
  });

  /* aggregati speciali */
  if(hasFactoring) lendingTabs.push({ key:'factoring', label:'Factoring', type:'factoring' });
  if(hasFidi)  lendingTabs.push({ key:'fidi', label:'Segreteria Fidi', type:'fidi' });
  if(hasSpecialty)  lendingTabs.push({ key:'specialty', label:'Specialty Finance', type:'specialty' });
  if(hasDigital)   operationsTabs.push({ key:'digital',  label:'Digital Bank', type:'digital' });
  if(hasMonetica)  operationsTabs.push({ key:'monetica', label:'OPS Incassi, Pagamenti e Monetica', type:'monetica' });

  /* ordina i due gruppi */
  const sortByOrder = (arr, order) =>
    arr.sort((a,b)=>{
      const pa = order.indexOf(a.type ?? a.key);
      const pb = order.indexOf(b.type ?? b.key);
      return (pa===-1?999:pa) - (pb===-1?999:pb);
    });
  sortByOrder(lendingTabs, lendingOrder);
  sortByOrder(operationsTabs, operationsOrder);

  /* ── costruisce i panel per TUTTI i tab (li creiamo tutti subito) ── */
  const allTabs = [...lendingTabs, ...operationsTabs];

  /* panel Overview */
  _createPanel(panels, 'overview');

  allTabs.forEach(t => _createPanel(panels, t.key));

  /* ── barra: Overview singolo ── */
  const overviewTab = el('div','tab','<span>Overview</span>');
  overviewTab.dataset.key = 'overview';
  overviewTab.onclick = ()=> activateTab('overview');
  bar.appendChild(overviewTab);

  /* ── barra: dropdown Lending ── */
  if(lendingTabs.length){
    bar.appendChild(_buildDropdown('Lending', lendingTabs));
  }

  /* ── barra: dropdown Operations ── */
  if(operationsTabs.length){
    bar.appendChild(_buildDropdown('Operations', operationsTabs));
  }

  activateTab('overview');
}

/* crea un div.panel vuoto */
function _createPanel(container, key){
  const panel = el('div','panel','');
  panel.id = 'panel-' + key;
  container.appendChild(panel);
}

/* costruisce un elemento dropdown nella tab-bar */
function _buildDropdown(groupLabel, tabs){
  const wrapper = el('div','tab-dropdown');

  const btn = el('div','tab tab-group-btn',
    `<span>${groupLabel}</span><span class="tab-arrow">▾</span>`);
  btn.dataset.group = groupLabel;

  const list = el('div','tab-dropdown-list');
  tabs.forEach(t=>{
    const item = el('div','tab-dropdown-item',`<span>${t.label}</span>`);
    item.dataset.key = t.key;
    item.onclick = (e)=>{
      e.stopPropagation();
      activateTab(t.key);
      list.classList.remove('open');
    };
    list.appendChild(item);
  });

  btn.onclick = (e)=>{
    e.stopPropagation(); // ← blocca la propagazione al document
    document.querySelectorAll('.tab-dropdown-list.open').forEach(l=>{
      if(l !== list) l.classList.remove('open');
    });
    list.classList.toggle('open');
  };

  wrapper.appendChild(btn);
  wrapper.appendChild(list);
  return wrapper;
}

/* chiudi dropdown cliccando fuori */
document.addEventListener('click', ()=>{
  document.querySelectorAll('.tab-dropdown-list.open').forEach(l=> l.classList.remove('open'));
});

/* ============================================================
   ACTIVATE TAB
   ============================================================ */
function activateTab(key){
  STATE.activeTab = key;

  /* evidenzia tab singoli */
  document.querySelectorAll('.tab:not(.tab-group-btn)').forEach(t=>
    t.classList.toggle('active', t.dataset.key === key));

  /* evidenzia il bottone gruppo se uno dei suoi item è attivo */
  document.querySelectorAll('.tab-group-btn').forEach(btn=>{
    const list = btn.nextElementSibling;
    const hasActive = [...list.querySelectorAll('.tab-dropdown-item')]
      .some(i => i.dataset.key === key);
    btn.classList.toggle('active', hasActive);
  });

  /* evidenzia item dropdown */
  document.querySelectorAll('.tab-dropdown-item').forEach(i=>
    i.classList.toggle('active', i.dataset.key === key));

  /* sidebar */
  document.querySelectorAll('.nav-item').forEach(t=>
    t.classList.toggle('active', t.dataset.key === key));

  /* panel */
  document.querySelectorAll('.panel').forEach(p=>
    p.classList.toggle('active', p.id === 'panel-'+key));

  const panel = document.getElementById('panel-'+key);
  if(!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  if(key === 'overview')  { renderOverview(panel);  return; }
  if(key === 'digital')   { renderDigital(panel);   return; }
  if(key === 'monetica')  { renderMonetica(panel);  return; }
  if(key === 'factoring') { renderFactoring(panel); return; }
  if(key === 'fidi')      { renderFidi(panel);      return; }
  if(key === 'specialty') { renderSpecialty(panel); return; }

  const idx = Number(key.slice(1));
  const s   = STATE.domainSheets[idx];

  if(s.type === 'anagrafe')        renderAnagrafe(panel, s);
  else if(s.type === 'antifrode')  renderAntifrode(panel, s);
  else if(s.type === 'ordinario')  renderCredito(panel, s);
  else if(s.type === 'speciale')   renderCreditoSpeciale(panel, s);
  else if(s.type === 'ops_aml')    renderOpsAml(panel, s);
  else if(s.type === 'perfezionamenti') renderPerfezionamenti(panel, s);
  else if(s.type === 'bancassurance')   renderBancassurance(panel, s);
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

  const totHC      = rows.reduce((a, r) => a + (Number(r.HC) || 0), 0);
  const totFteAsIs = rows.reduce((a, r) => a + (Number(r['FTE AS IS - in forza']) || 0), 0);
  const totFteStim = rows.reduce((a, r) => a + (Number(r['FTE Stimati']) || 0), 0);
  const totNS      = rows.reduce((a, r) => a + (Number(r['Need/Surplus']) || 0), 0);
  const nDeficit   = rows.filter(r => (Number(r['Need/Surplus']) || 0) < 0).length;
  const nSurplus   = rows.filter(r => (Number(r['Need/Surplus']) || 0) > 0).length;

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
  `;

  function draw() {
    const uo1 = document.getElementById('ovFilterUo1').value;
    const q   = document.getElementById('ovSearch').value.toLowerCase();
    const f   = rows.filter(r =>
      (!uo1 || r.uo1livello_descrizione === uo1) &&
      (!q   || String(r['UO LAST'] || '').toLowerCase().includes(q))
    );

    const areaGrid  = document.getElementById('ovAreaGrid');
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
                <th>FTE AS-IS</th>
                <th>FTE NEED</th>
                <th>Delta FTE</th>
              </tr>
            </thead>
            <tbody>
              ${areaRows.map(r => `
                <tr>
                  <td>${r['UO LAST'] || ''}</td>
                  <td class="tdspacer"></td>
                  <td class="numcell">${pillFte(r['FTE AS IS - in forza'])}</td>
                  <td class="numcell">${pillFte(r['FTE Stimati'])}</td>
                  <td class="numcell">${pillDelta(r['Need/Surplus'])}</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');
  }

  document.getElementById('ovFilterUo1').onchange = draw;
  document.getElementById('ovSearch').oninput     = draw;
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

  const fteTeorico = taskData.fte_teorico;
  const fteActual = taskData.fte_actual;

  // Verde se FTE Teorico > FTE Actual, rosso altrimenti
  const statusColor = fteTeorico !== null && fteActual !== null && fteTeorico > fteActual ? '#22c55e' : '#ef4444';

  return `
    <div style="display:flex; align-items:stretch; gap:0; height:40px; border:1px solid ${PALETTE.grey666}; border-radius:8px; overflow:hidden; background:#f5f5f5; width:fit-content;">
      <div style="min-width:70px; padding:5px 12px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${PALETTE.grid}; border-right:1px solid #fff;">
        <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666">Target</div>
        <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.pezzi !== null ? fmtIntRound.format(taskData.pezzi) : '—'}</div>
      </div>
      <div style="min-width:70px; padding:5px 12px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${PALETTE.grid}; border-right:1px solid #fff;">
        <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666;">FTE Teorico</div>
        <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.fte_teorico !== null ? fmtDec.format(taskData.fte_teorico) : '—'}</div>
      </div>
      <div style="min-width:70px; padding:5px 12px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${PALETTE.grid}; border-right:1px solid #fff;">
        <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666;">Media Mensile</div>
        <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.pezzi_actual !== null ? fmtIntRound.format(taskData.pezzi_actual) : '—'}</div>
      </div>
      <div style="min-width:70px; padding:5px 12px; display:flex; align-items:center; justify-content:center; gap:10px; background:${PALETTE.grid};">
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666;">FTE Actual</div>
          <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.fte_actual !== null ? fmtDec.format(taskData.fte_actual) : '—'}</div>
        </div>
        <span style="width:9px; height:9px; min-width:9px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
      </div>
    </div>
  `;
}

function renderKPITableFactoring(taskData) {
  if (!taskData) {
    return '<p class="hint">Nessun dato task disponibile.</p>';
  }

  const fteTeorico = taskData.fte_teorico;
  const fteActual = taskData.fte_actual;

  // Verde se FTE Teorico > FTE Actual, rosso altrimenti
  const statusColor = fteTeorico !== null && fteActual !== null && fteTeorico > fteActual ? '#22c55e' : '#ef4444';

  return `
    <div style="display:flex; align-items:stretch; gap:0; height:40px; border:1px solid ${PALETTE.grey666}; border-radius:8px; overflow:hidden; background:#f5f5f5; max-width:400px; width:100%;">
      <div style="min-width:70px; padding:5px 12px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${PALETTE.grid}; border-right:1px solid #fff;">
        <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666">Target per FTE</div>
        <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.pezzi !== null ? fmtIntRound.format(taskData.pezzi) : '—'}</div>
      </div>
      <div style="min-width:70px; padding:5px 12px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${PALETTE.grid}; border-right:1px solid #fff;">
        <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666;">FTE Teorico</div>
        <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.fte_teorico !== null ? fmtDec.format(taskData.fte_teorico) : '—'}</div>
      </div>
      <div style="min-width:70px; padding:5px 12px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${PALETTE.grid}; border-right:1px solid #fff;">
        <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666;">Media per FTE</div>
        <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.pezzi_actual !== null ? fmtIntRound.format(taskData.pezzi_actual) : '—'}</div>
      </div>
      <div style="min-width:70px; padding:5px 12px; display:flex; align-items:center; justify-content:center; gap:10px; background:${PALETTE.grid};">
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div style="font-size:11px; font-weight:400; line-height:1.1; color:#666666;">FTE Actual</div>
          <div style="font-size:14px; font-weight:700; line-height:1.2; margin-top:3px;">${taskData.fte_actual !== null ? fmtDec.format(taskData.fte_actual) : '—'}</div>
        </div>
        <span style="width:9px; height:9px; min-width:9px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
      </div>
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