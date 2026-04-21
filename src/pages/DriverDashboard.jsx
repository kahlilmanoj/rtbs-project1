import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocs, collection, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { ensureDemoData, seedDemoData, getTripHistory, clearTripHistory, clearRoutePolylineCache, addCustomRoute, removeBus, stopTrip } from '../services/busService';
import { STOP_DB } from '../data/busStops';

// Flat searchable list: base stops + every variant as a separate entry
const ALL_STOPS = Object.values(STOP_DB).flatMap((stop) => {
  const entries = [{ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng }];
  if (stop.variants) {
    Object.entries(stop.variants).forEach(([variant, coords]) =>
      entries.push({
        id: `${stop.id}_${variant}`,
        name: `${stop.name} (${variant.charAt(0).toUpperCase() + variant.slice(1)})`,
        lat: coords.lat,
        lng: coords.lng,
      }),
    );
  }
  return entries;
});

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard');

  // ── Dashboard state ──
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── History state ──
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [cacheMsg, setCacheMsg] = useState('');
  const [forceStoppingBus, setForceStoppingBus] = useState(null); // busId being force-stopped

  // ── Editable profile fields ──
  const [driverProfile, setDriverProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rtbs_driver_profile') || '{}'); }
    catch { return {}; }
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});

  const startEditProfile = () => { setProfileDraft({ ...driverProfile }); setEditingProfile(true); };
  const saveProfile = () => {
    setDriverProfile(profileDraft);
    localStorage.setItem('rtbs_driver_profile', JSON.stringify(profileDraft));
    setEditingProfile(false);
  };

  // ── Add Route state ──
  const EMPTY_FORM = { busNumber: '', routeName: '', busType: 'College Bus', fare: '', distance: '', duration: '', schedule: '07:30 AM' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedStops, setSelectedStops] = useState([]);
  const [stopSearch, setStopSearch] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // ── Fetch buses on mount ──
  useEffect(() => {
    if (!user?.email) return;

    async function fetchDriverBuses() {
      // Run ensureDemoData in background — don't block the UI on it
      ensureDemoData().catch(() => { });
      try {
        const busQuery = query(
          collection(db, 'buses'),
          where('driverEmail', '==', user.email)
        );
        const busSnap = await getDocs(busQuery);
        const busData = busSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBuses(busData);

        // Fetch all unique routes in parallel
        const uniqueRouteIds = [...new Set(busData.map((b) => b.routeId).filter(Boolean))];
        const routeSnaps = await Promise.all(
          uniqueRouteIds.map((rId) => getDoc(doc(db, 'routes', rId)))
        );
        const routeMap = {};
        routeSnaps.forEach((snap) => {
          if (snap.exists()) {
            const { route_polyline, recordedPolyline, ...rest } = snap.data();
            routeMap[snap.id] = { id: snap.id, ...rest };
          }
        });
        setRoutes(routeMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDriverBuses();
  }, [user]);

  // ── Fetch history when tab opens ──
  useEffect(() => {
    if (activeTab !== 'history' || !user?.email) return;
    setHistoryLoading(true);
    getTripHistory(user.email)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleStartTrip = (busId) => navigate(`/driver-tracking?busId=${busId}`);

  /* ── Tab: Dashboard ────────────────────────────────────────────────────── */
  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your buses…</p>
        </div>
      );
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayName = driverProfile.name ? driverProfile.name.split(' ')[0] : user?.email?.split('@')[0];

    return (
      <div style={{ paddingTop: 20 }}>

        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{greeting} 👋</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Hi, {displayName}!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Ready to start your trip today?
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <p className="input-label mb-12">Your Assigned Buses</p>

        {buses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚌</div>
            <h3>No buses assigned</h3>
            <p>
              No buses found for <strong>{user?.email}</strong>. Make sure demo
              data is seeded and your email matches <code>driverEmail</code> in
              Firestore.
            </p>
            <button className="btn btn-secondary mt-16" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        ) : (
          buses.map((bus) => {
            const route = routes[bus.routeId];
            return (
              <div key={bus.id} className="driver-bus-card">
                <div className="bus-card-header" style={{ marginBottom: 8 }}>
                  <div className="driver-bus-number">{bus.busNumber}</div>
                  <span className={`badge ${bus.status === 'active' ? 'badge-active' : 'badge-idle'}`}>
                    {bus.status === 'active' ? '● Active' : '○ Idle'}
                  </span>
                </div>

                <div className="route-name">🗺️&nbsp; {route?.name || bus.routeId}</div>

                <div className="info-row">
                  <span className="info-label">Schedule</span>
                  <span className="info-value">{bus.schedule}</span>
                </div>

                {route?.stops?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p className="input-label mb-8">Route Stops</p>
                    <ul className="stops-list">
                      {route.stops.map((stop, idx) => (
                        <li key={idx}>
                          <span className={`stop-dot ${idx === 0 ? 'first' : idx === route.stops.length - 1 ? 'last' : ''}`} />
                          <span>{stop.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bus.status === 'active' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => handleStartTrip(bus.id)}
                    >
                      ▶ Resume Trip
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, color: '#d32f2f', borderColor: '#d32f2f' }}
                      disabled={forceStoppingBus === bus.id}
                      onClick={async () => {
                        setForceStoppingBus(bus.id);
                        try {
                          await stopTrip(bus.id);
                          // Refresh bus list
                          setBuses((prev) =>
                            prev.map((b) => b.id === bus.id ? { ...b, status: 'idle' } : b)
                          );
                        } catch (e) {
                          alert('Force stop failed: ' + e.message);
                        } finally {
                          setForceStoppingBus(null);
                        }
                      }}
                    >
                      {forceStoppingBus === bus.id ? 'Stopping…' : '⏹ Stop Trip'}
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary mt-16"
                    onClick={() => handleStartTrip(bus.id)}
                  >
                    ▶ Start Trip
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  /* ── Tab: Trip History ─────────────────────────────────────────────────── */
  const renderHistory = () => {
    if (historyLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading trip history…</p>
        </div>
      );
    }

    return (
      <div style={{ paddingTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Trip History</h2>
          {history.length > 0 && (
            <button
              disabled={clearingHistory}
              onClick={() => setShowClearConfirm(true)}
              style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: clearingHistory ? 0.6 : 1 }}
            >
              {clearingHistory ? 'Clearing…' : 'Clear All'}
            </button>
          )}
        </div>
        <p className="text-sm text-muted mb-16">
          All completed trips for <strong>{user?.email}</strong>
        </p>

        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No trips yet</h3>
            <p>Start a trip from the Dashboard tab — it will appear here once completed.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {history.map((trip, i) => {
              const endDate = trip.endTime?.toDate
                ? trip.endTime.toDate()
                : null;
              const startDate = trip.startTime instanceof Date
                ? trip.startTime
                : trip.startTime?.toDate
                  ? trip.startTime.toDate()
                  : null;

              const durationMin = startDate && endDate
                ? Math.round((endDate - startDate) / 60000)
                : null;

              return (
                <div key={trip.id} className="card trip-history-card">
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>
                        Bus {trip.busNumber}
                      </span>
                      <span className="badge badge-completed" style={{ marginLeft: 10, fontSize: 11 }}>
                        ✓ Completed
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      #{history.length - i}
                    </span>
                  </div>

                  {/* Route */}
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    🗺️ {trip.routeName}
                  </p>

                  {/* Stats grid */}
                  <div className="trip-stats-grid">
                    <div className="trip-stat">
                      <span className="trip-stat-value">{trip.distanceKm ?? '—'}</span>
                      <span className="trip-stat-label">km covered</span>
                    </div>
                    <div className="trip-stat">
                      <span className="trip-stat-value">{trip.updateCount ?? '—'}</span>
                      <span className="trip-stat-label">GPS updates</span>
                    </div>
                    <div className="trip-stat">
                      <span className="trip-stat-value">
                        {durationMin !== null ? `${durationMin}m` : '—'}
                      </span>
                      <span className="trip-stat-label">duration</span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {startDate && (
                      <div className="info-row">
                        <span className="info-label">Started</span>
                        <span className="info-value" style={{ fontSize: 12 }}>
                          {startDate.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {endDate && (
                      <div className="info-row">
                        <span className="info-label">Ended</span>
                        <span className="info-value" style={{ fontSize: 12 }}>
                          {endDate.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ── Tab: Profile ──────────────────────────────────────────────────────── */
  const renderProfile = () => (
    <div style={{ paddingTop: 24 }}>
      <h2 className="section-title">Driver Profile</h2>

      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7b241c 0%, var(--primary) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 900,
          color: '#fff',
          boxShadow: '0 4px 16px rgba(192,57,43,0.3)',
          flexShrink: 0,
        }}>
          {driverProfile.name ? driverProfile.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 3 }}>
            {driverProfile.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 400, fontSize: 14 }}>No name set</span>}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {driverProfile.phone || <span style={{ fontStyle: 'italic' }}>No phone set</span>}
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
          <span className="badge" style={{ background: '#d0f0fb', color: '#0d5580' }}>Driver</span>
        </div>
        <div className="info-row">
          <span className="info-label">Name</span>
          {editingProfile ? (
            <input value={profileDraft.name || ''} onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Your name" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 160, outline: 'none' }} />
          ) : (
            <span className="info-value" style={{ fontSize: 13 }}>{driverProfile.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}</span>
          )}
        </div>
        <div className="info-row">
          <span className="info-label">Phone</span>
          {editingProfile ? (
            <input value={profileDraft.phone || ''} onChange={(e) => setProfileDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" type="tel" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 160, outline: 'none' }} />
          ) : (
            <span className="info-value" style={{ fontSize: 13 }}>{driverProfile.phone || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}</span>
          )}
        </div>
        <div className="info-row">
          <span className="info-label">Email</span>
          <span className="info-value" style={{ fontSize: 13 }}>{user?.email}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Buses Assigned</span>
          <span className="info-value">{buses.length}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Trips Completed</span>
          <span className="info-value">{history.length > 0 ? history.length : '—'}</span>
        </div>
      </div>

      {/* Assigned buses summary */}
      {buses.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="input-label mb-12">Assigned Buses</p>
          {buses.map((bus, i) => (
            <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < buses.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', whiteSpace: 'nowrap', minWidth: 64 }}>Bus {bus.busNumber}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{routes[bus.routeId]?.name || bus.routeId}</span>
              <button
                style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 13, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}
                title={`Remove Bus ${bus.busNumber}`}
                aria-label={`Remove Bus ${bus.busNumber}`}
                onClick={async () => {
                  if (!window.confirm(`Remove Bus ${bus.busNumber} and its route? This cannot be undone.`)) return;
                  try {
                    await removeBus(bus.id, bus.routeId);
                    setBuses((prev) => prev.filter((b) => b.id !== bus.id));
                  } catch (e) {
                    alert(`Failed to remove: ${e.message}`);
                  }
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* App info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="input-label mb-8">About</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Real-Time Bus Tracking System (RTBS) — a college demo project. GPS
          simulation sends location updates to Firebase every 6 seconds.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
          Version 1.0.0
        </p>
      </div>

      {/* Re-seed data (requires auth — safe to run here) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="input-label mb-8">Demo Data</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Re-seed Firestore with the latest TCE Madurai college bus data.
        </p>
        {seedMsg ? (
          <p style={{ fontSize: 13, color: seedMsg.startsWith('✅') ? '#2e7d32' : '#c62828', marginBottom: 8 }}>
            {seedMsg}
          </p>
        ) : null}
        <button
          className="btn btn-secondary"
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            setSeedMsg('');
            try {
              await seedDemoData();
              setSeedMsg('✅ Data seeded! Reload the page to see updated buses.');
            } catch (e) {
              setSeedMsg(`❌ ${e.message}`);
            } finally {
              setSeeding(false);
            }
          }}
        >
          {seeding ? 'Seeding…' : '⚙️ Re-seed Demo Data'}
        </button>
      </div>

      {/* Reset cached route polylines */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="input-label mb-8">Route Map Cache</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          If the route lines on the passenger map look wrong, reset the cache.
          They will be recomputed accurately next time someone views a route.
        </p>
        {cacheMsg ? (
          <div className={`inline-banner ${cacheMsg.startsWith('✅') ? 'inline-banner-success' : 'inline-banner-error'}`}>
            {cacheMsg}
          </div>
        ) : null}
        <button
          className="btn btn-secondary"
          onClick={async () => {
            setCacheMsg('');
            try {
              await clearRoutePolylineCache();
              setCacheMsg('✅ Route cache cleared! Lines will recompute on next view.');
            } catch (e) {
              setCacheMsg(`❌ ${e.message}`);
            }
          }}
        >
          🗺️ Reset Route Cache
        </button>
      </div>

    </div>
  );

  /* ── Tab: Add Route ────────────────────────────────────────────────────── */
  const renderAddRoute = () => {
    const filteredStops = stopSearch.trim().length > 0
      ? ALL_STOPS.filter((s) =>
        s.name.toLowerCase().includes(stopSearch.toLowerCase()) &&
        !selectedStops.find((sel) => sel.id === s.id),
      ).slice(0, 8)
      : [];

    const moveStop = (idx, dir) => {
      const arr = [...selectedStops];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      setSelectedStops(arr);
    };

    const handleSubmit = async () => {
      if (!form.busNumber.trim()) return setAddMsg('❌ Enter a bus number.');
      if (!form.routeName.trim()) return setAddMsg('❌ Enter a route name.');
      if (!form.fare || !form.distance) return setAddMsg('❌ Enter fare and distance.');
      if (selectedStops.length < 2) return setAddMsg('❌ Add at least 2 stops.');

      setAddLoading(true);
      setAddMsg('');
      try {
        await addCustomRoute(
          { ...form, stops: selectedStops },
          user.email,
        );
        setAddMsg('✅ Route added! Refresh the Dashboard tab to see your new bus.');
        setForm(EMPTY_FORM);
        setSelectedStops([]);
        setStopSearch('');
      } catch (e) {
        setAddMsg(`❌ ${e.message}`);
      } finally {
        setAddLoading(false);
      }
    };

    const field = (label, key, props = {}) => (
      <div style={{ marginBottom: 12 }}>
        <label className="input-label">{label}</label>
        <input
          className="input-field"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          {...props}
        />
      </div>
    );

    return (
      <div style={{ paddingTop: 24 }}>
        <h2 className="section-title">Add New Route</h2>
        <p className="text-sm text-muted mb-16">Create a bus and route — stops are resolved from the stop database automatically.</p>

        {/* Bus details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="input-label mb-12">Bus Details</p>
          {field('Bus Number', 'busNumber', { placeholder: 'e.g. BUS-6' })}
          {field('Route Name', 'routeName', { placeholder: 'e.g. Palanganatham to TCE' })}

          <div style={{ marginBottom: 12 }}>
            <label className="input-label">Bus Type</label>
            <select
              className="input-field"
              value={form.busType}
              onChange={(e) => setForm((f) => ({ ...f, busType: e.target.value }))}
            >
              {['College Bus', 'Staff Bus', 'Express', 'Mini Bus'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="input-label">Fare (₹)</label>
              <input className="input-field" type="number" value={form.fare} onChange={(e) => setForm((f) => ({ ...f, fare: e.target.value }))} placeholder="30" />
            </div>
            <div>
              <label className="input-label">Distance (km)</label>
              <input className="input-field" type="number" value={form.distance} onChange={(e) => setForm((f) => ({ ...f, distance: e.target.value }))} placeholder="18" />
            </div>
            <div>
              <label className="input-label">Duration (min)</label>
              <input className="input-field" type="number" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="55" />
            </div>
            <div>
              <label className="input-label">Schedule</label>
              <input className="input-field" value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} placeholder="06:00 AM" />
            </div>
          </div>
        </div>

        {/* Stop picker */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="input-label mb-12">Route Stops <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({selectedStops.length} added)</span></p>

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              className="input-field"
              placeholder="Search stop — e.g. Mattuthavani, Palanganatham…"
              value={stopSearch}
              onChange={(e) => setStopSearch(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            {filteredStops.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 220, overflowY: 'auto' }}>
                {filteredStops.map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}
                    onClick={() => {
                      setSelectedStops((prev) => [...prev, stop]);
                      setStopSearch('');
                    }}
                  >
                    📍 {stop.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected stop list */}
          {selectedStops.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>No stops added yet. Search above to add stops in order.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedStops.map((stop, i) => (
                <div key={`${stop.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#2e7d32' : i === selectedStops.length - 1 ? '#0d5580' : 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{stop.name}</span>
                  <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 14, padding: '2px 4px' }}>↑</button>
                  <button type="button" onClick={() => moveStop(i, 1)} disabled={i === selectedStops.length - 1} style={{ background: 'none', border: 'none', cursor: i === selectedStops.length - 1 ? 'default' : 'pointer', opacity: i === selectedStops.length - 1 ? 0.3 : 1, fontSize: 14, padding: '2px 4px' }}>↓</button>
                  <button type="button" onClick={() => setSelectedStops((p) => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {addMsg && (
          <div className={`inline-banner ${addMsg.startsWith('✅') ? 'inline-banner-success' : 'inline-banner-error'}`} style={{ marginBottom: 12 }}>
            {addMsg}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSubmit} disabled={addLoading}>
          {addLoading ? 'Adding…' : '✅ Add Bus & Route'}
        </button>
      </div>
    );
  };

  /* ── Render ────────────────────────────────────────────────────────────── */
  const tabContent = {
    dashboard: renderDashboard,
    history: renderHistory,
    add: renderAddRoute,
    profile: renderProfile,
  };

  return (
    <div className="page">

      {/* Clear History Confirm Modal */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 320, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1a2a3a', marginBottom: 10 }}>Clear Trip History?</h3>
            <p style={{ fontSize: 14, color: '#4a6a7a', lineHeight: 1.5, marginBottom: 24 }}>
              All trip records will be permanently deleted. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #b8e4f5', background: '#fff', color: '#1a2a3a', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={clearingHistory}
                onClick={async () => {
                  setClearingHistory(true);
                  try {
                    await clearTripHistory(user.email);
                    setHistory([]);
                  } finally {
                    setClearingHistory(false);
                    setShowClearConfirm(false);
                  }
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: clearingHistory ? 0.6 : 1 }}
              >
                {clearingHistory ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-title">
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span>Driver Mode</span>
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

      {/* Page content */}
      <div className="page-content">
        {tabContent[activeTab]?.()}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {[
          { key: 'dashboard', icon: '🚌', label: 'Dashboard' },
          { key: 'history', icon: '📋', label: 'History' },
          { key: 'add', icon: '➕', label: 'Add Route' },
          { key: 'profile', icon: '👤', label: 'Profile' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
