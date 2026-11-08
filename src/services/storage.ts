import type { AppData, ExpeditionTrip } from '../types';
import { initialData } from '../data/initialData';
import { dbService, STORES } from './db';
import { fileSystemService } from './fileSystemService';

const STORAGE_KEY = 'sistem_rekap_keuangan_offline_db';
const RECOVERY_SNAPSHOT_KEY = 'sistem_rekap_keuangan_recovery_snapshot';
const AUTO_BACKUP_META_KEY = 'sistem_rekap_keuangan_autobackup_meta';
const AUTO_BACKUP_RING_KEY = 'sistem_rekap_keuangan_autobackup_ring';
const MIGRATION_FLAG = 'idb_migration_status';

// Konfigurasi Auto-Save & Auto-Backup Berkala
const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 350;
const DEFAULT_AUTOBACKUP_INTERVAL_MS = 10 * 60 * 1000; // 10 menit
const MIN_VISIBILITY_BACKUP_GAP_MS = 3 * 60 * 1000; // 3 menit saat pindah aplikasi/tab
const DIRTY_CHANGES_BACKUP_THRESHOLD = 8; // Auto-backup ke file lokal tiap 8 perubahan transaksi
const MAX_RING_SNAPSHOTS = 3;

export interface AutoBackupMetadata {
  lastBackupAt: string | null;
  lastBackupFileName: string | null;
  lastBackupMode: 'filesystem' | 'android-bridge' | 'download' | 'local-ring' | 'none';
  dirtyCountSinceBackup: number;
  totalAutoBackups: number;
  isPersistentStorageGranted: boolean;
}

interface RingSnapshotItem {
  savedAt: string;
  recordCount: number;
  payload: AppData;
}

// State internal modul untuk antrean tulis (single-flight) & penjadwal auto-backup
let pendingAutoSaveData: AppData | null = null;
let autoSaveTimerId: ReturnType<typeof setTimeout> | null = null;
let isWriteInFlight = false;
let queuedWriteData: AppData | null = null;
let activeWritePromise: Promise<void> | null = null;

let latestKnownAppData: AppData | null = null;
let lastSavedFingerprint = '';
let lastBackupFingerprint = '';
let dirtyChangesCount = 0;
let autoBackupIntervalId: ReturnType<typeof setInterval> | null = null;
let lifecycleListenersAttached = false;
let persistentStorageGranted = false;

function computeDataFingerprint(data: AppData): string {
  const lpgLen = data.lpgTransactions?.length || 0;
  const expLen = data.expeditionTrips?.length || 0;
  const costLen = data.expenses?.length || 0;
  const custLen = data.customers?.length || 0;
  const vehLen = data.vehicles?.length || 0;
  const lpgSum = (data.lpgTransactions || []).reduce((s, t) => s + (t.total || 0), 0);
  const expSum = (data.expeditionTrips || []).reduce((s, t) => s + (t.totalRevenue || 0), 0);
  const costSum = (data.expenses || []).reduce((s, e) => s + (e.total || 0), 0);
  return `${custLen}:${vehLen}:${lpgLen}:${expLen}:${costLen}:${lpgSum}:${expSum}:${costSum}:${data.settings?.companyName || ''}`;
}

function hasMeaningfulMerchantData(data: AppData | null | undefined): boolean {
  if (!data) return false;
  return (
    (data.lpgTransactions?.length || 0) > 0 ||
    (data.expeditionTrips?.length || 0) > 0 ||
    (data.expenses?.length || 0) > 0 ||
    (data.customers?.length || 0) > 0 ||
    (data.vehicles?.length || 0) > 0
  );
}

function readAutoBackupMeta(): AutoBackupMetadata {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AutoBackupMetadata>;
      return {
        lastBackupAt: parsed.lastBackupAt ?? null,
        lastBackupFileName: parsed.lastBackupFileName ?? null,
        lastBackupMode: parsed.lastBackupMode ?? 'none',
        dirtyCountSinceBackup: parsed.dirtyCountSinceBackup ?? dirtyChangesCount,
        totalAutoBackups: parsed.totalAutoBackups ?? 0,
        isPersistentStorageGranted: persistentStorageGranted,
      };
    }
  } catch {
    // Abaikan kegagalan baca metadata
  }
  return {
    lastBackupAt: null,
    lastBackupFileName: null,
    lastBackupMode: 'none',
    dirtyCountSinceBackup: dirtyChangesCount,
    totalAutoBackups: 0,
    isPersistentStorageGranted: persistentStorageGranted,
  };
}

