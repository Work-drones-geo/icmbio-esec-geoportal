/**
 * Módulo de Armazenamento Local e Offline (IndexedDB + Fallback)
 * Work Drones Geo • ICMBio WebGIS
 */

class OfflineStore {
  constructor() {
    this.dbName = 'ICMBioGeoDB';
    this.version = 1;
    this.db = null;
    this.isReady = false;
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('[OfflineStore] IndexedDB não suportado. Usando LocalStorage.');
        this.isReady = true;
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('occurrences')) {
          db.createObjectStore('occurrences', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pending_queue')) {
          db.createObjectStore('pending_queue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        console.log('[OfflineStore] IndexedDB inicializado com sucesso.');
        resolve();
      };

      request.onerror = (event) => {
        console.error('[OfflineStore] Erro ao abrir IndexedDB:', event.target.error);
        this.isReady = true;
        resolve();
      };
    });
  }

  // --- Ocorrências Locais ---
  async saveOccurrence(feature) {
    if (!feature.id) {
      feature.id = 'occ-' + Date.now();
    }
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('occurrences', 'readwrite');
        const store = tx.objectStore('occurrences');
        const req = store.put(feature);
        req.onsuccess = () => resolve(feature);
        req.onerror = () => reject(req.error);
      });
    } else {
      const list = this._getLS('occurrences') || [];
      const idx = list.findIndex(f => f.id === feature.id);
      if (idx >= 0) list[idx] = feature;
      else list.push(feature);
      this._setLS('occurrences', list);
      return feature;
    }
  }

  async getAllOccurrences() {
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('occurrences', 'readonly');
        const store = tx.objectStore('occurrences');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      return this._getLS('occurrences') || [];
    }
  }

  // --- Fila de Sincronização Pendente (Offline Push) ---
  async addPendingSync(feature) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('pending_queue', 'readwrite');
        const store = tx.objectStore('pending_queue');
        const req = store.put(feature);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      const list = this._getLS('pending_queue') || [];
      const idx = list.findIndex(f => f.id === feature.id);
      if (idx >= 0) list[idx] = feature;
      else list.push(feature);
      this._setLS('pending_queue', list);
    }
  }

  async getPendingSyncList() {
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('pending_queue', 'readonly');
        const store = tx.objectStore('pending_queue');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      return this._getLS('pending_queue') || [];
    }
  }

  async removePendingSync(featureId) {
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('pending_queue', 'readwrite');
        const store = tx.objectStore('pending_queue');
        const req = store.delete(featureId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } else {
      let list = this._getLS('pending_queue') || [];
      list = list.filter(f => f.id !== featureId);
      this._setLS('pending_queue', list);
    }
  }

  // --- Configurações (Settings) ---
  async getSetting(key) {
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });
    } else {
      return localStorage.getItem('cfg_' + key);
    }
  }

  async setSetting(key, value) {
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const req = store.put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } else {
      localStorage.setItem('cfg_' + key, value);
    }
  }

  // Utilitários de Fallback LocalStorage
  _getLS(key) {
    try {
      const data = localStorage.getItem('db_' + key);
      return data ? jsonParse(data) : null;
    } catch { return null; }
  }

  _setLS(key, val) {
    try {
      localStorage.setItem('db_' + key, JSON.stringify(val));
    } catch (e) {
      console.warn('LocalStorage limit reached', e);
    }
  }
}

function jsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

window.offlineStore = new OfflineStore();
