import { useEffect, useRef, useState } from 'react';
import konektaLogo from "../../assets/konekta-logo.png";

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [fading, setFading] = useState(false);
  const finRef = useRef(onFinish);
  finRef.current = onFinish;

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1700);
    const finishTimer = setTimeout(() => finRef.current(), 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  return (
    <div className={`kaspro-splash splash-screen ${fading ? 'kaspro-splash--out' : ''}`}>
      <div className="kaspro-splash__inner">
        <div className="kaspro-splash__logo">
          <svg viewBox="0 0 48 48" width="56" height="56" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="12" fill="#0e7490" />
            <path d="M24 10c4 6 8 10.2 8 15a8 8 0 1 1-16 0c0-4.8 4-9 8-15Z" fill="#ffffff" />
            <rect x="22.5" y="26" width="3" height="8" rx="1.5" fill="#0e7490" />
            <circle cx="24" cy="25" r="5" fill="#ecf7fa" />
          </svg>
        </div>
        <h1 className="kaspro-splash__title">KasPro</h1>
        <p className="kaspro-splash__subtitle">Manajemen Keuangan Usaha Offline</p>
      </div>

      {/* Developer Branding */}
      <div className="developer-branding splash-developer-branding">
        <p>Developed by</p>
        <img src={konektaLogo} alt="KONEKTA Agency Logo" className="konekta-logo" />
        <h2>KONEKTA Agency</h2>
        <p>Connecting Solutions</p>
      </div>
    </div>
  );
};