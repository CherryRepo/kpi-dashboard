// worker.js - Elabora Excel in background

self.onmessage = function(e) {
  const arrayBuffer = e.data;
  
  try {
    // Importa XLSX nel worker
    importScripts('https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js');
    
    const data = new Uint8Array(arrayBuffer);
    const wb = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      defval: '',
      blankrows: false
    });
    
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
    
    // Tronca se troppo grande
    if (jsonData.length > 10000) {
      jsonData.length = 10000;
    }
    
    self.postMessage({
      success: true,
      workbook: wb,
      data: jsonData
    });
    
  } catch(err) {
    self.postMessage({
      success: false,
      error: err.message
    });
  }
};
