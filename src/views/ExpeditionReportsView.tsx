import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Download,
  Truck,
  CircleCheck,
  TriangleAlert,
  Wallet,
  ChartNoAxesColumnIncreasing,
  Gauge,
  FolderDown
} from 'lucide-react';
import type { AppData } from '../types';
import { formatRupiah, formatNumber, indonesianMonths } from '../utils/formatters';
import { excelExportService } from '../services/excelExport';
import { fileSystemService } from '../services/fileSystemService';

interface ExpeditionReportsViewProps {
  appData: AppData;
}

export const ExpeditionReportsView: React.FC<ExpeditionReportsViewProps> = ({ appData }) => {
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

  const trips = useMemo(() => appData.expeditionTrips.filter((t) => t.date.startsWith(monthStr)), [appData.expeditionTrips, monthStr]);
  const expenses = useMemo(() => appData.expenses.filter((e) => e.sector === 'expedition' && e.date.startsWith(monthStr)), [appData.expenses, monthStr]);

  const totalRev = useMemo(() => trips.reduce((s, t) => s + t.totalRevenue, 0), [trips]);
  const totalCost = useMemo(() => expenses.reduce((s, e) => s + e.total, 0), [expenses]);
  const netProfit = totalRev - totalCost;
  const totalKm = useMemo(() => trips.reduce((s, t) => s + (t.distanceKm || 0), 0), [trips]);
  const totalTon = useMemo(() => trips.reduce((s, t) => s + (t.weightKg ? t.weightKg / 1000 : (t.tonnage || 0)), 0), [trips]);

  const bbmExpenses = useMemo(() => expenses.filter((e) => e.category === 'BBM'), [expenses]);
  const totalBbm = useMemo(() => bbmExpenses.reduce((s, e) => s + e.total, 0), [bbmExpenses]);
  const totalLiters = useMemo(() => bbmExpenses.reduce((s, e) => s + (e.fuelDetails?.liters || 0), 0), [bbmExpenses]);

  const vehicleAgg = useMemo(() => {
    const agg = new Map<string, { tripsCount: number; rev: number; km: number; ton: number; bbm: number; other: number }>();
    appData.vehicles.forEach(v => agg.set(v.plateNumber, { tripsCount: 0, rev: 0, km: 0, ton: 0, bbm: 0, other: 0 }));
    
    trips.forEach(t => {
      const v = agg.get(t.plateNumber);
      if (v) {
        v.tripsCount++;
        v.rev += t.totalRevenue;
        v.km += (t.distanceKm || 0);
        v.ton += (t.weightKg ? t.weightKg / 1000 : (t.tonnage || 0));
      }
    });

    expenses.forEach(e => {
      if (e.targetPlate) {
        const v = agg.get(e.targetPlate);
        if (v) {
          if (e.category === 'BBM') v.bbm += e.total;
          else v.other += e.total;
        }
      }
    });
    return agg;
  }, [appData.vehicles, trips, expenses]);

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
      const res = await excelExportService.exportExpeditionRecap(appData, trips, expenses, periodLabel, fileNameSuffix);
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
        className="panel-banner expedition"
      >
        <div>
          <span className="badge badge-fleet" style={{ marginBottom: '8px', fontSize: '0.7rem' }}>REKAPITULASI DIVISI EKSPEDISI</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Laporan Kinerja & Keuangan Ekspedisi {monthName} {selectedYear}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', maxWidth: '560px' }}>
            Rekap perjalanan rit truk, efisiensi BBM, biaya perawatan armada, dan profitabilitas tiap mobil
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
              <span>Download Excel Ekspedisi</span>
            </button>
            <button
              type="button"
              onClick={handleSelectFolder}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.75rem', color: folderName ? 'var(--color-fleet)' : 'var(--text-muted)', border: '1px solid var(--border-medium)', background: '#fff' }}
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

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ '--card-accent': 'var(--color-fleet)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Pendapatan Ekspedisi</span>
            <ChartNoAxesColumnIncreasing size={18} style={{ color: 'var(--color-fleet)' }} />
          </div>
          <div className="stat-value">{formatRupiah(totalRev)}</div>
          <div className="stat-footer">{trips.length} Rit • {formatNumber(totalKm)} Km</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': 'var(--color-danger)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Beban Operasional Armada</span>
            <Wallet size={18} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div className="stat-value">{formatRupiah(totalCost)}</div>
          <div className="stat-footer">BBM ({formatRupiah(totalBbm)} / {totalLiters} L) + Servis/Lain</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Laba Bersih Divisi Ekspedisi</span>
            <Truck size={18} style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }} />
          </div>
          <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatRupiah(netProfit)}
          </div>
          <div className="stat-footer">Pendapatan Ekspedisi − Beban Armada</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': 'var(--color-lpg)' } as any}>
          <div className="stat-top">
            <span className="stat-label">Total Muatan</span>
            <Gauge size={18} style={{ color: 'var(--color-lpg)' }} />
          </div>
          <div className="stat-value">{formatNumber(totalTon)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Ton</span></div>
          <div className="stat-footer">{appData.vehicles.length} Armada Aktif</div>
        </div>
      </div>

      {/* Tabel Kinerja & Profitabilitas Armada Tiap Mobil */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Truck size={18} style={{ color: 'var(--color-fleet)' }} />
            Rekap Kinerja & Profitabilitas per Unit Armada ({monthName} {selectedYear})
          </h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Plat Kendaraan</th>
                <th>Nama Armada</th>
                <th>Driver</th>
                <th>Rit</th>
                <th>Jarak</th>
                <th>Tonase</th>
                <th>Pendapatan</th>
                <th>BBM</th>
                <th>Servis/Lain</th>
                <th>Total Biaya</th>
                <th>Laba Mobil Ini</th>
              </tr>
            </thead>
            <tbody>
              {appData.vehicles.map((v, idx) => {
                const agg = vehicleAgg.get(v.plateNumber) || { tripsCount: 0, rev: 0, km: 0, ton: 0, bbm: 0, other: 0 };
                const vCost = agg.bbm + agg.other;
                const vProf = agg.rev - vCost;

                return (
                  <tr key={v.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{v.plateNumber}</td>
                    <td style={{ fontWeight: '600' }}>{v.vehicleName}</td>
                    <td>{v.defaultDriver}</td>
                    <td>{agg.tripsCount}</td>
                    <td className="font-mono">{agg.km} Km</td>
                    <td>{agg.ton} Ton</td>
                    <td className="font-mono" style={{ color: 'var(--color-success)', fontWeight: '600' }}>{formatRupiah(agg.rev)}</td>
                    <td className="font-mono" style={{ color: 'var(--color-warning)' }}>{formatRupiah(agg.bbm)}</td>
                    <td className="font-mono" style={{ color: 'var(--color-danger)' }}>{formatRupiah(agg.other)}</td>
                    <td className="font-mono" style={{ color: 'var(--color-danger)', fontWeight: '600' }}>{formatRupiah(vCost)}</td>
                    <td className="font-mono" style={{ fontWeight: '600', color: vProf >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatRupiah(vProf)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
