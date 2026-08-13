/* ============================================================
   STATE SETTING
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
   INDEXEDDB UTILITIES
   ============================================================ */

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('myAppDB', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('files')) {
      db.createObjectStore('files');
    }
  };
});

async function saveFileToIndexedDB(key, data) {
  const db = await dbPromise;
  const tx = db.transaction(['files'], 'readwrite');
  const store = tx.objectStore('files');
  store.put(data, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadFileFromIndexedDB(key) {
  const db = await dbPromise;
  const tx = db.transaction(['files'], 'readonly');
  const store = tx.objectStore('files');
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ============================================================
   GESTIONE FILE
   ============================================================ */

function setupFileHandling() { 
  const fileInputMain = document.getElementById('fileInputMain');
  const btnLoadMain = document.getElementById('btnLoadMain');
  const dropZone = document.getElementById('dropZone');
  
  // Bottone per caricare il file principale
  if (btnLoadMain && fileInputMain) {
    btnLoadMain.addEventListener('click', () => {
      fileInputMain.value = '';
      fileInputMain.click();
    });
  }
  
  // Quando scegli il file principale
  if (fileInputMain) {
    fileInputMain.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileMain(file);
      }
    });
  }
  
  // Drop zone
  if (dropZone && fileInputMain) {
    dropZone.addEventListener('click', () => {
      fileInputMain.value = '';
      fileInputMain.click();
    });
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag');
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (file) handleFileMain(file);
    });
  }
  
  // Avvia il caricamento dal cache
  loadCachedFile();
}

// Carica il file dallo storage
async function loadCachedFile() {
  const loadingStatus = document.getElementById('loadingStatus');
  const dropZone = document.getElementById('dropZone');
  const noDbMessage = document.getElementById('noDbMessage');
  const emptyState = document.getElementById('emptyState');
  const loadingBar = document.getElementById('loadingBar');
  const dashboard = document.getElementById('dashboard');

  // 1️⃣ MOSTRA INTERFACCIA CON MESSAGGIO DI CARICAMENTO
  if (emptyState) emptyState.style.display = 'block';
  if (loadingStatus) {
    loadingStatus.textContent = 'Caricamento database strutture da localStorage...';
    loadingStatus.style.display = 'block';
  }
  if (dropZone) dropZone.style.display = 'none';
  if (noDbMessage) noDbMessage.style.display = 'none';

  try {
    const cached = await loadFileFromIndexedDB('database_v1_filtrato');
    
    if (cached) {
      // ⭐ REGISTRA L'ORA DI INIZIO
      const startTime = Date.now();
      
      // ⭐ MOSTRA LA BARRA SUBITO
      if (loadingBar) loadingBar.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';
      if (dashboard) dashboard.style.display = 'none';
      
      // 2️⃣ FILE TROVATO - Carica tutto in background
      const wb = XLSX.read(cached, { type: 'array', cellDates: true });
      parseWorkbook(wb);
      await buildTabsAsync();
      
      // ⭐ Aspetta con barra, calcolando il tempo da quando è stato rilevato il file
      await waitWithLoadingBar(startTime);
    } else {
      // 3️⃣ FILE NON TROVATO - Mostra messaggio e drop zone
      if (loadingStatus) loadingStatus.style.display = 'none';
      if (dropZone) dropZone.style.display = 'block';
      if (noDbMessage) noDbMessage.style.display = 'block';
    }
  } catch (e) {
    console.error('Errore caricamento cache:', e);
    // 3️⃣ ERRORE - Mostra messaggio e drop zone
    if (loadingStatus) loadingStatus.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
    if (noDbMessage) noDbMessage.style.display = 'block';
  }
}

