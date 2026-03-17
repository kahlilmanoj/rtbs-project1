import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ensureDemoData } from '../services/busService';

// Routes shown in the Routes tab (mirrors seeded Firestore TCE Madurai data)
const ALL_ROUTES = [
  { id:'route-BUS-1', name:'Bus 1 — Mattuthavani to TCE',
    stops:['Mattuthavani','KK Nagar','Thallakulam','Goripalayam','Simmakkal','Sethupathi Higher Secondary School','Periyar Bus Stand','Madura College','Palanganatham','Pykara','Pasumalai','Thiagarajar College of Engineering'],
    buses:['BUS-1'], type:'College Bus', fare:45, distance:'14.2 km', duration:'45 min' },
  { id:'route-BUS-2', name:'Bus 2 — Karuppayurani to TCE (Route A)',
    stops:['Karuppayurani','Melamadai','Paalpannai','Anna Bus Stand','Goripalayam','Kelavasal','Therukuvasal','Madura College','Vasantha Nagar','Palanganatham','Alagappan Nagar','Moolakarai','Thiagarajar College of Engineering'],
    buses:['BUS-2'], type:'College Bus', fare:35, distance:'16.8 km', duration:'52 min' },
  { id:'route-BUS-3', name:'Bus 3 — Karuppayurani to TCE (via Simmakkal)',
    stops:['Karuppayurani','Melamadai','Paalpannai','Anna Bus Stand','Goripalayam','Simmakkal','Sethupathi School','Periyar Bus Stand','Vasantha Nagar','Palanganatham','Alagappan Nagar','Moolakarai','Thiagarajar College of Engineering'],
    buses:['BUS-3'], type:'College Bus', fare:65, distance:'17.1 km', duration:'53 min' },
  { id:'route-BUS-4', name:'Bus 4 — Arapalayam to TCE',
    stops:['Arapalayam','Guru Theatre','Kalavasal','KFC','Ponmeni','Vasantha Nagar','Palanganatham','Alagappan Nagar','Pykara','Pasumalai','Moolakarai','Thiagarajar College of Engineering'],
    buses:['BUS-4'], type:'College Bus', fare:50, distance:'12.5 km', duration:'40 min' },
  { id:'route-BUS-5', name:'Bus 5 — Park Town to TCE',
    stops:['Park Town','Thabaal Thanthi Nagar','BB Kulam','Thamukkam','Goripalayam','Simmakkal','Sethupathi School','Periyar Bus Stand','Vasantha Nagar','Palanganatham','Alagappan Nagar','Moolakarai','Thiagarajar College of Engineering'],
    buses:['BUS-5'], type:'College Bus', fare:30, distance:'18.0 km', duration:'57 min' },
];

