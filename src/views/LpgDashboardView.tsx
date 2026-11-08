import { useMemo } from 'react';
import {
  Flame,
  CircleDollarSign,
  Wallet,
  FileChartColumn,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Plus,
  ContactRound,
  TrendingUp,
  TrendingDown,
  PackageCheck,
} from 'lucide-react';
import type { AppData, ActiveTab } from '../types';
import { formatRupiah, formatNumber, formatDate } from '../utils/formatters';

interface LpgDashboardViewProps {
  appData: AppData;
  setActiveTab: (tab: ActiveTab) => void;
  onExportLpgExcel: () => void;
  periodLabel: string;
  isDateInFilter: (dateStr: string) => boolean;
}

export const LpgDashboardView: React.FC<LpgDashboardViewProps> = ({
  appData,
  setActiveTab,
  onExportLpgExcel,
  periodLabel,
  isDateInFilter,
}) => {
  // Semua kalkulasi dashboard dibungkus useMemo — hanya recompute jika
  // data transaksi atau filter periode berubah, bukan setiap render
  const {
    lpgTx,
    lpgExpensesCount,
    totalRevenue,
    totalExpenses,
    netProfit,
    isProfit,
    profitMargin,
    expenseRatio,
    incomeBarPct,
    expenseBarPct,
    totalCylinders,
    avgPerCylinder,
    avgCylindersPerTx,
    profitPerCylinder,
    activeCustomersCount,
    recentTx,
    recentExp,
    recentTxTotal,
    recentExpTotal,
  } = useMemo(() => {
    const lpgTx = appData.lpgTransactions.filter((t) => isDateInFilter(t.date));
    const lpgExpenses = appData.expenses.filter(
      (e) => e.sector === 'lpg' && isDateInFilter(e.date)
    );

    const totalRevenue = lpgTx.reduce((sum, t) => sum + t.total, 0);
    const totalExpenses = lpgExpenses.reduce((sum, e) => sum + e.total, 0);
    const netProfit = totalRevenue - totalExpenses;
    const isProfit = netProfit >= 0;
    const profitMargin =
      totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const expenseRatio =
      totalRevenue > 0
        ? Math.min(999, Math.round((totalExpenses / totalRevenue) * 100))
        : totalExpenses > 0
          ? 100
          : 0;

    const totalCashflowVolume = totalRevenue + totalExpenses;
    const incomeBarPct =
      totalCashflowVolume > 0
        ? Math.round((totalRevenue / totalCashflowVolume) * 100)
        : 50;
    const expenseBarPct =
      totalCashflowVolume > 0 ? 100 - incomeBarPct : 50;

    const totalCylinders = lpgTx.reduce((sum, t) => sum + t.quantity, 0);
    const avgPerCylinder =
      totalCylinders > 0 ? Math.round(totalRevenue / totalCylinders) : 0;
    const avgCylindersPerTx =
      lpgTx.length > 0 ? Math.round(totalCylinders / lpgTx.length) : 0;
    const profitPerCylinder =
      totalCylinders > 0 ? Math.round(netProfit / totalCylinders) : 0;
    const activeCustomersCount = appData.customers.filter(
      (c) => c.status === 'active'
    ).length;

    // Helper untuk mengambil 5 data terbaru (O(n) time complexity) tanpa sorting seluruh array
    const getTop5Recent = <T extends { date: string; createdAt?: string }>(
      arr: T[]
    ): T[] => {
      const top: T[] = [];
      for (const item of arr) {
        top.push(item);
        top.sort((a, b) => {
          if (a.date !== b.date) return a.date > b.date ? -1 : 1;
          const aCreated = a.createdAt || '';
          const bCreated = b.createdAt || '';
          return aCreated > bCreated ? -1 : aCreated < bCreated ? 1 : 0;
        });
        if (top.length > 5) top.pop();
      }
      return top;
    };

    // 5 transaksi terbaru dalam periode aktif
    const recentTx = getTop5Recent(lpgTx);
    const recentExp = getTop5Recent(lpgExpenses);
    const recentTxTotal = recentTx.reduce((sum, t) => sum + t.total, 0);
    const recentExpTotal = recentExp.reduce((sum, e) => sum + e.total, 0);

    return {
      lpgTx,
      lpgExpensesCount: lpgExpenses.length,
      totalRevenue,
      totalExpenses,
      netProfit,
      isProfit,
      profitMargin,
      expenseRatio,
      incomeBarPct,
      expenseBarPct,
      totalCylinders,
      avgPerCylinder,
      avgCylindersPerTx,
      profitPerCylinder,
      activeCustomersCount,
      recentTx,
      recentExp,
      recentTxTotal,
      recentExpTotal,
    };
  }, [
    appData.lpgTransactions,
    appData.expenses,
    appData.customers,
    isDateInFilter,
  ]);

  return (
    <div className="dashboard-view">
      {/* Page Banner */}
      <section className="panel-banner lpg dashboard-banner">
        <div className="dashboard-banner__intro">
          <div className="dashboard-eyebrow dashboard-eyebrow--lpg">
            <Flame size={13} />
            <span>Divisi Distribusi LPG 3 Kg</span>
            <span className="dashboard-eyebrow__sep">•</span>
            <span className="dashboard-eyebrow__period">{periodLabel}</span>
          </div>
          <h2>Dashboard Operasional Penjualan LPG</h2>
          <p className="dashboard-banner__desc">
            Ringkasan arus kas masuk penjualan tabung, beban operasional pangkalan,
            dan margin laba bersih secara real-time.
          </p>
        </div>
        <div className="dashboard-banner__actions">
          <button
            type="button"
            onClick={onExportLpgExcel}
            className="btn btn-success btn-sm dashboard-action-btn"
          >
            <FileChartColumn size={15} />
            <span>Ekspor Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lpg-sales')}
            className="btn btn-primary btn-sm dashboard-action-btn"
          >
            <Plus size={15} />
            <span>Transaksi Baru</span>
          </button>
        </div>
      </section>

      {/* Stat Cards — Alive KPI Architecture with High-Contrast Polarity */}
      <section
        className="stats-grid dashboard-stats-grid"
        aria-label="Ringkasan Metrik Utama Divisi LPG"
      >
        {/* 1. PEMASUKAN (INCOME) */}
        <article className="stat-card kpi-card kpi-card--income">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--income">
                <TrendingUp size={11} />
                Pemasukan
              </span>
              <span className="stat-label">Pendapatan Penjualan LPG</span>
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
              {formatRupiah(totalRevenue)}
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Frekuensi</span>
              <span className="kpi-meta-val">{lpgTx.length} nota jual</span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Rata-rata / Tabung</span>
              <span className="kpi-meta-val font-mono">
                {avgPerCylinder > 0 ? formatRupiah(avgPerCylinder) : 'Rp 0'}
              </span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <button
              type="button"
              onClick={() => setActiveTab('lpg-sales')}
              className="kpi-card__link kpi-card__link--income"
            >
              <span>Rincian penjualan tabung</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </article>

        {/* 2. PENGELUARAN (EXPENSE) */}
        <article className="stat-card kpi-card kpi-card--expense">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--expense">
                <TrendingDown size={11} />
                Pengeluaran
              </span>
              <span className="stat-label">Beban Operasional Pangkalan</span>
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
              {formatRupiah(totalExpenses)}
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Porsi dari Omzet</span>
              <span className="kpi-meta-val kpi-meta-val--expense font-mono">
                {expenseRatio}% beban
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Catatan Biaya</span>
              <span className="kpi-meta-val">{lpgExpensesCount} transaksi</span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <button
              type="button"
              onClick={() => setActiveTab('lpg-expenses')}
              className="kpi-card__link kpi-card__link--expense"
            >
              <span>Kelola biaya pangkalan</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </article>

        {/* 3. LABA BERSIH (NET PROFIT & CASHFLOW CONTRAST) */}
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
                {isProfit ? 'Surplus Bersih' : 'Defisit Periode'}
              </span>
              <span className="stat-label">Laba Bersih Divisi LPG</span>
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
              {formatRupiah(Math.abs(netProfit))}
            </div>
          </div>

          {/* Visual Cashflow Contrast Bar: Pemasukan vs Pengeluaran */}
          <div className="kpi-cashflow-bar-wrap">
            <div
              className="kpi-cashflow-bar"
              role="img"
              aria-label={`Komposisi arus kas: Pemasukan ${incomeBarPct}% berbanding Pengeluaran ${expenseBarPct}%`}
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
              Margin {profitMargin}%
            </span>
            {totalCylinders > 0 && (
              <span className="kpi-inline-note font-mono">
                {isProfit ? '+' : '\u2212'}
                {formatRupiah(Math.abs(profitPerCylinder))}/tab
              </span>
            )}
          </div>
        </article>

        {/* 4. VOLUME DISTRIBUSI & PELANGGAN */}
        <article className="stat-card kpi-card kpi-card--lpg-volume">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--lpg">
                <PackageCheck size={11} />
                Volume Distribusi
              </span>
              <span className="stat-label">Total Tabung Terjual</span>
            </div>
            <div className="stat-icon kpi-icon kpi-icon--lpg">
              <Flame size={19} />
            </div>
          </div>

          <div className="kpi-value-row">
            <div className="stat-value kpi-value kpi-value--neutral">
              {formatNumber(totalCylinders)}{' '}
              <span className="kpi-unit">Tabung</span>
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Rata-rata / Nota</span>
              <span className="kpi-meta-val font-mono">
                {formatNumber(avgCylindersPerTx)} tabung
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Mitra Pangkalan</span>
              <span className="kpi-meta-val">{activeCustomersCount} aktif</span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <span className="badge badge-lpg">
              <ContactRound size={11} />
              {activeCustomersCount} Pelanggan Aktif
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('lpg-customers')}
              className="kpi-card__mini-btn"
            >
              Data Mitra
            </button>
          </div>
        </article>
      </section>

      {/* Two Column: Recent Transactions (Income) & Recent Expenses (Outcome) */}
      <section className="two-col-grid dashboard-panels-grid">
        {/* Penjualan Terkini (Pemasukan) */}
        <div className="card dashboard-panel dashboard-panel--income">
          <div className="card-header dashboard-panel__header">
            <div className="dashboard-panel__title-group">
              <h3 className="card-title">
                <span className="dashboard-panel__icon dashboard-panel__icon--income">
                  <TrendingUp size={15} />
                </span>
                <span>Penjualan LPG Terkini</span>
              </h3>
              <p className="card-subtitle">
                5 pemasukan penjualan tabung terbaru pada periode ini
              </p>
            </div>
            <div className="dashboard-panel__header-right">
              {recentTx.length > 0 && (
                <span
                  className="amount-pill amount-pill--income font-mono"
                  title="Subtotal 5 transaksi terbaru"
                >
                  + {formatRupiah(recentTxTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('lpg-sales')}
                className="btn btn-ghost btn-sm dashboard-panel__more-btn"
              >
                <span>Semua</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            className="table-container dashboard-table-wrap"
            role="region"
            aria-label="Tabel Penjualan LPG Terkini"
          >
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Pelanggan</th>
                  <th>Volume</th>
                  <th style={{ textAlign: 'right' }}>Pemasukan (+)</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.length === 0 ? (
                  <tr className="dashboard-table__empty-row">
                    <td colSpan={4} className="dashboard-table__empty-cell">
                      Belum ada transaksi penjualan LPG di periode ini
                    </td>
                  </tr>
                ) : (
                  recentTx.map((t) => (
                    <tr key={t.id} className="dashboard-table__row">
                      <td
                        className="dashboard-cell-date"
                        data-label="Tanggal"
                      >
                        {formatDate(t.date, 'short')}
                      </td>
                      <td
                        className="dashboard-cell-primary"
                        data-label="Pelanggan"
                      >
                        <span className="dashboard-row-title">
                          {t.customerName}
                        </span>
                        {t.paymentStatus && (
                          <span className="dashboard-row-sub">
                            {t.paymentStatus}
                          </span>
                        )}
                      </td>
                      <td
                        className="dashboard-cell-meta"
                        data-label="Volume"
                      >
                        <span className="badge badge-lpg">
                          {formatNumber(t.quantity)} Tabung
                        </span>
                      </td>
                      <td
                        className="dashboard-cell-amount font-mono"
                        data-label="Pemasukan"
                      >
                        <span className="amount-pill amount-pill--income">
                          + {formatRupiah(t.total)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Biaya Pangkalan Terkini (Pengeluaran) */}
        <div className="card dashboard-panel dashboard-panel--expense">
          <div className="card-header dashboard-panel__header">
            <div className="dashboard-panel__title-group">
              <h3 className="card-title">
                <span className="dashboard-panel__icon dashboard-panel__icon--expense">
                  <TrendingDown size={15} />
                </span>
                <span>Beban Operasional Terkini</span>
              </h3>
              <p className="card-subtitle">
                5 pengeluaran operasional pangkalan terbaru pada periode ini
              </p>
            </div>
            <div className="dashboard-panel__header-right">
              {recentExp.length > 0 && (
                <span
                  className="amount-pill amount-pill--expense font-mono"
                  title="Subtotal 5 pengeluaran terbaru"
                >
                  &minus; {formatRupiah(recentExpTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('lpg-expenses')}
                className="btn btn-ghost btn-sm dashboard-panel__more-btn dashboard-panel__more-btn--expense"
              >
                <span>Semua</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            className="table-container dashboard-table-wrap"
            role="region"
            aria-label="Tabel Beban Operasional LPG Terkini"
          >
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th style={{ textAlign: 'right' }}>Pengeluaran (&minus;)</th>
                </tr>
              </thead>
              <tbody>
                {recentExp.length === 0 ? (
                  <tr className="dashboard-table__empty-row">
                    <td colSpan={4} className="dashboard-table__empty-cell">
                      Belum ada catatan biaya operasional di periode ini
                    </td>
                  </tr>
                ) : (
                  recentExp.map((e) => (
                    <tr key={e.id} className="dashboard-table__row">
                      <td
                        className="dashboard-cell-date"
                        data-label="Tanggal"
                      >
                        {formatDate(e.date, 'short')}
                      </td>
                      <td
                        className="dashboard-cell-meta"
                        data-label="Kategori"
                      >
                        <span className="badge badge-neutral">
                          {e.category}
                        </span>
                      </td>
                      <td
                        className="dashboard-cell-primary"
                        data-label="Deskripsi"
                      >
                        <span className="dashboard-row-title">
                          {e.description}
                        </span>
                      </td>
                      <td
                        className="dashboard-cell-amount font-mono"
                        data-label="Pengeluaran"
                      >
                        <span className="amount-pill amount-pill--expense">
                          &minus; {formatRupiah(e.total)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
