import { useState, useMemo } from 'react';
import {
  Building,
  CircleDollarSign,
  Wallet,
  FileChartColumn,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  FolderDown,
  TrendingUp,
  TrendingDown,
  ChartNoAxesColumnIncreasing,
  Flame,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import type {
  AppData,
  FinancialSummary,
  Expense,
  DateFilterType,
  DateRange,
  CompanySettings,
} from '../types';
import {
  formatRupiah,
  formatDate,
  getTodayDateString,
  indonesianMonths,
} from '../utils/formatters';
import { ExpenseCategoryInput } from '../components/ExpenseCategoryInput';
import { DateFilterBar } from '../components/DateFilterBar';
import { fileSystemService } from '../services/fileSystemService';
import { storageService } from '../services/storage';

interface ConsolidationViewProps {
  appData: AppData;
  financialSummary: FinancialSummary;
  onExportMonthlyExcel: () => void;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateSettings?: (settings: Partial<CompanySettings>) => void;
  periodLabel: string;
  isDateInFilter: (dateStr: string) => boolean;
  dateFilter: DateFilterType;
  setDateFilter: (f: DateFilterType) => void;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
}

interface WeeklyBucket {
  id: string;
  label: string;
  shortLabel: string;
  rangeText: string;
  lpgRevenue: number;
  expeditionRevenue: number;
  totalRevenue: number;
  txCount: number;
  wowPct: number | null;
}

// Helper ringkas nominal pada sumbu Y chart (mis. Rp 12,5 Jt / Rp 750 Rb)
function formatCompactRupiah(val: number): string {
  if (val >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (val >= 1_000_000) {
    const jt = val / 1_000_000;
    return `Rp ${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1).replace('.', ',')} Jt`;
  }
  if (val >= 1_000) {
    return `Rp ${Math.round(val / 1_000)} Rb`;
  }
  return `Rp ${val}`;
}

export const ConsolidationView: React.FC<ConsolidationViewProps> = ({
  appData,
  financialSummary,
  onExportMonthlyExcel,
  onAddExpense,
  onDeleteExpense,
  onUpdateSettings,
  periodLabel,
  isDateInFilter,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
}) => {
  const [folderName, setFolderName] = useState(
    fileSystemService.getDirectoryName()
  );
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number | null>(null);

  const handleSelectFolder = async () => {
    const res = await fileSystemService.selectDirectory();
    if (res.success) {
      setFolderName(res.folderName);
      void storageService.performAutoBackupToLocalFile(appData, 'manual');
    }
  };

  const [showGenExpModal, setShowGenExpModal] = useState(false);
  const [expDate, setExpDate] = useState(getTodayDateString());
  const [expCategory, setExpCategory] = useState('Listrik Kantor');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expNotes, setExpNotes] = useState('');
  const [expError, setExpError] = useState('');

  const isProfit = financialSummary.netProfit >= 0;
  const profitMargin =
    financialSummary.totalRevenue > 0
      ? ((financialSummary.netProfit / financialSummary.totalRevenue) * 100).toFixed(1)
      : '0.0';

  const lpgPercent =
    financialSummary.totalRevenue > 0
      ? ((financialSummary.lpgRevenue / financialSummary.totalRevenue) * 100).toFixed(0)
      : '0';
  const expPercent =
    financialSummary.totalRevenue > 0
      ? ((financialSummary.expeditionRevenue / financialSummary.totalRevenue) * 100).toFixed(0)
      : '0';

  const totalCashflowVolume =
    financialSummary.totalRevenue + financialSummary.totalExpenses;
  const incomeBarPct =
    totalCashflowVolume > 0
      ? Math.round((financialSummary.totalRevenue / totalCashflowVolume) * 100)
      : 50;
  const expenseBarPct = totalCashflowVolume > 0 ? 100 - incomeBarPct : 50;

  const generalExpenses = useMemo(
    () =>
      appData.expenses.filter(
        (e) => e.sector === 'general' && isDateInFilter(e.date)
      ),
    [appData.expenses, isDateInFilter]
  );
  const totalGeneralExpenses = useMemo(
    () => generalExpenses.reduce((s, e) => s + e.total, 0),
    [generalExpenses]
  );

  // Agregasi Tren Omzet Mingguan (LPG vs Ekspedisi) — O(N) useMemo
  const weeklyTrend = useMemo(() => {
    const filteredLpg = appData.lpgTransactions.filter((t) =>
      isDateInFilter(t.date)
    );
    const filteredExp = appData.expeditionTrips.filter((t) =>
      isDateInFilter(t.date)
    );

    // Tentukan apakah rentang berada dalam satu bulan kalender (mode Minggu 1..4)
    const allDates: string[] = [
      ...filteredLpg.map((t) => t.date),
      ...filteredExp.map((t) => t.date),
    ].filter(Boolean);

    const uniqueMonths = new Set(allDates.map((d) => d.slice(0, 7)));
    const isSingleMonthMode =
      dateFilter === 'month' ||
      dateFilter === 'today' ||
      dateFilter === 'week' ||
      uniqueMonths.size <= 1;

    const buckets: WeeklyBucket[] = [];

    if (isSingleMonthMode) {
      // Ambil bulan referensi dari transaksi yang ada atau bulan sistem saat ini
      const sampleMonth =
        allDates.length > 0
          ? allDates[0].slice(0, 7)
          : getTodayDateString().slice(0, 7);
      const [yrStr, moStr] = sampleMonth.split('-');
      const yr = parseInt(yrStr, 10) || new Date().getFullYear();
      const mo = parseInt(moStr, 10) || new Date().getMonth() + 1;
      const lastDayOfMonth = new Date(yr, mo, 0).getDate();
      const shortMonth = (indonesianMonths[mo - 1] || 'Bulan').slice(0, 3);

      const weekRanges: Array<{ label: string; shortLabel: string; startDay: number; endDay: number }> = [
        { label: 'Minggu 1', shortLabel: 'Mgg 1', startDay: 1, endDay: 7 },
        { label: 'Minggu 2', shortLabel: 'Mgg 2', startDay: 8, endDay: 14 },
        { label: 'Minggu 3', shortLabel: 'Mgg 3', startDay: 15, endDay: 21 },
        {
          label: 'Minggu 4',
          shortLabel: 'Mgg 4',
          startDay: 22,
          endDay: lastDayOfMonth,
        },
      ];

      for (const wr of weekRanges) {
        const pad = (n: number) => String(n).padStart(2, '0');
        buckets.push({
          id: `${sampleMonth}-${wr.shortLabel}`,
          label: wr.label,
          shortLabel: wr.shortLabel,
          rangeText: `${pad(wr.startDay)}–${pad(wr.endDay)} ${shortMonth}`,
          lpgRevenue: 0,
          expeditionRevenue: 0,
          totalRevenue: 0,
          txCount: 0,
          wowPct: null,
        });
      }

      for (const tx of filteredLpg) {
        const day = parseInt(tx.date.slice(8, 10), 10) || 1;
        const idx = Math.min(3, Math.floor((day - 1) / 7));
        buckets[idx].lpgRevenue += tx.total;
        buckets[idx].totalRevenue += tx.total;
        buckets[idx].txCount += 1;
      }

      for (const tr of filteredExp) {
        const day = parseInt(tr.date.slice(8, 10), 10) || 1;
        const idx = Math.min(3, Math.floor((day - 1) / 7));
        buckets[idx].expeditionRevenue += tr.totalRevenue;
        buckets[idx].totalRevenue += tr.totalRevenue;
        buckets[idx].txCount += 1;
      }
    } else {
      // Mode multi-bulan: kelompokkan per awal minggu (Senin) dan ambil maks 6 minggu terakhir
      const weekMap = new Map<
        string,
        {
          mondayDate: Date;
          lpgRevenue: number;
          expeditionRevenue: number;
          txCount: number;
        }
      >();

      const getMondayKey = (dateStr: string): { key: string; monday: Date } => {
        const parts = dateStr.split('-');
        const d = new Date(
          parseInt(parts[0], 10),
          (parseInt(parts[1], 10) || 1) - 1,
          parseInt(parts[2], 10) || 1
        );
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        const key = `${monday.getFullYear()}-${String(
          monday.getMonth() + 1
        ).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        return { key, monday };
      };

      for (const tx of filteredLpg) {
        const { key, monday } = getMondayKey(tx.date);
        const cur = weekMap.get(key) || {
          mondayDate: monday,
          lpgRevenue: 0,
          expeditionRevenue: 0,
          txCount: 0,
        };
        cur.lpgRevenue += tx.total;
        cur.txCount += 1;
        weekMap.set(key, cur);
      }

      for (const tr of filteredExp) {
        const { key, monday } = getMondayKey(tr.date);
        const cur = weekMap.get(key) || {
          mondayDate: monday,
          lpgRevenue: 0,
          expeditionRevenue: 0,
          txCount: 0,
        };
        cur.expeditionRevenue += tr.totalRevenue;
        cur.txCount += 1;
        weekMap.set(key, cur);
      }

      const sortedKeys = Array.from(weekMap.keys()).sort().slice(-6);
      sortedKeys.forEach((key, idx) => {
        const item = weekMap.get(key)!;
        const sunday = new Date(item.mondayDate);
        sunday.setDate(item.mondayDate.getDate() + 6);
        const mShort = (
          indonesianMonths[item.mondayDate.getMonth()] || ''
        ).slice(0, 3);
        const sShort = (indonesianMonths[sunday.getMonth()] || '').slice(0, 3);
        const d1 = String(item.mondayDate.getDate()).padStart(2, '0');
        const d2 = String(sunday.getDate()).padStart(2, '0');
        const rangeText =
          mShort === sShort ? `${d1}–${d2} ${mShort}` : `${d1} ${mShort}–${d2} ${sShort}`;

        buckets.push({
          id: key,
          label: `Pekan ${idx + 1}`,
          shortLabel: `Pkn ${idx + 1}`,
          rangeText,
          lpgRevenue: item.lpgRevenue,
          expeditionRevenue: item.expeditionRevenue,
          totalRevenue: item.lpgRevenue + item.expeditionRevenue,
          txCount: item.txCount,
          wowPct: null,
        });
      });
    }

    // Hitung persentase pertumbuhan Week-over-Week (WoW)
    for (let i = 1; i < buckets.length; i++) {
      const prev = buckets[i - 1].totalRevenue;
      const curr = buckets[i].totalRevenue;
      if (prev > 0) {
        buckets[i].wowPct = Number((((curr - prev) / prev) * 100).toFixed(1));
      } else if (curr > 0) {
        buckets[i].wowPct = 100;
      } else {
        buckets[i].wowPct = 0;
      }
    }

    const maxWeeklyRevenue = Math.max(
      ...buckets.map((b) => b.totalRevenue),
      1
    );
    const highestBucketIdx = buckets.reduce(
      (bestIdx, b, idx, arr) =>
        b.totalRevenue >= arr[bestIdx].totalRevenue ? idx : bestIdx,
      0
    );

    return {
      buckets,
      maxWeeklyRevenue,
      highestBucketIdx,
    };
  }, [appData.lpgTransactions, appData.expeditionTrips, isDateInFilter, dateFilter]);

  const activeWeekIdx =
    selectedWeekIdx !== null &&
    selectedWeekIdx >= 0 &&
    selectedWeekIdx < weeklyTrend.buckets.length
      ? selectedWeekIdx
      : weeklyTrend.highestBucketIdx;

  const activeWeek: WeeklyBucket | undefined =
    weeklyTrend.buckets[activeWeekIdx];

  const backupMeta = storageService.getAutoBackupStatus();

  const handleSaveGeneralExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpError('');

    if (!expDesc.trim()) {
      setExpError('Deskripsi pengeluaran wajib diisi.');
      return;
    }
    const amount = Number(expAmount) || 0;
    if (amount <= 0) {
      setExpError('Nominal biaya wajib diisi.');
      return;
    }

    onAddExpense({
      date: expDate,
      sector: 'general',
      category: expCategory,
      description: expDesc.trim(),
      quantity: 1,
      unitPrice: amount,
      total: amount,
      allocationType: 'general',
      notes: expNotes.trim(),
    });

    setShowGenExpModal(false);
    setExpDesc('');
    setExpAmount('');
    setExpNotes('');
  };

  return (
    <div className="dashboard-view">
      {/* Date Range Selection Bar */}
      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        periodLabel={periodLabel}
        labelPrefix="Filter Waktu Konsolidasi Pusat"
      />

      {/* Top Banner */}
      <section className="panel-banner consolidation dashboard-banner">
        <div className="dashboard-banner__intro">
          <div className="dashboard-eyebrow dashboard-eyebrow--lpg">
            <Building size={13} />
            <span>KONSOLIDASI KEUANGAN PUSAT</span>
            <span className="dashboard-eyebrow__sep">•</span>
            <span className="dashboard-eyebrow__period">{periodLabel}</span>
          </div>
          <h2>Ikhtisar Eksekutif Laba Rugi Perusahaan</h2>
          <p className="dashboard-banner__desc">
            Konsolidasi arus kas masuk, beban operasional, dan tren omzet mingguan
            dari dua pilar usaha (Distribusi Gas LPG 3 Kg &amp; Jasa Ekspedisi Armada).
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onExportMonthlyExcel}
            className="btn btn-success btn-lg dashboard-action-btn"
            style={{ fontWeight: 600 }}
          >
            <FileChartColumn size={18} />
            <span>Export Excel Konsolidasi (Per Kategori)</span>
          </button>
          <button
            type="button"
            onClick={handleSelectFolder}
            className="btn btn-outline btn-sm"
            style={{
              fontSize: '0.75rem',
              color: folderName ? 'var(--color-primary)' : 'var(--text-dim)',
              border: folderName
                ? '1px dashed var(--color-primary)'
                : '1px dashed var(--border-medium)',
            }}
            title="Tentukan folder di perangkat Anda agar ekspor Excel & Auto-Backup JSON tersimpan otomatis"
          >
            <FolderDown size={14} />
            <span>
              {folderName
                ? `Auto-Backup & Ekspor: 📁 ${folderName}`
                : '📁 Atur Folder Simpan & Auto-Backup'}
            </span>
          </button>
          {backupMeta.lastBackupAt && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.7rem',
                color: 'var(--color-success-text)',
                justifyContent: 'flex-end',
              }}
            >
              <ShieldCheck size={12} />
              <span>
                Auto-backup aktif ({formatDate(backupMeta.lastBackupAt.slice(0, 10), 'short')})
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Main Metric Cards — Alive KPI Architecture */}
      <section
        className="stats-grid dashboard-stats-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
        aria-label="Ringkasan Metrik Utama Konsolidasi"
      >
        {/* 1. TOTAL PEMASUKAN */}
        <article className="stat-card kpi-card kpi-card--income">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--income">
                <TrendingUp size={11} />
                Total Pemasukan
              </span>
              <span className="stat-label">Total Pendapatan Usaha</span>
            </div>
            <div className="stat-icon kpi-icon kpi-icon--income">
              <CircleDollarSign size={19} />
            </div>
          </div>

          <div className="kpi-value-row">
            <span className="kpi-sign kpi-sign--income" aria-hidden="true">
              +
            </span>
            <div className="stat-value kpi-value kpi-value--income">
              {formatRupiah(financialSummary.totalRevenue)}
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Divisi LPG ({lpgPercent}%)</span>
              <span className="kpi-meta-val font-mono">
                {formatRupiah(financialSummary.lpgRevenue)}
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">
                Divisi Ekspedisi ({expPercent}%)
              </span>
              <span className="kpi-meta-val font-mono">
                {formatRupiah(financialSummary.expeditionRevenue)}
              </span>
            </div>
          </div>
        </article>

        {/* 2. TOTAL PENGELUARAN */}
        <article className="stat-card kpi-card kpi-card--expense">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--expense">
                <TrendingDown size={11} />
                Total Pengeluaran
              </span>
              <span className="stat-label">Total Beban Operasional</span>
            </div>
            <div className="stat-icon kpi-icon kpi-icon--expense">
              <Wallet size={19} />
            </div>
          </div>

          <div className="kpi-value-row">
            <span className="kpi-sign kpi-sign--expense" aria-hidden="true">
              &minus;
            </span>
            <div className="stat-value kpi-value kpi-value--expense">
              {formatRupiah(financialSummary.totalExpenses)}
            </div>
          </div>

          <div
            className="kpi-meta-grid"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">LPG</span>
              <span className="kpi-meta-val kpi-meta-val--expense font-mono">
                {formatCompactRupiah(financialSummary.lpgExpenses)}
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Ekspedisi</span>
              <span className="kpi-meta-val kpi-meta-val--expense font-mono">
                {formatCompactRupiah(financialSummary.expeditionExpenses)}
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Umum</span>
              <span className="kpi-meta-val kpi-meta-val--expense font-mono">
                {formatCompactRupiah(financialSummary.generalExpenses)}
              </span>
            </div>
          </div>
        </article>

        {/* 3. LABA BERSIH PERUSAHAAN */}
        <article
          className={`stat-card kpi-card ${
            isProfit ? 'kpi-card--profit' : 'kpi-card--deficit'
          }`}
        >
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span
                className={`kpi-polarity-tag ${
                  isProfit
                    ? 'kpi-polarity-tag--income'
                    : 'kpi-polarity-tag--expense'
                }`}
              >
                {isProfit ? (
                  <ArrowUpRight size={12} />
                ) : (
                  <ArrowDownRight size={12} />
                )}
                {isProfit ? 'Surplus Perusahaan' : 'Defisit Perusahaan'}
              </span>
              <span className="stat-label">Laba Bersih Perusahaan</span>
            </div>
            <div
              className={`stat-icon kpi-icon ${
                isProfit ? 'kpi-icon--income' : 'kpi-icon--expense'
              }`}
            >
              {isProfit ? (
                <ArrowUpRight size={19} />
              ) : (
                <ArrowDownRight size={19} />
              )}
            </div>
          </div>

          <div className="kpi-value-row">
            <span
              className={`kpi-sign ${
                isProfit ? 'kpi-sign--income' : 'kpi-sign--expense'
              }`}
              aria-hidden="true"
            >
              {isProfit ? '+' : '\u2212'}
            </span>
            <div
              className={`stat-value kpi-value ${
                isProfit ? 'kpi-value--income' : 'kpi-value--expense'
              }`}
            >
              {formatRupiah(Math.abs(financialSummary.netProfit))}
            </div>
          </div>

          <div className="kpi-cashflow-bar-wrap">
            <div
              className="kpi-cashflow-bar"
              role="img"
              aria-label={`Komposisi arus kas konsolidasi: Pemasukan ${incomeBarPct}% berbanding Pengeluaran ${expenseBarPct}%`}
            >
              <div
                className="kpi-cashflow-bar__in"
                style={{ width: `${incomeBarPct}%` }}
              />
              <div
                className="kpi-cashflow-bar__out"
                style={{ width: `${expenseBarPct}%` }}
              />
            </div>
            <div className="kpi-cashflow-legend">
              <span className="kpi-cashflow-legend__in">
                Masuk {incomeBarPct}%
              </span>
              <span className="kpi-cashflow-legend__out">
                Keluar {expenseBarPct}%
              </span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <span
              className={`badge ${
                isProfit ? 'badge-success' : 'badge-danger'
              }`}
            >
              Margin Bersih: {profitMargin}%
            </span>
          </div>
        </article>
      </section>

      {/* =====================================================================
          VISUALISASI CHART TREN OMZET MINGGUAN (ZERO-DEPENDENCY SVG + TOUCH UI)
          ===================================================================== */}
      <section
        className="card weekly-trend-card"
        aria-label="Visualisasi Tren Omzet Mingguan Perusahaan"
      >
        <div className="weekly-trend-header">
          <div>
            <h3 className="card-title">
              <span className="dashboard-panel__icon dashboard-panel__icon--income">
                <ChartNoAxesColumnIncreasing size={15} />
              </span>
              <span>Tren Omzet Mingguan (LPG vs Ekspedisi)</span>
            </h3>
            <p className="card-subtitle">
              Perbandingan kontribusi pendapatan mingguan per divisi — ketuk batang
              minggu untuk melihat rincian
            </p>
          </div>

          <div className="weekly-trend-legend">
            <span className="weekly-trend-legend__item">
              <span
                className="weekly-trend-legend__dot"
                style={{ backgroundColor: 'var(--color-lpg)' }}
              />
              <span>Divisi LPG</span>
            </span>
            <span className="weekly-trend-legend__item">
              <span
                className="weekly-trend-legend__dot"
                style={{ backgroundColor: 'var(--color-fleet)' }}
              />
              <span>Divisi Ekspedisi</span>
            </span>
          </div>
        </div>

        {/* Interactive Tap-to-Inspect Highlight Strip (Ramah Layar Sentuh Android) */}
        {activeWeek && (
          <div className="weekly-trend-inspector">
            <div className="weekly-trend-inspector__period">
              <span className="badge badge-primary">
                {activeWeek.label} ({activeWeek.rangeText})
              </span>
              {activeWeek.wowPct !== null && (
                <span
                  className={`badge ${
                    activeWeek.wowPct >= 0 ? 'badge-success' : 'badge-danger'
                  }`}
                >
                  {activeWeek.wowPct >= 0 ? '+' : ''}
                  {activeWeek.wowPct}% vs pekan lalu
                </span>
              )}
              <span className="weekly-trend-inspector__tx">
                {activeWeek.txCount} aktivitas transaksi
              </span>
            </div>

            <div className="weekly-trend-inspector__metrics">
              <div className="weekly-trend-inspector__metric">
                <span className="weekly-trend-inspector__label">
                  Total Omzet Pekan Ini
                </span>
                <span className="weekly-trend-inspector__val weekly-trend-inspector__val--total font-mono">
                  + {formatRupiah(activeWeek.totalRevenue)}
                </span>
              </div>

              <div className="weekly-trend-inspector__metric">
                <span className="weekly-trend-inspector__label">
                  <Flame size={12} style={{ color: 'var(--color-lpg)' }} /> Omzet
                  LPG
                </span>
                <span
                  className="weekly-trend-inspector__val font-mono"
                  style={{ color: 'var(--color-lpg-text)' }}
                >
                  {formatRupiah(activeWeek.lpgRevenue)}
                </span>
              </div>

              <div className="weekly-trend-inspector__metric">
                <span className="weekly-trend-inspector__label">
                  <Truck size={12} style={{ color: 'var(--color-fleet)' }} /> Omzet
                  Ekspedisi
                </span>
                <span
                  className="weekly-trend-inspector__val font-mono"
                  style={{ color: 'var(--color-fleet-text)' }}
                >
                  {formatRupiah(activeWeek.expeditionRevenue)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stacked Bar + Trend Chart Area */}
        <div className="weekly-chart-stage">
          {/* Y-Axis Grid Guides */}
          <div className="weekly-chart-grid" aria-hidden="true">
            {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
              <div key={ratio} className="weekly-chart-grid__line">
                <span className="weekly-chart-grid__label font-mono">
                  {ratio === 0
                    ? 'Rp 0'
                    : formatCompactRupiah(
                        Math.round(weeklyTrend.maxWeeklyRevenue * ratio)
                      )}
                </span>
              </div>
            ))}
          </div>

          {/* Interactive Bars */}
          <div
            className="weekly-chart-bars"
            style={{
              gridTemplateColumns: `repeat(${weeklyTrend.buckets.length}, minmax(0, 1fr))`,
            }}
          >
            {weeklyTrend.buckets.map((bucket, idx) => {
              const totalPct =
                weeklyTrend.maxWeeklyRevenue > 0
                  ? Math.max(
                      bucket.totalRevenue > 0 ? 6 : 2,
                      Math.round(
                        (bucket.totalRevenue / weeklyTrend.maxWeeklyRevenue) * 100
                      )
                    )
                  : 2;
              const lpgShareOfBar =
                bucket.totalRevenue > 0
                  ? Math.round((bucket.lpgRevenue / bucket.totalRevenue) * 100)
                  : 0;
              const expShareOfBar =
                bucket.totalRevenue > 0 ? 100 - lpgShareOfBar : 0;
              const isSelected = idx === activeWeekIdx;

              return (
                <button
                  key={bucket.id}
                  type="button"
                  onClick={() => setSelectedWeekIdx(idx)}
                  aria-pressed={isSelected}
                  className={`weekly-bar-col ${
                    isSelected ? 'weekly-bar-col--active' : ''
                  }`}
                  title={`${bucket.label} (${bucket.rangeText}): ${formatRupiah(
                    bucket.totalRevenue
                  )}`}
                >
                  <span className="weekly-bar-col__top-val font-mono">
                    {bucket.totalRevenue > 0
                      ? formatCompactRupiah(bucket.totalRevenue)
                      : 'Rp 0'}
                  </span>

                  <div className="weekly-bar-track">
                    <div
                      className="weekly-bar-stack"
                      style={{ height: `${totalPct}%` }}
                    >
                      {expShareOfBar > 0 && (
                        <div
                          className="weekly-bar-seg weekly-bar-seg--fleet"
                          style={{ height: `${expShareOfBar}%` }}
                        />
                      )}
                      {lpgShareOfBar > 0 && (
                        <div
                          className="weekly-bar-seg weekly-bar-seg--lpg"
                          style={{ height: `${lpgShareOfBar}%` }}
                        />
                      )}
                    </div>
                  </div>

                  <span className="weekly-bar-col__label">
                    {bucket.shortLabel}
                  </span>
                  <span className="weekly-bar-col__sub">{bucket.rangeText}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Beban Operasional Umum Kantor */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div>
            <h3 className="card-title">
              <Building size={18} style={{ color: 'var(--text-dim)' }} />
              Daftar Beban Operasional Umum &amp; Kantor
            </h3>
            <p className="card-subtitle">
              Pengeluaran overhead perusahaan yang tidak terikat khusus ke armada
              atau pangkalan (diekspor ke sheet khusus Pengeluaran Umum)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGenExpModal(true)}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>Catat Beban Umum</span>
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th>Total Biaya</th>
                <th>Catatan</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {generalExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: 'var(--text-dim)',
                    }}
                  >
                    Belum ada pengeluaran umum kantor pada periode ini
                  </td>
                </tr>
              ) : (
                generalExpenses.map((e, idx) => (
                  <tr key={e.id}>
                    <td>{idx + 1}</td>
                    <td>{formatDate(e.date, 'short')}</td>
                    <td>
                      <span className="badge badge-neutral">{e.category}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{e.description}</td>
                    <td className="font-mono">
                      <span className="amount-pill amount-pill--expense">
                        &minus; {formatRupiah(e.total)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {e.notes || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Hapus pengeluaran umum ${e.description}?`
                            )
                          ) {
                            onDeleteExpense(e.id);
                          }
                        }}
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {generalExpenses.length > 0 && (
                <tr
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    fontWeight: 600,
                    borderTop: '2px solid var(--border-medium)',
                  }}
                >
                  <td
                    colSpan={4}
                    style={{ textAlign: 'right', fontSize: '0.85rem' }}
                  >
                    TOTAL BEBAN UMUM KANTOR:
                  </td>
                  <td
                    className="font-mono"
                    style={{
                      color: 'var(--color-danger-text)',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                    }}
                  >
                    &minus; {formatRupiah(totalGeneralExpenses)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Beban Umum */}
      {showGenExpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Building size={20} />
                Catat Pengeluaran Umum Kantor
              </h3>
              <button
                type="button"
                onClick={() => setShowGenExpModal(false)}
                className="btn btn-outline btn-sm"
                style={{ border: 'none' }}
              >
                ✕
              </button>
            </div>

            {expError && (
              <div
                style={{
                  backgroundColor: 'var(--color-danger-light)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger-text)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '14px',
                }}
              >
                {expError}
              </div>
            )}

            <form onSubmit={handleSaveGeneralExpense}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group" style={{ display: 'none' }}>
                  {/* Spacer */}
                </div>
              </div>

              <ExpenseCategoryInput
                sector="general"
                category={expCategory}
                onCategoryChange={setExpCategory}
                description={expDesc}
                onDescriptionChange={setExpDesc}
                options={appData.settings?.generalExpCategories || []}
                onAddOption={(newOption) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({
                      generalExpCategories: [
                        ...(appData.settings?.generalExpCategories || []),
                        newOption,
                      ],
                    });
                  }
                }}
                onDeleteOption={(option) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({
                      generalExpCategories: (
                        appData.settings?.generalExpCategories || []
                      ).filter((c) => c !== option),
                    });
                  }
                }}
              />

              <div className="form-group">
                <label className="form-label">Total Biaya (Rp) *</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Contoh: 450000"
                  value={expAmount}
                  onChange={(e) =>
                    setExpAmount(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowGenExpModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Biaya Umum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
