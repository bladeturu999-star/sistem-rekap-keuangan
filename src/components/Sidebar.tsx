import {
  LayoutGrid,
  Flame,
  Truck,
  Wallet,
  FileChartColumn,
  DatabaseBackup,
  Settings2,
  ContactRound,
  GaugeCircle,
  CircleDollarSign,
  Wrench,
  ChartNoAxesColumnIncreasing,
  FolderOpen,
  ListCollapse,
  Building2,
  Circle,
  X,
} from 'lucide-react';
import type { ActiveTab, DivisionMode } from '../types';
import konektaLogo from '../assets/konekta-logo.png';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  divisionMode: DivisionMode;
  setDivisionMode: (mode: DivisionMode) => void;
  companyName: string;
  companyLogo?: string;
  isDirty: boolean;
  onQuickSave: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, badge }) => (
  <button
    type="button"
    onClick={onClick}
    className={`nav-item${active ? ' active' : ''}`}
  >
    <span className="nav-item-icon">{icon}</span>
    <span className="nav-item-label">{label}</span>
    {badge}
  </button>
);

/* Penanda kecil di sisi kanan item navigasi (mis. "Excel") */
const IconBadge = ({ label }: { label: string }) => (
  <span
    style={{
      marginLeft: 'auto',
      fontSize: '0.6875rem',
      padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-medium)',
      backgroundColor: '#fff',
      color: 'var(--text-muted)',
      fontWeight: '400',
      flexShrink: 0,
    }}
  >
    {label}
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  divisionMode,
  setDivisionMode,
  companyName,
  companyLogo,
  isDirty,
  onQuickSave,
  isOpenMobile,
  onCloseMobile,
}) => {
  const handleNav = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const handleSwitchDivision = (mode: DivisionMode) => {
    setDivisionMode(mode);
    if (mode === 'lpg') setActiveTab('lpg-dashboard');
    else if (mode === 'expedition') setActiveTab('expedition-dashboard');
    else setActiveTab('consolidation-dashboard');
    onCloseMobile();
  };

  const divisions: { mode: DivisionMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'lpg',           label: 'LPG',       icon: <Flame size={13}/> },
    { mode: 'expedition',    label: 'Ekspedisi', icon: <Truck size={13}/> },
    { mode: 'consolidation', label: 'Pusat',     icon: <Building2 size={13}/> },
  ];


  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(24,24,27,0.35)',
            zIndex: 998,
          }}
        />
      )}

      <aside className={`sidebar ${isOpenMobile ? 'open' : ''}`}>
        {/* Brand Header */}
        <div style={{
          padding: '16px 14px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {/* Logo + Company Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '30px', height: '30px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-main)',
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              {companyLogo ? (
                <img src={companyLogo} alt="Logo Usaha" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : divisionMode === 'lpg' ? <Flame size={16}/> : divisionMode === 'expedition' ? <Truck size={16}/> : <Building2 size={16}/>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-main)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {companyName || 'SISTEM KEUANGAN'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                <Circle size={5} style={{ color: 'var(--text-dim)', fill: 'currentColor', flexShrink: 0 }}/>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontWeight: '400' }}>100% Offline</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="sidebar-close-mobile"
              aria-label="Tutup Menu"
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                background: '#fff',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={15}/>
            </button>
          </div>

          {/* Division Switcher */}
          <div className="division-switch">
            {divisions.map(d => (
              <button
                key={d.mode}
                type="button"
                onClick={() => handleSwitchDivision(d.mode)}
                title={`Divisi ${d.label}`}
                className={`division-btn${divisionMode === d.mode ? ' active' : ''}`}
              >
                {d.icon}
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 4px' }}>

          {/* === LPG NAV === */}
          {divisionMode === 'lpg' && (
            <>
              <div className="section-title">RINGKASAN</div>
              <NavItem icon={<LayoutGrid size={16}/>} label="Dashboard LPG" active={activeTab === 'lpg-dashboard'} onClick={() => handleNav('lpg-dashboard')}/>
              <div className="section-title">PENCATATAN</div>
              <NavItem icon={<ContactRound size={16}/>} label="Data Pelanggan" active={activeTab === 'lpg-customers'} onClick={() => handleNav('lpg-customers')}/>
              <NavItem icon={<CircleDollarSign size={16}/>} label="Penjualan LPG" active={activeTab === 'lpg-sales'} onClick={() => handleNav('lpg-sales')}/>
              <NavItem icon={<Wallet size={16}/>} label="Beban Operasional LPG" active={activeTab === 'lpg-expenses'} onClick={() => handleNav('lpg-expenses')}/>
              <div className="section-title">LAPORAN</div>
              <NavItem icon={<ChartNoAxesColumnIncreasing size={16}/>} label="Analisis Pelanggan" active={activeTab === 'lpg-analytics'} onClick={() => handleNav('lpg-analytics')}/>
              <NavItem
                icon={<FileChartColumn size={16}/>}
                label="Laporan & Ekspor Data"
                active={activeTab === 'lpg-reports'}
                onClick={() => handleNav('lpg-reports')}
                badge={<IconBadge label="Excel"/>}
              />
            </>
          )}

          {/* === EXPEDITION NAV === */}
          {divisionMode === 'expedition' && (
            <>
              <div className="section-title">RINGKASAN</div>
              <NavItem icon={<LayoutGrid size={16}/>} label="Dashboard Ekspedisi" active={activeTab === 'expedition-dashboard'} onClick={() => handleNav('expedition-dashboard')}/>
              <div className="section-title">PENCATATAN</div>
              <NavItem icon={<GaugeCircle size={16}/>} label="Data Armada Mobil" active={activeTab === 'expedition-vehicles'} onClick={() => handleNav('expedition-vehicles')}/>
              <NavItem icon={<Truck size={16}/>} label="Perjalanan Ekspedisi" active={activeTab === 'expedition-trips'} onClick={() => handleNav('expedition-trips')}/>
              <div className="section-title">LAPORAN</div>
              <NavItem
                icon={<Wrench size={16}/>}
                label="Analisis Biaya Armada"
                active={activeTab === 'expedition-vehicle-recap'}
                onClick={() => handleNav('expedition-vehicle-recap')}
                badge={<IconBadge label="Fitur"/>}
              />
              <NavItem icon={<ChartNoAxesColumnIncreasing size={16}/>} label="Analisis Armada" active={activeTab === 'expedition-analytics'} onClick={() => handleNav('expedition-analytics')}/>
              <NavItem
                icon={<FileChartColumn size={16}/>}
                label="Laporan & Ekspor Data"
                active={activeTab === 'expedition-reports'}
                onClick={() => handleNav('expedition-reports')}
                badge={<IconBadge label="Excel"/>}
              />
            </>
          )}

          {/* === CONSOLIDATION NAV === */}
          {divisionMode === 'consolidation' && (
            <>
              <div className="section-title">RINGKASAN</div>
              <NavItem icon={<LayoutGrid size={16}/>} label="Ringkasan Laba Rugi" active={activeTab === 'consolidation-dashboard'} onClick={() => handleNav('consolidation-dashboard')}/>
              <div className="section-title">PENCATATAN</div>
              <NavItem icon={<Wallet size={16}/>} label="Pengeluaran Operasional" active={activeTab === 'expenses'} onClick={() => handleNav('expenses')}/>
              <div className="section-title">LAPORAN</div>
              <NavItem icon={<ListCollapse size={16}/>} label="Rekapitulasi Berkala" active={activeTab === 'reports'} onClick={() => handleNav('reports')}/>
              <NavItem
                icon={<FileChartColumn size={16}/>}
                label="Ekspor Gabungan (7 Sheet)"
                active={activeTab === 'monthly-recap'}
                onClick={() => handleNav('monthly-recap')}
                badge={<IconBadge label="Excel"/>}
              />
              <div className="section-title">PUSAT DATA & BACKUP</div>
              <NavItem
                icon={<DatabaseBackup size={16}/>}
                label="Backup & Manajemen Data"
                active={activeTab === 'data-manager'}
                onClick={() => handleNav('data-manager')}
                badge={isDirty ? (
                  <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'inline-block', flexShrink: 0 }}/>
                ) : undefined}
              />
              <NavItem icon={<Settings2 size={16}/>} label="Pengaturan Sistem" active={activeTab === 'settings'} onClick={() => handleNav('settings')}/>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--border-subtle)',
          background: '#fff',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '8px', padding: '0 2px',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Status</span>
            {isDirty ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-text)', fontWeight: '500' }}>Ada Perubahan</span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '400' }}>Tersimpan</span>
            )}
          </div>
          <button
            type="button"
            onClick={onQuickSave}
            className={`btn btn-sm ${isDirty ? 'btn-primary' : 'btn-outline'}`}
            style={{ width: '100%' }}
          >
            <FolderOpen size={14}/>
            Simpan File Database (.json)
          </button>

          {/* Developer Credit */}
          <div className="sidebar-developer-credit">
            <span>KasPro v1.0.0</span>
            <span>Powered by</span>
            <img src={konektaLogo} alt="KONEKTA Agency Logo" className="konekta-logo" />
            <span className="konekta-name">KONEKTA Agency</span>
          </div>
        </div>
      </aside>
    </>
  );
};
