import { Menu, Calendar, FileSpreadsheet, Save, FolderDown, CircleCheck } from 'lucide-react';
import type { DateFilterType, DateRange, ActiveTab } from '../types';
import { indonesianMonths } from '../utils/formatters';

interface HeaderProps {
  activeTab: ActiveTab;
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  onOpenMobileMenu: () => void;
  onExportMonthlyExcel: () => void;
  isDirty: boolean;
  onSaveData: () => void;
  exportFolderName?: string;
  onSelectExportFolder?: () => void;
  companyName?: string;
  companyLogo?: string;
}

  const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  'dashboard':                 { title: 'Konsolidasi Keuangan Pusat', subtitle: 'Ikhtisar laba-rugi gabungan LPG & Ekspedisi' },
  'consolidation-dashboard':   { title: 'Konsolidasi Keuangan Pusat', subtitle: 'Ikhtisar laba-rugi gabungan LPG & Ekspedisi' },
  'lpg-dashboard':             { title: 'Dashboard Divisi LPG 3 Kg',  subtitle: 'Penjualan tabung, beban pangkalan & laba bersih LPG' },
  'lpg-sales':                 { title: 'Penjualan Gas LPG 3 Kg',     subtitle: 'Catat transaksi penjualan tabung pelanggan' },
  'lpg-customers':             { title: 'Master Data Pelanggan LPG',   subtitle: 'Kelola data pelanggan, kontak & tarif tabung' },
  'lpg-expenses':              { title: 'Beban Operasional Pangkalan', subtitle: 'Listrik, air, gaji staf, bongkar muat & sewa' },
  'lpg-analytics':             { title: 'Analitik Pelanggan LPG',      subtitle: 'Akumulasi pembelian & frekuensi transaksi' },
  'lpg-reports':               { title: 'Rekapan & Laporan Divisi LPG', subtitle: 'Rekap bulanan penjualan & export Excel LPG' },
  'expedition-dashboard':      { title: 'Dashboard Divisi Ekspedisi',   subtitle: 'Perjalanan rit, armada & laba bersih ekspedisi' },
  'expedition-trips':          { title: 'Perjalanan Ekspedisi Armada',  subtitle: 'Rute jalan, jarak tempuh, tonase & pendapatan' },
  'expedition-vehicles':       { title: 'Master Armada Kendaraan',      subtitle: 'Daftar armada, plat nomor, driver & tarif per Km' },
  'expedition-expenses':       { title: 'Biaya Perawatan & BBM Armada', subtitle: 'BBM, ganti oli, ban, servis & sparepart' },
  'expedition-vehicle-recap':  { title: 'Rekap Biaya Mobil X',          subtitle: 'Analisis biaya per unit armada bulan ini' },
  'expedition-analytics':      { title: 'Analitik Kinerja Armada',      subtitle: 'Produktivitas rit, jarak & efisiensi muatan' },
  'expedition-reports':        { title: 'Rekapan & Laporan Ekspedisi',  subtitle: 'Laporan rit armada & export Excel Ekspedisi' },
  'expenses':                  { title: 'Pengeluaran Operasional',       subtitle: 'Seluruh biaya operasional perusahaan' },
  'expense-categories':        { title: 'Kategori Pengeluaran',          subtitle: 'Atur kategori beban untuk LPG, Ekspedisi & Umum' },
  'monthly-recap':             { title: 'Ekspor Rekap Bulanan',    subtitle: 'Ekspor laporan lengkap ke Excel multi-sheet (7 sheet)' },
  'reports':                   { title: 'Laporan Keuangan & Laba Rugi', subtitle: 'Rekapitulasi harian, mingguan, bulanan & tahunan' },
  'consolidation-reports':     { title: 'Laporan Keuangan & Laba Rugi', subtitle: 'Rekapitulasi harian, mingguan, bulanan & tahunan' },
  'data-manager':              { title: 'Manajemen Data & Backup',   subtitle: 'Simpan, muat & backup database JSON lokal' },
  'settings':                  { title: 'Pengaturan Sistem',             subtitle: 'Profil perusahaan, identitas bisnis & reset data' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
  onOpenMobileMenu,
  onExportMonthlyExcel,
  isDirty,
  onSaveData,
  exportFolderName,
  onSelectExportFolder,
  companyName,
  companyLogo,
}) => {
  const now = new Date();
  const currentMonthName = indonesianMonths[now.getMonth()] || '';
  const currentYear = now.getFullYear();

  const meta = PAGE_META[activeTab] ?? { title: 'KasPro', subtitle: 'Manajemen Keuangan Usaha Offline' };

  return (
    <header className="app-header"             style={{
              height: 'auto',
              minHeight: 'var(--header-height)',
              position: 'sticky',
              top: 0,
              zIndex: 90,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 32px',
              gap: '16px',
              flexWrap: 'wrap',
            }}>

      {/* Left: Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: '1 1 200px', padding: '12px 0' }}>
        {/* Mobile Menu */}
        <button
          id="mobile-menu-btn"
          className="mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Buka Menu"
        >
          <Menu size={18}/>
        </button>

        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          {companyLogo && (
            <img
              src={companyLogo}
              alt="Logo Usaha"
              style={{
                width: '28px', height: '28px', borderRadius: 'var(--radius-md)',
                objectFit: 'cover', border: '1px solid var(--border-medium)', flexShrink: 0,
              }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
            {companyName && (
              <span style={{
                fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-main)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                {companyName}
              </span>
            )}
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', flexShrink: 0 }}>·</span>
            <h1 style={{
              fontSize: '0.9375rem',
              fontWeight: '600',
              color: 'var(--text-main)',
              letterSpacing: '-0.011em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}>
              {meta.title}
            </h1>
          </div>
          <p style={{
            fontSize: '0.78125rem',
            color: 'var(--text-muted)',
            marginTop: '1px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}>
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Actions Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 0' }}>

        {/* Period Filter */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#fff',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          padding: '0 10px',
          height: '30px',
        }}>
          <Calendar size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }}/>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
            style={{
              padding: '0',
              fontSize: '0.78125rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: '400',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              minWidth: '130px',
            }}
          >
            <option value="all">Semua Waktu</option>
            <option value="today">Hari Ini</option>
            <option value="week">Minggu Ini</option>
            <option value="month">{`Bulan Ini (${currentMonthName} ${currentYear})`}</option>
            <option value="year">{`Tahun Ini (${currentYear})`}</option>
            <option value="custom">Rentang Khusus…</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              style={{
                padding: '5px 9px', fontSize: '0.78125rem', width: '132px',
                border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)',
                background: '#fff', color: 'var(--text-main)', outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.78125rem' }}>—</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              style={{
                padding: '5px 9px', fontSize: '0.78125rem', width: '132px',
                border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)',
                background: '#fff', color: 'var(--text-main)', outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        )}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }}/>

        {/* Export Excel */}
        <button
          onClick={onExportMonthlyExcel}
          className="btn btn-outline btn-sm"
          title="Ekspor laporan bulanan ke Excel"
        >
          <FileSpreadsheet size={13}/>
          <span>Ekspor Data</span>
        </button>

        {/* Select Folder */}
        {onSelectExportFolder && (
          <button
            onClick={onSelectExportFolder}
            className="btn btn-outline btn-sm"
            title={exportFolderName
              ? `Simpan otomatis ke: ${exportFolderName} — klik untuk ganti`
              : 'Pilih folder tujuan simpan Excel otomatis'}
          >
            <FolderDown size={13}/>
            <span>{exportFolderName ? exportFolderName : 'Pilih Folder'}</span>
          </button>
        )}

        {/* Save Status */}
        <button
          onClick={onSaveData}
          className={`btn btn-sm ${isDirty ? 'btn-primary' : 'btn-outline'}`}
          title="Simpan perubahan ke file JSON lokal"
        >
          {isDirty ? <Save size={13}/> : <CircleCheck size={13}/>}
          <span>{isDirty ? 'Simpan' : 'Tersimpan'}</span>
        </button>
      </div>
    </header>
  );
};
