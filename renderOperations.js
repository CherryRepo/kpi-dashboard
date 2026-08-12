/* ============================================================
   PANEL: ANAGRAFE
   ============================================================ */
function renderAnagrafe(panel, s){
  const ALLOWED_BU = ['', '-', 'smes', 'digital bank'];
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

  // ---- task KPI ----
  const tasksAnagrafe = getTasksForSheet(s.sheetName);

  const censimentiTask = tasksAnagrafe[0];
  if (censimentiTask) {
    taskDataCensimenti = {
      pezzi: censimentiTask.pezzi,
      fte_teorico: censimentiTask.fte_teorico,
      pezzi_actual: rows.length / MONTHS,
      fte_actual: (rows.length / MONTHS * censimentiTask.tempi) / HOURS_PER_MONTH
    };
  }

  panel.innerHTML = structHeaderHtml(s, 'Anagrafe - ORGANIZATION, ICT & HR') + `
    <div class="card" style="margin-bottom:16px; position:relative;">
      <h3 style="margin:0 0 4px;">Censimenti clientela 2026</h3>
      <p class="card-sub">trend mensile per data censimento</p>
      <div style="position:absolute; top:12px; right:12px;">
        ${renderKPITable(taskDataCensimenti)}
      </div>
      <canvas id="censimentiChart" style="width:100%; max-height:280px;"></canvas>
    </div>
    <div class="section-title">Statistiche e approfondimenti censimenti anagrafe 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Nominativi censiti</div><div class="val">${fmtInt.format(rows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Nature giuridiche distinte</div><div class="val">${new Set(rows.map(r=>r.des_natura_giuridica)).size}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Periodo censimento</div><div class="val" style="font-size:15px">${fmtDate(minD)} → ${fmtDate(maxD)}</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Natura giuridica (top 12)</h3><p class="card-sub">forma societaria dei nominativi censiti</p><canvas id="anNaturaChart"></canvas></div>
      <div class="card"><h3>Stato cliente</h3><p class="card-sub">${statusCounts.length? 'des_status_generic' : 'dato non disponibile'}</p><canvas id="anStatusChart"></canvas></div>
    </div>
  `;

  mkChart('censimentiChart', {type:'bar', data:{labels:months, datasets:[{label:'Censimenti', data:months.map(m=>byMonth.get(m)), backgroundColor:PALETTE.info}, {label:'Media mensile', data:Array(months.length).fill(rows.length / MONTHS), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderDash:[0]},
    {label:'Target', data:Array(months.length).fill(1250), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>chart.data.datasets.map((d,i)=>({text:d.label, fillStyle:d.type==='line'?'transparent':d.backgroundColor, strokeStyle:d.type==='line'?d.borderColor:'transparent', lineWidth:d.type==='line'?2:0, pointStyle:d.type==='line'?'line':'rect', hidden:!chart.isDatasetVisible(i), index:i}))}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:false}, y:{grid:{color:PALETTE.grid}, stacked:false}}}});

  mkChart('anNaturaChart', {type:'bar', data:{labels:naturaCounts.map(x=>x[0]), datasets:[{label:'Nominativi', data:naturaCounts.map(x=>x[1]), backgroundColor:PALETTE.navy}]},
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

    // ---- task KPI ----
  const tasksAntifrode = getTasksForSheet(s.sheetName);

  const frodiTask = tasksAntifrode[0];
  if (frodiTask) {
    taskDataFrodi = {
      pezzi: frodiTask.pezzi,
      fte_teorico: frodiTask.fte_teorico,
      pezzi_actual: total / 6,
      fte_actual: (total / 6 * frodiTask.tempi) / HOURS_PER_MONTH
    };
  }

  panel.innerHTML = structHeaderHtml(s, 'Antifrode - ORGANIZATION, ICT & HR') + `
    <div class="card" style="margin-bottom:16px; position:relative;">
      <h3 style="margin:0 0 4px;">Frodi interne ed esterne gestite 2026</h3>
      <p class="card-sub">trend mensile per data censimento</p>
      <div style="position:absolute; top:12px; right:12px;">
        ${renderKPITable(taskDataFrodi)}
      </div>
      <canvas id="frodiChart" style="width:100%; max-height:280px;"></canvas>
    </div>
    <div class="section-title">Statistiche e approfondimenti antifrode 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Segnalazioni totali</div><div class="val">${fmtInt.format(total)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Frodi confermate</div><div class="val">${fmtInt.format(confermate)}</div><div class="sub">${fmtDec.format(tassoConferma)}% del totale</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Falsi positivi</div><div class="val">${fmtInt.format(byClass.get('FALSO POSITIVO FRODE')||0)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Numero disconoscimenti</div><div class="val">${6}</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Andamento mensile per classificazione</h3><p class="card-sub">frodi confermate / falsi positivi / non classificabili</p><canvas id="afTrendChart"></canvas></div>
      <div class="card"><h3>Distribuzione per classificazione</h3><canvas id="afClassChart"></canvas></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card" style="grid-column:1/-1"><h3>Volumi per cluster di frode</h3><p class="card-sub">tipologia di frode rilevata</p><canvas id="afClusterChart"></canvas></div>
    </div>
  `;

  mkChart('frodiChart', {type:'bar', data:{labels:months, datasets:[{label:'Frodi', data:months.map(m=>[...byMonthClass.get(m).values()].reduce((a,b)=>a+b,0)), backgroundColor:PALETTE.info}, {label:'Media mensile', data:Array(months.length).fill(total / 6), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderDash:[0]},
    {label:'Target', data:Array(months.length).fill(42), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>chart.data.datasets.map((d,i)=>({text:d.label, fillStyle:d.type==='line'?'transparent':d.backgroundColor, strokeStyle:d.type==='line'?d.borderColor:'transparent', lineWidth:d.type==='line'?2:0, pointStyle:d.type==='line'?'line':'rect', hidden:!chart.isDatasetVisible(i), index:i}))}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:false}, y:{grid:{color:PALETTE.grid}, stacked:false}}}});

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
   PANEL: OPS AML
   ============================================================ */
function renderOpsAml(panel, s){

  const rows = s.rows;
  const isAlto = (r)=> String(r.fascia_rischio||'').toLowerCase().includes('alt');
  const altoRows = rows.filter(isAlto);
  const isDone = (r)=> !!toDate(r.data_uscita);
  const completedAlto = altoRows.filter(isDone);
  const pendingAlto = altoRows.filter(r=> !isDone(r));

  const altoNdg = distinctCount(altoRows);
  const completedAltoNdg = distinctCount(completedAlto);
  const pendingAltoNdg = distinctCount(pendingAlto);

  // Tempo medio di lavorazione per le completate a rischio alto
  const giorniAlto = completedAlto.map(r=>{
    const din = toDate(r.data_inserimento);
    const dout = toDate(r.data_uscita);
    if(!din || !dout) return null;
    return Math.round((dout - din) / 86400000);
  }).filter(v=> v!==null && v>=0);
  const avgGiorniAlto = giorniAlto.length ? giorniAlto.reduce((a,b)=>a+b,0)/giorniAlto.length : 0;

  // Scadute: rischio alto, ancora in lavorazione, con data_scadenza_adv nel passato
  const today = new Date();
  const scaduteRows = pendingAlto.filter(r=>{ const d = toDate(r.data_scadenza_adv); return d && d < today; });
  const scaduteNdg = distinctCount(scaduteRows);

  // Trend mensile completate a rischio alto
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

  // ---- task KPI ----
  const tasksOPSAML = getTasksForSheet(s.sheetName);

  const opsamlTask = tasksOPSAML[0];
  if (opsamlTask) {
    taskDataOPSAML = {
      pezzi: opsamlTask.pezzi,
      fte_teorico: opsamlTask.fte_teorico,
      pezzi_actual: completedAltoNdg / MONTHS,
      fte_actual: (completedAltoNdg / MONTHS * opsamlTask.tempi) / HOURS_PER_MONTH
    };
  }

  panel.innerHTML = structHeaderHtml(s, 'OPS AML - ORGANIZATION, ICT & HR') + `
    <div class="card" style="margin-bottom:16px; position:relative;">
      <h3 style="margin:0 0 4px;">Verifiche WF AML rischio Alto / Altissimo 2026</h3>
      <p class="card-sub">trend mensile per data uscita</p>
      <div style="position:absolute; top:12px; right:12px;">
        ${renderKPITable(taskDataOPSAML)}
      </div>
      <canvas id="amlChart" style="width:100%; max-height:280px;"></canvas>
    </div>

    <div class="section-title">Stato lavorazione adeguate verifiche su clientela a rischio alto <span class="count-badge">${fmtInt.format(altoNdg)} NDG</span></div>
    <p class="section-desc">Focus sulle posizioni in fascia di rischio alto: avanzamento delle adeguate verifiche e tempi di lavorazione.</p>
    
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Verifiche completate</div><div class="val">${fmtInt.format(completedAltoNdg)}</div><div class="sub">${fmtDec.format(altoNdg ? completedAltoNdg/altoNdg*100 : 0)}% del rischio alto</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Da lavorare</div><div class="val">${fmtInt.format(pendingAltoNdg)}</div><div class="sub">${fmtDec.format(altoNdg ? pendingAltoNdg/altoNdg*100 : 0)}% del rischio alto</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio</div><div class="val">${fmtDec.format(avgGiorniAlto)} gg</div><div class="sub">data uscita − inserimento</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Scadute e non completate</div><div class="val">${fmtInt.format(scaduteNdg)}</div><div class="sub">data scadenza ADV superata</div></div>
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

  // GRAFICI
  mkChart('amlChart', {type:'bar', data:{labels:months, datasets:[{label:'NDG completati', data:months.map(m=>byMonthSet.get(m).size), backgroundColor:PALETTE.info}, {label:'Media mensile', data:Array(months.length).fill(completedAltoNdg / MONTHS), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderDash:[0]},
    {label:'Target', data:Array(months.length).fill(112.5), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>chart.data.datasets.map((d,i)=>({text:d.label, fillStyle:d.type==='line'?'transparent':d.backgroundColor, strokeStyle:d.type==='line'?d.borderColor:'transparent', lineWidth:d.type==='line'?2:0, pointStyle:d.type==='line'?'line':'rect', hidden:!chart.isDatasetVisible(i), index:i}))}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:false}, y:{grid:{color:PALETTE.grid}, stacked:false}}}});

  mkChart('amlBuChart', {type:'bar', data:{labels:byBU.map(x=>x[0]), datasets:[{label:'NDG', data:byBU.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('amlClusterChart', {type:'bar', data:{labels:byCluster.map(x=>x[0]), datasets:[{label:'NDG', data:byCluster.map(x=>x[1]), backgroundColor:PALETTE.warn}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('amlWorkflowChart', {type:'pie', data:{labels:byWorkflow.map(x=>x[0]), datasets:[{data:byWorkflow.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('amlTipoChart', {type:'doughnut', data:{labels:byTipoVerifica.map(x=>x[0]), datasets:[{data:byTipoVerifica.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
}

/* ============================================================
   PANEL: MONETICA
   ============================================================ */
const MONETICA_ID = '10001100023100036';

function renderMonetica(panel){

  const bonifici = STATE.domainSheets.find(s=>s.type==='monetica_bonifici_banca');
  const cassa = STATE.domainSheets.find(s=>s.type==='monetica_cassa');
  const cassette = STATE.domainSheets.find(s=>s.type==='monetica_cassette');
  const bonifici_estero = STATE.domainSheets.find(s=>s.type==='monetica_bonifici_estero');

  const bonificiRows = bonifici ? bonifici.rows : [];
  const cassaRows = cassa ? cassa.rows : [];
  const cassetteRows = cassette ? cassette.rows : [];
  const bonificiEsteroRows = bonifici_estero ? bonifici_estero.rows : [];

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

  /* ============================================================ BONIFICI ESTERO ============================================================ */
  const bonificiDaEstero = bonificiEsteroRows.filter(r=>{
    const paese = String(r.paese_ord||'').toUpperCase();
    return paese && paese !== 'IT';
  });

  const bonificiVersoEstero = bonificiEsteroRows.filter(r=>{
    const paese = String(r.paese_beneficiario||'').toUpperCase();
    return paese && paese !== 'IT';
  });

  // Da estero: per mese
  const daEsteroMonth = {};
  const daEsteroVolMonth = {};
  bonificiDaEstero.forEach(r=>{
    const d = toDate(r.data_inserimento);
    if(!d) return;
    const k = monthKey(d);
    daEsteroMonth[k] = (daEsteroMonth[k]||0)+1;
    daEsteroVolMonth[k] = (daEsteroVolMonth[k]||0)+(parseFloat(r.importo_bonifico)||0);
  });

  // Da estero: per paese di origine
  const daEsteroPaese = {};
  bonificiDaEstero.forEach(r=>{
    const paese = r.paese_ord || 'N.D.';
    daEsteroPaese[paese] = (daEsteroPaese[paese]||0)+1;
  });

  // Verso estero: per mese
  const versoEsteroMonth = {};
  const versoEsteroVolMonth = {};
  bonificiVersoEstero.forEach(r=>{
    const d = toDate(r.data_inserimento);
    if(!d) return;
    const k = monthKey(d);
    versoEsteroMonth[k] = (versoEsteroMonth[k]||0)+1;
    versoEsteroVolMonth[k] = (versoEsteroVolMonth[k]||0)+(parseFloat(r.importo_bonifico)||0);
  });

  // Verso estero: per paese di destinazione
  const versoEsteroPaese = {};
  bonificiVersoEstero.forEach(r=>{
    const paese = r.paese_beneficiario || 'N.D.';
    versoEsteroPaese[paese] = (versoEsteroPaese[paese]||0)+1;
  });

  // Union mesi per bonifici estero
  const mesiEstero = [...new Set([
    ...Object.keys(daEsteroMonth),
    ...Object.keys(versoEsteroMonth)
  ])].sort();

  // Paesi da/verso estero ordinati
  const paeseListDaEstero = Object.keys(daEsteroPaese).sort();
  const paeseListVersoEstero = Object.keys(versoEsteroPaese).sort();

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
    if(!cassaMonthByType[k]) cassaMonthByType[k] = {cambiali:0, tesoreria:0, circolari:0, totale:0};
    
    if(cambiali76(r)) {
      cassaMonthByType[k].cambiali++;
      cassaMonthByType[k].totale++;
    }
    else if(operTesoreria(r)) {
      cassaMonthByType[k].tesoreria++;
      cassaMonthByType[k].totale++;
    }
    else if(assCircolari(r)) {
      cassaMonthByType[k].circolari++;
      cassaMonthByType[k].totale++;
    }
  });

  // Operazioni per filiale e tipo (CON VERIFICA)
  const operByFilialeType = {};
  cassa2026.forEach(r=>{
    const fil = r.descrizione_filiale || 'N.D.';
    if(!operByFilialeType[fil]) operByFilialeType[fil] = {cambiali:0, tesoreria:0, circolari:0, totale:0};
    
    if(cambiali76(r)) {
      operByFilialeType[fil].cambiali++;
      operByFilialeType[fil].totale++;
    }
    else if(operTesoreria(r)) {
      operByFilialeType[fil].tesoreria++;
      operByFilialeType[fil].totale++;
    }
    else if(assCircolari(r)) {
      operByFilialeType[fil].circolari++;
      operByFilialeType[fil].totale++;
    }
  });

  // Preparazione dati per il grafico filiale (non stacked)
  const filialArray = Object.keys(operByFilialeType).sort();
  const filialeDatasets = [
    {label:'Cambiali', data:filialArray.map(f=>operByFilialeType[f].cambiali||0), backgroundColor:PALETTE.info},
    {label:'Tesoreria', data:filialArray.map(f=>operByFilialeType[f].tesoreria||0), backgroundColor:PALETTE.warn},
    {label:'Circolari', data:filialArray.map(f=>operByFilialeType[f].circolari||0), backgroundColor:PALETTE.warn}
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


  // ---- task KPI ----
  const tasksMonetica = getTasksForSheet(MONETICA_ID);

  const moneticaTask1 = tasksMonetica[0];
  if (moneticaTask1) {
    taskDataMonetica1 = {
      pezzi: moneticaTask1.pezzi,
      fte_teorico: moneticaTask1.fte_teorico,
      pezzi_actual: 402 / MONTHS,
      fte_actual: (402 / MONTHS * moneticaTask1.tempi) / HOURS_PER_MONTH
    };
  }

  const moneticaTaskAssegni = tasksMonetica[3];
  if (moneticaTaskAssegni) {
    taskDataMoneticaAssegni = {
      pezzi: moneticaTaskAssegni.pezzi,
      fte_teorico: moneticaTaskAssegni.fte_teorico,
      pezzi_actual: totCircolari / MONTHS,
      fte_actual: (totCircolari / MONTHS * moneticaTaskAssegni.tempi) / HOURS_PER_MONTH
    };
  }

  const moneticaTaskCambiali = tasksMonetica[4];
  if (moneticaTaskCambiali) {
    taskDataMoneticaCambiali = {
      pezzi: moneticaTaskCambiali.pezzi,
      fte_teorico: moneticaTaskCambiali.fte_teorico,
      pezzi_actual: totCambiali / MONTHS,
      fte_actual: (totCambiali / MONTHS * moneticaTaskCambiali.tempi) / HOURS_PER_MONTH
    };
  }

  const moneticaTaskCassette = tasksMonetica[18];
  if (moneticaTaskCassette) {
    taskDataMoneticaCassette = {
      pezzi: moneticaTaskCassette.pezzi,
      fte_teorico: moneticaTaskCassette.fte_teorico,
      pezzi_actual: cassette2026.length / MONTHS,
      fte_actual: (cassette2026.length / MONTHS * moneticaTaskCassette.tempi) / HOURS_PER_MONTH
    };
  }

  const moneticaTaskTesoreria = tasksMonetica[30];
  if (moneticaTaskTesoreria) {
    taskDataMoneticaTesoreria = {
      pezzi: moneticaTaskTesoreria.pezzi,
      fte_teorico: moneticaTaskTesoreria.fte_teorico,
      pezzi_actual: totTesoreria / MONTHS,
      fte_actual: (totTesoreria / MONTHS * moneticaTaskTesoreria.tempi) / HOURS_PER_MONTH
    };
  }

  const moneticaDimRow = findDimRow(MONETICA_ID);
  panel.innerHTML = structHeaderHtml({sheetName: MONETICA_ID, dimRow: moneticaDimRow}, 'OPS Incassi, Pagamenti e Monetica - ORGANIZATION, ICT & HR') + `
  <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:16px;">
    <div style="display:flex; gap:16px;">
      <div class="card" style="padding:28px 24px; flex:1; min-width:0; overflow:hidden;">
        <h3 style="margin:0 0 16px 0;">Aperture e chiusure conti con portabilità 2026</h3>
        ${renderKPITable(taskDataMonetica1)}
      </div>
      <div class="card" style="padding:28px 24px; flex:1; min-width:0; overflow:hidden;">
        <h3 style="margin:0 0 16px 0;">Assegni circolari gestiti al 31/07/2026</h3>
        ${renderKPITable(taskDataMoneticaAssegni)}
      </div>
      <div class="card" style="padding:28px 24px; flex:1; min-width:0; overflow:hidden;">
        <h3 style="margin:0 0 16px 0;">Portafoglio cambiali cliente 2026</h3>
        ${renderKPITable(taskDataMoneticaCambiali)}
      </div>
    </div>
    <div style="display:flex; gap:16px;">
      <div class="card" style="flex:1; position:relative; display:flex; flex-direction:column; justify-content:flex-end;">
        <h3 style="margin:0 0 4px;">Cassette sicurezza</h3>
        <p class="card-sub">cassette aperte per mese</p>
        <div style="position:absolute; top:12px; right:12px;">
          ${renderKPITable(taskDataMoneticaCassette)}
        </div>
        <canvas id="CassetteChart" style="width:100%; max-height:240px;"></canvas>
      </div>
      <div class="card" style="flex:1; position:relative; display:flex; flex-direction:column; justify-content:flex-end;">
        <h3 style="margin:0 0 4px;">Operazioni di tesoreria</h3>
        <p class="card-sub">operazioni per mese</p>
        <div style="position:absolute; top:12px; right:12px;">
          ${renderKPITable(taskDataMoneticaTesoreria)}
        </div>
        <canvas id="TesoreriaChart" style="width:100%; max-height:240px;"></canvas>
      </div>
    </div>
  </div>

    <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
      <div class="section-title">KPI OPS Incassi, Pagamenti e Monetica 2026</div>
      <div class="kpi-row">
        <div class="kpi" style="--kc:${PALETTE.info}">
          <div class="lbl">Bonifici banca eseguiti</div>
          <div class="val">${fmtInt.format(bonifici2026.length)}</div>
        </div>
        <div class="kpi" style="--kc:${PALETTE.info}">
          <div class="lbl">C/C aperti con portabilità</div>
          <div class="val">${fmtInt.format(196)}</div>
        </div>
        <div class="kpi" style="--kc:${PALETTE.pos}">
          <div class="lbl">C/C chiusi con portabilità</div>
          <div class="val">${fmtInt.format(206)}</div>
        </div>
        <div class="kpi" style="--kc:${PALETTE.danger}">
          <div class="lbl">Operazioni cassa (Ass. Circolari, Cambiali, Op. Tesoreria)</div>
          <div class="val">${fmtInt.format(cassa2026.length)}</div>
        </div>
        <div class="kpi" style="--kc:${PALETTE.warn}">
          <div class="lbl">Cassette di sicurezza aperte</div>
          <div class="val">${fmtInt.format(cassette2026.length)}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-title">Bonifici banca <span class="count-badge">${fmtInt.format(bonifici2026.length)} operazioni</span></div>
  <div class="grid cols-2">
    <div class="card">
      <h3>Bonifici per mese</h3>
      <p class="card-sub">Numero operazioni</p>
      <canvas id="monBonificiChart"></canvas>
    </div>
    <div class="card">
      <h3>Volume bonifici per mese</h3>
      <p class="card-sub">Volume operazioni</p>
      <canvas id="monVolumeBonificiChart"></canvas>
    </div>
  </div>

  <div class="section-title">Bonifici da estero <span class="count-badge">${fmtInt.format(bonificiDaEstero.length)} operazioni</span></div>
  <div class="kpi-row">
    <div class="kpi" style="--kc:${PALETTE.info}">
      <div class="lbl">Bonifici da estero</div>
      <div class="val">${fmtInt.format(bonificiDaEstero.length)}</div>
    </div>
    <div class="kpi" style="--kc:${PALETTE.info}">
      <div class="lbl">Volume totale</div>
      <div class="val">€ ${fmtInt.format(Object.values(daEsteroVolMonth).reduce((a,b)=>a+b,0))}</div>
    </div>
  </div>
  <div class="grid cols-2">
    <div class="card">
      <h3>Bonifici da estero per mese</h3>
      <p class="card-sub">Numero operazioni (data_inserimento)</p>
      <canvas id="monDaEsteroMonthChart"></canvas>
    </div>
    <div class="card">
      <h3>Volume bonifici da estero per mese</h3>
      <p class="card-sub">Importo in valore assoluto</p>
      <canvas id="monDaEsteroVolChart"></canvas>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Bonifici da estero per paese di provenienza</h3>
    <p class="card-sub">Distribuzione per paese</p>
    <canvas id="monDaEsteroPaeseChart"></canvas>
  </div>

  <div class="section-title">Bonifici verso estero <span class="count-badge">${fmtInt.format(bonificiVersoEstero.length)} operazioni</span></div>
  <div class="kpi-row">
    <div class="kpi" style="--kc:${PALETTE.warn}">
      <div class="lbl">Bonifici verso estero</div>
      <div class="val">${fmtInt.format(bonificiVersoEstero.length)}</div>
    </div>
    <div class="kpi" style="--kc:${PALETTE.warn}">
      <div class="lbl">Volume totale</div>
      <div class="val">€ ${fmtInt.format(Object.values(versoEsteroVolMonth).reduce((a,b)=>a+b,0))}</div>
    </div>
  </div>
  <div class="grid cols-2">
    <div class="card">
      <h3>Bonifici verso estero per mese</h3>
      <p class="card-sub">Numero operazioni (data_inserimento)</p>
      <canvas id="monVersoEsteroMonthChart"></canvas>
    </div>
    <div class="card">
      <h3>Volume bonifici verso estero per mese</h3>
      <p class="card-sub">Importo in valore assoluto</p>
      <canvas id="monVersoEsteroVolChart"></canvas>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Bonifici verso estero per paese di destinazione</h3>
    <p class="card-sub">Distribuzione per paese</p>
    <canvas id="monVersoEsteroPaeseChart"></canvas>
  </div>

  <div class="section-title">Cassa <span class="count-badge">${fmtInt.format(cassa2026.length)} operazioni</span></div>
  <div class="kpi-row">
    <div class="kpi" style="--kc:${PALETTE.info}">
      <div class="lbl">Cambiali</div>
      <div class="val">${fmtInt.format(totCambiali)}</div>
    </div>
    <div class="kpi" style="--kc:${PALETTE.info}">
      <div class="lbl">Operazioni tesoreria</div>
      <div class="val">${fmtInt.format(totTesoreria)}</div>
    </div>
    <div class="kpi" style="--kc:${PALETTE.warn}">
      <div class="lbl">Ass. circolari</div>
      <div class="val">${fmtInt.format(totCircolari)}</div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Operazioni per mese per tipo</h3>
    <p class="card-sub">Cambiali, tesoreria, circolari</p>
    <canvas id="monCassaOperChart"></canvas>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Operazioni per filiale e tipo</h3>
    <p class="card-sub">Distribuzione per filiale</p>
    <canvas id="monFilialeChart"></canvas>
  </div>
  ${renderTaskTable(getTasksForSheet(MONETICA_ID))}
  `;

  mkChart('monBonificiChart',{type:'bar', data:{labels:months, datasets:[{label:'Bonifici',data:months.map(m=>bonificiMonth[m]||0),backgroundColor:PALETTE.info}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monVolumeBonificiChart',{type:'bar', data:{labels:months, datasets:[{label:'Volume (€)',data:months.map(m=>volumeMonth[m]||0),backgroundColor:PALETTE.navy}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monDaEsteroMonthChart',{type:'bar', data:{labels:mesiEstero, datasets:[{label:'Operazioni',data:mesiEstero.map(m=>daEsteroMonth[m]||0),backgroundColor:PALETTE.pos}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monDaEsteroVolChart',{type:'bar', data:{labels:mesiEstero, datasets:[{label:'Volume (€)',data:mesiEstero.map(m=>daEsteroVolMonth[m]||0),backgroundColor:PALETTE.danger}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monDaEsteroPaeseChart',{type:'bar', data:{labels:paeseListDaEstero, datasets:[{label:'Bonifici',data:paeseListDaEstero.map(p=>daEsteroPaese[p]||0),backgroundColor:PALETTE.warn}]}, options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false},ticks:{font:{size:10}}}}}});

  mkChart('monVersoEsteroMonthChart',{type:'bar', data:{labels:mesiEstero, datasets:[{label:'Operazioni',data:mesiEstero.map(m=>versoEsteroMonth[m]||0),backgroundColor:PALETTE.warn}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monVersoEsteroVolChart',{type:'bar', data:{labels:mesiEstero, datasets:[{label:'Volume (€)',data:mesiEstero.map(m=>versoEsteroVolMonth[m]||0),backgroundColor:PALETTE.pos}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monVersoEsteroPaeseChart',{type:'bar', data:{labels:paeseListVersoEstero, datasets:[{label:'Bonifici',data:paeseListVersoEstero.map(p=>versoEsteroPaese[p]||0),backgroundColor:PALETTE.danger}]}, options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false},ticks:{font:{size:10}}}}}});

  mkChart('monCassaOperChart',{type:'bar', data:{labels:months, datasets:[{label:'Cambiali',data:months.map(m=>cassaMonthByType[m]?.cambiali||0),backgroundColor:PALETTE.navy},{label:'Tesoreria',data:months.map(m=>cassaMonthByType[m]?.tesoreria||0),backgroundColor:PALETTE.warn},{label:'Circolari',data:months.map(m=>cassaMonthByType[m]?.circolari||0),backgroundColor:PALETTE.pos}]}, options:{scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:PALETTE.grid}}}, plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10.5}}}}}});

  mkChart('TesoreriaChart', {type:'bar', data:{labels:months, datasets:[{label:'Tesoreria', data:months.map(m=>cassaMonthByType[m]?.tesoreria||0), backgroundColor:PALETTE.accent}, {label:'Media Mensile', data:Array(months.length).fill(cassette2026.length / MONTHS), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(months.length).fill(20), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:false}}}});

  mkChart('monFilialeChart',{type:'bar', data:{labels:filialArray, datasets:[{label:'Cambiali',data:filialArray.map(f=>operByFilialeType[f].cambiali),backgroundColor:PALETTE.navy},{label:'Tesoreria',data:filialArray.map(f=>operByFilialeType[f].tesoreria),backgroundColor:PALETTE.warn},{label:'Circolari',data:filialArray.map(f=>operByFilialeType[f].circolari),backgroundColor:PALETTE.pos}]}, options:{scales:{x:{grid:{display:false}},y:{grid:{color:PALETTE.grid}, ticks:{font:{size:10}}}}, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('CassetteChart', {type:'bar', data:{labels:months, datasets:[{label:'Cassette',data:months.map(m=>cassetteMonth[m]||0), backgroundColor:PALETTE.accent}, {label:'Media Mensile', data:Array(months.length).fill(cassette2026.length / MONTHS), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(months.length).fill(20), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:false}}}});

  mkChart('monBuCassetteChart',{type:'bar', data:{labels:byBuCassette.map(x=>x[0]), datasets:[{label:'Cassette',data:byBuCassette.map(x=>x[1]),backgroundColor:PALETTE.danger}]}, options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false},ticks:{font:{size:10}}}}}});
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
  panel.innerHTML = structHeaderHtml({sheetName: DIGITAL_BANK_ID, dimRow: digitalDimRow}, 'Digital Bank - ORGANIZATION, ICT & HR') + `
    <div class="section-title">KPI Digital Bank 2026</div>

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

      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Bonifici Raisin controllati 2026</div>
        <div class="val">${fmtInt.format(raisin2026.length)}</div>
      </div>
    </div>

    <div class="section-title">Rapporti nuovi/estinti</div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card">
        <h3>Rapporti aperti per mese</h3>
        <p class="card-sub">Nuovi rapporti Digital Bank</p>
        <canvas id="digitalApertiChart"></canvas>
      </div>

      <div class="card">
        <h3>Rapporti chiusi per mese</h3>
        <p class="card-sub">Rapporti estinti</p>
        <canvas id="digitalChiusiChart"></canvas>
      </div>
    </div>

    <div class="section-title">Segnalazioni ad antifrode</div>
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

    <div class="section-title">Controlli su bonifici Raisin</div>
    <div class="card" style="margin-top:16px">
      <h3>Bonifici Raisin controllati per mese</h3>
      <p class="card-sub">Numero bonifici analizzati - 2026</p>
      <canvas id="digitalRaisinChart"></canvas>
    </div>

    ${renderTaskTable(getTasksForSheet(DIGITAL_BANK_ID))}
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
        backgroundColor:PALETTE.info
      }]
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
  
  panel.innerHTML = structHeaderHtml(s, 'Wealth & Bancassurance - ORGANIZATION, ICT & HR') + `
    <div class="section-title">Statistiche su ordini di trasferimento titoli, fondi, ecc... 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Ordini totali</div><div class="val">${fmtInt.format(bancassurance.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Volume totale</div><div class="val">€ ${fmtInt.format(volumeTotal)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Volume medio mensile</div><div class="val">€ ${fmtInt.format(volumeAvg)}</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Ordini mensili per stato</h3>
        <p class="card-sub">data_ordine, suddiviso per descrizione_stato</p>
        <canvas id="baOrdiniChart"></canvas>
      </div>
      <div class="card">
        <h3>Volume mensile</h3>
        <p class="card-sub">tot_generale_euro per mese</p>
        <canvas id="baVolumeChart"></canvas>
      </div>
    </div>

    ${renderTaskTable(getTasksForSheet(s.sheetName))}
  `;

  mkChart('baOrdiniChart', { type: 'bar', data: { labels: months, datasets: statiArray.map(stato => ({ label: stato, data: months.map(m => ordiniByMonthStato[m]?.[stato] || 0), backgroundColor: statoColorMap[stato], borderColor: statoColorMap[stato], borderWidth: 0 })) }, options: { scales: { x: {stacked: true, grid: {display: false}}, y: {stacked: true, grid: {color: PALETTE.grid}} }, plugins: { legend: {position: 'bottom', labels: {boxWidth: 10, font: {size: 10.5}}} } } });

  mkChart('baVolumeChart', { type: 'bar', data: { labels: months, datasets: [{ label: 'Volume (€)', data: months.map(m => volumeByMonth[m] || 0), backgroundColor: PALETTE.pos, borderColor: PALETTE.pos, borderWidth: 0 }] }, options: { scales: { x: {grid: {display: false}}, y: {grid: {color: PALETTE.grid}} }, plugins: { legend: {display: false} } } });
}