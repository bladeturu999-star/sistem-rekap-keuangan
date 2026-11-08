import { useState, useMemo, useRef, useCallback } from 'react';
import {
  FileChartColumn,
  Download,
  ListCollapse,
  ChartNoAxesColumnIncreasing,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CircleCheck,
  TriangleAlert,
  Layers,
  Table2,
  ArrowUpDown
} from 'lucide-react';
import type { AppData, FinancialSummary, ActiveTab } from '../types';
import {
  formatRupiah,
  formatDate,
  formatNumber,
  indonesianMonths,
} from '../utils/formatters';
import { excelExportService } from '../services/excelExport';

interface ReportsViewProps {
  appData: AppData;
  financialSummary: FinancialSummary;
  activeSubTab: 'monthly-recap' | 'reports';
  onSubTabChange: (tab: ActiveTab) => void;
  periodLabel: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  appData,
  financialSummary,
  activeSubTab,
  onSubTabChange,
  periodLabel,
}) => {
  // Monthly Excel Export State
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [activePreviewSheet, setActivePreviewSheet] = useState<number>(1);

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

  const handleExportMonthly = async () => {
    try {
      const monthName = indonesianMonths[selectedMonth - 1] || 'Bulan';
      const lpgFiltered = appData.lpgTransactions.filter((t) => t.date.startsWith(monthKey));
      const expFiltered = appData.expeditionTrips.filter((t) => t.date.startsWith(monthKey));
      const expensesFiltered = appData.expenses.filter((e) => e.date.startsWith(monthKey));
      const periodLabel = `${monthName} ${selectedYear}`;
      const fileNameSuffix = `${monthName}_${selectedYear}`;
      const res = await excelExportService.exportMonthlyRecap(appData, lpgFiltered, expFiltered, expensesFiltered, periodLabel, fileNameSuffix);
      if (res.mode === 'filesystem') {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil otomatis disimpan ke folder: "${res.folderName}"!`);
      } else {
        showExportNotif('success', `File Excel "${res.fileName}" berhasil diunduh ke komputer Anda!`);
      }
    } catch (error: any) {
      showExportNotif('error', `Gagal mengekspor file Excel: ${error?.message || error}`);
    }
  };

  // Filter data for selected preview month — dibungkus useMemo agar tidak
  // dihitung ulang setiap render (sebelumnya 8 filter/reduce bebas di body komponen)
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const {
    lpgMonth,
    expMonth,
    lpgRevMonth,
    expRevMonth,
    totalRevMonth,
    lpgCostMonth,
    vehCostMonth,
    genCostMonth,
    totalCostMonth,
    netProfitMonth,
    vehicleAgg,
  } = useMemo(() => {
    const lpgMonth = appData.lpgTransactions.filter((t) => t.date.startsWith(monthKey));
    const expMonth = appData.expeditionTrips.filter((t) => t.date.startsWith(monthKey));
    const expExpensesMonth = appData.expenses.filter((e) => e.date.startsWith(monthKey));

    const lpgRevMonth = lpgMonth.reduce((s, t) => s + t.total, 0);
    const expRevMonth = expMonth.reduce((s, t) => s + t.totalRevenue, 0);
    const totalRevMonth = lpgRevMonth + expRevMonth;

    const lpgCostMonth = expExpensesMonth.filter((e) => e.sector === 'lpg').reduce((s, e) => s + e.total, 0);
    const vehCostMonth = expExpensesMonth.filter((e) => e.sector === 'expedition').reduce((s, e) => s + e.total, 0);
    const genCostMonth = expExpensesMonth.filter((e) => e.sector === 'general').reduce((s, e) => s + e.total, 0);
    const totalCostMonth = lpgCostMonth + vehCostMonth + genCostMonth;
    const netProfitMonth = totalRevMonth - totalCostMonth;

    const vehicleAgg = new Map<string, { tripsCount: number; km: number; rev: number; cost: number }>();
    appData.vehicles.forEach(v => {
      vehicleAgg.set(v.plateNumber, { tripsCount: 0, km: 0, rev: 0, cost: 0 });
    });

    expMonth.forEach(t => {
      const agg = vehicleAgg.get(t.plateNumber);
      if (agg) {
        agg.tripsCount++;
        agg.km += (t.distanceKm || 0);
        agg.rev += t.totalRevenue;
      }
    });

    expExpensesMonth.forEach(e => {
      if (e.targetPlate) {
        const agg = vehicleAgg.get(e.targetPlate);
        if (agg) {
          agg.cost += e.total;
        }
      }
    });

    return {
      lpgMonth,
      expMonth,
      lpgRevMonth,
      expRevMonth,
      totalRevMonth,
      lpgCostMonth,
      vehCostMonth,
      genCostMonth,
      totalCostMonth,
      netProfitMonth,
      vehicleAgg,
    };
  }, [appData.lpgTransactions, appData.expeditionTrips, appData.expenses, appData.vehicles, monthKey]);

  // Dynamic Periodic Recap for Reports tab (Harian, Mingguan, Bulanan, Tahunan)
  // Hitung dinamis dari transaksi tanpa buat data agregat palsu
  const [recapTimeScale, setRecapTimeScale] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recapSortMode, setRecapSortMode] = useState<'date_desc' | 'date_asc' | 'rev_desc' | 'rev_asc' | 'exp_desc' | 'exp_asc' | 'profit_desc' | 'profit_asc'>('date_desc');

  // Grouping generator with useMemo for performance optimization
  const periodicRecapList = useMemo(() => {
    const groups: Record<string, { label: string; lpgRev: number; expRev: number; expenses: number }> = {};

    const getGroupKey = (dateStr: string) => {
      let key = dateStr;
      let label = formatDate(dateStr, 'short');
      
      if (recapTimeScale === 'monthly') {
        key = dateStr.slice(0, 7);
        const [y, m] = key.split('-');
        label = `${indonesianMonths[parseInt(m, 10) - 1]} ${y}`;
      } else if (recapTimeScale === 'yearly') {
        key = dateStr.slice(0, 4);
        label = `Tahun ${key}`;
      } else if (recapTimeScale === 'weekly') {
        const d = new Date(dateStr);
        const day = d.getDay(); // 0 = Sunday, 1 = Monday
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        label = `Minggu ${formatDate(key, 'short')}`;
      }
      return { key, label };
    };

    // LPG Transactions
    (appData.lpgTransactions || []).forEach((t) => {
      const { key, label } = getGroupKey(t.date);
      if (!groups[key]) groups[key] = { label, lpgRev: 0, expRev: 0, expenses: 0 };
      groups[key].lpgRev += t.total;
    });

    // Expedition Trips
    (appData.expeditionTrips || []).forEach((t) => {
      const { key, label } = getGroupKey(t.date);
      if (!groups[key]) groups[key] = { label, lpgRev: 0, expRev: 0, expenses: 0 };
      groups[key].expRev += t.totalRevenue;
    });

    // Expenses
    (appData.expenses || []).forEach((e) => {
      const { key, label } = getGroupKey(e.date);
      if (!groups[key]) groups[key] = { label, lpgRev: 0, expRev: 0, expenses: 0 };
      groups[key].expenses += e.total;
    });

    const result = Object.entries(groups)
      .map(([key, val]) => ({
        key,
        ...val,
        totalRev: val.lpgRev + val.expRev,
        netProfit: val.lpgRev + val.expRev - val.expenses,
      }));

    return result.sort((a, b) => {
      if (recapSortMode === 'date_desc') return b.key.localeCompare(a.key);
      if (recapSortMode === 'date_asc') return a.key.localeCompare(b.key);
      if (recapSortMode === 'rev_desc') return b.totalRev - a.totalRev;
      if (recapSortMode === 'rev_asc') return a.totalRev - b.totalRev;
      if (recapSortMode === 'exp_desc') return b.expenses - a.expenses;
      if (recapSortMode === 'exp_asc') return a.expenses - b.expenses;
      if (recapSortMode === 'profit_desc') return b.netProfit - a.netProfit;
      if (recapSortMode === 'profit_asc') return a.netProfit - b.netProfit;
      return 0;
    });
  }, [appData.lpgTransactions, appData.expeditionTrips, appData.expenses, recapTimeScale, recapSortMode]);

  const handleSortToggle = (field: string) => {
    setRecapSortMode((prev: string) => {
      if (prev.startsWith(field)) {
        return prev.endsWith('_desc') ? `${field}_asc` as any : `${field}_desc` as any;
      }
      return `${field}_desc` as any;
    });
  };

  const renderSortableHeader = (label: string, field: string, isRightAlign = false) => {
    const isActive = recapSortMode.startsWith(field);
    const isAsc = isActive && recapSortMode.endsWith('_asc');
    
    return (
      <th 
        style={{ cursor: 'pointer', userSelect: 'none', textAlign: isRightAlign ? 'right' : 'left' }}
        onClick={() => handleSortToggle(field)}
        title={`Urutkan berdasarkan ${label}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRightAlign ? 'flex-end' : 'flex-start', gap: '4px' }}>
          {label}
          {isActive && (
            <ArrowUpDown size={14} style={{ transform: isAsc ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />
          )}
        </div>
      </th>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub Tabs */}
      <div className="tabs-nav">
        <button
          onClick={() => onSubTabChange('monthly-recap')}
          className={`tab-btn highlight-excel ${activeSubTab === 'monthly-recap' ? 'active' : ''}`}
          style={{ fontWeight: '600' }}
        >
          <FileChartColumn size={16} />
          <span>Pusat Export Excel Bulanan (8 Sheet Terpisah)</span>
          <span className="badge badge-success">Siap Unduh</span>
        </button>

        <button
          onClick={() => onSubTabChange('reports')}
          className={`tab-btn ${activeSubTab === 'reports' ? 'active' : ''}`}
        >
          <ListCollapse size={16} />
          <span>Laporan Keuangan & Rekap Dinamis</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. TAB: PUSAT EXPORT EXCEL BULANAN                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'monthly-recap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Action Card with Month Selector */}
          <div
            className="panel-banner consolidation"
            style={{ padding: '24px 28px' }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '0.71875rem', fontWeight: '400', marginBottom: '10px', letterSpacing: 'normal' }}>
                <CircleCheck size={12} />
                <span>1-KLIK GENERATOR EXCEL RESMI</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
                Unduh Rekap Laporan Bulanan (.xlsx)
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px', maxWidth: '600px' }}>
                Sistem menghasilkan 1 file workbook Excel lengkap dengan 8 sheet terpisah per kategori: Ringkasan Bulanan, Penjualan LPG, Pengeluaran LPG, Rekap Pelanggan, Perjalanan Ekspedisi, Pengeluaran Ekspedisi, Rekap Kendaraan, dan Pengeluaran Umum (dengan format Rp otomatis).
              </p>
            </div>

            <div className="report-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '3px' }}>PILIH BULAN</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="form-select"
                  style={{ minWidth: '150px', fontWeight: '600' }}
                >
                  {indonesianMonths.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '3px' }}>TAHUN</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="form-select"
                  style={{ width: '100px', fontWeight: '600' }}
                >
                  {Array.from({ length: 28 }, (_, i) => 2023 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  onClick={handleExportMonthly}
                  className="btn btn-success btn-lg"
                  style={{ fontWeight: '600', padding: '12px 28px' }}
                >
                  <Download size={20} />
                  <span>Download Excel {indonesianMonths[selectedMonth - 1]} {selectedYear}</span>
                </button>
              </div>
            </div>
          </div>

          {exportNotif && (
            <div
              style={{
                backgroundColor: exportNotif.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light, #ffebee)',
                border: `1px solid ${exportNotif.type === 'success' ? 'var(--color-success-border)' : 'var(--color-error, #f44336)'}`,
                color: exportNotif.type === 'success' ? 'var(--color-success-text)' : 'var(--color-error, #d32f2f)',
                padding: '14px 20px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: '600',
              }}
            >
              {exportNotif.type === 'success' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
              <span>{exportNotif.message}</span>
            </div>
          )}

          {/* Snapshot Summary of Selected Month */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="stat-card" style={{ '--card-accent': 'var(--color-lpg)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Total Pendapatan Bulan Ini</span>
                <ChartNoAxesColumnIncreasing size={18} style={{ color: 'var(--color-lpg)' }} />
              </div>
              <div className="stat-value">{formatRupiah(totalRevMonth)}</div>
              <div className="stat-footer">LPG: {formatRupiah(lpgRevMonth)} • Ekspedisi: {formatRupiah(expRevMonth)}</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': 'var(--color-danger)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Total Pengeluaran Bulan Ini</span>
                <Wallet size={18} style={{ color: 'var(--color-danger)' }} />
              </div>
              <div className="stat-value">{formatRupiah(totalCostMonth)}</div>
              <div className="stat-footer">Armada: {formatRupiah(vehCostMonth)} • LPG & Umum: {formatRupiah(lpgCostMonth + genCostMonth)}</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': netProfitMonth >= 0 ? 'var(--color-success)' : 'var(--color-danger)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Laba Bersih Bulan Ini</span>
                {netProfitMonth >= 0 ? <ArrowUpRight size={18} style={{ color: 'var(--color-success)' }} /> : <ArrowDownRight size={18} style={{ color: 'var(--color-danger)' }} />}
              </div>
              <div className="stat-value" style={{ color: netProfitMonth >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatRupiah(netProfitMonth)}
              </div>
              <div className="stat-footer"></div>
            </div>

            <div className="stat-card" style={{ '--card-accent': 'var(--color-fleet)' } as any}>
              <div className="stat-top">
                <span className="stat-label">Volume & Aktivitas</span>
                <Layers size={18} style={{ color: 'var(--color-fleet)' }} />
              </div>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                {lpgMonth.reduce((s, t) => s + t.quantity, 0)} Tabung • {expMonth.length} Rit
              </div>
              <div className="stat-footer">{appData.vehicles.length} Armada Aktif</div>
            </div>
          </div>

          {/* Interactive Sheet Previewer */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap' }}>
              <div>
                <h3 className="card-title">
                  <Table2 size={18} style={{ color: 'var(--color-success)' }} />
                  Pratinjau Struktur Isi Sheet Excel (.xlsx)
                </h3>
                <p className="card-subtitle">
                  Klik nama sheet di bawah ini untuk melihat pratinjau tabel yang akan tercetak di file Excel
                </p>
              </div>
            </div>

            {/* Sheet Tabs */}
            <div className="tabs-nav" style={{ marginBottom: '16px' }}>
              {[
                { id: 1, name: 'Sheet 1: Ringkasan Bulanan' },
                { id: 2, name: 'Sheet 2: Penjualan LPG' },
                { id: 6, name: 'Sheet 3: Pengeluaran LPG' },
                { id: 3, name: 'Sheet 4: Rekap Pelanggan' },
                { id: 4, name: 'Sheet 5: Perjalanan Ekspedisi' },
                { id: 7, name: 'Sheet 6: Pengeluaran Ekspedisi' },
                { id: 5, name: 'Sheet 7: Rekap Kendaraan' },
                { id: 8, name: 'Sheet 8: Pengeluaran Umum' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActivePreviewSheet(s.id)}
                  className={`tab-btn ${activePreviewSheet === s.id ? 'active' : ''}`}
                  style={{ fontSize: '0.8rem' }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* Sheet 1: Summary Preview */}
            {activePreviewSheet === 1 && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Indikator Laporan</th>
                      <th style={{ textAlign: 'right' }}>Nilai / Angka</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: '600', color: 'var(--color-lpg)' }}>Pendapatan Penjualan LPG 3 Kg</td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600' }}>{formatRupiah(lpgRevMonth)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '600', color: 'var(--color-fleet)' }}>Pendapatan Jasa Ekspedisi Armada</td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600' }}>{formatRupiah(expRevMonth)}</td>
                    </tr>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', borderTop: '1px solid var(--border-medium)' }}>
                      <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>TOTAL PENDAPATAN USAHA</td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-primary)' }}>{formatRupiah(totalRevMonth)}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Beban Operasional LPG</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--color-danger)' }}>{formatRupiah(lpgCostMonth)}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Beban Armada Ekspedisi (BBM, Servis, Oli, Ban)</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--color-danger)' }}>{formatRupiah(vehCostMonth)}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Beban Operasional Umum Kantor</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--color-danger)' }}>{formatRupiah(genCostMonth)}</td>
                    </tr>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', borderTop: '1px solid var(--border-medium)' }}>
                      <td style={{ fontWeight: '600', color: 'var(--color-danger-text)' }}>TOTAL PENGELUARAN OPERASIONAL</td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-danger)' }}>{formatRupiah(totalCostMonth)}</td>
                    </tr>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', borderTop: '2px solid var(--text-main)' }}>
                      <td style={{ fontWeight: '600', fontSize: '1rem', color: netProfitMonth >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>Laba Bersih Bulan Ini</td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.1rem', color: netProfitMonth >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatRupiah(netProfitMonth)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Sheet 2: Penjualan LPG Preview */}
            {activePreviewSheet === 2 && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Pelanggan</th>
                      <th>Jumlah Tabung</th>
                      <th>Harga Satuan</th>
                      <th>Total Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lpgMonth.map((t) => (
                      <tr key={t.id}>
                        <td>{formatDate(t.date, 'short')}</td>
                        <td style={{ fontWeight: '600' }}>{t.customerName}</td>
                        <td>{t.quantity} Tabung</td>
                        <td className="font-mono">{formatRupiah(t.pricePerUnit)}</td>
                        <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-lpg)' }}>{formatRupiah(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sheet 4: Ekspedisi Preview */}
            {activePreviewSheet === 4 && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Plat Mobil</th>
                      <th>Driver</th>
                      <th>Rute / Tujuan</th>
                      <th>Muatan (Kg)</th>
                      <th>Tarif/Kg</th>
                      <th>Uang Jalan</th>
                      <th>Hasil Perjalanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expMonth.map((t) => (
                      <tr key={t.id}>
                        <td>{formatDate(t.date, 'short')}</td>
                        <td style={{ fontWeight: '600', color: 'var(--color-fleet)' }}>{t.plateNumber}</td>
                        <td>{t.driver}</td>
                        <td>{t.destination}</td>
                        <td className="font-mono">{formatNumber(t.weightKg || 0)} Kg</td>
                        <td className="font-mono">{formatRupiah(t.ratePerKg || 0)} / Kg</td>
                        <td className="font-mono" style={{ color: t.travelAllowance ? 'var(--color-danger)' : 'var(--text-dim)' }}>
                          {t.travelAllowance ? formatRupiah(t.travelAllowance) : 'Rp 0'}
                        </td>
                        <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                          {formatRupiah(t.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sheet 5: Rekap Armada Preview */}
            {activePreviewSheet === 5 && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plat Nomor</th>
                      <th>Nama Armada</th>
                      <th>Rit</th>
                      <th>Total Km</th>
                      <th>Pendapatan</th>
                      <th>Biaya Mobil</th>
                      <th>Laba Operasional Mobil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appData.vehicles.map((v) => {
                      const agg = vehicleAgg.get(v.plateNumber) || { tripsCount: 0, km: 0, rev: 0, cost: 0 };
                      const rev = agg.rev;
                      const km = agg.km;
                      const cost = agg.cost;
                      const prof = rev - cost;
                      return (
                        <tr key={v.id}>
                          <td style={{ fontWeight: '600', color: 'var(--color-fleet)' }}>{v.plateNumber}</td>
                          <td>{v.vehicleName}</td>
                          <td>{agg.tripsCount}</td>
                          <td>{km} Km</td>
                          <td className="font-mono" style={{ color: 'var(--color-success)' }}>{formatRupiah(rev)}</td>
                          <td className="font-mono" style={{ color: 'var(--color-danger)' }}>{formatRupiah(cost)}</td>
                          <td className="font-mono" style={{ fontWeight: '600', color: prof >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {formatRupiah(prof)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activePreviewSheet !== 1 && activePreviewSheet !== 2 && activePreviewSheet !== 4 && activePreviewSheet !== 5 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                Sheet {activePreviewSheet} terformat rapi di dalam file Excel yang diunduh.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: LAPORAN KEUANGAN & REKAP DINAMIS                                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Laporan Laba Rugi Komprehensif */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <ListCollapse size={20} style={{ color: 'var(--color-primary)' }} />
                  Laporan Laba Rugi Perusahaan ({periodLabel.toUpperCase()})
                </h3>
                <p className="card-subtitle">
                  Konsolidasi seluruh pendapatan usaha dikurangi seluruh beban operasional
                </p>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Komponen Keuangan</th>
                    <th>Divisi / Sektor</th>
                    <th style={{ textAlign: 'right' }}>Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: '600' }}>Pendapatan Distribusi Gas LPG 3 Kg</td>
                    <td><span className="badge badge-lpg">LPG</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-lpg)' }}>
                      {formatRupiah(financialSummary.lpgRevenue)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: '600' }}>Pendapatan Jasa Ekspedisi / Transportasi</td>
                    <td><span className="badge badge-fleet">Ekspedisi</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-fleet)' }}>
                      {formatRupiah(financialSummary.expeditionRevenue)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderTop: '1px solid var(--border-medium)' }}>
                    <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>Total Pendapatan</td>
                    <td><span className="badge badge-primary">Total Masuk</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                      {formatRupiah(financialSummary.totalRevenue)}
                    </td>
                  </tr>

                  <tr>
                    <td>Beban Operasional LPG (Listrik, air, gaji staf, bongkar muat)</td>
                    <td><span className="badge badge-lpg">Beban LPG</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                      {formatRupiah(financialSummary.lpgExpenses)}
                    </td>
                  </tr>
                  <tr>
                    <td>Beban Operasional Armada Ekspedisi (BBM, oli, ban, servis, sparepart)</td>
                    <td><span className="badge badge-fleet">Beban Armada</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                      {formatRupiah(financialSummary.expeditionExpenses)}
                    </td>
                  </tr>
                  <tr>
                    <td>Beban Operasional Umum & Kantor (PLN kantor, sewa, internet, admin)</td>
                    <td><span className="badge badge-neutral">Overhead</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                      {formatRupiah(financialSummary.generalExpenses)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderTop: '1px solid var(--border-medium)' }}>
                    <td style={{ fontWeight: '600', color: 'var(--color-danger-text)' }}>Total Pengeluaran Operasional</td>
                    <td><span className="badge badge-danger">Total Keluar</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.05rem', color: 'var(--color-danger)' }}>
                      {formatRupiah(financialSummary.totalExpenses)}
                    </td>
                  </tr>

                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderTop: '2px solid var(--text-main)' }}>
                    <td style={{ fontWeight: '600', fontSize: '1rem', color: financialSummary.netProfit >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>Laba Bersih Perusahaan</td>
                    <td>
                      <span className={`badge ${financialSummary.netProfit >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.8rem' }}>
                        {financialSummary.netProfit >= 0 ? 'SURPLUS / LABA' : 'DEFISIT / RUGI'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.125rem', color: financialSummary.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatRupiah(financialSummary.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Rekap Harian / Bulanan / Tahunan */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap' }}>
              <div>
                <h3 className="card-title">
                  <ChartNoAxesColumnIncreasing size={20} style={{ color: 'var(--color-success)' }} />
                  Rekapitulasi Berkala Dinamis
                </h3>
                <p className="card-subtitle">
                  Dihitung otomatis secara langsung dari transaksi asli tanpa membuat baris palsu
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setRecapTimeScale('daily')}
                    className={`btn ${recapTimeScale === 'daily' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  >
                    Harian
                  </button>
                  <button
                    onClick={() => setRecapTimeScale('weekly')}
                    className={`btn ${recapTimeScale === 'weekly' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  >
                    Mingguan
                  </button>
                  <button
                    onClick={() => setRecapTimeScale('monthly')}
                    className={`btn ${recapTimeScale === 'monthly' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => setRecapTimeScale('yearly')}
                    className={`btn ${recapTimeScale === 'yearly' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  >
                    Tahunan
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sortir:</span>
                  <select
                    value={recapSortMode}
                    onChange={(e) => setRecapSortMode(e.target.value as any)}
                    className="form-select"
                    style={{ fontSize: '0.85rem', padding: '6px 30px 6px 12px' }}
                  >
                    <option value="date_desc">Tanggal Terbaru</option>
                    <option value="date_asc">Tanggal Terlama</option>
                    <option value="rev_desc">Pemasukan Terbesar</option>
                    <option value="rev_asc">Pemasukan Terkecil</option>
                    <option value="exp_desc">Pengeluaran Terbesar</option>
                    <option value="exp_asc">Pengeluaran Terkecil</option>
                    <option value="profit_desc">Laba Bersih Terbesar</option>
                    <option value="profit_asc">Laba Bersih Terkecil</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {renderSortableHeader('Periode', 'date')}
                    {/* LPG & Ekspedisi combined in rev_desc logic for total, so here we can sort by 'rev' for total revenue */}
                    <th>Pendapatan LPG</th>
                    <th>Pendapatan Ekspedisi</th>
                    {renderSortableHeader('Total Pendapatan', 'rev')}
                    {renderSortableHeader('Pengeluaran', 'exp')}
                    {renderSortableHeader('Laba Bersih Periode', 'profit')}
                  </tr>
                </thead>
                <tbody>
                  {periodicRecapList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                        Tidak ada transaksi tercatat untuk rekapitulasi ini
                      </td>
                    </tr>
                  ) : (
                    periodicRecapList.map((row) => (
                      <tr key={row.key}>
                        <td style={{ fontWeight: '600' }}>{row.label}</td>
                        <td className="font-mono">{formatRupiah(row.lpgRev)}</td>
                        <td className="font-mono">{formatRupiah(row.expRev)}</td>
                        <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{formatRupiah(row.totalRev)}</td>
                        <td className="font-mono" style={{ color: 'var(--color-danger)' }}>{formatRupiah(row.expenses)}</td>
                        <td className="font-mono" style={{ fontWeight: '600', color: row.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {formatRupiah(row.netProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
