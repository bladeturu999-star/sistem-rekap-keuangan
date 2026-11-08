import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Download,
  Flame,
  CircleCheck,
  TriangleAlert,
  Wallet,
  ContactRound,
  ChartNoAxesColumnIncreasing,
  FolderDown,
  Receipt
} from 'lucide-react';
import type { AppData } from '../types';
import { formatRupiah, formatDate, indonesianMonths } from '../utils/formatters';
import { excelExportService } from '../services/excelExport';
import { fileSystemService } from '../services/fileSystemService';

interface LpgReportsViewProps {
  appData: AppData;
}

export const LpgReportsView: React.FC<LpgReportsViewProps> = ({ appData }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [folderName, setFolderName] = useState(fileSystemService.getDirectoryName());

  const [exportNotif, setExportNotif] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const notifTimeoutRef = useRef<number | null>(null);

  const showExportNotif = useCallback((type: 'success' | 'error', message: string) => {
    setExportNotif({ type, message });
    if (notifTimeoutRef.current) {
      window.clearTimeout(notifTimeoutRef.current);
    }
    notifTimeoutRef.current = window.setTimeout(() => {
      setExportNotif(null);
    }, 7000);
  }, []);

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const monthName = indonesianMonths[selectedMonth - 1] || 'Bulan';

  const lpgTx = useMemo(() => appData.lpgTransactions.filter((t) => t.date.startsWith(monthStr)), [appData.lpgTransactions, monthStr]);
  const lpgExpenses = useMemo(() => appData.expenses.filter((e) => e.sector === 'lpg' && e.date.startsWith(monthStr)), [appData.expenses, monthStr]);

  const totalRev = useMemo(() => lpgTx.reduce((s, t) => s + t.total, 0), [lpgTx]);
  const totalExp = useMemo(() => lpgExpenses.reduce((s, e) => s + e.total, 0), [lpgExpenses]);
  const netProfit = totalRev - totalExp;
  const totalCylinders = useMemo(() => lpgTx.reduce((s, t) => s + t.quantity, 0), [lpgTx]);

  const customerAgg = useMemo(() => {
    const agg = new Map<string, { txCount: number; quantity: number; total: number }>();
    appData.customers.forEach(c => agg.set(c.id, { txCount: 0, quantity: 0, total: 0 }));
    lpgTx.forEach(t => {
      const c = agg.get(t.customerId);
      if (c) {
        c.txCount++;
        c.quantity += t.quantity;
        c.total += t.total;
      }
    });
    return agg;
  }, [appData.customers, lpgTx]);

  const handleSelectFolder = async () => {
    const res = await fileSystemService.selectDirectory();
    if (res.success) {
      setFolderName(res.folderName);
      showExportNotif('success', `Folder penyimpanan otomatis diatur ke: "${res.folderName}"`);
    }
  };

  const handleExport = async () => {
    try {
      const periodLabel = `${monthName} ${selectedYear}`;
      const fileNameSuffix = `${monthName}_${selectedYear}`;
      const res = await excelExportService.exportLpgRecap(appData, lpgTx, lpgExpenses, periodLabel, fileNameSuffix);
      if (res.mode === 'filesystem') {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil OTOMATIS disimpan di folder: "${res.folderName}"!`);
      } else {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil diunduh ke komputer Anda!`);
      }
    } catch (error: any) {
      showExportNotif('error', `Gagal mengekspor file Excel: ${error?.message || error}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        className="panel-banner lpg"
      >
        <div>
          <span className="badge badge-lpg" style={{ marginBottom: '8px', fontSize: '0.7rem' }}>REKAPITULASI DIVISI LPG 3 KG</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Laporan Keuangan & Penjualan LPG {monthName} {selectedYear}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', maxWidth: '560px' }}>
            Detail transaksi, analisis, dan ekspor data: rekap penjualan tabung, rekapitulasi pelanggan, dan rincian biaya operasional pangkalan
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>PILIH BULAN</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="form-select"
              style={{ minWidth: '140px', fontWeight: '600' }}
            >
              {indonesianMonths.map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>TAHUN</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="form-select"
              style={{ width: '90px', fontWeight: '600' }}
            >
              {Array.from({ length: 28 }, (_, i) => 2023 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={handleExport}
              className="btn btn-success btn-lg"
              style={{ fontWeight: '600' }}
            >
              <Download size={18} />
              <span>Download Excel LPG</span>
            </button>
            <button
              type="button"
              onClick={handleSelectFolder}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.75rem', color: folderName ? 'var(--color-lpg)' : 'var(--text-muted)', border: '1px solid var(--border-medium)', background: '#fff' }}
              title="Tentukan folder di komputer Anda agar ekspor tersimpan otomatis"
            >
              <FolderDown size={13} />
              <span>{folderName ? `Simpan: 📁 ${folderName}` : '📁 Atur Folder Simpan'}</span>
            </button>
          </div>
        </div>
      </div>

      {exportNotif && (
        <div style={{
          backgroundColor: exportNotif.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light, #ffebee)',
          border: `1px solid ${exportNotif.type === 'success' ? 'var(--color-success-border)' : 'var(--color-error, #f44336)'}`,
          color: exportNotif.type === 'success' ? 'var(--color-success-text)' : 'var(--color-error, #d32f2f)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {exportNotif.type === 'success' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
          <span>{exportNotif.message}</span>
        </div>
      )}

      {/* Metric Cards for LPG Month */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ '--card-accent': 'var(--color-lpg)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Total Penjualan LPG</span>
            <ChartNoAxesColumnIncreasing size={18} style={{ color: 'var(--color-lpg)' }} />
          </div>
          <div className="stat-value">{formatRupiah(totalRev)}</div>
          <div className="stat-footer">{totalCylinders} Tabung Terjual</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': 'var(--color-danger)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Biaya Pangkalan LPG</span>
            <Wallet size={18} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div className="stat-value">{formatRupiah(totalExp)}</div>
          <div className="stat-footer">{lpgExpenses.length} Pos Pengeluaran</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Laba Bersih Divisi LPG</span>
            <Flame size={18} style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }} />
          </div>
          <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatRupiah(netProfit)}
          </div>
          <div className="stat-footer">Penjualan LPG − Biaya Pangkalan</div>
        </div>
      </div>

      {/* Rekap Pelanggan LPG Bulan Ini */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <ContactRound size={18} style={{ color: 'var(--color-lpg)' }} />
            Rekapitulasi Pembelian per Pelanggan ({monthName} {selectedYear})
          </h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Pelanggan</th>
                <th>Telepon</th>
                <th>Alamat</th>
                <th>Transaksi</th>
                <th>Total Tabung</th>
                <th>Total Nilai Pembelian</th>
              </tr>
            </thead>
            <tbody>
              {appData.customers.map((c, idx) => {
                const agg = customerAgg.get(c.id) || { txCount: 0, quantity: 0, total: 0 };
                return (
                  <tr key={c.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: '600' }}>{c.name}</td>
                    <td>{c.phone || '-'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{c.address || '-'}</td>
                    <td>{agg.txCount} Kali</td>
                    <td><span className="badge badge-lpg">{agg.quantity} Tabung</span></td>
                    <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-lpg-text)' }}>
                      {formatRupiah(agg.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rincian Biaya Operasional LPG */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Receipt size={18} style={{ color: 'var(--color-danger)' }} />
            Rincian Biaya Operasional Pangkalan ({monthName} {selectedYear})
          </h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Deskripsi Pengeluaran</th>
                <th>Kuantitas</th>
                <th>Harga Satuan</th>
                <th>Total Biaya</th>
              </tr>
            </thead>
            <tbody>
              {lpgExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                    Tidak ada biaya operasional LPG di bulan ini
                  </td>
                </tr>
              ) : (
                lpgExpenses.map((e, idx) => (
                  <tr key={e.id}>
                    <td>{idx + 1}</td>
                    <td>{formatDate(e.date, 'short')}</td>
                    <td><span className="badge badge-lpg">{e.category}</span></td>
                    <td style={{ fontWeight: '600' }}>{e.description}</td>
                    <td>{e.quantity}</td>
                    <td className="font-mono">{formatRupiah(e.unitPrice)}</td>
                    <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-danger)' }}>{formatRupiah(e.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