export default function PassengerHome() {
  const navigate   = useNavigate();
  const { logout, user } = useAuth();

  const [fromStop, setFromStop]   = useState('');
  const [toStop, setToStop]       = useState('');
  const [activeNav, setActiveNav] = useState('home');
  const [routeFilter, setRouteFilter] = useState('');
  const [showAllTrips, setShowAllTrips] = useState(false);

  // Editable profile fields
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rtbs_passenger_profile') || '{}'); }
    catch { return {}; }
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});

  const startEditProfile = () => { setProfileDraft({ ...profile }); setEditingProfile(true); };
  const saveProfile = () => {
    setProfile(profileDraft);
    localStorage.setItem('rtbs_passenger_profile', JSON.stringify(profileDraft));
    setEditingProfile(false);
  };

  // Auto-seed Firestore demo data if the buses collection is empty
  useEffect(() => { ensureDemoData(); }, []);

  // Favourites stored in localStorage
  const [favourites, setFavourites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rtbs_favourites') || '[]');
    } catch {
      return [];
    }
  });

  const saveFavourites = (list) => {
    setFavourites(list);
    localStorage.setItem('rtbs_favourites', JSON.stringify(list));
  };

  const addFavourite = (from, to) => {
    const exists = favourites.some((f) => f.from === from && f.to === to);
    if (!exists) saveFavourites([...favourites, { from, to }]);
  };

  const removeFavourite = (index) => {
    const updated = favourites.filter((_, i) => i !== index);
    saveFavourites(updated);
  };

  const handleSwap = () => {
    setFromStop(toStop);
    setToStop(fromStop);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!fromStop.trim() || !toStop.trim()) return;
    const params = new URLSearchParams({ from: fromStop.trim(), to: toStop.trim() });
    navigate(`/bus-list?${params.toString()}`);
  };

  const searchRoute = (from, to) => {
    const params = new URLSearchParams({ from, to });
    navigate(`/bus-list?${params.toString()}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /* ── Render helpers ──────────────────────────────────────────────────────── */

  const renderHome = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayName = profile.name ? profile.name.split(' ')[0] : user?.email?.split('@')[0];

    return (
    <div style={{ paddingTop: 20 }}>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{greeting} 👋</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Hi, {displayName}!
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Where do you want to travel today?
        </p>
      </div>

      {/* Search card */}
      <form onSubmit={handleSearch} className="search-card card">
        <label className="input-label" htmlFor="from-stop">From</label>
        <input
          id="from-stop"
          type="text"
          className="input-field"
          placeholder="e.g. Mattuthavani"
          value={fromStop}
          onChange={(e) => setFromStop(e.target.value)}
          required
          autoComplete="off"
        />

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <button
            type="button"
            className="swap-btn"
            onClick={handleSwap}
            aria-label="Swap from and to stops"
            title="Swap stops"
          >
            ⇅
          </button>
        </div>

        <label className="input-label" htmlFor="to-stop">To</label>
        <input
          id="to-stop"
          type="text"
          className="input-field"
          placeholder="e.g. TCE"
          value={toStop}
          onChange={(e) => setToStop(e.target.value)}
          required
          autoComplete="off"
        />

        <button type="submit" className="btn btn-primary mt-8">
          🔍&nbsp; Search Buses
        </button>
      </form>

      {/* Popular Routes */}
      <div className="card">
        <p className="input-label mb-8">Popular Routes</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { from: 'Mattuthavani', to: 'TCE'         },
            { from: 'Karuppayurani', to: 'TCE'        },
            { from: 'Arapalayam', to: 'TCE'           },
            { from: 'Park Town', to: 'TCE'            },
          ].map((route) => (
            <button
              key={`${route.from}-${route.to}`}
              className="route-chip"
              onClick={() => searchRoute(route.from, route.to)}
            >
              <span className="route-chip-label">
                📍 {route.from} → {route.to}
              </span>
              <span className="route-chip-arrow">Search →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
    );
  };

  const renderRoutes = () => {
    const filtered = routeFilter.trim()
      ? ALL_ROUTES.filter((r) =>
          r.name.toLowerCase().includes(routeFilter.toLowerCase()) ||
          r.stops.some((s) => s.toLowerCase().includes(routeFilter.toLowerCase()))
        )
      : ALL_ROUTES;

    return (
    <div style={{ paddingTop: 24 }}>
      <h2 className="section-title">All Routes</h2>
      <p className="text-sm text-muted mb-16">
        {ALL_ROUTES.length} routes available · tap a route to search buses
      </p>

      {/* Filter bar */}
      <div className="filter-bar-wrapper">
        <span className="filter-bar-icon">🔍</span>
        <input
          type="search"
          className="filter-bar"
          placeholder="Search routes or stops…"
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          aria-label="Filter routes"
        />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No matching routes</h3>
          <p style={{ fontSize: 14, marginTop: 8 }}>Try a different stop name or destination.</p>
        </div>
      )}

      {filtered.map((route) => (
        <div key={route.id} className="card" style={{ marginBottom: 16 }}>
          {/* Route name */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)', flex: 1 }}>
              🗺️ {route.name}
            </p>
            <span className="badge badge-active" style={{ flexShrink: 0 }}>
              {route.buses.length} bus{route.buses.length > 1 ? 'es' : ''}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{route.type} · {route.distance} · {route.duration} · ₹{route.fare}</p>

          {/* Stops */}
          <div style={{ marginBottom: 12 }}>
            <p className="input-label mb-8">Stops</p>
            <ul className="stops-list">
              {route.stops.map((stop, i) => (
                <li key={stop}>
                  <span
                    className={`stop-dot ${i === 0 ? 'first' : i === route.stops.length - 1 ? 'last' : ''}`}
                  />
                  <span style={{ fontSize: 14 }}>{stop}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Buses on this route */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {route.buses.map((b) => (
              <span
                key={b}
                style={{
                  background: '#d0f0fb',
                  color: '#0d5580',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Bus {b}
              </span>
            ))}
          </div>

          {/* Search + Save favourite */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => searchRoute(route.stops[0], route.stops[route.stops.length - 1])}
              aria-label={`Search buses for ${route.name}`}
            >
              Search Buses
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '0 16px', minWidth: 48 }}
              title="Save to saved routes"
              aria-label="Save to saved routes"
              onClick={() => addFavourite(route.stops[0], route.stops[route.stops.length - 1])}
            >
              ⭐
            </button>
          </div>
        </div>
      ))}
    </div>
    );
  };

  const renderFavourites = () => (
    <div style={{ paddingTop: 24 }}>
      <h2 className="section-title">Saved Routes</h2>
      <p className="text-sm text-muted mb-16">Your saved routes for quick access.</p>

      {favourites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <h3>No saved routes yet</h3>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Go to <strong>Routes</strong> and tap ⭐ to save a route here for quick access.
          </p>
          <button
            className="btn btn-secondary mt-16"
            style={{ maxWidth: 200, margin: '16px auto 0' }}
            onClick={() => setActiveNav('routes')}
          >
            Browse Routes
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {favourites.map((fav, i) => (
            <div key={i} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4, flex: 1 }}>
                  ⭐ {fav.from} → {fav.to}
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: 'auto', padding: '6px 10px', fontSize: 18, color: 'var(--danger)', flexShrink: 0, lineHeight: 1 }}
                  onClick={() => removeFavourite(i)}
                  aria-label={`Remove saved route ${fav.from} to ${fav.to}`}
                  title="Remove saved route"
                >
                  🗑️
                </button>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => searchRoute(fav.from, fav.to)}
              >
                🔍 Search Buses
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const [showClearTripsConfirm, setShowClearTripsConfirm] = useState(false);
  const [pastTrips, setPastTrips] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rtbs_past_trips') || '[]'); }
    catch { return []; }
  });

  const clearPastTrips = () => {
    localStorage.removeItem('rtbs_past_trips');
    setPastTrips([]);
  };

  const renderProfile = () => (
    <div style={{ paddingTop: 24 }}>
      <h2 className="section-title">My Profile</h2>

      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0d98c8 0%, #0d5580 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 900,
          color: '#fff',
          boxShadow: '0 4px 16px rgba(13,85,128,0.3)',
          flexShrink: 0,
        }}>
          {profile.name ? profile.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 3 }}>
            {profile.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 400, fontSize: 14 }}>No name set</span>}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {profile.phone || <span style={{ fontStyle: 'italic' }}>No phone set</span>}
          </p>
        </div>
      </div>

      {/* Info card */}
      <div className="card info-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="input-label" style={{ marginBottom: 0 }}>Profile</span>
          {editingProfile ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditingProfile(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, padding: '3px 10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={saveProfile} style={{ background: 'var(--primary)', border: 'none', borderRadius: 6, fontSize: 12, padding: '3px 10px', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>Save</button>
            </div>
          ) : (
            <button onClick={startEditProfile} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, padding: '3px 10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✏️ Edit</button>
          )}
        </div>

        <div className="info-row">
          <span className="info-label">Role</span>
          <span className="badge badge-active">Passenger</span>
        </div>
        <div className="info-row">
          <span className="info-label">Name</span>
          {editingProfile ? (
            <input value={profileDraft.name || ''} onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Your name" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 160, outline: 'none' }} />
          ) : (
            <span className="info-value" style={{ fontSize: 13 }}>{profile.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}</span>
          )}
        </div>
        <div className="info-row">
          <span className="info-label">Phone</span>
          {editingProfile ? (
            <input value={profileDraft.phone || ''} onChange={(e) => setProfileDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" type="tel" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 160, outline: 'none' }} />
          ) : (
            <span className="info-value" style={{ fontSize: 13 }}>{profile.phone || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}</span>
          )}
        </div>
        <div className="info-row">
          <span className="info-label">Email</span>
          <span className="info-value" style={{ fontSize: 13 }}>{user?.email}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Saved Routes</span>
          <span className="info-value">{favourites.length}</span>
        </div>
      </div>

      {/* Past trips */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="input-label" style={{ marginBottom: 0 }}>Past Trips</p>
          {pastTrips.length > 0 && (
            <button
              onClick={() => setShowClearTripsConfirm(true)}
              style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Clear All
            </button>
          )}
        </div>
        {pastTrips.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
            No trips yet — track a bus to record your first trip.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(showAllTrips ? pastTrips : pastTrips.slice(0, 3)).map((trip, i, arr) => {
                const d = new Date(trip.timestamp);
                const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const date = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#d0f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🚌</div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Bus {trip.busNumber}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{date} · {time}</p>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>₹{trip.fare ?? '—'}</span>
                  </div>
                );
              })}
            </div>
            {pastTrips.length > 3 && (
              <button
                onClick={() => setShowAllTrips((v) => !v)}
                style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'center' }}
              >
                {showAllTrips ? '▲ Show less' : `▼ View all ${pastTrips.length} trips`}
              </button>
            )}
          </>
        )}
      </div>

      {/* App info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="input-label mb-8">About</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          TCE Real-Time Bus Tracking — track live bus locations, get accurate ETAs,
          and browse all Madurai city routes.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
          Version 1.0.0 · Thiagarajar College of Engineering
        </p>
      </div>

    </div>
  );

  const tabContent = {
    home:    renderHome,
    routes:  renderRoutes,
    fav:     renderFavourites,
    profile: renderProfile,
  };

  return (
    <div className="page">

      {/* Clear Trips Confirm Modal */}
      {showClearTripsConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 320, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1a2a3a', marginBottom: 10 }}>Clear Past Trips?</h3>
            <p style={{ fontSize: 14, color: '#4a6a7a', lineHeight: 1.5, marginBottom: 24 }}>
              All your past trip records will be removed from this device.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowClearTripsConfirm(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #b8e4f5', background: '#fff', color: '#1a2a3a', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { clearPastTrips(); setShowClearTripsConfirm(false); }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-title">
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span>TCE Bus Tracking</span>
        </div>
        <div className="header-actions">
          <span style={{ fontSize: 12, color: '#1a2a3a', fontWeight: 500, opacity: 0.7 }}>
            {user?.email?.split('@')[0]}
          </span>
          <button
            onClick={handleLogout}
            style={{ background: '#d32f2f', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', marginLeft: 8 }}
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Page content — switches by active nav */}
      <div className="page-content">
        {tabContent[activeNav]?.()}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {[
          { key: 'home',    icon: '🏠',  label: 'Home'    },
          { key: 'routes',  icon: '🗺️',  label: 'Routes'  },
          { key: 'fav',     icon: '⭐',  label: 'Saved'   },
          { key: 'profile', icon: '👤',  label: 'Profile' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`nav-item ${activeNav === tab.key ? 'active' : ''}`}
            onClick={() => setActiveNav(tab.key)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
