import React, { useState } from 'react';
import { TriangleAlert, Trash2, CircleCheck, ShieldAlert, X, Database } from 'lucide-react';
import type { AppData } from '../types';

interface ClearAllDataModalProps {
  isOpen?: boolean;
  onClose: () => void;
  appData: AppData;
  onClearAll?: (keepMasterData: boolean) => void;
  onConfirm?: (keepMasterData: boolean) => void;
}

export const ClearAllDataModal: React.FC<ClearAllDataModalProps> = ({
  isOpen = true,
  onClose,
  appData,
  onClearAll,
  onConfirm,
}) => {
  const [step1Confirmed, setStep1Confirmed] = useState(false);
  const [keepMasterData, setKeepMasterData] = useState(true);

  if (isOpen === false) return null;

  const handleClose = () => {
    setStep1Confirmed(false);
    onClose();
  };

  const handleExecute = () => {
    if (!step1Confirmed) return;
    if (onClearAll) {
      onClearAll(keepMasterData);
    } else if (onConfirm) {
      onConfirm(keepMasterData);
    }
    handleClose();
  };

  const totalRecords =
    appData.lpgTransactions.length +
    appData.expeditionTrips.length +
    appData.expenses.length +
    (keepMasterData ? 0 : appData.customers.length + appData.vehicles.length);

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '560px',
          border: '2px solid var(--color-danger)',
          boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.25), 0 8px 10px -6px rgba(239, 68, 68, 0.2)',
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-medium)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-danger)',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-danger)', margin: 0 }}>
                Hapus Seluruh Data (Mulai dari Nol)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Perlu 2 langkah konfirmasi bertahap agar data tidak terhapus karena salah klik
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="btn btn-outline btn-sm"
            style={{ border: 'none', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Warning Message */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              color: 'var(--text-main)',
              lineHeight: '1.5',
            }}
          >
            <strong>Peringatan Penting:</strong> Fitur ini digunakan jika Anda ingin <strong>membersihkan semua data transaksi contoh/demo</strong> dan memulai pencatatan pembukuan riil bisnis Anda dari nol (saldo Rp 0).
          </div>

          {/* Records Summary */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={15} />
              <span>Data yang akan dikosongkan ({totalRecords} catatan):</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: 'var(--text-muted)' }}>
              <div>• Penjualan Gas LPG: <strong style={{ color: 'var(--text-main)' }}>{appData.lpgTransactions.length} transaksi</strong></div>
              <div>• Trip Ekspedisi: <strong style={{ color: 'var(--text-main)' }}>{appData.expeditionTrips.length} perjalanan</strong></div>
              <div>• Biaya Operasional: <strong style={{ color: 'var(--text-main)' }}>{appData.expenses.length} pengeluaran</strong></div>
              <div>• Data Pelanggan: <strong style={{ color: 'var(--text-main)' }}>{keepMasterData ? 'Tetap Tersimpan' : `${appData.customers.length} dihapus`}</strong></div>
            </div>
          </div>

          {/* Master Data Option */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: keepMasterData ? 'rgba(2, 132, 199, 0.06)' : 'transparent',
              border: keepMasterData ? '1px solid var(--border-medium)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            <input
              type="checkbox"
              checked={keepMasterData}
              onChange={(e) => setKeepMasterData(e.target.checked)}
              style={{ marginTop: '2px', accentColor: 'var(--color-primary)' }}
            />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                Tetap Simpan Daftar Pelanggan ({appData.customers.length}) & Armada Mobil ({appData.vehicles.length})
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                Rekomendasi: Hanya bersihkan seluruh riwayat transaksi & pengeluaran keuangan, nama pelanggan & kendaraan tetap ada sehingga langsung siap dipakai.
              </div>
            </div>
          </label>

          {/* Two-Step Action Box */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: step1Confirmed ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-subtle)',
              border: step1Confirmed ? '1px dashed var(--color-danger)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Step 1 Button */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: step1Confirmed ? 'var(--color-success)' : 'var(--text-muted)', marginBottom: '6px' }}>
                Langkah 1 dari 2:
              </div>
              <button
                type="button"
                onClick={() => setStep1Confirmed(!step1Confirmed)}
                className={`btn btn-sm ${step1Confirmed ? 'btn-outline' : 'btn-secondary'}`}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontWeight: '600',
                  borderColor: step1Confirmed ? 'var(--color-success)' : undefined,
                  color: step1Confirmed ? 'var(--color-success)' : undefined,
                }}
              >
                {step1Confirmed ? (
                  <>
                    <CircleCheck size={16} />
                    <span>✓ Tahap 1 Terkonfirmasi (Klik lagi jika ingin batal)</span>
                  </>
                ) : (
                  <>
                    <TriangleAlert size={15} />
                    <span>1. Klik Konfirmasi Penghapusan</span>
                  </>
                )}
              </button>
            </div>

            {/* Step 2 Final Button */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: step1Confirmed ? 'var(--color-danger)' : 'var(--text-dim)', marginBottom: '6px' }}>
                Langkah 2 dari 2:
              </div>
              <button
                type="button"
                disabled={!step1Confirmed}
                onClick={handleExecute}
                className="btn btn-danger"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '10px 16px',
                  fontWeight: '700',
                  opacity: step1Confirmed ? 1 : 0.45,
                  cursor: step1Confirmed ? 'pointer' : 'not-allowed',
                  boxShadow: step1Confirmed ? '0 4px 12px rgba(239, 68, 68, 0.35)' : 'none',
                }}
              >
                <Trash2 size={16} />
                <span>2. Ya, Setuju Hapus Seluruh Data Sekarang</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Batal (Tutup & Data Tetap Aman)
          </button>
        </div>
      </div>
    </div>
  );
};
