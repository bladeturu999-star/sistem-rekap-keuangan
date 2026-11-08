import { useRef, useState } from 'react';
import { Upload, Building, User, Phone, MapPin, Save } from 'lucide-react';
import konektaLogo from "../../assets/konekta-logo.png";
import type { CompanySettings } from '../../types';

interface SetupProfileScreenProps {
  onComplete: (settings: CompanySettings) => void;
}

export const SetupProfileScreen: React.FC<SetupProfileScreenProps> = ({ onComplete }) => {
  const [logo, setLogo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      companyName: companyName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      logo,
      currency: 'IDR',
      isSetupComplete: true,
      customCategories: [],
    });
  };

  return (
    <div className="kaspro-onboard">
      <div className="kaspro-onboard__card kaspro-onboard__card--wide">
        <div className="kaspro-onboard__logo">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="12" fill="#0e7490" />
            <path d="M24 10c4 6 8 10.2 8 15a8 8 0 1 1-16 0c0-4.8 4-9 8-15Z" fill="#ffffff" />
            <rect x="22.5" y="26" width="3" height="8" rx="1.5" fill="#0e7490" />
            <circle cx="24" cy="25" r="5" fill="#ecf7fa" />
          </svg>
        </div>

        <h1 className="kaspro-onboard__title">Lengkapi Profil Usaha</h1>
        <p className="kaspro-onboard__text">
          Informasi ini tampil di dashboard, laporan, dan kop ekspor Excel.
        </p>

        <form onSubmit={handleSubmit} className="kaspro-onboard__form">
          <div className="kaspro-onboard__logo-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleLogoSelect(e.target.files?.[0])}
            />
            {logo ? (
              <img src={logo} alt="Logo Usaha" className="kaspro-onboard__logo-preview" onClick={() => fileInputRef.current?.click()} />
            ) : (
              <button
                type="button"
                className="kaspro-onboard__logo-empty"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} />
                <span>Upload Logo Usaha</span>
              </button>
            )}
            {logo && (
              <button type="button" className="kaspro-onboard__logo-replace" onClick={() => fileInputRef.current?.click()}>
                Ganti Logo
              </button>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              <Building size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Nama Usaha *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="form-input"
              placeholder="cth. Toko Sembako Berkah"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <User size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Nama Pemilik
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="form-input"
                placeholder="cth. Budi Santoso"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Phone size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Nomor Telepon
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                placeholder="cth. 0812-3456-7890"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Alamat Usaha
            </label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="form-textarea"
              placeholder="cth. Jl. Merdeka No. 12, Yogyakarta"
            />
          </div>

          <div className="kaspro-onboard__actions">
            <button type="submit" className="btn btn-primary kaspro-onboard__btn" style={{ width: '100%' }}>
              <Save size={16} />
              Simpan &amp; Mulai
            </button>
          </div>
        </form>
      </div>

      {/* Developer Branding Footer */}
      <div className="developer-footer">
        <p>Developed by</p>
        <img src={konektaLogo} alt="KONEKTA Agency Logo" className="konekta-logo" />
        <h2>KONEKTA Agency</h2>
        <p>Connecting Solutions</p>
        <p className="copyright">© 2026 KONEKTA Agency. All Rights Reserved</p>
      </div>
    </div>
  );
};