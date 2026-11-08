import konektaLogo from "../../assets/konekta-logo.png";

interface WelcomeScreenProps {
  onStart: () => void;
  onRestore: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onRestore }) => {
  return (
    <div className="kaspro-onboard kaspro-onboard--with-footer">
      <div className="kaspro-onboard__card">
        <div className="kaspro-onboard__logo">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="12" fill="#0e7490" />
            <path d="M24 10c4 6 8 10.2 8 15a8 8 0 1 1-16 0c0-4.8 4-9 8-15Z" fill="#ffffff" />
            <rect x="22.5" y="26" width="3" height="8" rx="1.5" fill="#0e7490" />
            <circle cx="24" cy="25" r="5" fill="#ecf7fa" />
          </svg>
        </div>

        <h1 className="kaspro-onboard__title">Selamat Datang</h1>
        <p className="kaspro-onboard__text">
          Kelola keuangan usaha Anda<br/>dengan lebih mudah
        </p>

        <div className="kaspro-onboard__actions">
          <button type="button" className="btn btn-primary kaspro-onboard__btn" onClick={onStart} style={{ width: '100%' }}>
            Mulai Sekarang
          </button>
          <button type="button" className="btn btn-outline kaspro-onboard__btn" onClick={onRestore} style={{ width: '100%' }}>
            Pulihkan Data
          </button>
        </div>

        <p className="kaspro-onboard__foot">Renah &amp; mudah digunakan · Offline · Data aman di perangkat Anda</p>
      </div>

      {/* Developer Branding Footer */}
      <div className="developer-footer">
        <p>Powered by</p>
        <img src={konektaLogo} alt="KONEKTA Agency Logo" className="konekta-logo" />
        <h2>KONEKTA Agency</h2>
        <p>Connecting Solutions</p>
        <p className="copyright">© 2026 KONEKTA Agency. All Rights Reserved</p>
      </div>
    </div>
  );
};