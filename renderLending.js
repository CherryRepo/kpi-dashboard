const MONTHS = 7;
const HOURS_PER_MONTH = 150;

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
    "Small Business",
    "Carte di Credito fino a Euro 10.000"
  ];

/* All'inizio le carte di credito le conti per le statistiche generali poi le escludi per i singoli KPI */
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
    if(!byMonthDelibera.has(k)) byMonthDelibera.set(k, {pos:0, danger:0, altro:0});
    const m = byMonthDelibera.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const deliberaMonths = [...byMonthDelibera.keys()].sort();

// ---- dati dimensionamento ----
  const tasksCredito = getTasksForSheet(s.sheetName);

// ---- Calcolo KPI ----
/* Delibere Nuovo Fido SMEs */
  const ISTRUTTORIA_SMEs = [
    "Relationship Bank Business",
    "Rinegoziazioni - Consolidamenti - Rifinanziamenti BUSINESS",
    "Relationship Bank",
    "Relationship Bank Individuals",
    "Rinegoziazioni - Consolidamenti - Rifinanziamenti INDIVIDUALS",
    "Pratica Tecnica e Revoca Affidamenti",
    "RINEGOZIAZIONI - CONSOLIDAMENTI - RIFINANZIAMENTI",
    "Small Business",
  ];
  const SCOPO_SMEs = [
    "Nuova linea di fido",
    "Nuovo impianto fidi"
  ];
  const OPERATORE_SMEs = [
    "Client Manager",
    "Sviluppatore Commerciale SMEs"
  ];
  const smeRows = s.rows.filter(r=> 
    ISTRUTTORIA_SMEs.includes(r.des_tipo_istruttoria) && 
    SCOPO_SMEs.includes(r.des_scopo_pratica) && 
    OPERATORE_SMEs.includes(r.des_ruolo_operatore_apertura)
  );
  const smeCompletedRows = smeRows.filter(isCompleted);
  const byMonthDeliberaSME = new Map();
  smeCompletedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    const tipo = String(r.des_tipo_delibera||'').toLowerCase();
    if(!byMonthDeliberaSME.has(k)) byMonthDeliberaSME.set(k, {pos:0, neg:0, altro:0});
    const m = byMonthDeliberaSME.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const smeMonths = [...byMonthDeliberaSME.keys()].sort();
  const smeMonthsData = smeMonths.map(month => ({
    month,
    pos: byMonthDeliberaSME.get(month).pos,
    neg: byMonthDeliberaSME.get(month).neg,
    altro: byMonthDeliberaSME.get(month).altro,
    total: byMonthDeliberaSME.get(month).pos + byMonthDeliberaSME.get(month).neg + byMonthDeliberaSME.get(month).altro
  }));

  const firstTask = tasksCredito[0];
  if (firstTask) {
    // Crea l'oggetto con le colonne selezionate + calcolate
    taskDataSMEs = {
      pezzi: firstTask.pezzi,
      fte_teorico: firstTask.fte_teorico,
      pezzi_actual: smeCompletedRows.length / MONTHS,
      fte_actual: (smeCompletedRows.length / MONTHS * firstTask.tempi) / HOURS_PER_MONTH
    };
  }

  /* Delibere Nuovo Fido Retail */
  const retailRows = s.rows.filter(r=> 
    ISTRUTTORIA_SMEs.includes(r.des_tipo_istruttoria) && 
    SCOPO_SMEs.includes(r.des_scopo_pratica) && 
    !OPERATORE_SMEs.includes(r.des_ruolo_operatore_apertura)
  );
  const retailCompletedRows = retailRows.filter(isCompleted);
  const byMonthDeliberaRETAIL = new Map();
  retailCompletedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    const tipo = String(r.des_tipo_delibera||'').toLowerCase();
    if(!byMonthDeliberaRETAIL.has(k)) byMonthDeliberaRETAIL.set(k, {pos:0, neg:0, altro:0});
    const m = byMonthDeliberaRETAIL.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const retailMonths = [...byMonthDeliberaRETAIL.keys()].sort();
  const retailMonthsData = smeMonths.map(month => ({
    month,
    pos: byMonthDeliberaRETAIL.get(month).pos,
    neg: byMonthDeliberaRETAIL.get(month).neg,
    altro: byMonthDeliberaRETAIL.get(month).altro,
    total: byMonthDeliberaRETAIL.get(month).pos + byMonthDeliberaRETAIL.get(month).neg + byMonthDeliberaRETAIL.get(month).altro
  }));

  const thirdTask = tasksCredito[2];
  if (thirdTask) {
    // Crea l'oggetto con le colonne selezionate + calcolate
    taskDataRetail = {
      pezzi: thirdTask.pezzi,
      fte_teorico: thirdTask.fte_teorico,
      pezzi_actual: retailCompletedRows.length / MONTHS,
      fte_actual: (retailCompletedRows.length / MONTHS * thirdTask.tempi) / HOURS_PER_MONTH
    };
  }

  /* Delibere Revisioni/Proroghe/Variazioni */
  const revisioniRows = s.rows.filter(r=> 
    ISTRUTTORIA_SMEs.includes(r.des_tipo_istruttoria) && 
    !SCOPO_SMEs.includes(r.des_scopo_pratica)
  );
  const revisioniCompletedRows = revisioniRows.filter(isCompleted);
  const byMonthDeliberaREVISIONI = new Map();
  revisioniCompletedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    const tipo = String(r.des_tipo_delibera||'').toLowerCase();
    if(!byMonthDeliberaREVISIONI.has(k)) byMonthDeliberaREVISIONI.set(k, {pos:0, neg:0, altro:0});
    const m = byMonthDeliberaREVISIONI.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const revisioniMonths = [...byMonthDeliberaREVISIONI.keys()].sort();
  const revisioniMonthsData = smeMonths.map(month => ({
    month,
    pos: byMonthDeliberaREVISIONI.get(month).pos,
    neg: byMonthDeliberaREVISIONI.get(month).neg,
    altro: byMonthDeliberaREVISIONI.get(month).altro,
    total: byMonthDeliberaREVISIONI.get(month).pos + byMonthDeliberaREVISIONI.get(month).neg + byMonthDeliberaREVISIONI.get(month).altro
  }));

  const fourthTask = tasksCredito[3];
  if (fourthTask) {
    // Crea l'oggetto con le colonne selezionate + calcolate
    taskDataRevisioni = {
      pezzi: fourthTask.pezzi,
      fte_teorico: fourthTask.fte_teorico,
      pezzi_actual: revisioniCompletedRows.length / MONTHS,
      fte_actual: (revisioniCompletedRows.length / MONTHS * fourthTask.tempi) / HOURS_PER_MONTH
    };
  }

  /* Delibere Carte di Credito */
  const ISTRUTTORIA_CARTE = [
    "Carte di Credito fino a Euro 10.000",
  ];

  const carteRows = s.rows.filter(r=> 
    ISTRUTTORIA_CARTE.includes(r.des_tipo_istruttoria)
  );
  const carteCompletedRows = carteRows.filter(isCompleted);
  const byMonthDeliberaCARTE = new Map();
  carteCompletedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    const tipo = String(r.des_tipo_delibera||'').toLowerCase();
    if(!byMonthDeliberaCARTE.has(k)) byMonthDeliberaCARTE.set(k, {pos:0, neg:0, altro:0});
    const m = byMonthDeliberaCARTE.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const carteMonths = [...byMonthDeliberaCARTE.keys()].sort();
  const carteMonthsData = smeMonths.map(month => ({
    month,
    pos: byMonthDeliberaCARTE.get(month).pos,
    neg: byMonthDeliberaCARTE.get(month).neg,
    altro: byMonthDeliberaCARTE.get(month).altro,
    total: byMonthDeliberaCARTE.get(month).pos + byMonthDeliberaCARTE.get(month).neg + byMonthDeliberaCARTE.get(month).altro
  }));

  const fifthTask = tasksCredito[4];
  if (fifthTask) {
    // Crea l'oggetto con le colonne selezionate + calcolate
    taskDataCarte = {
      pezzi: fifthTask.pezzi,
      fte_teorico: fifthTask.fte_teorico,
      pezzi_actual: carteCompletedRows.length / MONTHS,
      fte_actual: (carteCompletedRows.length / MONTHS * fifthTask.tempi) / HOURS_PER_MONTH
    };
  }
  
  panel.innerHTML = structHeaderHtml(s, 'Credito Ordinario & Factoring - Lending') + `
	<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
    <div>
      <div class="card" style="position:relative; height:380px; display:flex; flex-direction:column; justify-content:center;">
	      <h3 style="margin:0; margin-top:-10px;">Delibere nuovo fido SMEs 2026</h3>
	      <canvas id="smeDeliberaChart" style="flex:1; width:100%; height:650px; max-width:100%; margin-top:20px;"></canvas>
	      <div style="position:absolute; top:12px; right:12px; padding:4px; font-size:0.8em; line-height:1;">
		      ${renderKPITable(taskDataSMEs)}
	      </div>
      </div>
		</div>
    <div>
      <div class="card" style="position:relative; height:380px; display:flex; flex-direction:column; justify-content:center;">
	      <h3 style="margin:0; margin-top:-10px;">Delibere nuovo fido Retail 2026</h3>
	      <canvas id="retailDeliberaChart" style="flex:1; width:100%; height:650px; max-width:100%; margin-top:20px;"></canvas>
	      <div style="position:absolute; top:12px; right:12px; padding:4px; font-size:0.8em; line-height:1;">
		      ${renderKPITable(taskDataRetail)}
	      </div>
      </div>
		</div>
  </div>

	<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
    <div>
      <div class="card" style="position:relative; height:380px; display:flex; flex-direction:column; justify-content:center;">
	      <h3 style="margin:0; margin-top:-10px;">Delibere Revisioni/Proroghe/Variazioni 2026</h3>
	      <canvas id="revisioniDeliberaChart" style="flex:1; width:100%; height:650px; max-width:100%; margin-top:20px;"></canvas>
	      <div style="position:absolute; top:12px; right:12px; padding:4px; font-size:0.8em; line-height:1;">
		      ${renderKPITable(taskDataRevisioni)}
	      </div>
      </div>
		</div>
    <div>
      <div class="card" style="position:relative; height:380px; display:flex; flex-direction:column; justify-content:center;">
	      <h3 style="margin:0; margin-top:-10px;">Delibere Carte di Credito 2026</h3>
	      <canvas id="carteDeliberaChart" style="flex:1; width:100%; height:650px; max-width:100%; margin-top:20px;"></canvas>
	      <div style="position:absolute; top:12px; right:12px; padding:4px; font-size:0.8em; line-height:1;">
		      ${renderKPITable(taskDataCarte)}
	      </div>
      </div>
		</div>
  </div>

  <div class="section-title">Statistiche generali e approfondimenti su pratiche 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Pratiche totali</div><div class="val">${fmtInt.format(total)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">In lavorazione</div><div class="val">${fmtInt.format(inLavRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Completate</div><div class="val">${fmtInt.format(completedRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorni)} gg</div></div>
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
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Tempo medio in coda</div><div class="val">${fmtDec.format(avgGiorniCoda)} gg</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Operatori coinvolti</div><div class="val">${opStats.length}</div></div>
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
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Completate</div><div class="val">${fmtInt.format(completedRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.pos||'#1c8a45'}"><div class="lbl">Delibere positive</div><div class="val">${fmtInt.format(positiva)}</div><div class="sub">${fmtDec.format(pctPositiva)}% delle completate</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Delibere negative</div><div class="val">${fmtInt.format(negativa)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorniCompleted)} gg</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card">
        <h3>Completate per mese: positive vs negative</h3>
        <p class="card-sub">conteggio mensile su data delibera, solo pratiche completate</p>
        <canvas id="crDeliberaTrendChart"></canvas>
      </div>
      <div class="card">
        <h3>Tipo delibera</h3>
        <p class="card-sub">solo pratiche completate</p>
        <canvas id="crTipoChart"></canvas>
      </div>
    </div>
  `;

