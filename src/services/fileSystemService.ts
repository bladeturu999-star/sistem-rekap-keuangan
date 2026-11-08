import * as XLSX from 'xlsx';

// IndexedDB database & store name for FileSystemHandle
const DB_NAME = 'SistemKeuanganFSA';
const DB_VERSION = 1;
const STORE_NAME = 'directory_handles';
const HANDLE_KEY = 'export_directory';

class FileSystemService {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private dirName: string = '';
  private isInitialized: boolean = false;

  constructor() {
    // Attempt to restore directory name from localStorage
    try {
      this.dirName = localStorage.getItem('export_folder_name') || '';
    } catch {
      this.dirName = '';
    }
  }

  // Open IndexedDB
  private getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Initialize and retrieve stored directory handle if available
  public async init(): Promise<string> {
    if (this.isInitialized && this.dirHandle) {
      return this.dirName;
    }

    try {
      if (!('showDirectoryPicker' in window)) {
        return '';
      }

      const db = await this.getDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);

      return new Promise((resolve) => {
        req.onsuccess = async () => {
          const handle = req.result as FileSystemDirectoryHandle | undefined;
          if (handle) {
            try {
              // Verify permission state
              const permission = await (handle as any).queryPermission?.({ mode: 'readwrite' });
              if (permission === 'granted') {
                this.dirHandle = handle;
                this.dirName = handle.name;
                localStorage.setItem('export_folder_name', handle.name);
                this.isInitialized = true;
                resolve(handle.name);
                return;
              }
            } catch {
              // permission check failed
            }
          }
          this.isInitialized = true;
          resolve(this.dirName || '');
        };
        req.onerror = () => {
          this.isInitialized = true;
          resolve(this.dirName || '');
        };
      });
    } catch {
      this.isInitialized = true;
      return this.dirName || '';
    }
  }

  // Check if File System Access API is supported
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  // Prompt user to pick a folder on their device
  public async selectDirectory(): Promise<{ success: boolean; folderName: string; error?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        folderName: '',
        error: 'Browser Anda tidak mendukung pemilihan folder langsung (File System API). File akan diunduh secara normal ke folder Download.',
      };
    }

    try {
      let handle: any;
      try {
        handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          id: 'rekap-keuangan-export',
          startIn: 'documents',
        });
      } catch (optErr: any) {
        if (optErr.name === 'AbortError') throw optErr;
        // Fallback without options in case browser rejected parameters
        handle = await (window as any).showDirectoryPicker();
      }

      this.dirHandle = handle;
      this.dirName = handle.name;
      localStorage.setItem('export_folder_name', handle.name);

      // Save handle in IndexedDB
      try {
        const db = await this.getDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(handle, HANDLE_KEY);
      } catch (e) {
        console.warn('Could not persist handle in IndexedDB:', e);
      }

      return { success: true, folderName: handle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, folderName: this.dirName, error: 'Pemilihan folder dibatalkan.' };
      }
      return { success: false, folderName: this.dirName, error: err.message || 'Gagal memilih folder.' };
    }
  }

  // Reset or disconnect folder
  public async clearDirectory(): Promise<void> {
    this.dirHandle = null;
    this.dirName = '';
    try {
      localStorage.removeItem('export_folder_name');
      const db = await this.getDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(HANDLE_KEY);
    } catch {
      // ignore
    }
  }

  public getDirectoryName(): string {
    return this.dirName;
  }

  public hasActiveDirectory(): boolean {
    return !!this.dirHandle;
  }

  // Deteksi apakah berjalan di dalam WebView Android native (bridge tersedia).
  public isNativeAndroidBridge(): boolean {
    return typeof (window as any).AndroidBridge !== 'undefined'
      && typeof (window as any).AndroidBridge?.saveFile === 'function';
  }

  // Mengirim byte (base64) + nama file + mime ke bridge native agar disimpan di
  // folder Download Android. Backup JSON & Excel tetap dalam format aslinya.
  public async saveViaNativeBridge(data: Uint8Array | string, fileName: string, mimeType: string): Promise<boolean> {
    const bridge = (window as any).AndroidBridge;
    if (!bridge || typeof bridge.saveFile !== 'function') return false;

    let base64: string;
    if (typeof data === 'string') {
      base64 = this.arrayBufferToBase64(new TextEncoder().encode(data));
    } else {
      base64 = this.arrayBufferToBase64(data);
    }
    bridge.saveFile(base64, fileName, mimeType);
    return true;
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < buffer.length; i += chunk) {
      binary += String.fromCharCode.apply(null, buffer.subarray(i, i + chunk) as any);
    }
    return window.btoa(binary);
  }

  // Save Excel file to the selected folder, or fallback to browser download
  public async saveExcel(
    wb: XLSX.WorkBook,
    fileName: string
  ): Promise<{ success: boolean; fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    // Generate binary buffer (cellStyles: true agar styling header & numFmt Rp tersimpan)
    let excelBuffer: any;
    try {
      excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    } catch (err) {
      console.error('Failed to generate Excel buffer:', err);
      throw new Error('Gagal melakukan proses penulisan file Excel. Pastikan data tidak korup.');
    }

    // Check if we have an active directory handle
    if (this.dirHandle) {
      try {
        // Check/request permission if needed
        const permission = await (this.dirHandle as any).requestPermission?.({ mode: 'readwrite' });
        if (permission === 'granted' || !permission) {
          const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
          const writable = await (fileHandle as any).createWritable();
          await writable.write(excelBuffer);
          await writable.close();

          return {
            success: true,
            fileName,
            folderName: this.dirName,
            mode: 'filesystem',
          };
        }
      } catch (err) {
        console.warn('Error saving to directory handle, falling back to browser download:', err);
      }
    }

    // Fallback: Trigger standard browser file download
    try {
      // Di Android WebView native lebih andal disimpan langsung via bridge
      if (this.isNativeAndroidBridge()) {
        const saved = await this.saveViaNativeBridge(
          new Uint8Array(excelBuffer),
          fileName,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        if (saved) {
          return { success: true, fileName, folderName: 'FOLDER_DOWNLOAD_ANDROID', mode: 'download' };
        }
      }
      XLSX.writeFile(wb, fileName, { cellStyles: true });
      return {
        success: true,
        fileName,
        folderName: 'Folder Download Default Browser',
        mode: 'download',
      };
    } catch {
      // Blob URL fallback
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return {
        success: true,
        fileName,
        folderName: 'Folder Download Default Browser',
        mode: 'download',
      };
    }
  }

  // Simpan file JSON backup ke folder lokal aktif, Android bridge, atau unduhan browser
  public async saveJsonFile(
    jsonString: string,
    fileName: string,
    options: { allowDownloadFallback?: boolean; silentPermissionCheck?: boolean } = {}
  ): Promise<{ success: boolean; fileName: string; folderName?: string; mode: 'filesystem' | 'android-bridge' | 'download' | 'skipped' }> {
    const { allowDownloadFallback = false, silentPermissionCheck = true } = options;

    if (!this.isInitialized) {
      await this.init();
    }

    // 1. Jika ada folder lokal (File System Access API)
    if (this.dirHandle) {
      try {
        const handleAny = this.dirHandle as unknown as {
          queryPermission?: (desc: { mode: 'readwrite' }) => Promise<string>;
          requestPermission?: (desc: { mode: 'readwrite' }) => Promise<string>;
        };
        const perm = silentPermissionCheck
          ? await handleAny.queryPermission?.({ mode: 'readwrite' })
          : await handleAny.requestPermission?.({ mode: 'readwrite' });

        if (perm === 'granted' || !perm) {
          const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
          const writable = await (fileHandle as unknown as {
            createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
          }).createWritable();
          await writable.write(jsonString);
          await writable.close();
          return {
            success: true,
            fileName,
            folderName: this.dirName,
            mode: 'filesystem',
          };
        }
      } catch (err) {
        console.warn('Gagal menulis auto-backup JSON ke folder lokal:', err);
      }
    }

    // 2. Jika berjalan di Android WebView dengan Native Bridge
    if (this.isNativeAndroidBridge()) {
      try {
        const saved = await this.saveViaNativeBridge(jsonString, fileName, 'application/json');
        if (saved) {
          return {
            success: true,
            fileName,
            folderName: 'FOLDER_DOWNLOAD_ANDROID',
            mode: 'android-bridge',
          };
        }
      } catch (err) {
        console.warn('Gagal menulis auto-backup JSON via AndroidBridge:', err);
      }
    }

    // 3. Fallback unduhan browser bila diizinkan
    if (allowDownloadFallback && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return {
        success: true,
        fileName,
        folderName: 'Folder Download Default Browser',
        mode: 'download',
      };
    }

    return {
      success: false,
      fileName,
      mode: 'skipped',
    };
  }
}

export const fileSystemService = new FileSystemService();
