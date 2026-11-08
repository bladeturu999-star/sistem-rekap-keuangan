import { useState } from 'react';
import { Building2, Save, CircleCheck, RefreshCw, Trash2, TriangleAlert, Flame, Truck, List, ContactRound } from 'lucide-react';
import type { AppData, CompanySettings } from '../types';
import { ClearAllDataModal } from '../components/ClearAllDataModal';
import { OptionListManager } from '../components/OptionListManager';
import konektaLogo from '../assets/konekta-logo.png';

interface SettingsViewProps {
  appData: AppData;
  onUpdateSettings: (settings: CompanySettings) => void;
  onResetData: () => void;
  onClearAllData?: (keepMasterData: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appData,
  onUpdateSettings,
  onResetData,
  onClearAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'lpg' | 'expedition' | 'general'>('profile');
  const [showClearModal, setShowClearModal] = useState(false);
  
  // Profile state
  const [companyName, setCompanyName] = useState(appData.settings.companyName);
  const [address, setAddress] = useState(appData.settings.address);
  const [phone, setPhone] = useState(appData.settings.phone);
  const [currency, setCurrency] = useState(appData.settings.currency || 'IDR');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...appData.settings,
      companyName: companyName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      currency,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleUpdateOption = (field: keyof CompanySettings, newOptions: string[]) => {
    onUpdateSettings({
      ...appData.settings,
      [field]: newOptions,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Building2 size={16} /> Profil Usaha & Sistem
        </button>
        <button 
          onClick={() => setActiveTab('lpg')}
          className={`btn ${activeTab === 'lpg' ? 'btn-primary' : 'btn-outline'}`}
          style={activeTab === 'lpg' ? { backgroundColor: 'var(--color-lpg)', borderColor: 'var(--color-lpg)' } : { color: 'var(--color-lpg)' }}
        >
          <Flame size={16} /> Master Data LPG
        </button>
        <button 
          onClick={() => setActiveTab('expedition')}
          className={`btn ${activeTab === 'expedition' ? 'btn-primary' : 'btn-outline'}`}
          style={activeTab === 'expedition' ? { backgroundColor: 'var(--color-fleet)', borderColor: 'var(--color-fleet)' } : { color: 'var(--color-fleet)' }}
        >
          <Truck size={16} /> Master Data Ekspedisi
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-outline'}`}
          style={activeTab === 'general' ? { backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-success)' }}
        >
          <List size={16} /> Master Pengeluaran
        </button>
      </div>

      {activeTab === 'profile' && (
        <>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Building2 size={20} style={{ color: 'var(--color-lpg)' }} />
                  Identitas & Profil Perusahaan
                </h3>
                <p className="card-subtitle">
                  Informasi ini akan muncul di header aplikasi dan kop laporan ekspor Excel
                </p>
              </div>
            </div>

            {savedSuccess && (
              <div
                style={{
                  backgroundColor: 'var(--color-success-light)',
                  border: '1px solid var(--color-success-border)',
                  color: 'var(--color-success-text)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  fontWeight: '600',
                }}
              >
                <CircleCheck size={18} />
                <span>Pengaturan perusahaan berhasil disimpan!</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nama Perusahaan / Pangkalan / Badan Usaha *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">No. Telepon / Kontak Resmi</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Format Mata Uang</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="form-select"
                  >
                    <option value="IDR">Rupiah Indonesia (IDR - Rp)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Kantor / Pangkalan</label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} />
                  <span>Simpan Pengaturan</span>
                </button>
              </div>
            </form>
          </div>

          {/* App Info & Demo Reset Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: '#fff', flexShrink: 0, overflow: 'hidden',
                    }}
                  >
                    <svg viewBox="0 0 48 48" width="28" height="28" fill="none" aria-hidden="true">
                      <rect width="48" height="48" rx="12" fill="#0e7490" />
                      <path d="M24 10c4 6 8 10.2 8 15a8 8 0 1 1-16 0c0-4.8 4-9 8-15Z" fill="#ffffff" />
                      <rect x="22.5" y="26" width="3" height="8" rx="1.5" fill="#0e7490" />
                      <circle cx="24" cy="25" r="5" fill="#ecf7fa" />
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '2px' }}>KasPro</h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manajemen Keuangan Usaha Offline</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <div><strong>Versi:</strong> 1.0.0</div>
                  <div><strong>Build:</strong> 2026.10</div>
                  <div><strong>Arsitektur:</strong> 100% Offline-First (Local File-Based JSON Storage)</div>
                  <div><strong>Koneksi Server:</strong> Tanpa Server Cloud (Data tersimpan di perangkat pengguna)</div>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px',
                  paddingTop: '12px', borderTop: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
                  }}>
                    <img src={konektaLogo} alt="KONEKTA Agency" style={{ width: '30px', height: 'auto', objectFit: 'contain' }} />
                  </div>
                  <div style={{ lineHeight: '1.5' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Developer: KONEKTA Agency</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Connecting Solutions</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>© 2026 KONEKTA Agency</div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset database ke data percontohan awal?')) {
                    onResetData();
                  }
                }}
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}
              >
                <RefreshCw size={14} />
                <span>Reset Data Demo</span>
              </button>
            </div>
          </div>



          {/* Zona Bahaya: Hapus Seluruh Data / Mulai dari Nol (2 Langkah Konfirmasi) */}
          {onClearAllData && (
            <div
              className="card"
              style={{
                border: '1px solid var(--color-danger-border)',
                backgroundColor: 'rgba(239, 68, 68, 0.03)',
              }}
            >
              <div className="card-header" style={{ borderBottomColor: 'var(--color-danger-border)' }}>
                <div>
                  <h3 className="card-title" style={{ color: 'var(--color-danger)' }}>
                    <TriangleAlert size={20} />
                    Hapus Seluruh Data Sistem (Mulai dari Nol)
                  </h3>
                  <p className="card-subtitle">
                    Gunakan fitur ini ketika Anda ingin mengosongkan seluruh pembukuan latihan/demo dan siap memulai pencatatan riil dari saldo Rp 0.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.6',
                    backgroundColor: 'var(--bg-card)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  🔒 <strong>Keamanan Berlapis (2 Langkah Konfirmasi):</strong> Tombol ini dirancang dengan pengaman 2 tahap (<span style={{ color: 'var(--text-main)', fontWeight: '600' }}>1. Klik Konfirmasi</span> lalu <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>2. Ya Setuju</span>) sehingga data Anda dijamin tidak akan terhapus karena salah klik atau kecelakaan.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="btn btn-primary"
                    style={{
                      backgroundColor: 'var(--color-danger)',
                      borderColor: 'var(--color-danger)',
                      gap: '8px',
                      fontWeight: '600',
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Hapus Seluruh Data (Mulai dari Nol)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2-Step Confirmation Modal */}
          {showClearModal && onClearAllData && (
            <ClearAllDataModal
              appData={appData}
              onClose={() => setShowClearModal(false)}
              onConfirm={(keepMasterData) => {
                onClearAllData(keepMasterData);
                setShowClearModal(false);
              }}
            />
          )}
        </>
      )}

      {activeTab === 'lpg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--color-lpg-text)' }}>Master Data: Divisi LPG</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Atur daftar pilihan yang muncul saat input transaksi penjualan LPG.</p>
          </div>

          <OptionListManager
            title="Jenis Produk / Tabung Gas"
            icon={<Flame size={18} style={{ color: 'var(--color-lpg)' }} />}
            description="Daftar varian gas LPG yang dijual ke pelanggan."
            options={appData.settings.lpgProducts || []}
            onChange={(newOpts) => handleUpdateOption('lpgProducts', newOpts)}
            placeholder="Misal: LPG 3 Kg / Bright Gas 12 Kg"
          />

          <OptionListManager
            title="Metode Pembayaran LPG"
            icon={<List size={18} style={{ color: 'var(--color-lpg)' }} />}
            description="Status atau opsi metode pembayaran yang bisa dipilih saat penjualan."
            options={appData.settings.lpgPaymentMethods || []}
            onChange={(newOpts) => handleUpdateOption('lpgPaymentMethods', newOpts)}
            placeholder="Misal: Tunai, Transfer QRIS, Bon/Tempo"
          />

          <OptionListManager
            title="Kategori Pengeluaran LPG"
            icon={<List size={18} style={{ color: 'var(--color-lpg)' }} />}
            description="Klasifikasi biaya operasional pangkalan LPG."
            options={appData.settings.lpgExpCategories || []}
            onChange={(newOpts) => handleUpdateOption('lpgExpCategories', newOpts)}
            placeholder="Misal: Bongkar/Muat Gas, Gaji Staf"
          />
        </div>
      )}

      {activeTab === 'expedition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--color-fleet)' }}>Master Data: Divisi Ekspedisi</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Atur daftar pilihan yang muncul saat input ritase atau manajemen armada.</p>
          </div>

          <OptionListManager
            title="Daftar Supir / Driver"
            icon={<ContactRound size={18} style={{ color: 'var(--color-fleet)' }} />}
            description="Daftar nama supir yang membawa armada ekspedisi."
            options={appData.settings.expeditionDrivers || []}
            onChange={(newOpts) => handleUpdateOption('expeditionDrivers', newOpts)}
            placeholder="Misal: Budi Santoso"
          />

          <OptionListManager
            title="Rute Perjalanan / Tujuan"
            icon={<Truck size={18} style={{ color: 'var(--color-fleet)' }} />}
            description="Daftar rute standar yang sering dilalui armada."
            options={appData.settings.expeditionRoutes || []}
            onChange={(newOpts) => handleUpdateOption('expeditionRoutes', newOpts)}
            placeholder="Misal: Medan - Pematang Siantar"
          />

          <OptionListManager
            title="Kategori Jenis Kendaraan"
            icon={<List size={18} style={{ color: 'var(--color-fleet)' }} />}
            description="Tipe-tipe mobil armada (misal: Truk, Pick Up)."
            options={appData.settings.expeditionVehTypes || []}
            onChange={(newOpts) => handleUpdateOption('expeditionVehTypes', newOpts)}
            placeholder="Misal: Colt Diesel Engkel"
          />

          <OptionListManager
            title="Kategori Pengeluaran Kendaraan"
            icon={<List size={18} style={{ color: 'var(--color-fleet)' }} />}
            description="Klasifikasi biaya perawatan atau operasional jalan armada."
            options={appData.settings.expeditionVehExpCategories || []}
            onChange={(newOpts) => handleUpdateOption('expeditionVehExpCategories', newOpts)}
            placeholder="Misal: Ganti Oli / Uang Jalan"
          />
        </div>
      )}

      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--color-success)' }}>Master Data: Pengeluaran Umum</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Atur daftar kategori pengeluaran konsolidasi/pusat (di luar divisi).</p>
          </div>

          <OptionListManager
            title="Kategori Pengeluaran Umum"
            icon={<List size={18} style={{ color: 'var(--color-success)' }} />}
            description="Daftar kategori untuk beban dan operasional umum (kantor pusat)."
            options={appData.settings.generalExpCategories || []}
            onChange={(newOpts) => handleUpdateOption('generalExpCategories', newOpts)}
            placeholder="Misal: Listrik Kantor, Internet & Telepon"
          />
        </div>
      )}

    </div>
  );
};


