import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { seedDemoData } from '../services/busService';

// Demo credentials for each role
const DEMO_CREDS = {
  passenger: { email: 'passenger@test.com', password: '123456' },
  driver:    { email: 'driver@test.com',    password: '123456' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const [role, setRole]             = useState('passenger'); // 'passenger' | 'driver'
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [seedLoading, setSeedLoading]   = useState(false);
  const [seedSuccess, setSeedSuccess]   = useState('');

  // Switch role toggle — also pre-fills demo credentials
  const switchRole = (newRole) => {
    setRole(newRole);
    setError('');
    setEmail('');
    setPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Save the role the user selected so AuthContext can read it instantly
      localStorage.setItem('rtbs_role', role);
    } catch (err) {
      const messages = {
        'auth/user-not-found':     'No account found with this email.',
        'auth/wrong-password':     'Incorrect password. Please try again.',
        'auth/invalid-email':      'Please enter a valid email address.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests':  'Too many attempts. Please wait and try again.',
      };
      setError(messages[err.code] || `Login failed: ${err.message}`);
      setLoginLoading(false);
    }
  };

  // Navigate once AuthContext resolves the role after sign-in
  React.useEffect(() => {
    if (userRole && loginLoading) {
      setLoginLoading(false);
      navigate(userRole === 'driver' ? '/driver-dashboard' : '/passenger-home');
    }
  }, [userRole, loginLoading, navigate]);

  const handleSeedData = async () => {
    setSeedLoading(true);
    setSeedSuccess('');
    setError('');
    try {
      await seedDemoData();
      setSeedSuccess('Demo data seeded! Routes and buses are ready.');
    } catch (err) {
      setError(`Seed failed: ${err.message}`);
    } finally {
      setSeedLoading(false);
    }
  };

  // Fill the form with demo credentials for the selected role
  const fillDemo = () => {
    setEmail(DEMO_CREDS[role].email);
    setPassword(DEMO_CREDS[role].password);
  };

  const isDriver = role === 'driver';

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <img src="/logo.png" alt="TCE Logo" style={{ width: 72, height: 72, objectFit: 'contain' }} />
        </div>
        <h1 className="login-title" style={{ fontSize: 15, letterSpacing: 1 }}>Thiagarajar College of Engineering</h1>
        <p className="login-subtitle">Bus Tracking System</p>

        {/* Role Toggle */}
        <div className="role-toggle">
          <button
            type="button"
            className={`role-btn ${!isDriver ? 'role-btn-active' : ''}`}
            onClick={() => switchRole('passenger')}
          >
            <img src="/logo.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />
            Passenger
          </button>
          <button
            type="button"
            className={`role-btn ${isDriver ? 'role-btn-active role-btn-driver' : ''}`}
            onClick={() => switchRole('driver')}
          >
            <img src="/logo.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />
            Driver
          </button>
        </div>

        {/* Role label */}
        <p className="role-hint">
          {isDriver
            ? 'Sign in to start your trip & share live location'
            : 'Sign in to search buses and track live arrivals'}
        </p>

        {error      && <div className="error-message">{error}</div>}
        {seedSuccess && <div className="success-message">{seedSuccess}</div>}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <label className="input-label">Email</label>
          <input
            type="email"
            className="input-field"
            placeholder={DEMO_CREDS[role].email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label className="input-label">Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button
            type="submit"
            className={`btn mt-8 ${isDriver ? 'btn-driver' : 'btn-primary'}`}
            disabled={loginLoading}
          >
            {loginLoading ? 'Signing in…' : `Sign In as ${isDriver ? 'Driver' : 'Passenger'}`}
          </button>
        </form>

      </div>
    </div>
  );
}
