import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBusRoute, updateBusLocation, startTrip, stopTrip, saveTripHistory, saveRawGpsPath } from '../services/busService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { haversineDistance } from '../utils/etaCalculator';

// Convert m/s (from Geolocation API) to km/h
function msToKmh(ms) {
  return ms != null && ms >= 0 ? Math.round(ms * 3.6) : 0;
}

export default function DriverTrackingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const busId = searchParams.get('busId') || '';

  const [busData,         setBusData]         = useState(null);
  const [routeData,       setRouteData]       = useState(null);   // { name, stops[] }
  const [currentCoords,   setCurrentCoords]   = useState(null);
  const [currentSpeed,    setCurrentSpeed]    = useState(0);
  const [updateCount,     setUpdateCount]     = useState(0);
  const [distanceCovered, setDistanceCovered] = useState(0);
  const [stopping,        setStopping]        = useState(false);
  const [gpsStatus,       setGpsStatus]       = useState('waiting'); // 'waiting' | 'active' | 'denied' | 'unavailable'
  const [closestStopIdx,  setClosestStopIdx]  = useState(0);
  const [arrived,         setArrived]         = useState(false);

  const gpsWatchIdRef      = useRef(null);
  const distanceCoveredRef  = useRef(0);
  const prevCoordsRef       = useRef(null);
  const startTimeRef        = useRef(new Date());
  const updateCountRef      = useRef(0);
  const stopsRef            = useRef([]);
  const gpsRecordingRef     = useRef([]);
  const routeIdRef          = useRef(null);
  // Monotonic stop index — can only advance forward, never jump backward.
  // Prevents GPS jitter or a bad initial fix from skipping the bus to the end.
  const closestStopIdxRef   = useRef(0);

  // ── Load bus + route data, then start real GPS watch ──────────────────────
  useEffect(() => {
    if (!busId) return;
    let mounted = true;
    const mountedCleanups = []; // collects extra teardown fns (e.g. beforeunload)

    async function init() {
      // 1. Fetch bus doc
      const busSnap = await getDoc(doc(db, 'buses', busId));
      if (!busSnap.exists() || !mounted) return;
      const bus = { id: busSnap.id, ...busSnap.data() };
      setBusData(bus);

      // 2. Fetch route doc
      const route = await getBusRoute(busId);
      if (!route || !mounted) return;

      const stops = [...(route.stops || [])].sort((a, b) => a.order - b.order);
      if (stops.length < 2) return;

      setRouteData({ name: route.name, stops });
      stopsRef.current = stops;
      routeIdRef.current = route.id;

      // 3. Mark trip active only if not already active (prevents false re-notification
      //    when driver navigates back to this page after a brief interruption)
      if (bus.status !== 'active') {
        await startTrip(busId);
      }
      if (!mounted) return;

      // 4. Register a beforeunload handler so navigating away / closing the tab
      //    automatically resets the bus to idle in Firestore
      const handleUnload = () => { stopTrip(busId).catch(() => {}); };
      window.addEventListener('beforeunload', handleUnload);
      // Store for cleanup
      mountedCleanups.push(() => window.removeEventListener('beforeunload', handleUnload));

      // ── Helper: start a GPS watch with given options ────────────────────────
      const startGpsWatch = (highAccuracy) => {
        if (!mounted) return;
        if (gpsWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
        gpsWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!mounted) return;

            const lat       = pos.coords.latitude;
            const lng       = pos.coords.longitude;
            const accuracy  = pos.coords.accuracy;  // metres
            const speed     = msToKmh(pos.coords.speed);

            // Skip wildly inaccurate fixes (> 2 km) on first update
            // to avoid an IP-based location triggering a wrong stop or arrival
            if (updateCountRef.current === 0 && accuracy > 2000) {
              console.warn(`GPS accuracy too low (${Math.round(accuracy)} m) — skipping first fix`);
              return;
            }

            // Record raw GPS trace for route baking
            gpsRecordingRef.current.push({ lat, lng });

            // Accumulate distance from previous fix
            if (prevCoordsRef.current) {
              const seg = haversineDistance(
                prevCoordsRef.current.lat, prevCoordsRef.current.lng,
                lat, lng
              );
              // Only count movement that's plausible (< 5 km per fix — rules out GPS jumps)
              if (seg < 5) {
                distanceCoveredRef.current += seg;
                setDistanceCovered(distanceCoveredRef.current);
              }
            }
            prevCoordsRef.current = { lat, lng };

            // Update UI state
            setCurrentCoords({ lat, lng });
            setCurrentSpeed(speed);
            updateCountRef.current += 1;
            setUpdateCount(updateCountRef.current);
            setGpsStatus('active');

            // ── Route-proximity guard ─────────────────────────────────────────
            // If the driver's device is more than 50 km from the route's first
            // stop (e.g. testing from Trivandrum while the route is in Madurai),
            // skip route-progress and arrival detection entirely.
            // Progress stays pinned at stop 0 — correct when actually on the route.
            const s          = stopsRef.current;
            const firstStop  = s[0];
            const distFromRouteStart = haversineDistance(lat, lng, firstStop.lat, firstStop.lng);
            const onRoute = distFromRouteStart <= 50; // within 50 km of route origin

            if (onRoute) {
              // ── Monotonic closest-stop detection ────────────────────────────
              // Search only forward from current index — can NEVER jump backward.
              let minDist = Infinity;
              let minIdx  = closestStopIdxRef.current;
              for (let i = closestStopIdxRef.current; i < s.length; i++) {
                const d = haversineDistance(lat, lng, s[i].lat, s[i].lng);
                if (d < minDist) { minDist = d; minIdx = i; }
              }
              closestStopIdxRef.current = minIdx;
              setClosestStopIdx(minIdx);

              // ── Arrival detection ──────────────────────────────────────────
              // Require ≥5 GPS updates AND ≥500 m covered before declaring
              // arrival — guards against any remaining inaccurate fixes.
              const lastStop  = s[s.length - 1];
              const distToEnd = haversineDistance(lat, lng, lastStop.lat, lastStop.lng);
              if (
                updateCountRef.current >= 5 &&
                distanceCoveredRef.current >= 0.5 &&
                distToEnd < 0.3
              ) {
                setArrived(true);
              }
            }

            // Write real coordinates to Firestore — passengers see this instantly
            updateBusLocation(busId, lat, lng, speed).catch(() => {});
          },
          (err) => {
            if (!mounted) return;
            console.error('GPS error:', err);
            if (err.code === err.PERMISSION_DENIED) {
              setGpsStatus('denied');
            } else if (err.code === err.TIMEOUT && highAccuracy) {
              // High-accuracy timed out (common on desktop) — retry with coarse location
              console.warn('High-accuracy GPS timed out — retrying with coarse location…');
              startGpsWatch(false);
            } else {
              setGpsStatus('unavailable');
            }
          },
          {
            enableHighAccuracy: highAccuracy,
            maximumAge: highAccuracy ? 5000 : 10000,
            timeout: highAccuracy ? 60000 : 30000, // 60 s for high, 30 s for coarse
          }
        );
      };

      // Guard: browser must support geolocation
      if (!navigator.geolocation) {
        setGpsStatus('unavailable');
        return;
      }

      startGpsWatch(true); // start with high accuracy; falls back automatically
    }

    init();
    return () => {
      mounted = false;
      mountedCleanups.forEach((fn) => fn());
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
    };
  }, [busId]);

  // ── Stop trip ──────────────────────────────────────────────────────────────
  const handleStopTrip = async () => {
    setStopping(true);

    // Stop GPS watch
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }

    // Save raw GPS recording if we captured enough points for route baking
    if (gpsRecordingRef.current.length >= 20 && routeIdRef.current) {
      saveRawGpsPath(routeIdRef.current, gpsRecordingRef.current).catch(() => {});
    }

    await stopTrip(busId);

    try {
      await saveTripHistory({
        busId,
        busNumber:   busData?.busNumber || busId,
        routeName:   routeData?.name    || busId,
        driverEmail: busData?.driverEmail || '',
        startTime:   startTimeRef.current,
        distanceKm:  distanceCoveredRef.current,
        updateCount: updateCountRef.current,
      });
    } catch (e) {
      console.warn('Could not save trip history:', e.message);
    }

    navigate('/driver-dashboard');
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const stops       = routeData?.stops || [];
  const origin      = stops[0]?.name              || '…';
  const destination = stops[stops.length - 1]?.name || '…';

  return (
    <div className="tracking-page">
      {/* Header */}
      <div className="tracking-header">
        <div>
          <div className="tracking-title">
            🚌 Bus {busData?.busNumber || busId}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {busData?.busType || 'Driver Tracking Mode'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {arrived ? (
            <span className="badge" style={{ background: 'rgba(249,168,37,0.2)', color: '#f9a825', fontSize: 12 }}>
              ✓ ARRIVED
            </span>
          ) : (
            <span className="badge badge-active" style={{ background: 'rgba(105,240,174,0.15)', color: '#69f0ae' }}>
              ● ACTIVE
            </span>
          )}
          <div className="gps-status" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
            <span
              className="gps-dot"
              style={{ background: gpsStatus === 'active' ? '#69f0ae' : gpsStatus === 'waiting' ? '#f9a825' : '#f44336' }}
            />
            {gpsStatus === 'active'      ? 'GPS: Live'
              : gpsStatus === 'waiting'  ? 'GPS: Waiting…'
              : gpsStatus === 'denied'   ? 'GPS: Denied'
              : 'GPS: Unavailable'}
          </div>
        </div>
      </div>

      {/* GPS permission denied / unavailable banner */}
      {(gpsStatus === 'denied' || gpsStatus === 'unavailable') && (
        <div style={{ margin: '0 16px 8px', background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius: 12, padding: '14px 18px', border: '1.5px solid #ef4444' }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: '#fca5a5', marginBottom: 4 }}>
            {gpsStatus === 'denied' ? '🚫 GPS Permission Denied' : '📡 GPS Unavailable'}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            {gpsStatus === 'denied'
              ? 'Allow location access in your browser settings, then reload the page to start real-time tracking.'
              : 'Your device does not support GPS or location could not be determined. Try again outdoors.'}
          </p>
        </div>
      )}

      {/* Destination arrived banner */}
      {arrived && (
        <div style={{ margin: '0 16px 4px', background: 'linear-gradient(135deg,#0d5580,#1a7aa8)', borderRadius: 12, padding: '16px 20px', textAlign: 'center', borderBottom: '3px solid #fffdac' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🏁</div>
          <p style={{ fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 4 }}>Destination Arrived!</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            {destination} · {distanceCovered.toFixed(1)} km covered
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{currentSpeed}</div>
          <div className="stat-label">Speed (km/h)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{distanceCovered.toFixed(2)}</div>
          <div className="stat-label">Distance (km)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{updateCount}</div>
          <div className="stat-label">GPS Updates Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 14 }}>
            {currentCoords
              ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`
              : '—'}
          </div>
          <div className="stat-label">Coordinates</div>
        </div>
      </div>

      {/* Fare & distance info */}
      {busData?.fare && (
        <div style={{ margin: '0 16px 12px', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: '#0d2a3d', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f9a825' }}>₹{busData.fare}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginTop: 2 }}>Fare</div>
          </div>
          <div style={{ flex: 1, background: '#0d2a3d', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f9a825' }}>{busData.distance} km</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginTop: 2 }}>Total Route</div>
          </div>
        </div>
      )}

      {/* Current & next stop */}
      {!arrived && (
        <div className="coords-display">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Current Stop</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#f9a825' }}>
                {stops[closestStopIdx]?.name || '—'}
              </p>
            </div>
            {stops[closestStopIdx + 1] && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Next Stop</p>
                <p style={{ fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>
                  {stops[closestStopIdx + 1].name}
                </p>
              </div>
            )}
          </div>
          <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            Real GPS · updates on every device position change · {stops.length} stops
          </p>
        </div>
      )}

      {/* Route stop list */}
      <div style={{ padding: '16px', margin: '0 16px', background: '#0d2a3d', borderRadius: 10, marginTop: 12 }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Route Progress ({closestStopIdx + 1}/{stops.length} stops)
        </p>
        <div className="stop-list-scroll" style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, background: 'rgba(255,255,255,0.08)', zIndex: 0 }} />
          {stops.map((stop, idx) => {
            const isCovered = arrived ? true : idx < closestStopIdx;
            const isCurrent = !arrived && idx === closestStopIdx;
            const isNext    = !arrived && idx === closestStopIdx + 1;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: idx < stops.length - 1 ? 12 : 0, position: 'relative', zIndex: 1 }}>
                {isCovered ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1.5px solid #4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#4caf50', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>
                  </div>
                ) : isCurrent ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#f9a825', flexShrink: 0 }} />
                ) : isNext ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.7)', background: 'transparent', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.18)', background: 'transparent', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: 13,
                  fontWeight: isCurrent ? 700 : isNext ? 600 : 400,
                  color: isCovered ? 'rgba(255,255,255,0.28)' : isCurrent ? '#f9a825' : isNext ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)',
                }}>
                  {stop.name}
                  {isCurrent && <span style={{ marginLeft: 6, fontSize: 10, background: '#f9a825', color: '#2d1010', borderRadius: 3, padding: '1px 5px', fontWeight: 900 }}>NOW</span>}
                  {isNext    && <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>NEXT</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stop / Complete Trip button */}
      <div className="stop-trip-btn">
        {arrived ? (
          <button
            className="btn"
            style={{ background: 'linear-gradient(135deg,#f57f17,#f9a825)', color: '#1a0505', fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}
            onClick={handleStopTrip}
            disabled={stopping}
          >
            {stopping ? 'Saving…' : '✅  Complete Trip'}
          </button>
        ) : (
          <button
            className="btn"
            style={{ background: '#0d98c8', color: '#fff', fontWeight: 700 }}
            onClick={handleStopTrip}
            disabled={stopping}
          >
            {stopping ? 'Stopping…' : '⏹  Stop Trip'}
          </button>
        )}
      </div>
    </div>
  );
}
