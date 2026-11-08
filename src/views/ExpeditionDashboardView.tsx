import { useMemo } from 'react';
import {
  Truck,
  CircleDollarSign,
  Wallet,
  FileChartColumn,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Gauge,
  Wrench,
  Plus,
  TrendingUp,
  TrendingDown,
  Fuel,
} from 'lucide-react';
import type { AppData, ActiveTab } from '../types';
import { formatRupiah, formatNumber, formatDate } from '../utils/formatters';

interface ExpeditionDashboardViewProps {
  appData: AppData;
  setActiveTab: (tab: ActiveTab) => void;
  onExportExpeditionExcel: () => void;
  periodLabel: string;
  isDateInFilter: (dateStr: string) => boolean;
}

export const ExpeditionDashboardView: React.FC<ExpeditionDashboardViewProps> = ({
  appData,
  setActiveTab,
  onExportExpeditionExcel,
  periodLabel,
  isDateInFilter,
}) => {
  // Semua kalkulasi dashboard dibungkus useMemo — hanya recompute jika
  // data transaksi atau filter periode berubah, bukan setiap render
  const {
    trips,
    totalRev,
    totalCost,
    nonBbmCost,
    netProfit,
    isProfit,
    profitMargin,
    expenseRatio,
    incomeBarPct,
    expenseBarPct,
    avgRevPerTrip,
    avgProfitPerTrip,
    totalKm,
    totalWeightKg,
    totalTon,
    totalLiters,
    totalBbm,
    activeVehiclesCount,
    recentTrips,
    recentExpenses,
    recentTripsTotal,
    recentExpensesTotal,
  } = useMemo(() => {
    const trips = appData.expeditionTrips.filter((t) => isDateInFilter(t.date));
    const expenses = appData.expenses.filter(
      (e) => e.sector === 'expedition' && isDateInFilter(e.date)
    );

    const totalRev = trips.reduce((s, t) => s + t.totalRevenue, 0);
    const totalCost = expenses.reduce((s, e) => s + e.total, 0);
    const netProfit = totalRev - totalCost;
    const isProfit = netProfit >= 0;
    const profitMargin =
      totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : '0.0';
    const expenseRatio =
      totalRev > 0
        ? Math.min(999, Math.round((totalCost / totalRev) * 100))
        : totalCost > 0
          ? 100
          : 0;

    const totalCashflowVolume = totalRev + totalCost;
    const incomeBarPct =
      totalCashflowVolume > 0
        ? Math.round((totalRev / totalCashflowVolume) * 100)
        : 50;
    const expenseBarPct =
      totalCashflowVolume > 0 ? 100 - incomeBarPct : 50;

    const avgRevPerTrip =
      trips.length > 0 ? Math.round(totalRev / trips.length) : 0;
    const avgProfitPerTrip =
      trips.length > 0 ? Math.round(netProfit / trips.length) : 0;

    const totalKm = trips.reduce((s, t) => s + (t.distanceKm || 0), 0);
    const totalWeightKg = trips.reduce((s, t) => s + (t.weightKg || 0), 0);
    const totalTon =
      totalWeightKg > 0
        ? totalWeightKg / 1000
        : trips.reduce((s, t) => s + (t.tonnage || 0), 0);

    const bbmExpenses = expenses.filter((e) => e.category === 'BBM');
    const totalLiters = bbmExpenses.reduce(
      (s, e) => s + (e.fuelDetails?.liters || 0),
      0
    );
    const totalBbm = bbmExpenses.reduce((s, e) => s + e.total, 0);
    const nonBbmCost = Math.max(0, totalCost - totalBbm);
    const activeVehiclesCount = appData.vehicles.filter(
      (v) => v.status === 'active'
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

    // 5 terbaru dalam periode aktif
    const recentTrips = getTop5Recent(trips);
    const recentExpenses = getTop5Recent(expenses);
    const recentTripsTotal = recentTrips.reduce(
      (s, t) => s + t.totalRevenue,
      0
    );
    const recentExpensesTotal = recentExpenses.reduce(
      (s, e) => s + e.total,
      0
    );

    return {
      trips,
      totalRev,
      totalCost,
      nonBbmCost,
      netProfit,
      isProfit,
      profitMargin,
      expenseRatio,
      incomeBarPct,
      expenseBarPct,
      avgRevPerTrip,
      avgProfitPerTrip,
      totalKm,
      totalWeightKg,
      totalTon,
      totalLiters,
      totalBbm,
      activeVehiclesCount,
      recentTrips,
      recentExpenses,
      recentTripsTotal,
      recentExpensesTotal,
    };
  }, [
    appData.expeditionTrips,
    appData.expenses,
    appData.vehicles,
    isDateInFilter,
  ]);

  return (
    <div className="dashboard-view">
      {/* Page Banner */}
      <section className="panel-banner expedition dashboard-banner">
        <div className="dashboard-banner__intro">
          <div className="dashboard-eyebrow dashboard-eyebrow--fleet">
            <Truck size={13} />
            <span>Divisi Ekspedisi &amp; Transportasi</span>
            <span className="dashboard-eyebrow__sep">•</span>
            <span className="dashboard-eyebrow__period">{periodLabel}</span>
          </div>
          <h2>Dashboard Operasional Armada &amp; Ekspedisi</h2>
          <p className="dashboard-banner__desc">
            Pemantauan arus kas hasil ritase perjalanan, beban BBM &amp; perawatan
            armada, serta utilitas tonase muatan.
          </p>
        </div>
        <div className="dashboard-banner__actions">
          <button
            type="button"
            onClick={onExportExpeditionExcel}
            className="btn btn-success btn-sm dashboard-action-btn"
          >
            <FileChartColumn size={15} />
            <span>Ekspor Rekap</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('expedition-trips')}
            className="btn btn-primary btn-sm dashboard-action-btn"
          >
            <Plus size={15} />
            <span>Perjalanan Baru</span>
          </button>
        </div>
      </section>

      {/* Stat Cards — Alive KPI Architecture with High-Contrast Polarity */}
      <section
        className="stats-grid dashboard-stats-grid"
        aria-label="Ringkasan Metrik Utama Divisi Ekspedisi"
      >
        {/* 1. PEMASUKAN (INCOME) */}
        <article className="stat-card kpi-card kpi-card--income">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--income">
                <TrendingUp size={11} />
                Pemasukan
              </span>
              <span className="stat-label">Pendapatan Jasa Ekspedisi</span>
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
              {formatRupiah(totalRev)}
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Total Ritase</span>
              <span className="kpi-meta-val">{trips.length} perjalanan</span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Rata-rata / Rit</span>
              <span className="kpi-meta-val font-mono">
                {avgRevPerTrip > 0 ? formatRupiah(avgRevPerTrip) : 'Rp 0'}
              </span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <button
              type="button"
              onClick={() => setActiveTab('expedition-trips')}
              className="kpi-card__link kpi-card__link--income"
            >
              <span>Log perjalanan armada</span>
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
              <span className="stat-label">Total Beban Armada</span>
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
              {formatRupiah(totalCost)}
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Konsumsi BBM</span>
              <span className="kpi-meta-val kpi-meta-val--expense font-mono">
                {formatRupiah(totalBbm)}
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Servis &amp; Lainnya</span>
              <span className="kpi-meta-val font-mono">
                {formatRupiah(nonBbmCost)}
              </span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <button
              type="button"
              onClick={() => setActiveTab('expedition-vehicle-recap')}
              className="kpi-card__link kpi-card__link--expense"
            >
              <span>Rasio beban {expenseRatio}% • Rekap mobil</span>
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
                {isProfit ? 'Surplus Ekspedisi' : 'Defisit Armada'}
              </span>
              <span className="stat-label">Laba Bersih Ekspedisi</span>
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
              aria-label={`Komposisi arus kas ekspedisi: Pemasukan ${incomeBarPct}% berbanding Pengeluaran ${expenseBarPct}%`}
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
            {trips.length > 0 && (
              <span className="kpi-inline-note font-mono">
                {isProfit ? '+' : '\u2212'}
                {formatRupiah(Math.abs(avgProfitPerTrip))}/rit
              </span>
            )}
          </div>
        </article>

        {/* 4. UTILITAS MUATAN, JARAK & BBM */}
        <article className="stat-card kpi-card kpi-card--fleet-volume">
          <div className="stat-top">
            <div className="kpi-card__heading">
              <span className="kpi-polarity-tag kpi-polarity-tag--fleet">
                <Gauge size={11} />
                Utilitas Logistik
              </span>
              <span className="stat-label">Total Muatan &amp; Jarak Tempuh</span>
            </div>
            <div className="stat-icon kpi-icon kpi-icon--fleet">
              <Truck size={19} />
            </div>
          </div>

          <div className="kpi-value-row">
            <div className="stat-value kpi-value kpi-value--neutral">
              {formatNumber(totalWeightKg)}{' '}
              <span className="kpi-unit">
                Kg ({totalTon.toFixed(1)} Ton)
              </span>
            </div>
          </div>

          <div className="kpi-meta-grid">
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Jarak Tempuh</span>
              <span className="kpi-meta-val font-mono">
                {formatNumber(totalKm)} Km
              </span>
            </div>
            <div className="kpi-meta-item">
              <span className="kpi-meta-label">Volume Solar/BBM</span>
              <span className="kpi-meta-val font-mono">
                {totalLiters > 0 ? `${formatNumber(totalLiters)} Liter` : '0 Liter'}
              </span>
            </div>
          </div>

          <div className="stat-footer kpi-card__footer">
            <span className="badge badge-fleet">
              <Fuel size={11} />
              {activeVehiclesCount} Armada Aktif
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('expedition-vehicles')}
              className="kpi-card__mini-btn"
            >
              Data Armada
            </button>
          </div>
        </article>
      </section>

      {/* Two Column: Recent Trips (Income) & Recent Expenses (Outcome) */}
      <section className="two-col-grid dashboard-panels-grid">
        {/* Perjalanan Terkini (Pemasukan) */}
        <div className="card dashboard-panel dashboard-panel--income">
          <div className="card-header dashboard-panel__header">
            <div className="dashboard-panel__title-group">
              <h3 className="card-title">
                <span className="dashboard-panel__icon dashboard-panel__icon--income">
                  <TrendingUp size={15} />
                </span>
                <span>Perjalanan Armada Terkini</span>
              </h3>
              <p className="card-subtitle">
                5 pemasukan hasil ritase perjalanan terbaru pada periode ini
              </p>
            </div>
            <div className="dashboard-panel__header-right">
              {recentTrips.length > 0 && (
                <span
                  className="amount-pill amount-pill--income font-mono"
                  title="Subtotal 5 perjalanan terbaru"
                >
                  + {formatRupiah(recentTripsTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('expedition-trips')}
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
            aria-label="Tabel Perjalanan Armada Terkini"
          >
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Plat</th>
                  <th>Rute &amp; Driver</th>
                  <th>Muatan</th>
                  <th style={{ textAlign: 'right' }}>Hasil Bersih (+)</th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.length === 0 ? (
                  <tr className="dashboard-table__empty-row">
                    <td colSpan={5} className="dashboard-table__empty-cell">
                      Belum ada catatan perjalanan armada di periode ini
                    </td>
                  </tr>
                ) : (
                  recentTrips.map((t) => (
                    <tr key={t.id} className="dashboard-table__row">
                      <td
                        className="dashboard-cell-date"
                        data-label="Tanggal"
                      >
                        {formatDate(t.date, 'short')}
                      </td>
                      <td className="dashboard-cell-meta" data-label="Armada">
                        <span
                          className="badge badge-fleet"
                          style={{ fontWeight: 600, letterSpacing: '0.03em' }}
                        >
                          {t.plateNumber}
                        </span>
                      </td>
                      <td
                        className="dashboard-cell-primary"
                        data-label="Rute & Driver"
                      >
                        <span className="dashboard-row-title">
                          {t.destination}
                        </span>
                        <span className="dashboard-row-sub">{t.driver}</span>
                      </td>
                      <td
                        className="dashboard-cell-meta"
                        data-label="Muatan & Uang Jalan"
                      >
                        <div className="dashboard-cargo-stack">
                          <span className="font-mono" style={{ fontWeight: 600 }}>
                            {formatNumber(t.weightKg || 0)} Kg
                          </span>
                          {t.travelAllowance ? (
                            <span className="dashboard-allowance-deduct font-mono">
                              &minus; UJ {formatRupiah(t.travelAllowance)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="dashboard-cell-amount font-mono"
                        data-label="Hasil Perjalanan"
                      >
                        <span className="amount-pill amount-pill--income">
                          + {formatRupiah(t.totalRevenue)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Biaya Armada Terkini (Pengeluaran) */}
        <div className="card dashboard-panel dashboard-panel--expense">
          <div className="card-header dashboard-panel__header">
            <div className="dashboard-panel__title-group">
              <h3 className="card-title">
                <span className="dashboard-panel__icon dashboard-panel__icon--expense">
                  <Wrench size={15} />
                </span>
                <span>Biaya Perawatan &amp; BBM Terkini</span>
              </h3>
              <p className="card-subtitle">
                5 pengeluaran operasional armada terbaru pada periode ini
              </p>
            </div>
            <div className="dashboard-panel__header-right">
              {recentExpenses.length > 0 && (
                <span
                  className="amount-pill amount-pill--expense font-mono"
                  title="Subtotal 5 biaya terbaru"
                >
                  &minus; {formatRupiah(recentExpensesTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('expedition-vehicle-recap')}
                className="btn btn-ghost btn-sm dashboard-panel__more-btn dashboard-panel__more-btn--expense"
              >
                <span>Rekap Mobil</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            className="table-container dashboard-table-wrap"
            role="region"
            aria-label="Tabel Biaya Perawatan dan BBM Terkini"
          >
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Plat</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th style={{ textAlign: 'right' }}>Pengeluaran (&minus;)</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.length === 0 ? (
                  <tr className="dashboard-table__empty-row">
                    <td colSpan={5} className="dashboard-table__empty-cell">
                      Belum ada biaya perawatan atau BBM armada di periode ini
                    </td>
                  </tr>
                ) : (
                  recentExpenses.map((e) => (
                    <tr key={e.id} className="dashboard-table__row">
                      <td
                        className="dashboard-cell-date"
                        data-label="Tanggal"
                      >
                        {formatDate(e.date, 'short')}
                      </td>
                      <td className="dashboard-cell-meta" data-label="Plat">
                        <span
                          className="badge badge-neutral"
                          style={{ fontSize: '0.7rem', fontWeight: 600 }}
                        >
                          {e.targetPlate || 'Armada'}
                        </span>
                      </td>
                      <td
                        className="dashboard-cell-meta"
                        data-label="Kategori"
                      >
                        <span
                          className="badge badge-fleet"
                          style={{ fontSize: '0.7rem' }}
                        >
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