// Calcola media generale SME
  const smeTotalAvg = smeMonthsData.length > 0 
    ? smeMonthsData.reduce((sum, d) => sum + (d.pos + d.neg), 0) / smeMonthsData.length 
    : 0;
// Calcola media generale Retail
  const retailTotalAvg = retailMonthsData.length > 0 
    ? retailMonthsData.reduce((sum, d) => sum + (d.pos + d.neg), 0) / retailMonthsData.length 
    : 0;
// Calcola media generale Revisioni
  const revisioniTotalAvg = revisioniMonthsData.length > 0 
    ? revisioniMonthsData.reduce((sum, d) => sum + (d.pos + d.neg), 0) / revisioniMonthsData.length 
    : 0;
// Calcola media generale Revisioni
  const carteTotalAvg = carteMonthsData.length > 0 
    ? carteMonthsData.reduce((sum, d) => sum + (d.pos + d.neg), 0) / carteMonthsData.length 
    : 0;

  mkChart('smeDeliberaChart', {type:'bar', data:{labels:smeMonthsData.map(d=>d.month), datasets:[{label:'Positive', data:smeMonthsData.map(d=>d.pos), backgroundColor:PALETTE.accent}, {label:'Negative', data:smeMonthsData.map(d=>d.neg), backgroundColor:PALETTE.danger}, {label:'Media Mensile', data:Array(smeMonthsData.length).fill(carteTotalAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(smeMonthsData.length).fill(72-carteTotalAvg), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]}, 
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:true}}}});
   
  mkChart('retailDeliberaChart', {type:'bar', data:{labels:retailMonthsData.map(d=>d.month), datasets:[{label:'Positive', data:retailMonthsData.map(d=>d.pos), backgroundColor:PALETTE.accent}, {label:'Negative', data:retailMonthsData.map(d=>d.neg), backgroundColor:PALETTE.danger}, {label:'Media Mensile', data:Array(retailMonthsData.length).fill(retailTotalAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(retailMonthsData.length).fill(100-retailTotalAvg), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]}, 
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:true}}}});

  mkChart('revisioniDeliberaChart', {type:'bar', data:{labels:revisioniMonthsData.map(d=>d.month), datasets:[{label:'Positive', data:revisioniMonthsData.map(d=>d.pos), backgroundColor:PALETTE.accent}, {label:'Negative', data:revisioniMonthsData.map(d=>d.neg), backgroundColor:PALETTE.danger}, {label:'Media Mensile', data:Array(revisioniMonthsData.length).fill(revisioniTotalAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(revisioniMonthsData.length).fill(231-revisioniTotalAvg), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]}, 
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:true}}}});
  
  mkChart('carteDeliberaChart', {type:'bar', data:{labels:carteMonthsData.map(d=>d.month), datasets:[{label:'Positive', data:carteMonthsData.map(d=>d.pos), backgroundColor:PALETTE.accent}, {label:'Negative', data:carteMonthsData.map(d=>d.neg), backgroundColor:PALETTE.danger}, {label:'Media Mensile', data:Array(carteMonthsData.length).fill(carteTotalAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(carteMonthsData.length).fill(25-carteTotalAvg), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]}, 
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:true}}}});

  mkChart('crOrganoChart', {type:'bar', data:{labels:byOrgano.map(x=>x[0]), datasets:[{label:'Pratiche', data:byOrgano.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});

  const organoTempoSorted = mapToSorted(avgGiorniByOrgano);
  mkChart('crOrganoTempoChart', {type:'bar', data:{labels:organoTempoSorted.map(x=>x[0]), datasets:[{label:'Giorni medi', data:organoTempoSorted.map(x=>Number(x[1].toFixed(1))), backgroundColor:PALETTE.warn}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});

  mkChart('crScopoChart', {type:'bar', data:{labels:byScopo.map(x=>x[0]), datasets:[{label:'Pratiche', data:byScopo.map(x=>x[1]), backgroundColor:PALETTE.navy}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('crTempiChart', {type:'bar', data:{labels:bucketLabels, datasets:[{label:'Pratiche', data:bucketCounts, backgroundColor: bucketLabels.map((_,i)=> CHART_SERIES[i])}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('crStatoInLavChart', {type:'pie', data:{labels:byStatoInLav.map(x=>x[0]), datasets:[{data:byStatoInLav.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('crDeliberaTrendChart', {type:'bar', data:{labels:deliberaMonths, datasets:[
      {label:'Positive', data:deliberaMonths.map(m=>byMonthDelibera.get(m).pos), backgroundColor:'#1c8a45'},
      {label:'Negative', data:deliberaMonths.map(m=>byMonthDelibera.get(m).danger), backgroundColor:PALETTE.danger},
      {label:'Altro', data:deliberaMonths.map(m=>byMonthDelibera.get(m).altro), backgroundColor:PALETTE.text}
    ]},
    options:{plugins:{legend:{position:'bottom', labels:{boxWidth:10,font:{size:10.5}}}}, scales:{x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{color:PALETTE.grid}}}}});

  mkChart('crTipoChart', {type:'doughnut', data:{labels:byTipoDeliberaCompleted.map(x=>x[0]), datasets:[{data:byTipoDeliberaCompleted.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
}

/* ============================================================
   PANEL: CREDITO SPECIALE
   ============================================================ */
function renderCreditoSpeciale(panel, s){
  const ALLOWED_TIPO_ISTRUTTORIA_V2 = [
    "Corporate Investment Banking",
  ];
  
  const rows = s.rows.filter(r=> ALLOWED_TIPO_ISTRUTTORIA_V2.includes(r.des_tipo_istruttoria));
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

  // ---- dati mensili completate ----
  const monthKeyOf = (r)=>{
    const d = toDate(r.dta_delibera) || toDate(r.dta_istruttoria);
    return d ? monthKey(d) : null;
  };
  const byMonthDelibera = new Map();
  completedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    if(!byMonthDelibera.has(k)) byMonthDelibera.set(k, {totale:0});
    byMonthDelibera.get(k).totale++;
  });
  const deliberaMonths = [...byMonthDelibera.keys()].sort();
  const deliberaMonthsData = deliberaMonths.map(m => ({
    month: m,
    totale: byMonthDelibera.get(m).totale
  }));

  // ---- media mensile ----
  const specialeMonthlyAvg = deliberaMonthsData.length > 0
    ? deliberaMonthsData.reduce((sum, d) => sum + d.totale, 0) / MONTHS
    : 0;

  // ---- task KPI ----
  const tasksCreditoSpeciale = getTasksForSheet(s.sheetName);

  const specialeTask = tasksCreditoSpeciale[0];
  if (specialeTask) {
    taskDataSpeciale = {
      pezzi: specialeTask.pezzi,
      fte_teorico: specialeTask.fte_teorico,
      pezzi_actual: completedRows.length / MONTHS,
      fte_actual: (completedRows.length / MONTHS * specialeTask.tempi) / HOURS_PER_MONTH
    };
  }

  panel.innerHTML = structHeaderHtml(s, 'Credito Speciale - Lending') + `
    <div class="card" style="margin-bottom:16px; position:relative;">
      <h3 style="margin:0 0 4px;">Delibere BU Special Situations, FS, Lombard 2026</h3>
      <p class="card-sub">pratiche completate per mese, delibere 100% positive</p>
      <div style="position:absolute; top:12px; right:12px;">
        ${renderKPITable(taskDataSpeciale)}
      </div>
      <canvas id="specialeDeliberaChart" style="width:100%; max-height:280px;"></canvas>
    </div>

    <div class="section-title">Statistiche generali e approfondimenti su pratiche 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Pratiche totali</div><div class="val">${fmtInt.format(total)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">In lavorazione</div><div class="val">${fmtInt.format(inLavRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Completate</div><div class="val">${fmtInt.format(completedRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorni)} gg</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Pratiche per organo deliberante</h3><canvas id="crOrganoChart2"></canvas></div>
      <div class="card"><h3>Tempo medio lavorazione per organo</h3><p class="card-sub">giorni, nro_giorni_lavorazione</p><canvas id="crOrganoTempoChart2"></canvas></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Scopo pratica (top 12)</h3><canvas id="crScopoChart2"></canvas></div>
      <div class="card"><h3>Distribuzione tempi di lavorazione</h3><p class="card-sub">fasce giorni lavorazione, tutte le pratiche</p><canvas id="crTempiChart2"></canvas></div>
    </div>

    <div class="section-title">Pratiche in lavorazione <span class="count-badge">${fmtInt.format(inLavRows.length)} pratiche</span></div>
    <p class="section-desc">Pratiche non ancora completate (stato istruttoria diverso da "Completa").</p>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Pratiche in lavorazione</div><div class="val">${fmtInt.format(inLavRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorniInLav)} gg</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Tempo medio in coda</div><div class="val">${fmtDec.format(avgGiorniCoda)} gg</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Operatori coinvolti</div><div class="val">${opStats.length}</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Stato istruttoria (in lavorazione)</h3><p class="card-sub">dettaglio stati non completati</p><canvas id="crStatoInLavChart2"></canvas></div>
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
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Completate</div><div class="val">${fmtInt.format(completedRows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.pos||'#1c8a45'}"><div class="lbl">Delibere positive</div><div class="val">${fmtInt.format(positiva)}</div><div class="sub">${fmtDec.format(pctPositiva)}% delle completate</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Delibere negative</div><div class="val">${fmtInt.format(negativa)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio lavorazione</div><div class="val">${fmtDec.format(avgGiorniCompleted)} gg</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card">
        <h3>Completate per mese: positive vs negative</h3>
        <p class="card-sub">conteggio mensile su data delibera, solo pratiche completate</p>
        <canvas id="crDeliberaTrendChart2"></canvas>
      </div>
      <div class="card">
        <h3>Tipo delibera</h3>
        <p class="card-sub">solo pratiche completate</p>
        <canvas id="crTipoChart2"></canvas>
      </div>
    </div>
  `;

  // ---- grafico mensile principale ----
  mkChart('specialeDeliberaChart', {type:'bar', data:{labels:deliberaMonthsData.map(d=>d.month), datasets:[{label:'Pratiche completate', data:deliberaMonthsData.map(d=>d.totale), backgroundColor:PALETTE.accent}, {label:'Media mensile', data:Array(deliberaMonthsData.length).fill(specialeMonthlyAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderDash:[0]},
    {label:'Target', data:Array(deliberaMonthsData.length).fill(5-specialeMonthlyAvg), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>chart.data.datasets.map((d,i)=>({text:d.label, fillStyle:d.type==='line'?'transparent':d.backgroundColor, strokeStyle:d.type==='line'?d.borderColor:'transparent', lineWidth:d.type==='line'?2:0, pointStyle:d.type==='line'?'line':'rect', hidden:!chart.isDatasetVisible(i), index:i}))}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{color:PALETTE.grid}, stacked:true}}}});

  mkChart('crOrganoChart2', {type:'bar', data:{labels:byOrgano.map(x=>x[0]), datasets:[{label:'Pratiche', data:byOrgano.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});

  const organoTempoSorted = mapToSorted(avgGiorniByOrgano);
  mkChart('crOrganoTempoChart2', {type:'bar', data:{labels:organoTempoSorted.map(x=>x[0]), datasets:[{label:'Giorni medi', data:organoTempoSorted.map(x=>Number(x[1].toFixed(1))), backgroundColor:PALETTE.warn}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}}}});

  mkChart('crScopoChart2', {type:'bar', data:{labels:byScopo.map(x=>x[0]), datasets:[{label:'Pratiche', data:byScopo.map(x=>x[1]), backgroundColor:PALETTE.navy}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('crTempiChart2', {type:'bar', data:{labels:bucketLabels, datasets:[{label:'Pratiche', data:bucketCounts, backgroundColor: bucketLabels.map((_,i)=> CHART_SERIES[i])}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('crStatoInLavChart2', {type:'pie', data:{labels:byStatoInLav.map(x=>x[0]), datasets:[{data:byStatoInLav.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  // byMonthDelibera ora ha solo totale, ricostruiamo per il trend
  const byMonthDeliberaFull = new Map();
  completedRows.forEach(r=>{
    const k = monthKeyOf(r);
    if(!k) return;
    const tipo = String(r.des_tipo_delibera||'').toLowerCase();
    if(!byMonthDeliberaFull.has(k)) byMonthDeliberaFull.set(k, {pos:0, neg:0, altro:0});
    const m = byMonthDeliberaFull.get(k);
    if(tipo.includes('positiv')) m.pos++;
    else if(tipo.includes('negativ')) m.neg++;
    else m.altro++;
  });
  const deliberaMonthsFull = [...byMonthDeliberaFull.keys()].sort();

  mkChart('crDeliberaTrendChart2', {type:'bar', data:{labels:deliberaMonthsFull, datasets:[
      {label:'Positive', data:deliberaMonthsFull.map(m=>byMonthDeliberaFull.get(m).pos), backgroundColor:'#1c8a45'},
      {label:'Negative', data:deliberaMonthsFull.map(m=>byMonthDeliberaFull.get(m).neg), backgroundColor:PALETTE.danger},
      {label:'Altro',    data:deliberaMonthsFull.map(m=>byMonthDeliberaFull.get(m).altro), backgroundColor:PALETTE.text}
    ]},
    options:{plugins:{legend:{position:'bottom', labels:{boxWidth:10,font:{size:10.5}}}}, scales:{x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{color:PALETTE.grid}}}}});

  mkChart('crTipoChart2', {type:'doughnut', data:{labels:byTipoDeliberaCompleted.map(x=>x[0]), datasets:[{data:byTipoDeliberaCompleted.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
}


/* ============================================================
   PANEL: CONTRATTI E PERFEZIONAMENTI CREDITO ORDINARIO
   ============================================================ */
function renderPerfezionamenti(panel, s){
  const rows = s.rows;

  // ============================================================
  // PERFEZIONAMENTI 2026
  // ============================================================

  const perfezionati2026 = (() => {
    const seen = new Set();
    return rows.filter(r => {
      const d = toDate(r.dta_operativa);
      if (!d || d.getFullYear() !== 2026) return false;
      const id = r.cod_identif_fido;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  })();

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

    // ============================================================
  // GRUPPI BU PERSONALIZZATI
  // ============================================================

  const BU_GROUPS = {
    corporate: [
      'Finanza Strutturata',
      'Special Situations',
      'Turnaround & Strategic Finance'
    ],
    retail: [
      'Retail Banking'
    ],
  };

  const buildBUGroup = (buList) => {
    const filtered = perfezionati2026.filter(r => buList.includes(r.des_business_unit));
    const byMonth = {};
    filtered.forEach(r => {
      const k = monthKey(toDate(r.dta_operativa));
      if (!k) return;
      byMonth[k] = (byMonth[k] || 0) + 1;
    });
    const monthsArr = Object.keys(byMonth).sort();
    const totale = filtered.length;
    const monthlyAvg = monthsArr.length ? totale / monthsArr.length : 0;
    const monthsData = monthsArr.map(m => ({month: m, totale: byMonth[m]}));
    return {filtered, byMonth, monthsArr, monthsData, totale, monthlyAvg};
  };

  const corporateGroup = buildBUGroup(BU_GROUPS.corporate);
  const retailGroup    = buildBUGroup(BU_GROUPS.retail);

  const DIPENDENTI = {
    dipendenti: [
      'MUTUO IPOTECARIO A DIP. CHERRY BANK',
      'APERT. CRED. IN C/C A DIP. CHERRY BANK'
    ],
  };
  const buildDIPGroup = (buList) => {
    const filtered = perfezionati2026.filter(r => buList.includes(r.des_forma_tecnica));
    const byMonth = {};
    filtered.forEach(r => {
      const k = monthKey(toDate(r.dta_operativa));
      if (!k) return;
      byMonth[k] = (byMonth[k] || 0) + 1;
    });
    const monthsArr = Object.keys(byMonth).sort();
    const totale = filtered.length;
    const monthlyAvg = monthsArr.length ? totale / monthsArr.length : 0;
    const monthsData = monthsArr.map(m => ({month: m, totale: byMonth[m]}));
    return {filtered, byMonth, monthsArr, monthsData, totale, monthlyAvg};
  };

  const DIPGroup    = buildDIPGroup(DIPENDENTI.dipendenti);

  // ---- task KPI ----
  const tasksPerfezionamenti = getTasksForSheet(s.sheetName);

  const perfezionamentiTask1 = tasksPerfezionamenti[0];
  if (perfezionamentiTask1) {
    taskDataPerfezionamenti1 = {
      pezzi: perfezionamentiTask1.pezzi,
      fte_teorico: perfezionamentiTask1.fte_teorico,
      pezzi_actual: corporateGroup.totale / MONTHS,
      fte_actual: (corporateGroup.totale / MONTHS * perfezionamentiTask1.tempi) / HOURS_PER_MONTH
    };
  }

  const perfezionamentiTask2 = tasksPerfezionamenti[1];
  if (perfezionamentiTask2) {
    taskDataPerfezionamenti2 = {
      pezzi: perfezionamentiTask2.pezzi,
      fte_teorico: perfezionamentiTask2.fte_teorico,
      pezzi_actual: retailGroup.totale / MONTHS,
      fte_actual: (retailGroup.totale / MONTHS * perfezionamentiTask2.tempi) / HOURS_PER_MONTH
    };
  }

  const perfezionamentiTaskDipendenti = tasksPerfezionamenti[7];
  if (perfezionamentiTaskDipendenti) {
    taskDataPerfezionamentiDip = {
      pezzi: perfezionamentiTaskDipendenti.pezzi,
      fte_teorico: perfezionamentiTaskDipendenti.fte_teorico,
      pezzi_actual: DIPGroup.totale / MONTHS,
      fte_actual: (DIPGroup.totale / MONTHS * perfezionamentiTaskDipendenti.tempi) / HOURS_PER_MONTH
    };
  }

  panel.innerHTML = structHeaderHtml(s, 'Contratti e perfezionamenti credito ordinario - Lending') + `

  <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
    <div>
      <div class="card" style="position:relative; height:380px; display:flex; flex-direction:column; justify-content:center;">
        <h3 style="margin:0; margin-top:-10px;">Perfezionamento e erogazione Corporate 2026</h3>
        <canvas id="CorporateChart" style="flex:1; width:100%; height:650px; max-width:100%; margin-top:20px;"></canvas>
        <div style="position:absolute; top:12px; right:12px; padding:4px; font-size:0.8em; line-height:1;">
          ${renderKPITable(taskDataPerfezionamenti1)}
        </div>
      </div>
    </div>
    <div>
      <div class="card" style="position:relative; height:380px; display:flex; flex-direction:column; justify-content:center;">
        <h3 style="margin:0; margin-top:-10px;">Perfezionamento e erogazione Retail 2026, data quality check necessario</h3>
        <canvas id="RetailChart" style="flex:1; width:100%; height:650px; max-width:100%; margin-top:20px;"></canvas>
        <div style="position:absolute; top:12px; right:12px; padding:4px; font-size:0.8em; line-height:1;">
          ${renderKPITable(taskDataPerfezionamenti2)}
        </div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px; position:relative;">
    <h3 style="margin:0 0 4px;">Erogazioni mutui e fidi dipendenti 2026</h3>
    <p class="card-sub">pratiche completate per mese</p>
    <div style="position:absolute; top:12px; right:12px;">
      ${renderKPITable(taskDataPerfezionamentiDip)}
    </div>
    <canvas id="DipChart" style="width:100%; max-height:280px;"></canvas>
  </div>

    <div class="section-title">Approfondimenti su pratiche completate perfezionate nel 2026</div>

    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Pratiche perfezionate 2026</div>
        <div class="val">${fmtInt.format(perfezionati2026.length)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Business unit</div>
        <div class="val">${fmtInt.format(buArray.length)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.warn}">
        <div class="lbl">Tempo medio lavorazione</div>
        <div class="val">${fmtDec.format(avgGiorniOverall)} gg</div>
        <div class="sub">delibera → operativa</div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Perfezionamenti per mese e business unit</h3>
        <p class="card-sub">dta_decorrenza 2026, suddiviso per des_business_unit</p>
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

  mkChart('CorporateChart', {type:'bar', data:{labels:corporateGroup.monthsData.map(d=>d.month), datasets:[{label:'Pratiche', data:corporateGroup.monthsData.map(d=>d.totale), backgroundColor:PALETTE.accent}, {label:'Media Mensile', data:Array(corporateGroup.monthsData.length).fill(corporateGroup.monthlyAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(corporateGroup.monthsData.length).fill(46), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:false}}}});

  mkChart('RetailChart', {type:'bar', data:{labels:retailGroup.monthsData.map(d=>d.month), datasets:[{label:'Pratiche', data:retailGroup.monthsData.map(d=>d.totale), backgroundColor:PALETTE.accent}, {label:'Media Mensile', data:Array(retailGroup.monthsData.length).fill(retailGroup.monthlyAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(retailGroup.monthsData.length).fill(100), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:false}}}});

  mkChart('DipChart', {type:'bar', data:{labels:DIPGroup.monthsData.map(d=>d.month), datasets:[{label:'Pratiche', data:DIPGroup.monthsData.map(d=>d.totale), backgroundColor:PALETTE.accent}, {label:'Media Mensile', data:Array(DIPGroup.monthsData.length).fill(DIPGroup.monthlyAvg), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(DIPGroup.monthsData.length).fill(10), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:false}}}});
 
  const datasetsPerfezionati = buArray.map(bu => ({
    label: bu,
    data: months.map(m => perfByMonthBU[m]?.[bu] || 0),
    backgroundColor: buColorMap[bu],
    borderColor: buColorMap[bu],
    borderWidth: 0
  }));

  mkChart('crPerfezionatiChart', {type:'bar', data:{labels:months, datasets:datasetsPerfezionati},
    options:{scales:{x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{color:PALETTE.grid}}}, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('crGiorniDelibOpChart', {type:'line', data:{labels:months, datasets:[{label:'Giorni medi', data:months.map(m=>{const val=avgGiorniByMonth[m]; return val?Number(val.toFixed(1)):0;}),
    borderColor:PALETTE.warn, backgroundColor:'rgba(184,159,132,0.1)', tension:0.4, fill:true, pointRadius:4, pointBackgroundColor:PALETTE.warn}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('crBuChart', {type:'bar', data:{labels:byBU.map(x=>x[0]), datasets:[{label:'Pratiche', data:byBU.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});
}


/* ============================================================
   PANEL: FACTORING
   ============================================================ */
const FACTORING_ID = '10004100067100080';

function renderFactoring(panel, s){

  const cedenti = STATE.domainSheets.find(s=>s.type==='factoring_cedenti');
  const debitori = STATE.domainSheets.find(s=>s.type==='factoring_debitori');

  const cedentiRows = cedenti ? cedenti.rows : [];
  const debitoriRows = debitori ? debitori.rows : [];

  // ============================================================
  // AGGREGAZIONI: PRATICHE (COUNT NDG)
  // ============================================================

  // Estrai dimensioni uniche
  const filialiSet = new Set(cedentiRows.map(r => r['filiale']).filter(Boolean));
  const filialiArray = Array.from(filialiSet).sort();
  const countNdg = (arr) => new Set(arr.map(r => r['ndg']).filter(Boolean)).size;
  const countNdgDebitori = (arr) => new Set(arr.map(r => r['ndg_debitore']).filter(Boolean)).size;

  // ============================================================
  // CEDENTI
  // ============================================================
  
  const totalPraticheCedenti = countNdg(cedentiRows);
  const pratichePerMeseCedenti = {};
  const pratichePerFilialeCedenti = mapToSorted(countBy(cedentiRows, 'filiale'));

  // Pratiche per mese
  cedentiRows.forEach(r => {
    const d = toDate(r['data prima stipula']);
    const k = monthKey(d);
    pratichePerMeseCedenti[k] = (pratichePerMeseCedenti[k] || 0) + 1;
  });

  // ============================================================
  // AGGREGAZIONI: ACCORDATO (SUM)
  // ============================================================

  const sumAccordato = (arr) => arr.reduce((sum, r) => sum + (parseFloat(r['accordato']) || 0), 0);
  const sumImpiego = (arr) => arr.reduce((sum, r) => sum + (parseFloat(r['impiego']) || 0), 0);
  const sumTurnover = (arr) => arr.reduce((sum, r) => sum + (parseFloat(r['turnover anno corrente']) || 0), 0);

  const accordatoTotaleCedenti = sumAccordato(cedentiRows);
  const accordatoMedioCedenti = totalPraticheCedenti ? accordatoTotaleCedenti / totalPraticheCedenti : 0;
  
  const accordatoPerMeseCedenti = {};
  const accordatoPerFilialeCedenti = {};

  cedentiRows.forEach(r => {
    const d = toDate(r['data prima stipula']);
    const k = monthKey(d);
    const importo = parseFloat(r['accordato']) || 0;
    
    accordatoPerMeseCedenti[k] = (accordatoPerMeseCedenti[k] || 0) + importo;
    accordatoPerFilialeCedenti[r['filiale']] = (accordatoPerFilialeCedenti[r['filiale']] || 0) + importo;
  });

  // ============================================================
  // AGGREGAZIONI: IMPIEGO E TURNOVER
  // ============================================================

  const impiegoTotaleCedenti = sumImpiego(cedentiRows);
  const impiegoMedioCedenti = totalPraticheCedenti ? impiegoTotaleCedenti / totalPraticheCedenti : 0;
  
  const turnoverTotale = sumTurnover(cedentiRows);

  // Union di tutti i mesi
  const monthsCedenti = [...new Set([
    ...Object.keys(pratichePerMeseCedenti),
    ...Object.keys(accordatoPerMeseCedenti)
  ])].sort();

  // ============================================================
  // DEBITORI
  // ============================================================

  const totalDebitori = countNdgDebitori(debitoriRows);

  // ============================================================
  // AGGREGAZIONI: ACCORDATO (SUM)
  // ============================================================

  const debitoriSolvendo = debitoriRows.filter(r => (parseFloat(r['accordato_pro_solvendo']) || 0) > 0);
  const debitoriSoluto = debitoriRows.filter(r => (parseFloat(r['accordato_pro_soluto']) || 0) > 0);
  const totalPraticheSolvendo = countNdgDebitori(debitoriSolvendo);
  const totalPraticheSoluto = countNdgDebitori(debitoriSoluto);

  const sumAccordatoSolvendo = (arr) => arr.reduce((sum, r) => sum + (parseFloat(r['accordato_pro_solvendo']) || 0), 0);
  const sumAccordatoSoluto = (arr) => arr.reduce((sum, r) => sum + (parseFloat(r['accordato_pro_soluto']) || 0), 0);

  const accordatoTotaleSolvendo = sumAccordatoSolvendo(debitoriSolvendo);
  const accordatoMedioSolvendo = totalPraticheSolvendo ? accordatoTotaleSolvendo / totalPraticheSolvendo : 0;
  const accordatoTotaleSoluto = sumAccordatoSoluto(debitoriSoluto);
  const accordatoMedioSoluto = totalPraticheSoluto ? accordatoTotaleSoluto / totalPraticheSoluto : 0;
  
  const accordatoPerMeseSolvendo = {};
  const accordatoPerMeseSoluto = {};

  debitoriRows.forEach(r => {
    const d = toDate(r['data_delibera']);
    const k = monthKey(d);
    const importoSolvendo = parseFloat(r['accordato_pro_solvendo']) || 0;
    const importoSoluto = parseFloat(r['accordato_pro_soluto']) || 0;
  
    accordatoPerMeseSolvendo[k] = (accordatoPerMeseSolvendo[k] || 0) + importoSolvendo;
    accordatoPerMeseSoluto[k] = (accordatoPerMeseSoluto[k] || 0) + importoSoluto;    
  });

  // ============================================================
  // CHART: DISTRIBUZIONE NDG PER PRODOTTO (DEBITORI)
  // ============================================================
  const ndgPerProdotto = {};
  debitoriRows.forEach(r => {
    const ndg = r['ndg_debitore'];
    const prodotto = r['descrizione_prodotto'];
    if (ndg && prodotto) {
      if (!ndgPerProdotto[prodotto]) {
        ndgPerProdotto[prodotto] = new Set();
      }
      ndgPerProdotto[prodotto].add(ndg);
    }
  });
  // Conta NDG per prodotto
  const conteoNdgPerProdotto = {};
  Object.entries(ndgPerProdotto).forEach(([prodotto, ndgs]) => {
    conteoNdgPerProdotto[prodotto] = ndgs.size;
  });
  // ============================================================
  // FILTRO PRODOTTI VISIBILI
  // ============================================================
  const PRODOTTI_VISIBILI = [
    'factoring ordinario prosolvendo',
    'factoring ordinario prosoluto',
    'anticipo crediti futuri',
    'sola gestione pro soluto',
    'export factoring'
  ];

  const conteoNdgPerProdottoSorted = Object.entries(conteoNdgPerProdotto)
    .sort((a, b) => b[1] - a[1]);

  const visibili = conteoNdgPerProdottoSorted.filter(([prod]) => 
    PRODOTTI_VISIBILI.some(p => prod.toLowerCase().trim() === p.toLowerCase().trim()));
  const altri = conteoNdgPerProdottoSorted.filter(([prod]) => 
    !PRODOTTI_VISIBILI.some(p => prod.toLowerCase().trim() === p.toLowerCase().trim()));

  const totalAltri = altri.reduce((sum, [, val]) => sum + val, 0);
  const datiFinaliProdotti = visibili.map(([prod, val]) => [prod.toUpperCase(), val]);
  if (totalAltri > 0) {
    datiFinaliProdotti.push(['ALTRI PRODOTTI', totalAltri]);
  }

  // ============================================================
  // AGGREGAZIONI
  // ============================================================

  // Union di tutti i mesi
  const monthsDebitori = [...new Set([
    ...Object.keys(accordatoPerMeseSolvendo),
    ...Object.keys(accordatoPerMeseSoluto),
  ])].sort();

  // ============================================================
  // AGGREGAZIONI
  // ============================================================

  const tasksFactoring = getTasksForSheet(FACTORING_ID);

  const debitoriFactoring = tasksFactoring[0];
  if (debitoriFactoring) {
    taskDataDebitoriFactoring = {
      pezzi: debitoriFactoring.pezzi,
      fte_teorico: debitoriFactoring.fte_teorico,
      pezzi_actual: totalDebitori / debitoriFactoring.fte_teorico,
      fte_actual: totalDebitori / debitoriFactoring.pezzi
    };
  }

  const cedentiFactoring = tasksFactoring[1];
  if (cedentiFactoring) {
    taskDataCedentiFactoring = {
      pezzi: cedentiFactoring.pezzi,
      fte_teorico: cedentiFactoring.fte_teorico,
      pezzi_actual: totalPraticheCedenti / cedentiFactoring.fte_teorico,
      fte_actual: totalPraticheCedenti / cedentiFactoring.pezzi
    };
  }

  const perfezionamentiFactoring = tasksFactoring[2];
  if (perfezionamentiFactoring) {
    taskDataPerfezionamentiFactoring = {
      pezzi: perfezionamentiFactoring.pezzi,
      fte_teorico: perfezionamentiFactoring.fte_teorico,
      pezzi_actual: totalPraticheCedenti / MONTHS,
      fte_actual: (totalPraticheCedenti / MONTHS * perfezionamentiFactoring.tempi) / HOURS_PER_MONTH
    };
  }
  
  // ============================================================
  // RENDER HTML
  // ============================================================
  const factoringDimRow = findDimRow(FACTORING_ID);
  panel.innerHTML = structHeaderHtml({sheetName: FACTORING_ID, dimRow: factoringDimRow}, 'Factoring - Lending') + `
    <div style="display:flex; gap:16px; margin-bottom:16px; align-items:stretch;">
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div class="card" style="padding:28px 24px; display:inline-block; flex:1;">
          <h3 style="margin:0 0 16px 0;">Gestione debitori factoring al 31/07/2026</h3>
          ${renderKPITableFactoring(taskDataDebitoriFactoring)}
        </div>
        <div class="card" style="padding:28px 24px; display:inline-block; flex:1;">
          <h3 style="margin:0 0 16px 0;">Gestione cedenti factoring al 31/07/2026</h3>
          ${renderKPITableFactoring(taskDataCedentiFactoring)}
        </div>
      </div>
      <div class="card" style="flex:1; position:relative; display:flex; flex-direction:column; justify-content:flex-end;">
        <h3 style="margin:0 0 4px;">Perfezionamenti Factoring 2026, errore nel calcolo FTE Teorico da excel</h3>
        <p class="card-sub">pratiche completate per mese</p>
        <div style="position:absolute; top:12px; right:12px;">
          ${renderKPITable(taskDataPerfezionamentiFactoring)}
        </div>
        <canvas id="PerfezionamentiChart" style="width:100%; max-height:240px;"></canvas>
      </div>
    </div>
    
    <!-- ========== CEDENTI ========== -->
    <div class="section-title">Riepilogo e approfondimenti nuove pratiche factoring cedenti nel periodo 2026</div>
    
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Pratiche stipulate</div>
        <div class="val">${fmtInt.format(totalPraticheCedenti)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.pos}">
        <div class="lbl">Accordato totale</div>
        <div class="val">${fmtCurrency.format(accordatoTotaleCedenti)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Impiego totale</div>
        <div class="val">${fmtCurrency.format(impiegoTotaleCedenti)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.warning}">
        <div class="lbl">Turnover generato</div>
        <div class="val">${fmtCurrency.format(turnoverTotale)}</div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Nuove pratiche per mese, ripetizione KPI, si toglie in un secondo</h3>
        <p class="card-sub">COUNT(ndg) per mese</p>
        <canvas id="npPratichePerMeseChart"></canvas>
      </div>
      <div class="card">
        <h3>Nuovo accordato per mese</h3>
        <p class="card-sub">SUM(accordato) per mese</p>
        <canvas id="npAccordatoPerMeseChart"></canvas>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Pratiche per filiale</h3>
        <p class="card-sub">COUNT(ndg)</p>
        <canvas id="npPraticheFiliale"></canvas>
      </div>
      <div class="card">
        <h3>Accordato per filiale</h3>
        <p class="card-sub">SUM(accordato)</p>
        <canvas id="npAccordatoFiliale"></canvas>
      </div>
    </div>

    <!-- ========== DEBITORI ========== -->
    <div class="section-title">Riepilogo e approfondimenti nuove pratiche factoring debitori nel periodo 2026</div>
    
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Totale debitori</div>
        <div class="val">${fmtInt.format(totalDebitori)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.pos}">
        <div class="lbl">Accordato medio per debitore pro solvendo</div>
        <div class="val">${fmtCurrency.format(accordatoMedioSolvendo)}</div>
      </div>
      <div class="kpi" style="--kc:${PALETTE.info}">
        <div class="lbl">Accordato medio per debitore pro soluto</div>
        <div class="val">${fmtCurrency.format(accordatoMedioSoluto)}</div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Accordato per mese</h3>
        <p class="card-sub">SUM(accordato solvendo vs soluto) per mese</p>
        <canvas id="dbAccordatoPerMeseChart"></canvas>
      </div>
      <div class="card">
        <h3>Distribuzione prodotti</h3>
        <p class="card-sub">descrizione_prodotto</p>
        <canvas id="dbNdgPerProdotto"></canvas>
      </div>
    </div>
  `;

  mkChart('PerfezionamentiChart', {type:'bar', data:{labels:monthsCedenti, datasets: [{ label: 'Pratiche', data: monthsCedenti.map(m => pratichePerMeseCedenti[m] || 0), backgroundColor:PALETTE.accent}, {label:'Media Mensile', data:Array(monthsCedenti.length).fill(totalPraticheCedenti/MONTHS), type:'line', borderColor:PALETTE.navy, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[0]}}, {label:'Target', data:Array(monthsCedenti.length).fill(26), type:'line', borderColor:PALETTE.grey, borderWidth:2, fill:false, pointRadius:0, borderSkipped:false, segment:{borderDash:()=>[5,5]}}]},
    options:{indexAxis:'x', plugins:{legend:{display:true, position:'bottom', labels:{usePointStyle:true, generateLabels:(chart)=>{return chart.data.datasets.map((d,i)=>{const isLine = d.type === 'line'; return {text:d.label, fillStyle:isLine ? 'transparent' : d.backgroundColor, strokeStyle:isLine ? d.borderColor : 'transparent', lineWidth:isLine ? 2 : 0, pointStyle:isLine ? 'line' : 'rect', hidden:!chart.isDatasetVisible(i), index:i};})}}}}, scales:{x:{grid:{color:PALETTE.grid}, stacked:true}, y:{grid:{display:true, color:PALETTE.grid}, ticks:{font:{size:12}}, stacked:false}}}});
  
  // ============================================================
  // CHART: PRATICHE PER MESE (CEDENTI)
  // ============================================================

  mkChart('npPratichePerMeseChart', {type: 'bar', data: { labels: monthsCedenti, datasets: [{ label: 'Pratiche', data: monthsCedenti.map(m => pratichePerMeseCedenti[m] || 0), backgroundColor: PALETTE.navy, borderColor: PALETTE.info, borderWidth: 0 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: PALETTE.grid } } } }});

  mkChart('npAccordatoPerMeseChart', {type: 'line', data: { labels: monthsCedenti, datasets: [{ label: 'Accordato', data: monthsCedenti.map(m => accordatoPerMeseCedenti[m] || 0), borderColor: PALETTE.pos, backgroundColor: 'rgba(111,146,119,0.15)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: PALETTE.pos, pointBorderColor: PALETTE.navy, pointBorderWidth: 0 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: PALETTE.grid }, ticks: { callback: v => fmtCurrency.format(v) } } } }});

  mkChart('npPraticheFiliale', {type: 'bar', data: { labels: pratichePerFilialeCedenti.map(x => x[0]), datasets: [{ label: 'Pratiche', data: pratichePerFilialeCedenti.map(x => x[1]), backgroundColor: PALETTE.pos, borderColor: PALETTE.navy, borderWidth: 0 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: PALETTE.grid } }, y: { grid: { display: false }, ticks: { font: { size: 9.5 } } } } }});

  const accordatoFilialeCedentiSorted = Object.entries(accordatoPerFilialeCedenti).sort((a, b) => b[1] - a[1]);
  mkChart('npAccordatoFiliale', {type: 'bar', data: { labels: accordatoFilialeCedentiSorted.map(x => x[0]), datasets: [{ label: 'Accordato', data: accordatoFilialeCedentiSorted.map(x => x[1]), backgroundColor: PALETTE.danger, borderColor: PALETTE.navy, borderWidth: 0 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: PALETTE.grid }, ticks: { callback: v => fmtCurrency.format(v) } }, y: { grid: { display: false }, ticks: { font: { size: 9.5 } } } } }});

  mkChart('dbAccordatoPerMeseChart', {type: 'bar', data: { labels: monthsDebitori, datasets: [{ label: 'Accordato Solvendo', data: monthsDebitori.map(m => accordatoPerMeseSolvendo[m] || 0), backgroundColor: PALETTE.pos, borderColor: PALETTE.navy, borderWidth: 0 }, { label: 'Accordato Soluto', data: monthsDebitori.map(m => accordatoPerMeseSoluto[m] || 0), backgroundColor: PALETTE.info, borderColor: PALETTE.navy, borderWidth: 0 }] },
    options: { plugins: { legend: { display: true } }, scales: { x: { grid: { display: false }, stacked: true }, y: { grid: { color: PALETTE.grid }, stacked: true, ticks: { callback: v => fmtCurrency.format(v) } } } }});

  mkChart('dbNdgPerProdotto', {type: 'bar', data: { labels: datiFinaliProdotti.map(x => x[0]), datasets: [{ label: 'NDG per Prodotto', data: datiFinaliProdotti.map(x => x[1]), backgroundColor: [PALETTE.pos, PALETTE.danger, PALETTE.warn, PALETTE.info, PALETTE.navy], borderColor: PALETTE.navy, borderWidth: 0 }] },
    options: { plugins: { legend: { display: false } } }});
}
