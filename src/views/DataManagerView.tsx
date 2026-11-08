import { useState, useRef } from 'react';
import {
  Save,
  FolderOpen,
  Archive,
  RotateCcw,
  CircleCheck,
  TriangleAlert,
  ShieldCheck,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';
import type { AppData } from '../types';
import { storageService } from '../services/storage';
import { ClearAllDataModal } from '../components/ClearAllDataModal';

import { indonesianMonths } from '../utils/formatters';

interface DataManagerViewProps {
  appData: AppData;
  onDataLoaded: (data: AppData) => void;
  isDirty: boolean;
  setIsDirty: (val: boolean) => void;
  onResetData: () => void;
  onClearAllData?: (keepMasterData: boolean) => void;
}

export const DataManagerView: React.FC<DataManagerViewProps> = ({
  appData,
  onDataLoaded,
  isDirty,
  setIsDirty,
  onResetData,
  onClearAllData,
}) => {
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<AppData | null>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentDateStr = now.toISOString().split('T')[0];
  const currentMonthStr = `${indonesianMonths[now.getMonth()]} ${currentYear}`;

  const showNotification = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 6000);
  };

  // Simpan Data JSON ke File
  const handleSaveData = async () => {
    try {
      const fileName = await storageService.exportDataToFile(appData);
      setIsDirty(false);
      showNotification(`File database "${fileName}" berhasil disimpan ke perangkat Anda!`, 'success');
    } catch (e: any) {
      if (e.message && e.message.includes('dibatalkan')) {
        showNotification('Penyimpanan dibatalkan oleh pengguna.', 'warning');
      } else {
        showNotification(e.message || 'Gagal menyimpan database.', 'error');
      }
    }
  };

  // Backup Data Bertanggal
  const handleBackupData = () => {
    try {
      const fileName = storageService.backupData(appData);
      showNotification(`File cadangan "${fileName}" berhasil diunduh. Simpan file ini di tempat aman!`, 'success');
    } catch (e: any) {
      showNotification('Gagal membuat file backup.', 'error');
    }
  };

  // Buka Data (Muat File)
  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    storageService
      .importDataFromFile(file)
      .then((data) => {
        onDataLoaded(data);
        setIsDirty(false);
        showNotification(`Database "${file.name}" berhasil dimuat ke aplikasi!`, 'success');
      })
      .catch((err) => {
        showNotification(err.message, 'error');
      });

    e.target.value = '';
  };

  // Trigger Restore Input — hanya BACA + validasi untuk preview, belum menulis.
  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    storageService
      .importDataFromFile(file)
      .then((data) => {
        setPendingRestoreFile(file);
        setPendingRestoreData(data);
        setShowRestoreModal(true);
      })
      .catch((err) => {
        showNotification(err.message, 'error');
      });

    e.target.value = '';
  };

  // Execute Restore — menulis ke IndexedDB HANYA setelah konfirmasi, dengan rollback.
  const confirmRestore = async () => {
    const restored = pendingRestoreData;
    if (pendingRestoreFile && restored) {
      setIsRestoring(true);
      try {
        await storageService.restoreDataFromFile(pendingRestoreFile);
        onDataLoaded(restored);
        setIsDirty(false);
        setShowRestoreModal(false);
        setPendingRestoreData(null);
        setPendingRestoreFile(null);
        showNotification('Seluruh data berhasil dipulihkan dari file backup!', 'success');
      } catch (err: any) {
        console.error('Error during restore:', err);
        showNotification(err.message || 'Gagal memulihkan data backup. Data aktif tetap dipertahankan.', 'error');
      } finally {
        setIsRestoring(false);
      }
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleOpenFile}
        accept=".json"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={restoreInputRef}
        onChange={handleSelectRestoreFile}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Notification Banner */}
      {statusMsg && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor:
              statusMsg.type === 'success'
                ? 'var(--color-success-light)'
                : statusMsg.type === 'error'
                ? 'var(--color-danger-light)'
                : 'var(--color-warning-light)',
            border: `1px solid ${
              statusMsg.type === 'success'
                ? 'var(--color-success-border)'
                : statusMsg.type === 'error'
                ? 'var(--color-danger-border)'
                : 'var(--color-warning-border)'
            }`,
            color:
              statusMsg.type === 'success'
                ? 'var(--color-success-text)'
                : statusMsg.type === 'error'
                ? 'var(--color-danger-text)'
                : 'var(--color-warning-text)',
            fontWeight: '600',
          }}
        >
          {statusMsg.type === 'success' ? (
            <CircleCheck size={20} />
          ) : (
            <TriangleAlert size={20} />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Information Header */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--color-primary)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <ShieldCheck size={22} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Pusat Pengelolaan Database File Lokal (100% Offline)
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', lineHeight: '1.6' }}>
          Data perusahaan Anda disimpan seutuhnya di komputer/laptop Anda dan tidak pernah dikirim ke internet ataupun cloud.
          Gunakan tombol di bawah ini untuk menyimpan database ke file lokal, memindahkan data ke laptop lain, atau membuat file backup cadangan.
        </p>

        {/* Database Status Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Status Penyimpanan: </span>
            {isDirty ? (
              <span className="badge badge-warning">Ada Perubahan Belum Disimpan</span>
            ) : (
              <span className="badge badge-success">Data Tersimpan Aman</span>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Terakhir disimpan: <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{new Date(appData.metadata.lastSaved).toLocaleString('id-ID')}</span>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Total Entri: <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
              {appData.customers.length} Pelanggan • {appData.vehicles.length} Armada • {appData.lpgTransactions.length} Transaksi LPG • {appData.expeditionTrips.length} Perjalanan • {appData.expenses.length} Pengeluaran
            </span>
          </div>
        </div>
      </div>

      {/* Main Operations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* 1. SIMPAN DATA */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Save size={18} />
            </div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', marginBottom: '6px' }}>Simpan Data (Save)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Simpan seluruh database aktif ke file JSON di komputer Anda (contoh: <code>database_perusahaan_{currentYear}.json</code>).
            </p>
          </div>
          <button onClick={handleSaveData} className="btn btn-primary" style={{ width: '100%' }}>
            <Save size={16} />
            <span>Simpan Data Sekarang</span>
          </button>
        </div>

        {/* 2. BUKA DATA */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-fleet-light)', border: '1px solid var(--color-fleet-border)', color: 'var(--color-fleet)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <FolderOpen size={18} />
            </div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', marginBottom: '6px' }}>Buka Data (Open)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Pilih dan buka file database yang sebelumnya telah disimpan. Cocok jika Anda berganti laptop atau memuat data dari flashdisk.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <FolderOpen size={16} />
            <span>Pilih File Database (.json)</span>
          </button>
        </div>

        {/* 3. BACKUP DATA */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Archive size={18} />
            </div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', marginBottom: '6px' }}>Backup Data Berkala</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Buat salinan cadangan bertanggal otomatis (contoh: <code>backup_perusahaan_{currentDateStr}.json</code>) untuk arsip perusahaan.
            </p>
          </div>
          <button onClick={handleBackupData} className="btn btn-success" style={{ width: '100%' }}>
            <Archive size={16} />
            <span>Unduh File Backup</span>
          </button>
        </div>

        {/* 4. RESTORE DATA */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <RotateCcw size={18} />
            </div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', marginBottom: '6px' }}>Restore Data</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Pulihkan data dari file backup sebelumnya. Sistem akan meminta konfirmasi sebelum data aktif ditimpa.
            </p>
          </div>
          <button
            onClick={() => restoreInputRef.current?.click()}
            className="btn btn-outline"
            style={{ width: '100%', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}
          >
            <RotateCcw size={16} />
            <span>Pilih File Backup untuk Restore</span>
          </button>
        </div>
      </div>


      {/* Database Reset & Wipe Section */}
      <div className="card" style={{ border: '1px solid var(--color-danger-border)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Opsi 1: Hapus Seluruh Data (Mulai dari Nol) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h4 style={{ color: 'var(--color-danger)', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} />
                <span>Hapus Seluruh Data (Mulai dari Nol)</span>
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Mengosongkan semua riwayat transaksi, perjalanan, dan pengeluaran. Dilengkapi <strong>2 langkah konfirmasi bertahap</strong> untuk keamanan dari salah klik.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="btn btn-danger btn-sm"
              style={{ fontWeight: '600' }}
            >
              <Trash2 size={14} />
              <span>Hapus Seluruh Data (Mulai dari Nol)</span>
            </button>
          </div>

          {/* Opsi 2: Reset ke Data Demo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h5 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Reset ke Data Demo Awal</h5>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Mengembalikan sistem ke data percontohan awal (Pelanggan CA/CB, Armada Siantar, dan transaksi {currentMonthStr}).
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('PERINGATAN: Apakah Anda yakin ingin mereset seluruh database kembali ke data contoh bawaan?')) {
                  onResetData();
                  showNotification('Database telah direset ke data contoh bawaan.', 'success');
                }
              }}
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}
            >
              <RefreshCw size={14} />
              <span>Reset Database Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI RESTORE DATA                                            */}
      {/* ========================================================================= */}
      {showRestoreModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '600', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TriangleAlert size={22} />
                Konfirmasi Restore Database
              </h3>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 0', fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '12px', fontWeight: '600' }}>
                {isRestoring
                  ? 'Sedang memulihkan data dari file backup, mohon tunggu…'
                  : '«"Data yang sedang digunakan akan digantikan dengan data dari file backup. Lanjutkan?"»'}
              </p>
              {pendingRestoreFile && (
                <div style={{ marginBottom: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  <strong>File terpilih:</strong> {pendingRestoreFile.name}
                </div>
              )}
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                <div><strong>Perusahaan:</strong> {pendingRestoreData?.settings.companyName || '-'}</div>
                <div><strong>Pelanggan:</strong> {pendingRestoreData?.customers.length || 0}</div>
                <div><strong>Armada Kendaraan:</strong> {pendingRestoreData?.vehicles.length || 0}</div>
                <div><strong>Transaksi LPG:</strong> {pendingRestoreData?.lpgTransactions.length || 0}</div>
                <div><strong>Perjalanan Ekspedisi:</strong> {pendingRestoreData?.expeditionTrips.length || 0}</div>
                <div><strong>Pengeluaran:</strong> {pendingRestoreData?.expenses.length || 0}</div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="btn btn-secondary"
                disabled={isRestoring}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                className="btn btn-danger"
                disabled={isRestoring}
              >
                {isRestoring ? 'Memulihkan…' : 'Restore Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: HAPUS SELURUH DATA (2 TAHAP KONFIRMASI)                            */}
      {/* ========================================================================= */}
      <ClearAllDataModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        appData={appData}
        onClearAll={(keepMaster) => {
          onClearAllData?.(keepMaster);
          showNotification(
            keepMaster
              ? 'Seluruh riwayat transaksi & pengeluaran berhasil dikosongkan. Daftar pelanggan & armada tetap tersimpan!'
              : 'Seluruh database berhasil dibersihkan total. Anda siap mencatat dari nol!',
            'success'
          );
        }}
      />
    </div>
  );
};

