
const DB_NAME = 'SistemRekapDB';
const DB_VERSION = 1;

export const STORES = {
  METADATA: 'metadata',
  SETTINGS: 'settings',
  CUSTOMERS: 'customers',
  VEHICLES: 'vehicles',
  LPG_TRANSACTIONS: 'lpgTransactions',
  EXPEDITION_TRIPS: 'expeditionTrips',
  EXPENSES: 'expenses',
};

export const dbService = {
  db: null as IDBDatabase | null,

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    // Android WebView lama/mode penyimpanan khusus bisa tidak menyediakan
    // IndexedDB. Jatuhkan ke reject agar pemanggil memakai fallback.
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB tidak tersedia di lingkungan ini.'));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event: Event | null) => {
        console.error('IndexedDB error:', event);
        if (event && event.target) {
          console.error('IndexedDB error target:', (event.target as IDBOpenDBRequest).error);
        }
        this.db = null;
        reject(new Error('Gagal membuka IndexedDB.'));
      };

      request.onblocked = () => {
        // Koneksi versi lama masih terbuka (mis. tab/WebView lain). Gunakan
        // database yang ada agar aplikasi tetap bisa membaca data.
        console.warn('IndexedDB upgrade blocked, melanjutkan dengan koneksi lama.');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
          db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.VEHICLES)) {
          db.createObjectStore(STORES.VEHICLES, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(STORES.LPG_TRANSACTIONS)) {
          const lpgStore = db.createObjectStore(STORES.LPG_TRANSACTIONS, { keyPath: 'id' });
          lpgStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(STORES.EXPEDITION_TRIPS)) {
          const expStore = db.createObjectStore(STORES.EXPEDITION_TRIPS, { keyPath: 'id' });
          expStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
          const expStore = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
          expStore.createIndex('date', 'date', { unique: false });
        }
      };
    });
  },

  async clearStore(storeName: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName: string, item: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // Tulis seluruh store pennuh dalam satu transaksi agar atomic:
  // bila salah satu store gagal, IndexedDB meng-abort dan tidak ada data parsial.
  async writeAllStores(payload: {
    metadata: any;
    settings: any;
    customers: any[];
    vehicles: any[];
    lpgTransactions: any[];
    expeditionTrips: any[];
    expenses: any[];
  }): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const storeNames = [
        STORES.METADATA,
        STORES.SETTINGS,
        STORES.CUSTOMERS,
        STORES.VEHICLES,
        STORES.LPG_TRANSACTIONS,
        STORES.EXPEDITION_TRIPS,
        STORES.EXPENSES,
      ];
      const tx = db.transaction(storeNames, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject((event.target as IDBRequest)?.error ?? tx.error);
      tx.onabort = (event) => reject((event.target as IDBRequest)?.error ?? tx.error);

      const metaStore = tx.objectStore(STORES.METADATA);
      metaStore.clear();
      metaStore.put(payload.metadata);

      const settingsStore = tx.objectStore(STORES.SETTINGS);
      settingsStore.clear();
      settingsStore.put(payload.settings);

      const writeAll = (storeName: string, items: any[]) => {
        const store = tx.objectStore(storeName);
        store.clear();
        items.forEach((item) => store.put(item));
      };
      writeAll(STORES.CUSTOMERS, payload.customers);
      writeAll(STORES.VEHICLES, payload.vehicles);
      writeAll(STORES.LPG_TRANSACTIONS, payload.lpgTransactions);
      writeAll(STORES.EXPEDITION_TRIPS, payload.expeditionTrips);
      writeAll(STORES.EXPENSES, payload.expenses);
    });
  },

  async putAll(storeName: string, items: any[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      items.forEach((item) => store.put(item));
    });
  },

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  },

  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  },

  async count(storeName: string): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};
