import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useBusLocation } from '../hooks/useBusLocation';
import { getBusRoute } from '../services/busService';
import { calculateETA, haversineDistance, formatETA } from '../utils/etaCalculator';
import MapView from '../components/MapView';

export default function LiveTrackingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const busId = searchParams.get('busId') || '';

  const { location, loading: locLoading } = useBusLocation(busId);
  const [busData, setBusData]     = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Trip-start notification ──────────────────────────────────────────────
  const [tripNotification, setTripNotification] = useState(null); // { busNumber, routeName }
  const seenTripStartRef = useRef(null); // tracks the last tripStartedAt we've seen to avoid re-firing

  useEffect(() => {
    if (!busId) return;
    async function fetchData() {
      try {
        const busSnap = await getDoc(doc(db, 'buses', busId));
        if (busSnap.exists()) {
          const data = { id: busSnap.id, ...busSnap.data() };
          setBusData(data);
          // Record this trip in passenger history (localStorage)
          try {
            const prev = JSON.parse(localStorage.getItem('rtbs_past_trips') || '[]');
            const entry = { busNumber: data.busNumber, routeId: data.routeId, fare: data.fare, timestamp: new Date().toISOString() };
            // Avoid duplicate if same bus tracked within 5 minutes
            const recent = prev[0];
            const tooSoon = recent && recent.busNumber === data.busNumber && (Date.now() - new Date(recent.timestamp).getTime()) < 5 * 60 * 1000;
            if (!tooSoon) localStorage.setItem('rtbs_past_trips', JSON.stringify([entry, ...prev].slice(0, 20)));
          } catch { /* ignore storage errors */ }
        }
        const route = await getBusRoute(busId);
        setRouteData(route);
      } catch (err) {
        console.error('LiveTrackingPage:', err);
      } finally {
        setDataLoading(false);
      }
    }
    fetchData();
  }, [busId]);

  // ETA to the last stop on the route
  const destination =
    routeData?.stops?.length > 0
      ? routeData.stops[routeData.stops.length - 1]
      : { lat: 9.938, lng: 78.132 };

  const eta = location
    ? calculateETA(location.lat, location.lng, destination.lat, destination.lng, location.speed)
    : null;

  const distance = location
    ? haversineDistance(location.lat, location.lng, destination.lat, destination.lng)
    : null;

  const isLive = location?.tripStatus === 'active';

  // Detect idle → active transition: fire toast only when tripStartedAt changes
  useEffect(() => {
    if (!location?.tripStartedAt) return;
    const key = location.tripStartedAt?.seconds ?? String(location.tripStartedAt);
    // Skip on first render / if we've already shown this notification
    if (seenTripStartRef.current === null) {
      seenTripStartRef.current = key;
      return;
    }
    if (seenTripStartRef.current !== key && location.tripStatus === 'active') {
      seenTripStartRef.current = key;
      setTripNotification({
        busNumber: busData?.busNumber || busId,
        routeName: routeData?.name || '',
      });
      // Auto-dismiss after 7 seconds
      setTimeout(() => setTripNotification(null), 7000);
    }
  }, [location?.tripStartedAt, location?.tripStatus, busData, routeData, busId]);

  // ── Route-proximity guard ─────────────────────────────────────────
  // If the bus is more than 50 km from its origin, pin progress to stop 0.
  // This prevents testing from Trivandrum (200km away) from showing
  // the bus at destination (Madurai).
  const firstStop          = routeData?.stops?.[0];
  const distFromRouteStart = (location && firstStop)
    ? haversineDistance(location.lat, location.lng, firstStop.lat, firstStop.lng)
    : Infinity;
  const onRoute = distFromRouteStart <= 50;

  // Find closest stop to current bus position
  let closestStopIdx = 0;
  if (onRoute && location && routeData?.stops?.length) {
    let minDist = Infinity;
    routeData.stops.forEach((stop, i) => {
      const d = haversineDistance(location.lat, location.lng, stop.lat, stop.lng);
      if (d < minDist) { minDist = d; closestStopIdx = i; }
    });
  }
  const totalStops      = routeData?.stops?.length ?? 0;
  const isAtDestination = onRoute && totalStops > 0 && closestStopIdx === totalStops - 1;
  const isCompleted     = !isLive && isAtDestination;
  const nextStop        = isAtDestination ? null : (routeData?.stops?.[closestStopIdx + 1] ?? null);
  const etaToNext       = nextStop && location
    ? calculateETA(location.lat, location.lng, nextStop.lat, nextStop.lng, location.speed)
    : null;

  // When idle and not completed, snap map to the route origin (first stop)
  const sourceStop = routeData?.stops?.[0];
  const mapBusLocation = (!isLive && !isAtDestination && sourceStop)
    ? { lat: sourceStop.lat, lng: sourceStop.lng, speed: 0, tripStatus: 'idle' }
    : location;

  if (locLoading || dataLoading) {
    return (
      <div className="page">
        <header className="app-header">
          <div className="header-title">🚌 Live Tracking</div>
        </header>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading bus information…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-layout">

      {/* ── Trip-Start Notification Toast ── */}
      {tripNotification && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 'calc(100% - 32px)',
          maxWidth: 420,
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
          border: '1.5px solid #34d399',
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          animation: 'slideDown 0.3s ease',
        }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>🚌</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: '#d1fae5', marginBottom: 2 }}>
              Bus {tripNotification.busNumber} has started!
            </p>
            {tripNotification.routeName && (
              <p style={{ fontSize: 12, color: 'rgba(209,250,229,0.7)', lineHeight: 1.4 }}>
                {tripNotification.routeName}
              </p>
            )}
          </div>
          <button
            onClick={() => setTripNotification(null)}
            aria-label="Dismiss notification"
            style={{ background: 'none', border: 'none', color: '#6ee7b7', fontSize: 18, cursor: 'pointer', padding: 2, lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-title">
          <button
            className="icon-btn"
            onClick={() => navigate(-1)}
            style={{ marginRight: 8 }}
            aria-label="Go back to bus list"
          >
            ←
          </button>
          🚌 Live Tracking
        </div>
        <div className="header-actions">
          {isLive
            ? <span className="badge badge-active">● Live</span>
            : isCompleted
            ? <span className="badge" style={{ background: '#e8f5e9', color: '#1b5e20' }}>✓ Completed</span>
            : <span className="badge badge-idle">○ Idle</span>
          }
        </div>
      </header>

      {/* ── Map — fills available space ── */}
      <div className="tracking-map-wrapper">
        <MapView
          busLocation={mapBusLocation}
          routeStops={routeData?.stops}
          routeId={routeData?.id}
          encodedPolyline={routeData?.encodedPolyline}
          routePath={null}
        />
      </div>

      {/* ── Info panel ── */}
      <div className="tracking-info-panel">
        {/* Bus number + ETA row */}
        <div className="tracking-top-row">
          <div>
            <span className="tracking-bus-number">Bus {busData?.busNumber || busId}</span>
            <span className="tracking-route-name">{routeData?.name || ''}</span>
          </div>
          <div className="tracking-eta-box">
            <span className="tracking-eta-label">ETA</span>
            <span className="tracking-eta-value">
              {eta !== null ? formatETA(eta) : '—'}
            </span>
          </div>
        </div>

        <div className="tracking-divider" />

        {/* Distance + speed row */}
        <div className="tracking-meta-row">
          <div className="tracking-meta-item">
            <span className="tracking-meta-label">Distance</span>
            <span className="tracking-meta-value">
              {distance !== null ? `${distance.toFixed(2)} km` : '—'}
            </span>
          </div>
          <div className="tracking-meta-item">
            <span className="tracking-meta-label">Speed</span>
            <span className="tracking-meta-value">
              {location?.speed ? `${location.speed} km/h` : '0 km/h'}
            </span>
          </div>
          <div className="tracking-meta-item">
            <span className="tracking-meta-label">Status</span>
            <span className={`tracking-meta-value ${isLive ? 'text-live' : isCompleted ? '' : 'text-idle'}`}
              style={isCompleted ? { color: '#2e7d32', fontWeight: 700 } : {}}>
              {isLive ? 'Moving' : isCompleted ? 'Completed' : 'Idle'}
            </span>
          </div>
        </div>

        {/* Idle banner — bus not yet departed */}
        {!isLive && !isAtDestination && sourceStop && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff5f3', border: '1px solid #f0dede', borderRadius: 10, padding: '10px 14px', marginTop: 12 }}>
            <span style={{ fontSize: 20 }}>🚏</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Bus not yet departed</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                Waiting at {sourceStop.name}
              </p>
            </div>
          </div>
        )}

        {/* Arrived banner / next stop + ETA row */}
        {isAtDestination ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#e8f5e9,#f1f8e9)', border: '1.5px solid #4caf50', borderRadius: 12, padding: '12px 16px', marginTop: 12 }}>
            <span style={{ fontSize: 28 }}>🏁</span>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#2e7d32' }}>Arrived at Destination!</p>
              <p style={{ fontSize: 12, color: '#388e3c', marginTop: 2 }}>
                {routeData?.stops?.[totalStops - 1]?.name} — end of route
              </p>
            </div>
          </div>
        ) : nextStop ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff5f3', border: '1.5px solid #f0dede', borderRadius: 10, padding: '10px 14px', marginTop: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Next Stop</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#c0392b' }}>📍 {nextStop.name}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>ETA</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#c0392b' }}>{etaToNext !== null ? formatETA(etaToNext) : '—'}</p>
            </div>
          </div>
        ) : null}

        {/* Stops list */}
        {routeData?.stops?.length > 0 && (
          <div className="tracking-stops">
            <p className="tracking-stops-label">Route Stops</p>
            <div style={{ position: 'relative', paddingLeft: 4 }}>
              {/* Vertical connector line */}
              <div style={{ position: 'absolute', left: 13, top: 10, bottom: 10, width: 2, background: 'var(--border)', zIndex: 0 }} />
              {routeData.stops.map((stop, i) => {
                const isCovered = isAtDestination ? true : i < closestStopIdx;
                const isCurrent = !isAtDestination && i === closestStopIdx;
                const isNext    = !isAtDestination && i === closestStopIdx + 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < routeData.stops.length - 1 ? 10 : 0, position: 'relative', zIndex: 1 }}>
                    {isCovered ? (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'transparent', border: '2px solid #4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#4caf50', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>
                      </div>
                    ) : isCurrent ? (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fffdac', flexShrink: 0 }} />
                    ) : isNext ? (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #77dbf5', background: '#fff', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(119,219,245,0.4)', background: '#fff', flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: 13,
                      fontWeight: isCurrent ? 700 : isNext ? 600 : 400,
                      color: isCovered ? 'var(--text-secondary)' : isCurrent ? '#0d98c8' : isNext ? '#0d98c8' : 'var(--text-secondary)',
                      opacity: isCovered ? 0.6 : 1,
                    }}>
                      {stop.name}
                      {isCurrent && <span style={{ marginLeft: 6, fontSize: 10, background: '#77dbf5', color: '#1a2a3a', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>NOW</span>}
                      {isNext    && <span style={{ marginLeft: 6, fontSize: 10, color: '#0d98c8', fontWeight: 600 }}>NEXT</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Exit Tracking — pinned at bottom ── */}
      <div className="tracking-footer">
        <button className="btn btn-back" onClick={() => navigate(-1)} aria-label="Go back to bus list">
          ← Back to Buses
        </button>
      </div>
    </div>
  );
}