function writeAutoBackupMeta(update: Partial<AutoBackupMetadata>): AutoBackupMetadata {
  const current = readAutoBackupMeta();
  const next: AutoBackupMetadata = {
    ...current,
    ...update,
    isPersistentStorageGranted: persistentStorageGranted,
  };
  try {
    localStorage.setItem(AUTO_BACKUP_META_KEY, JSON.stringify(next));
  } catch {
    // Abaikan jika quota localStorage penuh
  }
  return next;
}

function pushToLocalBackupRing(data: AppData): void {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_RING_KEY);
    const ring: RingSnapshotItem[] = raw ? (JSON.parse(raw) as RingSnapshotItem[]) : [];
    const recordCount =
      (data.lpgTransactions?.length || 0) +
      (data.expeditionTrips?.length || 0) +
      (data.expenses?.length || 0);

    const nextRing: RingSnapshotItem[] = [
      {
        savedAt: new Date().toISOString(),
        recordCount,
        payload: data,
      },
      ...ring,
    ].slice(0, MAX_RING_SNAPSHOTS);

    localStorage.setItem(AUTO_BACKUP_RING_KEY, JSON.stringify(nextRing));
  } catch {
    // Jika quota localStorage terbatas, minimal RECOVERY_SNAPSHOT_KEY tetap terjaga
  }
}

