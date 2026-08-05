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

  <div class="section-title">Statistiche generali su pratiche 2026</div>
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

  panel.innerHTML = structHeaderHtml(s, 'Credito Speciale - Lending') + `
    <div class="section-title">Statistiche generali su pratiche 2026</div>
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

    ${renderTaskTable(getTasksForSheet(s.sheetName))}
  `;

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

  mkChart('crDeliberaTrendChart2', {type:'bar', data:{labels:deliberaMonths, datasets:[
      {label:'Positive', data:deliberaMonths.map(m=>byMonthDelibera.get(m).pos), backgroundColor:'#1c8a45'},
      {label:'Negative', data:deliberaMonths.map(m=>byMonthDelibera.get(m).danger), backgroundColor:PALETTE.danger},
      {label:'Altro', data:deliberaMonths.map(m=>byMonthDelibera.get(m).altro), backgroundColor:PALETTE.text}
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

  const perfezionati2026 = rows.filter(r => {
    const d = toDate(r.dta_decorrenza);
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
    const d = toDate(r.dta_decorrenza);
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
    const dOperativa = toDate(r.dta_decorrenza);
    
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
  
  panel.innerHTML = structHeaderHtml(s, 'Contratti e perfezionamenti credito ordinario - Lending') + `
    <div class="section-title">Pratiche completate perfezionate nel 2026</div>
    
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

    ${renderTaskTable(getTasksForSheet(s.sheetName))}
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
        borderColor: PALETTE.warn,
        backgroundColor: 'rgba(184,159,132,0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: PALETTE.warn
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
  // RENDER HTML
  // ============================================================
  const factoringDimRow = findDimRow(FACTORING_ID);
  panel.innerHTML = structHeaderHtml({sheetName: FACTORING_ID, dimRow: factoringDimRow}, 'Factoring - Lending') + `
    <!-- ========== CEDENTI ========== -->
    <div class="section-title">Riepilogo nuove pratiche factoring cedenti nel periodo 2026</div>
    
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
        <h3>Nuove pratiche per mese</h3>
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
    <div class="section-title">Riepilogo nuove pratiche factoring debitori nel periodo 2026</div>
    
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

    ${renderTaskTable(getTasksForSheet(FACTORING_ID))}
  `;

  // ============================================================
  // CHART: PRATICHE PER MESE (CEDENTI)
  // ============================================================

  mkChart('npPratichePerMeseChart', {
    type: 'bar',
    data: {
      labels: monthsCedenti,
      datasets: [{
        label: 'Pratiche',
        data: monthsCedenti.map(m => pratichePerMeseCedenti[m] || 0),
        backgroundColor: PALETTE.navy,
        borderColor: PALETTE.info,
        borderWidth: 0
      }]
    },
    options: {
      plugins: {legend: {display: false}},
      scales: {
        x: {grid: {display: false}},
        y: {grid: {color: PALETTE.grid}}
      }
    }
  });

  // ============================================================
  // CHART: ACCORDATO PER MESE (CEDENTI)
  // ============================================================

  mkChart('npAccordatoPerMeseChart', {
    type: 'line',
    data: {
      labels: monthsCedenti,
      datasets: [{
        label: 'Accordato',
        data: monthsCedenti.map(m => accordatoPerMeseCedenti[m] || 0),
        borderColor: PALETTE.pos,
        backgroundColor: 'rgba(111,146,119,0.15)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: PALETTE.pos,
        pointBorderColor: PALETTE.navy,
        pointBorderWidth: 0
      }]
    },
    options: {
      plugins: {legend: {display: false}},
      scales: {
        x: {grid: {display: false}},
        y: {grid: {color: PALETTE.grid}, ticks: {callback: v => fmtCurrency.format(v)}}
      }
    }
  });

  // ============================================================
  // CHART: PRATICHE PER FILIALE (CEDENTI)
  // ============================================================

  mkChart('npPraticheFiliale', {
    type: 'bar',
    data: {
      labels: pratichePerFilialeCedenti.map(x => x[0]),
      datasets: [{
        label: 'Pratiche',
        data: pratichePerFilialeCedenti.map(x => x[1]),
        backgroundColor: PALETTE.pos,
        borderColor: PALETTE.navy,
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {legend: {display: false}},
      scales: {
        x: {grid: {color: PALETTE.grid}},
        y: {grid: {display: false}, ticks: {font: {size: 9.5}}}
      }
    }
  });

  // ============================================================
  // CHART: ACCORDATO PER FILIALE (CEDENTI)
  // ============================================================

  const accordatoFilialeCedentiSorted = Object.entries(accordatoPerFilialeCedenti)
    .map(([k, v]) => [k, v])
    .sort((a, b) => b[1] - a[1]);

  mkChart('npAccordatoFiliale', {
    type: 'bar',
    data: {
      labels: accordatoFilialeCedentiSorted.map(x => x[0]),
      datasets: [{
        label: 'Accordato',
        data: accordatoFilialeCedentiSorted.map(x => x[1]),
        backgroundColor: PALETTE.danger,
        borderColor: PALETTE.navy,
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {legend: {display: false}},
      scales: {
        x: {grid: {color: PALETTE.grid}, ticks: {callback: v => fmtCurrency.format(v)}},
        y: {grid: {display: false}, ticks: {font: {size: 9.5}}}
      }
    }
  });

  // ============================================================
  // CHART: ACCORDATO PER MESE (DEBITORI - SOLVENDO VS SOLUTO)
  // ============================================================

  mkChart('dbAccordatoPerMeseChart', {
    type: 'bar',
    data: {
      labels: monthsDebitori,
      datasets: [
        {
          label: 'Accordato Solvendo',
          data: monthsDebitori.map(m => accordatoPerMeseSolvendo[m] || 0),
          backgroundColor: PALETTE.pos,
          borderColor: PALETTE.navy,
          borderWidth: 0
        },
        {
          label: 'Accordato Soluto',
          data: monthsDebitori.map(m => accordatoPerMeseSoluto[m] || 0),
          backgroundColor: PALETTE.info,
          borderColor: PALETTE.navy,
          borderWidth: 0
        }
      ]
    },
    options: {
      plugins: {legend: {display: true}},
      scales: {
        x: {grid: {display: false}, stacked: true},
        y: {grid: {color: PALETTE.grid}, stacked: true, ticks: {callback: v => fmtCurrency.format(v)}}
      }
    }
  });

  // ============================================================
  // CHART: DISTRIBUZIONE PRODOTTI DEBITORI
  // ============================================================

  mkChart('dbNdgPerProdotto', {
    type: 'bar',
    data: {
      labels: datiFinaliProdotti.map(x => x[0]),
      datasets: [{
        label: 'NDG per Prodotto',
        data: datiFinaliProdotti.map(x => x[1]),
        backgroundColor: [
          PALETTE.pos,
          PALETTE.danger,
          PALETTE.warn,
          PALETTE.info,
          PALETTE.navy,
        ],
        borderColor: PALETTE.navy,
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: {display: false}
      }
    }
  });
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

  panel.innerHTML = structHeaderHtml(s, 'Anagrafe - ORGANIZATION, ICT & HR') + `
    <div class="section-title">Statistiche censimenti anagrafe 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Nominativi censiti</div><div class="val">${fmtInt.format(rows.length)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Nature giuridiche distinte</div><div class="val">${new Set(rows.map(r=>r.des_natura_giuridica)).size}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Periodo censimento</div><div class="val" style="font-size:15px">${fmtDate(minD)} → ${fmtDate(maxD)}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Trend censimenti nel tempo</h3><p class="card-sub">conteggio mensile per data censimento</p><canvas id="anTrendChart"></canvas>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Natura giuridica (top 12)</h3><p class="card-sub">forma societaria dei nominativi censiti</p><canvas id="anNaturaChart"></canvas></div>
      <div class="card"><h3>Stato cliente</h3><p class="card-sub">${statusCounts.length? 'des_status_generic' : 'dato non disponibile'}</p><canvas id="anStatusChart"></canvas></div>
    </div>

    ${renderTaskTable(getTasksForSheet(s.sheetName))}
  `;

  mkChart('anTrendChart', {type:'line', data:{labels:months, datasets:[{label:'Censimenti', data:months.map(m=>byMonth.get(m)), borderColor:PALETTE.info, backgroundColor:'rgba(47,111,179,0.12)', fill:true, tension:.3}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

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

  panel.innerHTML = structHeaderHtml(s, 'Antifrode - ORGANIZATION, ICT & HR') + `
    <div class="section-title">Statistiche generali antifrode 2026</div>
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Segnalazioni totali</div><div class="val">${fmtInt.format(total)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Frodi confermate</div><div class="val">${fmtInt.format(confermate)}</div><div class="sub">${fmtDec.format(tassoConferma)}% del totale</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Falsi positivi</div><div class="val">${fmtInt.format(byClass.get('FALSO POSITIVO FRODE')||0)}</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Cluster di frode monitorati</div><div class="val">${clusterSorted.length}</div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>Andamento mensile per classificazione</h3><p class="card-sub">frodi confermate / falsi positivi / non classificabili</p><canvas id="afTrendChart"></canvas></div>
      <div class="card"><h3>Distribuzione per classificazione</h3><canvas id="afClassChart"></canvas></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card" style="grid-column:1/-1"><h3>Volumi per cluster di frode</h3><p class="card-sub">tipologia di frode rilevata</p><canvas id="afClusterChart"></canvas></div>
    </div>

    ${renderTaskTable(getTasksForSheet(s.sheetName))}
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

  panel.innerHTML = structHeaderHtml(s, 'OPS AML - ORGANIZATION, ICT & HR') + `
    <div class="section-title">Stato lavorazione adeguate verifiche su clientela a rischio alto <span class="count-badge">${fmtInt.format(altoNdg)} NDG</span></div>
    <p class="section-desc">Focus sulle posizioni in fascia di rischio alto: avanzamento delle adeguate verifiche e tempi di lavorazione.</p>
    
    <div class="kpi-row">
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Verifiche completate</div><div class="val">${fmtInt.format(completedAltoNdg)}</div><div class="sub">${fmtDec.format(altoNdg ? completedAltoNdg/altoNdg*100 : 0)}% del rischio alto</div></div>
      <div class="kpi" style="--kc:${PALETTE.warn}"><div class="lbl">Da lavorare</div><div class="val">${fmtInt.format(pendingAltoNdg)}</div><div class="sub">${fmtDec.format(altoNdg ? pendingAltoNdg/altoNdg*100 : 0)}% del rischio alto</div></div>
      <div class="kpi" style="--kc:${PALETTE.info}"><div class="lbl">Tempo medio</div><div class="val">${fmtDec.format(avgGiorniAlto)} gg</div><div class="sub">data uscita − inserimento</div></div>
      <div class="kpi" style="--kc:${PALETTE.danger}"><div class="lbl">Scadute e non completate</div><div class="val">${fmtInt.format(scaduteNdg)}</div><div class="sub">data scadenza ADV superata</div></div>
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

    ${renderTaskTable(getTasksForSheet(s.sheetName))}
  `;

  // GRAFICI
  mkChart('amlTrendChart', {type:'bar', data:{labels:months, datasets:[{label:'NDG completati', data:months.map(m=>byMonthSet.get(m).size), backgroundColor:PALETTE.danger}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('amlBuChart', {type:'bar', data:{labels:byBU.map(x=>x[0]), datasets:[{label:'NDG', data:byBU.map(x=>x[1]), backgroundColor:PALETTE.info}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('amlClusterChart', {type:'bar', data:{labels:byCluster.map(x=>x[0]), datasets:[{label:'NDG', data:byCluster.map(x=>x[1]), backgroundColor:PALETTE.warn}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false}, ticks:{font:{size:10}}}}}});

  mkChart('amlWorkflowChart', {type:'pie', data:{labels:byWorkflow.map(x=>x[0]), datasets:[{data:byWorkflow.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('amlTipoChart', {type:'doughnut', data:{labels:byTipoVerifica.map(x=>x[0]), datasets:[{data:byTipoVerifica.map(x=>x[1]), backgroundColor:CHART_SERIES}]},
    options:{plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10.5}}}}}});
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

  const moneticaDimRow = findDimRow(MONETICA_ID);
  panel.innerHTML = structHeaderHtml({sheetName: MONETICA_ID, dimRow: moneticaDimRow}, 'OPS Incassi, Pagamenti e Monetica - ORGANIZATION, ICT & HR') + `
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

    <div class="section-title">Cassette di sicurezza <span class="count-badge">${fmtInt.format(cassette2026.length)} rapporti</span></div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Cassette aperte per mese</h3>
        <p class="card-sub">Nuove cassette</p>
        <canvas id="monCassetteChart"></canvas>
      </div>
      <div class="card">
        <h3>Cassette per business unit</h3>
        <p class="card-sub">Distribuzione</p>
        <canvas id="monBuCassetteChart"></canvas>
      </div>
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

  mkChart('monFilialeChart',{type:'bar', data:{labels:filialArray, datasets:[{label:'Cambiali',data:filialArray.map(f=>operByFilialeType[f].cambiali),backgroundColor:PALETTE.navy},{label:'Tesoreria',data:filialArray.map(f=>operByFilialeType[f].tesoreria),backgroundColor:PALETTE.warn},{label:'Circolari',data:filialArray.map(f=>operByFilialeType[f].circolari),backgroundColor:PALETTE.pos}]}, options:{scales:{x:{grid:{display:false}},y:{grid:{color:PALETTE.grid}, ticks:{font:{size:10}}}}, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10.5}}}}}});

  mkChart('monCassetteChart',{type:'bar', data:{labels:months, datasets:[{label:'Cassette',data:months.map(m=>cassetteMonth[m]||0),backgroundColor:PALETTE.warn}]}, options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:PALETTE.grid}}}}});

  mkChart('monBuCassetteChart',{type:'bar', data:{labels:byBuCassette.map(x=>x[0]), datasets:[{label:'Cassette',data:byBuCassette.map(x=>x[1]),backgroundColor:PALETTE.danger}]}, options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:PALETTE.grid}}, y:{grid:{display:false},ticks:{font:{size:10}}}}}});
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