const CACHE_NAME = 'water-harvesting-cache';
console.log('cache.js: Loading...');
const CACHE_VERSION = 1;
const DB_NAME = 'WaterHarvestingDB';
const STORES = ['terrain', 'weather', 'analysis', 'config'];

const CacheEngine = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, CACHE_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
    });
  },

  async get(storeName, key) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
  },

  async set(storeName, key, data, ttl = 86400000) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const record = {
        id: key,
        data,
        timestamp: Date.now(),
        expires: Date.now() + ttl
      };
      const request = store.put(record);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async has(key, storeName = 'terrain') {
    const record = await this.get(storeName, key);
    if (!record) return false;
    return record.expires > Date.now();
  },

  async clear(storeName = null) {
    if (!this.db) await this.init();
    const stores = storeName ? [storeName] : STORES;
    for (const s of stores) {
      const tx = this.db.transaction(s, 'readwrite');
      tx.objectStore(s).clear();
    }
  }
};

const DecisionEngine = {
  worker: null,
  ready: false,

  async init() {
    if (this.worker) return;
    this.worker = new Worker('/static/js/hydro-worker.js');
    this.worker.onmessage = (e) => {
      this.lastResult = e.data.result;
      this.ready = true;
    };
    await new Promise(r => setTimeout(r, 200));
    this.ready = true;
  },

  computeD8Flow(grid, gridSize, cellSize) {
    return this._postMessage('d8_flow', { grid, gridSize, cellSize });
  },

  computeFlowAccumulation(flowDir, gridSize) {
    return this._postMessage('flow_accumulation', { flowDir, gridSize });
  },

  projectGroundwater(data) {
    return this._postMessage('groundwater_projection', data);
  },

  optimize(data) {
    return this._postMessage('optimize', data);
  },

  extractDrainagePaths(flowDir, flowAcc, threshold, gridSize, bounds) {
    return this._postMessage('drainage_paths', { flowDir, flowAcc, threshold, gridSize, bounds });
  },

  _postMessage(type, data) {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.data.type === type) {
          this.worker.removeEventListener('message', handler);
          resolve(e.data.result);
        }
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type, data });
    });
  }
};

const SmartAlerts = {
  analyze(weather, terrain, analysis) {
    const alerts = [];
    const runoffIntensity = (weather.annual_rain || 0) * 0.5;
    const groundwaterDepth = terrain?.groundwater_depth || 50;

    if (runoffIntensity > 1000) {
      alerts.push({
        level: 'danger',
        type: 'runoff',
        title: 'High Runoff Detected',
        message: 'Install recharge trench to prevent erosion and capture water.',
        action: 'Place Recharge Trench'
      });
    }

    if (groundwaterDepth > 100) {
      alerts.push({
        level: 'warning',
        type: 'water_table',
        title: 'Deep Water Table',
        message: 'Prioritize surface storage over groundwater recharge.',
        action: 'Install Large Tank'
      });
    }

    if ((weather.annual_rain || 0) < 600) {
      alerts.push({
        level: 'warning',
        type: 'low_rain',
        title: 'Low Rainfall Region',
        message: 'Consider greywater recycling for year-round supply.',
        action: 'Add Greywater System'
      });
    }

    const monsoonDep = weather.monsoon_dep || 0;
    if (monsoonDep > 80) {
      alerts.push({
        level: 'info',
        type: 'seasonal',
        title: 'Monsoon Dependent',
        message: 'Focus on large storage capacity during concentrated rainfall months.',
        action: 'Maximize Storage'
      });
    }

    return alerts;
  }
};

const Reporting = {
  async generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Water Harvesting Advisor Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Location: ${data.location?.lat}, ${data.location?.lon}`, 20, 40);
    
    doc.setFontSize(14);
    doc.text('Recommended Setup', 20, 55);
    
    doc.setFontSize(11);
    let y = 65;
    data.recommendations?.forEach((rec, i) => {
      doc.text(`${i + 1}. ${rec.name} - ₹${rec.cost?.toLocaleString()}`, 25, y);
      doc.text(`   Annual: ${rec.annual?.toLocaleString()}L | ROI: ${rec.roi} years`, 25, y + 6);
      y += 15;
    });
    
    y += 10;
    doc.setFontSize(14);
    doc.text('Summary', 20, y);
    y += 10;
    doc.setFontSize(11);
    doc.text(`Total Cost: ₹${data.totalCost?.toLocaleString()}`, 25, y);
    doc.text(`Annual Savings: ${data.totalAnnualLiters?.toLocaleString()}L`, 25, y + 7);
    doc.text(`ROI Period: ${data.roiYears} years`, 25, y + 14);
    
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-report-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  serializeState(data) {
    const state = btoa(JSON.stringify(data));
    return `${window.location.origin}?state=${state}`;
  },

  loadState() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state) {
      try {
        return JSON.parse(atob(state));
      } catch (e) {
        return null;
      }
    }
    return null;
  }
};

window.CacheEngine = CacheEngine;
window.DecisionEngine = DecisionEngine;
window.SmartAlerts = SmartAlerts;
window.Reporting = Reporting;