export const storageService = {
  // Meminta izin Persistent Storage dari browser/Android WebView agar cache &
  // IndexedDB tidak dihapus otomatis oleh OS saat memori perangkat menipis.
  async requestPersistentStorage(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
        const alreadyPersisted = await navigator.storage.persisted?.();
        if (alreadyPersisted) {
          persistentStorageGranted = true;
          return true;
        }
        persistentStorageGranted = await navigator.storage.persist();
        writeAutoBackupMeta({ isPersistentStorageGranted: persistentStorageGranted });
        return persistentStorageGranted;
      }
    } catch (err) {
      console.warn('Gagal meminta persistent storage:', err);
    }
    return false;
  },

  // Masih dipertahankan untuk kompatibilitas fungsi lama & fallback berlapis
  loadAppData(): AppData {
    const keysToTry = [STORAGE_KEY, RECOVERY_SNAPSHOT_KEY];
    for (const key of keysToTry) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            parsed.customers &&
            parsed.vehicles &&
            parsed.lpgTransactions &&
            parsed.expeditionTrips &&
            parsed.expenses
          ) {
            const normalized = this.normalizeData(parsed);
            latestKnownAppData = normalized;
            return normalized;
          }
        }
      } catch (e) {
        console.error(`Error loading data from localStorage (${key}):`, e);
      }
    }

    // Fallback ke cincin auto-backup lokal jika kunci utama korup/terhapus
    try {
      const ringRaw = localStorage.getItem(AUTO_BACKUP_RING_KEY);
      if (ringRaw) {
        const ring = JSON.parse(ringRaw) as RingSnapshotItem[];
        if (Array.isArray(ring) && ring.length > 0 && ring[0]?.payload) {
          const recovered = this.normalizeData(ring[0].payload);
          latestKnownAppData = recovered;
          return recovered;
        }
      }
    } catch (e) {
      console.error('Error recovering from auto-backup ring:', e);
    }

    return initialData;
  },

  normalizeData(input: Record<string, unknown> | Partial<AppData> | AppData): AppData {
    const parsed = input as Record<string, unknown>;
    const rawTrips = Array.isArray(parsed.expeditionTrips)
      ? (parsed.expeditionTrips as Partial<ExpeditionTrip>[])
      : [];

    const normalizedTrips = rawTrips.map((t) => {
      const initialMatch = initialData.expeditionTrips.find((it) => it.id === t.id);
      const allowance =
        t.travelAllowance !== undefined
          ? t.travelAllowance
          : initialMatch?.travelAllowance || 0;
      const weight = t.weightKg || 0;
      const rate = t.ratePerKg || 0;
      const computedRevenue =
        weight > 0 && rate > 0 ? weight * rate - allowance : t.totalRevenue || 0;
      return {
        ...t,
        travelAllowance: allowance,
        totalRevenue: computedRevenue,
      } as ExpeditionTrip;
    });

    const settingsObj =
      parsed.settings && typeof parsed.settings === 'object'
        ? (parsed.settings as Record<string, unknown>)
        : { ...initialData.settings };

    settingsObj.isSetupComplete =
      settingsObj.isSetupComplete !== undefined ? Boolean(settingsObj.isSetupComplete) : false;
    settingsObj.ownerName = (settingsObj.ownerName as string) ?? '';
    settingsObj.logo = (settingsObj.logo as string) ?? '';

    return {
      ...parsed,
      expeditionTrips: normalizedTrips,
      settings: settingsObj,
    } as unknown as AppData;
  },

  async loadAppDataAsync(): Promise<AppData> {
    // Minta proteksi persistent storage dari OS/browser sejak awal startup
    void this.requestPersistentStorage();
    this.attachLifecycleFlushListeners();

    try {
      await dbService.init();

      // a. Cek seluruh object store untuk memastikan apakah IDB memiliki data
      const [
        idbCustomersCount,
        idbVehiclesCount,
        idbLpgCount,
        idbExpeditionCount,
        idbExpensesCount,
        idbSettingsCount,
      ] = await Promise.all([
        dbService.count(STORES.CUSTOMERS),
        dbService.count(STORES.VEHICLES),
        dbService.count(STORES.LPG_TRANSACTIONS),
        dbService.count(STORES.EXPEDITION_TRIPS),
        dbService.count(STORES.EXPENSES),
        dbService.count(STORES.SETTINGS),
      ]);

      const hasIdbData =
        idbCustomersCount > 0 ||
        idbVehiclesCount > 0 ||
        idbLpgCount > 0 ||
        idbExpeditionCount > 0 ||
        idbExpensesCount > 0 ||
        idbSettingsCount > 0;

      // b. Jika ada data di IndexedDB, muat & normalisasi
      if (hasIdbData) {
        try {
          localStorage.setItem(MIGRATION_FLAG, 'SUCCESS');
        } catch {
          // ignore
        }

        const [
          metadata,
          settings,
          customers,
          vehicles,
          lpgTransactions,
          expeditionTrips,
          expenses,
        ] = await Promise.all([
          dbService.get<Record<string, unknown>>(STORES.METADATA, 'app_metadata'),
          dbService.get<Record<string, unknown>>(STORES.SETTINGS, 'app_settings'),
          dbService.getAll<AppData['customers'][number]>(STORES.CUSTOMERS),
          dbService.getAll<AppData['vehicles'][number]>(STORES.VEHICLES),
          dbService.getAll<AppData['lpgTransactions'][number]>(STORES.LPG_TRANSACTIONS),
          dbService.getAll<AppData['expeditionTrips'][number]>(STORES.EXPEDITION_TRIPS),
          dbService.getAll<AppData['expenses'][number]>(STORES.EXPENSES),
        ]);

        const metadataWithoutId = { ...(metadata || initialData.metadata) } as Record<string, unknown>;
        delete metadataWithoutId.id;

        const settingsWithoutId = { ...(settings || initialData.settings) } as Record<string, unknown>;
        delete settingsWithoutId.id;

        const loaded = this.normalizeData({
          metadata: metadataWithoutId,
          settings: settingsWithoutId,
          customers,
          vehicles,
          lpgTransactions,
          expeditionTrips,
          expenses,
        });

        // Jika IDB ternyata kosong dari transaksi padahal snapshot cadangan di
        // localStorage memiliki transaksi (mis. pasca reset cache parsial), pulihkan.
        if (!hasMeaningfulMerchantData(loaded)) {
          const fallbackCandidate = this.loadAppData();
          if (hasMeaningfulMerchantData(fallbackCandidate)) {
            await this.saveAppDataAsync(fallbackCandidate);
            latestKnownAppData = fallbackCandidate;
            lastSavedFingerprint = computeDataFingerprint(fallbackCandidate);
            return fallbackCandidate;
          }
        }

        latestKnownAppData = loaded;
        lastSavedFingerprint = computeDataFingerprint(loaded);
        return loaded;
      }

      // c. Jika IndexedDB kosong, cek localStorage / snapshot cadangan untuk migrasi
      const localDataString =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem(RECOVERY_SNAPSHOT_KEY);
      if (localDataString) {
        const localData = this.normalizeData(JSON.parse(localDataString) as Record<string, unknown>);
        try {
          await dbService.writeAllStores({
            metadata: { id: 'app_metadata', ...localData.metadata },
            settings: { id: 'app_settings', ...localData.settings },
            customers: localData.customers,
            vehicles: localData.vehicles,
            lpgTransactions: localData.lpgTransactions,
            expeditionTrips: localData.expeditionTrips,
            expenses: localData.expenses,
          });

          // Validasi integritas hasil migrasi
          const [countCustomers, countVehicles, countLpg, countExpedition, countExpenses] =
            await Promise.all([
              dbService.count(STORES.CUSTOMERS),
              dbService.count(STORES.VEHICLES),
              dbService.count(STORES.LPG_TRANSACTIONS),
              dbService.count(STORES.EXPEDITION_TRIPS),
              dbService.count(STORES.EXPENSES),
            ]);

          if (
            countCustomers !== localData.customers.length ||
            countVehicles !== localData.vehicles.length ||
            countLpg !== localData.lpgTransactions.length ||
            countExpedition !== localData.expeditionTrips.length ||
            countExpenses !== localData.expenses.length
          ) {
            throw new Error('Validasi Migrasi Gagal: Jumlah data tidak cocok.');
          }

          localStorage.setItem(MIGRATION_FLAG, 'SUCCESS');
          latestKnownAppData = localData;
          lastSavedFingerprint = computeDataFingerprint(localData);
          return localData;
        } catch (migrationError) {
          console.error('Migrasi Gagal, menggunakan localStorage sebagai fallback:', migrationError);
          latestKnownAppData = localData;
          return localData;
        }
      }

      // d. Jika keduanya kosong, inisialisasi database awal
      await this.saveAppDataAsync(initialData);
      try {
        localStorage.setItem(MIGRATION_FLAG, 'SUCCESS');
      } catch {
        // ignore
      }
      latestKnownAppData = initialData;
      lastSavedFingerprint = computeDataFingerprint(initialData);
      return initialData;
    } catch (e) {
      console.error('Error in loadAppDataAsync (IDB), fallback to localStorage:', e);
      return this.loadAppData();
    }
  },

  saveAppData(data: AppData): void {
    try {
      const updatedData: AppData = {
        ...data,
        metadata: {
          ...data.metadata,
          lastSaved: new Date().toISOString(),
        },
      };
      const serialized = JSON.stringify(updatedData);
      localStorage.setItem(STORAGE_KEY, serialized);
      if (hasMeaningfulMerchantData(updatedData)) {
        localStorage.setItem(RECOVERY_SNAPSHOT_KEY, serialized);
      }
      latestKnownAppData = updatedData;
    } catch (e) {
      console.error('Error saving data to localStorage:', e);
    }
  },

  // Penulisan atomic ke IndexedDB dengan antrean single-flight (mencegah race
  // condition saat auto-save dipicu beruntun) + auto-retry + mirror cadangan.
  async saveAppDataAsync(data: AppData): Promise<void> {
    latestKnownAppData = data;
    queuedWriteData = data;

    if (isWriteInFlight && activeWritePromise) {
      return activeWritePromise;
    }

    isWriteInFlight = true;
    activeWritePromise = (async () => {
      try {
        while (queuedWriteData !== null) {
          const snapshotToSave = queuedWriteData;
          queuedWriteData = null;

          const updatedData: AppData = {
            ...snapshotToSave,
            metadata: {
              ...snapshotToSave.metadata,
              lastSaved: new Date().toISOString(),
            },
          };

          // Eksekusi penulisan ke IndexedDB dengan retry hingga 2 kali bila terkunci sementara
          let attempt = 0;
          const maxRetries = 2;
          while (true) {
            try {
              await dbService.writeAllStores({
                metadata: { id: 'app_metadata', ...updatedData.metadata },
                settings: { id: 'app_settings', ...updatedData.settings },
                customers: updatedData.customers,
                vehicles: updatedData.vehicles,
                lpgTransactions: updatedData.lpgTransactions,
                expeditionTrips: updatedData.expeditionTrips,
                expenses: updatedData.expenses,
              });
              break;
            } catch (writeErr) {
              attempt += 1;
              if (attempt > maxRetries) {
                throw writeErr;
              }
              await new Promise((r) => setTimeout(r, 80 * attempt));
            }
          }

          // Mirror ke localStorage + recovery snapshot bila transaksi IndexedDB sukses
          try {
            const serialized = JSON.stringify(updatedData);
            localStorage.setItem(STORAGE_KEY, serialized);
            if (hasMeaningfulMerchantData(updatedData)) {
              localStorage.setItem(RECOVERY_SNAPSHOT_KEY, serialized);
            }
          } catch (e) {
            console.warn('Gagal mirror ke localStorage:', e);
          }

          // Lacak perubahan untuk pemicu auto-backup berkala
          const currentFp = computeDataFingerprint(updatedData);
          if (currentFp !== lastSavedFingerprint) {
            lastSavedFingerprint = currentFp;
            dirtyChangesCount += 1;
            writeAutoBackupMeta({ dirtyCountSinceBackup: dirtyChangesCount });

            if (dirtyChangesCount >= DIRTY_CHANGES_BACKUP_THRESHOLD) {
              void this.performAutoBackupToLocalFile(updatedData, 'threshold');
            }
          }
        }
      } finally {
        isWriteInFlight = false;
        activeWritePromise = null;
      }
    })();

    return activeWritePromise;
  },

  // Jadwalkan auto-save dengan debounce agar input cepat tidak membebani thread utama
  scheduleAutoSave(data: AppData, debounceMs: number = DEFAULT_AUTOSAVE_DEBOUNCE_MS): void {
    latestKnownAppData = data;
    pendingAutoSaveData = data;

    if (autoSaveTimerId !== null) {
      clearTimeout(autoSaveTimerId);
    }

    autoSaveTimerId = setTimeout(() => {
      autoSaveTimerId = null;
      const toSave = pendingAutoSaveData;
      pendingAutoSaveData = null;
      if (toSave) {
        void this.saveAppDataAsync(toSave);
      }
    }, debounceMs);
  },

  // Paksa simpan seketika bila masih ada antrean auto-save yang tertunda (mis. saat tab ditutup)
  async flushPendingAutoSave(): Promise<void> {
    if (autoSaveTimerId !== null) {
      clearTimeout(autoSaveTimerId);
      autoSaveTimerId = null;
    }
    const toFlush = pendingAutoSaveData;
    pendingAutoSaveData = null;
    if (toFlush) {
      this.saveAppData(toFlush);
      await this.saveAppDataAsync(toFlush);
    } else if (activeWritePromise) {
      await activeWritePromise;
    }
  },

  // Pasang listener otomatis untuk menyelamatkan data saat aplikasi Android/browser ditutup atau berpindah layar
  attachLifecycleFlushListeners(): void {
    if (lifecycleListenersAttached || typeof window === 'undefined') return;
    lifecycleListenersAttached = true;

    const handleVisibilityOrHide = () => {
      if (pendingAutoSaveData) {
        this.saveAppData(pendingAutoSaveData);
        void this.flushPendingAutoSave();
      }
      if (latestKnownAppData && dirtyChangesCount > 0) {
        const meta = readAutoBackupMeta();
        const lastMs = meta.lastBackupAt ? new Date(meta.lastBackupAt).getTime() : 0;
        if (Date.now() - lastMs >= MIN_VISIBILITY_BACKUP_GAP_MS) {
          void this.performAutoBackupToLocalFile(latestKnownAppData, 'lifecycle');
        } else {
          pushToLocalBackupRing(latestKnownAppData);
        }
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleVisibilityOrHide();
      }
    });
    window.addEventListener('pagehide', handleVisibilityOrHide);
    window.addEventListener('beforeunload', handleVisibilityOrHide);
  },

  // Eksekusi auto-backup berkala ke file lokal (Folder Simpan Otomatis / AndroidBridge / Local Ring)
  async performAutoBackupToLocalFile(
    data?: AppData,
    reason: 'interval' | 'threshold' | 'lifecycle' | 'manual' = 'interval'
  ): Promise<{ backedUp: boolean; fileName?: string; mode: AutoBackupMetadata['lastBackupMode'] }> {
    const targetData = data || latestKnownAppData;
    if (!targetData || !hasMeaningfulMerchantData(targetData)) {
      return { backedUp: false, mode: 'none' };
    }

    const currentFp = computeDataFingerprint(targetData);
    if (reason !== 'manual' && currentFp === lastBackupFingerprint && dirtyChangesCount === 0) {
      return { backedUp: false, mode: readAutoBackupMeta().lastBackupMode };
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const payloadWithMeta: AppData = {
      ...targetData,
      metadata: {
        ...targetData.metadata,
        lastSaved: now.toISOString(),
      },
    };
    const jsonString = JSON.stringify(payloadWithMeta, null, 2);

    // Selalu simpan ke cincin cadangan internal terlebih dahulu
    pushToLocalBackupRing(payloadWithMeta);

    const dailyFileName = `kaspro_autobackup_${dateStr}.json`;
    const latestFileName = 'kaspro_autobackup_latest.json';

    // Coba tulis ke folder lokal yang sudah disetel pedagang atau Android native bridge
    const primaryRes = await fileSystemService.saveJsonFile(jsonString, latestFileName, {
      allowDownloadFallback: reason === 'manual',
      silentPermissionCheck: reason !== 'manual',
    });

    if (primaryRes.success && primaryRes.mode === 'filesystem') {
      // Simpan juga arsip tanggal hari ini di folder lokal yang sama
      await fileSystemService.saveJsonFile(jsonString, dailyFileName, {
        allowDownloadFallback: false,
        silentPermissionCheck: true,
      });
    }

    lastBackupFingerprint = currentFp;
    dirtyChangesCount = 0;

    const prevMeta = readAutoBackupMeta();
    const effectiveMode: AutoBackupMetadata['lastBackupMode'] = primaryRes.success
      ? (primaryRes.mode as AutoBackupMetadata['lastBackupMode'])
      : 'local-ring';
    const effectiveFileName = primaryRes.success ? primaryRes.fileName : dailyFileName;

    writeAutoBackupMeta({
      lastBackupAt: now.toISOString(),
      lastBackupFileName: effectiveFileName,
      lastBackupMode: effectiveMode,
      dirtyCountSinceBackup: 0,
      totalAutoBackups: (prevMeta.totalAutoBackups || 0) + 1,
    });

    return {
      backedUp: true,
      fileName: effectiveFileName,
      mode: effectiveMode,
    };
  },

  // Mulai penjadwal auto-backup berkala selama aplikasi aktif
  startAutoBackupScheduler(
    getData: () => AppData | null,
    intervalMs: number = DEFAULT_AUTOBACKUP_INTERVAL_MS,
    onBackupSuccess?: (info: { fileName?: string; mode: AutoBackupMetadata['lastBackupMode'] }) => void
  ): () => void {
    this.attachLifecycleFlushListeners();

    if (autoBackupIntervalId !== null) {
      clearInterval(autoBackupIntervalId);
    }

    autoBackupIntervalId = setInterval(async () => {
      const currentData = getData() || latestKnownAppData;
      if (!currentData || !hasMeaningfulMerchantData(currentData)) return;
      if (dirtyChangesCount <= 0 && lastBackupFingerprint === computeDataFingerprint(currentData)) {
        return;
      }
      const res = await this.performAutoBackupToLocalFile(currentData, 'interval');
      if (res.backedUp && onBackupSuccess) {
        onBackupSuccess({ fileName: res.fileName, mode: res.mode });
      }
    }, intervalMs);

    return () => {
      this.stopAutoBackupScheduler();
    };
  },

  stopAutoBackupScheduler(): void {
    if (autoBackupIntervalId !== null) {
      clearInterval(autoBackupIntervalId);
      autoBackupIntervalId = null;
    }
  },

  getAutoBackupStatus(): AutoBackupMetadata {
    return readAutoBackupMeta();
  },

  async exportDataToFile(data: AppData, suggestedName?: string): Promise<string> {
    await this.flushPendingAutoSave();
    const today = new Date().toISOString().slice(0, 10);
    const fileName = suggestedName || `database_perusahaan_${today}.json`;
    const jsonString = JSON.stringify(data, null, 2);

    // Jika pedagang sudah memilih folder lokal aktif, simpan langsung ke sana juga
    if (fileSystemService.hasActiveDirectory()) {
      const savedToDir = await fileSystemService.saveJsonFile(jsonString, fileName, {
        allowDownloadFallback: false,
        silentPermissionCheck: false,
      });
      if (savedToDir.success) {
        writeAutoBackupMeta({
          lastBackupAt: new Date().toISOString(),
          lastBackupFileName: fileName,
          lastBackupMode: 'filesystem',
          dirtyCountSinceBackup: 0,
        });
        return fileName;
      }
    }

    // Coba gunakan File System Access API jika didukung oleh browser
    if ('showSaveFilePicker' in window) {
      try {
        const winWithPicker = window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<{
            createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
          }>;
        };
        const handle = await winWithPicker.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'JSON Database File',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        return fileName;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Penyimpanan dibatalkan oleh pengguna.');
        }
        // Fallback jika ditolak
      }
    }

    // Android WebView: simpan langsung ke folder Download via bridge native
    if (fileSystemService.isNativeAndroidBridge()) {
      await fileSystemService.saveViaNativeBridge(jsonString, fileName, 'application/json');
      return fileName;
    }

    // Fallback Blob Download standar
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return fileName;
  },

  backupData(data: AppData): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `backup_perusahaan_${dateStr}_${timeStr}.json`;
    const jsonString = JSON.stringify(data, null, 2);

    pushToLocalBackupRing(data);

    // Jika folder lokal aktif tersedia, tulis juga ke folder lokal di latar belakang
    if (fileSystemService.hasActiveDirectory()) {
      void fileSystemService.saveJsonFile(jsonString, fileName, {
        allowDownloadFallback: false,
        silentPermissionCheck: true,
      });
    }

    // Android WebView: simpan backup JSON langsung ke folder Download
    if (fileSystemService.isNativeAndroidBridge()) {
      void fileSystemService.saveViaNativeBridge(jsonString, fileName, 'application/json');
      return fileName;
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return fileName;
  },

  // Baca dan validasi file JSON tanpa menulis ke IndexedDB (untuk preview).
  async importDataFromFile(file: File): Promise<AppData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const validated = this.validateAppData(content);
          const normalized = this.normalizeData(validated as unknown as Record<string, unknown>);
          resolve(normalized);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal membaca atau memproses file database.';
          reject(new Error(msg));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file dari disk.'));
      reader.readAsText(file);
    });
  },

  // Validasi mendalam isi backup: wajib JSON object dengan seluruh array yang
  // benar, metadata & settings, serta struktur item yang minimal benar.
  validateAppData(jsonString: string): AppData {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      throw new Error('File bukan JSON yang valid. Pastikan file backup berasal dari sistem ini.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Struktur file tidak valid: bukan objek database.');
    }

    // Wajib object metadata & settings
    if (!parsed.metadata || typeof parsed.metadata !== 'object') {
      throw new Error('File backup cacat: metadata perusahaan tidak ditemukan.');
    }
    if (!parsed.settings || typeof parsed.settings !== 'object') {
      throw new Error('File backup cacat: pengaturan sistem tidak ditemukan.');
    }

    // Wajib lima array data
    const arrayFields: Array<[string, string]> = [
      ['customers', 'Daftar pelanggan'],
      ['vehicles', 'Daftar armada'],
      ['lpgTransactions', 'Transaksi LPG'],
      ['expeditionTrips', 'Perjalanan ekspedisi'],
      ['expenses', 'Pengeluaran'],
    ];
    for (const [field, label] of arrayFields) {
      if (!Array.isArray(parsed[field])) {
        throw new Error(`File backup cacat: ${label} (${field}) bukan daftar array.`);
      }
    }

    // Setiap item harus objek dengan id
    for (const [field, label] of arrayFields) {
      const list = parsed[field] as Array<Record<string, unknown>>;
      for (const item of list) {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.id.length === 0) {
          throw new Error(`File backup cacat: terdapat ${label} tanpa id yang sah.`);
        }
      }
    }

    // Validasi nilai numerik penting agar laporan tidak menghasilkan NaN
    if (Array.isArray(parsed.lpgTransactions)) {
      for (const t of parsed.lpgTransactions as Array<Record<string, unknown>>) {
        if (t && typeof t.total !== 'undefined' && typeof t.total !== 'number') {
          throw new Error('File backup cacat: total transaksi LPG bukan angka.');
        }
      }
    }
    if (Array.isArray(parsed.expenses)) {
      for (const e of parsed.expenses as Array<Record<string, unknown>>) {
        if (e && typeof e.total !== 'undefined' && typeof e.total !== 'number') {
          throw new Error('File backup cacat: total pengeluaran bukan angka.');
        }
      }
    }

    return parsed as unknown as AppData;
  },

  // helper: hasil validateAppData adalah plain object baru dari JSON.parse.
  castStructuredCloneParsed<T>(input: T): T {
    return structuredClone(input);
  },

  // Restore penuh: simpan snapshot data aktif, tulis data baru atomically, dan
  // kembalikan snapshot bila penulisan gagal (rollback). Tidak merusak IndexedDB.
  async restoreDataFromFile(file: File): Promise<AppData> {
    await this.flushPendingAutoSave();
    const restored = await this.importDataFromFile(file); // baca + validasi (read-only)

    // Snapshot data aktif untuk rollback bila restore gagal.
    const backup = await this.loadAppDataAsync();
    pushToLocalBackupRing(backup);

    try {
      await this.saveAppDataAsync(restored);
    } catch (restoreError) {
      // Kembalikan data aktif sebelumnya agar IndexedDB tidak rusak.
      const message = restoreError instanceof Error ? restoreError.message : 'Unknown error';
      try {
        await dbService.writeAllStores({
          metadata: { id: 'app_metadata', ...backup.metadata },
          settings: { id: 'app_settings', ...backup.settings },
          customers: backup.customers,
          vehicles: backup.vehicles,
          lpgTransactions: backup.lpgTransactions,
          expeditionTrips: backup.expeditionTrips,
          expenses: backup.expenses,
        });
      } catch (rollbackError) {
        const rbMsg = rollbackError instanceof Error ? rollbackError.message : 'Unknown error';
        throw new Error(`Restore gagal: ${message}. Pemulihan data sebelumnya juga gagal: ${rbMsg}`);
      }
      throw new Error(`Restore gagal dan data sebelumnya telah dikembalikan: ${message}`);
    }

    return restored;
  },

  async resetToDefault(): Promise<AppData> {
    await this.flushPendingAutoSave();
    if (latestKnownAppData && hasMeaningfulMerchantData(latestKnownAppData)) {
      pushToLocalBackupRing(latestKnownAppData);
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MIGRATION_FLAG);
    await this.saveAppDataAsync(initialData);
    return initialData;
  },

  async clearAllData(keepMasterData: boolean = false, currentSettings?: AppData['settings']): Promise<AppData> {
    await this.flushPendingAutoSave();
    const prev = await this.loadAppDataAsync();
    if (hasMeaningfulMerchantData(prev)) {
      pushToLocalBackupRing(prev);
      void this.performAutoBackupToLocalFile(prev, 'lifecycle');
    }
    const emptyData: AppData = {
      metadata: {
        appName: 'Sistem Manajemen Operasional & Keuangan',
        version: '1.0.0',
        lastSaved: new Date().toISOString(),
        companyName: currentSettings?.companyName || prev.settings.companyName || 'Perusahaan Saya',
      },
      settings: currentSettings || prev.settings,
      customers: keepMasterData ? prev.customers : [],
      vehicles: keepMasterData ? prev.vehicles : [],
      lpgTransactions: [],
      expeditionTrips: [],
      expenses: [],
    };
    await this.saveAppDataAsync(emptyData);
    return emptyData;
  },
};
