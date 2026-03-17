import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-page" style={{
      backgroundImage: "url('/college pic.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, rgba(13,85,128,0.82) 0%, rgba(7,42,69,0.9) 100%)',
        zIndex: 0,
      }} />
      <img
        src="/logo.png"
        alt="TCE Logo"
        className="splash-logo"
        style={{ width: 110, height: 110, objectFit: 'contain', fontSize: 'unset' }}
      />
      <h1 className="splash-title" style={{ fontSize: 18, letterSpacing: 2, textAlign: 'center', maxWidth: 280, lineHeight: 1.3 }}>
        Thiagarajar College of Engineering
      </h1>
      <p className="splash-subtitle">Bus Tracking System</p>
      <div className="loading-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
