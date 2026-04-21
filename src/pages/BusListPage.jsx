import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getBusesByStops } from '../services/busService';
import BusCard from '../components/BusCard';

export default function BusListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fromStop = searchParams.get('from') || '';
  const toStop = searchParams.get('to') || '';

  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Real-time bus status map: busId → { tripStatus, speed }
  // Updated via Firestore onSnapshot so passengers see LIVE badges instantly
  const [liveStatus, setLiveStatus] = useState({});

  // Fetch matching buses once (one-time query for the route match)
  useEffect(() => {
    let cancelled = false;

    async function fetchBuses() {
      setLoading(true);
      try {
        const result = await getBusesByStops(fromStop, toStop);
        if (!cancelled) {
          setBuses(result);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (fromStop && toStop) {
      fetchBuses();
    } else {
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [fromStop, toStop]);

  // Subscribe to busLocations for all found buses to get real-time status
  useEffect(() => {
    if (buses.length === 0) return;

    const busIds = buses.map((b) => b.id);

    // Firestore 'in' queries are limited to 10 items — chunk if needed
    const chunks = [];
    for (let i = 0; i < busIds.length; i += 10) {
      chunks.push(busIds.slice(i, i + 10));
    }

    const unsubscribes = chunks.map((chunk) => {
      const q = query(
        collection(db, 'busLocations'),
        where('__name__', 'in', chunk)
      );
      return onSnapshot(q, (snap) => {
        setLiveStatus((prev) => {
          const updated = { ...prev };
          snap.docs.forEach((d) => {
            updated[d.id] = {
              tripStatus: d.data().tripStatus,
              speed: d.data().speed,
            };
          });
          return updated;
        });
      });
    });

    return () => unsubscribes.forEach((u) => u());
  }, [buses]);

  const handleTrack = (busId) => {
    navigate(`/live-tracking?busId=${busId}`);
  };

  if (loading) {
    return (
      <div className="page">
        <header className="app-header">
          <div className="header-title">🔍 Searching…</div>
        </header>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Finding buses for your route…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <header className="app-header">
        <div className="header-title">
          <button
            className="icon-btn"
            onClick={() => navigate('/passenger-home')}
            style={{ marginRight: 8 }}
            aria-label="Go back to search"
          >
            ← Back
          </button>
          Available Buses
        </div>
        {/* Live indicator if any bus is active */}
        {Object.values(liveStatus).some((s) => s.tripStatus === 'active') && (
          <span className="badge-live">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            LIVE
          </span>
        )}
      </header>

      <div className="page-content">
        {/* Route display */}
        <div className="route-header mt-16">
          <span>🚏</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{fromStop}</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>→ {toStop}</span>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {buses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚌</div>
            <h3>No buses found</h3>
            <p style={{ fontSize: 14, marginTop: 8 }}>
              No buses serve <strong>{fromStop} → {toStop}</strong>.
              <br />Check spelling or try a nearby stop.
            </p>
            <button
              className="btn btn-primary mt-16"
              onClick={() => navigate('/passenger-home')}
            >
              ← Search Again
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted mb-12">
              {buses.length} bus{buses.length !== 1 ? 'es' : ''} found
            </p>

            {buses.map((bus) => {
              const live = liveStatus[bus.id];
              const isLive = live?.tripStatus === 'active';
              return (
                <div key={bus.id} style={{ position: 'relative' }}>
                  {/* LIVE overlay badge */}
                  {isLive && (
                    <span
                      className="badge-live"
                      style={{
                        position: 'absolute',
                        top: 12, right: 12,
                        zIndex: 2,
                        fontSize: 10,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                      LIVE
                    </span>
                  )}
                  <BusCard
                    busNumber={bus.busNumber}
                    busType={bus.busType}
                    fare={bus.fare}
                    routeDistance={bus.distance}
                    duration={bus.duration}
                    status={isLive ? 'active' : bus.status}
                    onTrack={() => handleTrack(bus.id)}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