function handleFileMain(file) {
  if (typeof XLSX === 'undefined') {
    alert('Errore: Excel non caricato');
    return;
  }
  // ⭐ MOSTRA LA BARRA SUBITO
  const loadingBar = document.getElementById('loadingBar');
  const emptyState = document.getElementById('emptyState');
  const dashboard = document.getElementById('dashboard');
  
  if (loadingBar) loadingBar.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';
  if (dashboard) dashboard.style.display = 'none';
  
  // ⭐ REGISTRA L'ORA DI INIZIO
  const startTime = Date.now();
  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  
  reader.onload = async (e) => {
    try {
      let wb;
      if (isCSV) {
        wb = XLSX.read(e.target.result, { type: 'string', cellDates: true });
      } else {
        wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      }
      parseWorkbook(wb);
      await saveFileToIndexedDB('database_v1_filtrato', e.target.result);
      await buildTabsAsync();
      
      // ⭐ Aspetta con barra, calcolando il tempo da quando è stato caricato il file
      await waitWithLoadingBar(startTime);
    } catch (err) {
      if (loadingBar) loadingBar.style.display = 'none';
      alert('Errore: ' + err.message);
    }
  };
  
  reader.onerror = () => {
    if (loadingBar) loadingBar.style.display = 'none';
    alert('Errore nella lettura del file');
  };
  
  if (isCSV) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
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

  if (sheetNames.length > 1) {
    const taskSheet = wb.Sheets[sheetNames[1]];
    const taskJson = XLSX.utils.sheet_to_json(taskSheet, { defval: null });
    STATE.taskData = taskJson.map(row => ({
      id_task: row.id_task || null,
      nome_task: row.nome_task || null,
      pezzi: row.pezzi ? Number(row.pezzi) : null,
      tempi: row.tempi ? Number(row.tempi) : null,
      fte_teorico: row.fte_teorico ? Number(row.fte_teorico) : null,
      fte_asis_ripartito: row.fte_asis_ripartito ? Number(row.fte_asis_ripartito) : null,
      ripartizione: row.Ripartizione ? Number(row.Ripartizione) : null,
      id_uo: normalizeId(row.id_uo)
    }));
  } else {
    STATE.taskData = [];
  }

  STATE.domainSheets = [];
  
  // 📌 FOGLI RESTANTI: Domain sheets
  for (let i = 2; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const type = classifySheet(name);
    const dimRow = findDimRow(name);
    STATE.domainSheets.push({ sheetName: name, type, headers, rows, dimRow });
  }
  
  const typeOrder = ['ordinario', 'speciale', 'perfezionamenti', 'anagrafe', 'antifrode', 'ops_aml', 'bancassurance', 'fidi', 'specialty', 'generic'];
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
  if (name.includes('10001100023000001')) return 'anagrafe';
  if (name.includes('10004100067100079')) return 'perfezionamenti';
  if (name.includes('10004100067100080v1')) return 'factoring_cedenti';
  if (name.includes('10004100067100080v2')) return 'factoring_debitori';
  if (name.includes('10004100067100078v1')) return 'fidi';
  if (name.includes('10004100067100078v2')) return 'fidi_collegamenti';
  if (name.includes('10004100067100081v1')) return 'specialty_censimenti';
  if (name.includes('10004100067100081v2')) return 'specialty_adv';
  if (name.includes('10004100067100081v3')) return 'specialty_rapporti';
  if (name.includes('10004100067100081v4')) return 'specialty_perfezionamenti';
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

/**
 * Normalizza gli ID da formato "10001-100023-100034----" 
 * a formato "10001100023100034"
 */
function normalizeId(id) {
  if (!id) return null;
  return String(id).replace(/-/g, '').trim();
}
/**
 * Trova le task associate a uno sheet in base all'ID
 */
function getTasksForSheet(sheetName) {
  const normalizedSheetId = normalizeId(sheetName);
  if (!normalizedSheetId) return [];
  
  return STATE.taskData.filter(task => {
    if (!task.id_uo) return false;
    // Match esatto cifra per cifra
    return task.id_uo === normalizedSheetId;
  });
}

/* ============================================================
   BUILD TABS ASYNC
   ============================================================ */

async function buildTabsAsync() {
  return new Promise((resolve) => {
    if (typeof buildTabs === 'function') {
      buildTabs();
    }
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  if (typeof XLSX !== 'undefined') {
    setupFileHandling();
  } else {
    alert('❌ Errore: La libreria Excel non è stata caricata.\nRicarica la pagina e riprova.');
  }
});