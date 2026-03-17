import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBusRoute, updateBusLocation, startTrip, stopTrip, saveTripHistory, saveRawGpsPath } from '../services/busService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { haversineDistance } from '../utils/etaCalculator';

const UPDATE_INTERVAL_MS = 2000;  // fires every 2s; 3 steps = 6s per stop segment

function randomSpeed(busType = '') {
  // Faster speed for express/superfast routes
  if (busType.toLowerCase().includes('super fast') || busType.toLowerCase().includes('express')) {
    return Math.floor(55 + Math.random() * 25); // 55–79 km/h
  }
  return Math.floor(35 + Math.random() * 20); // 35–54 km/h
}

export default function DriverTrackingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const busId = searchParams.get('busId') || '';

  const [busData,        setBusData]        = useState(null);
  const [routeData,      setRouteData]      = useState(null);   // { name, stops[] }
  const [currentCoords,  setCurrentCoords]  = useState(null);
  const [currentSpeed,   setCurrentSpeed]   = useState(0);
  const [updateCount,    setUpdateCount]    = useState(0);
  const [distanceCovered,setDistanceCovered]= useState(0);
  const [stopping,       setStopping]       = useState(false);
  const [routePointText, setRoutePointText] = useState('—');
  const [arrived,        setArrived]        = useState(false);

  const intervalRef        = useRef(null);
  const routeIndexRef      = useRef(0);
  const subStepRef         = useRef(0);    // 0-2 within each stop segment (1/3, 2/3, 3/3)
  const distanceCoveredRef = useRef(0);
  const prevCoordsRef      = useRef(null);
  const startTimeRef       = useRef(new Date());
  const stopsRef           = useRef([]);   // live ref to stops array
  const gpsRecordingRef    = useRef([]);   // raw GPS trace from device
  const gpsWatchIdRef      = useRef(null); // geolocation watch handle
  const routeIdRef         = useRef(null); // saved for GPS baking on trip end

  // ── Load bus + route data, then start simulation ───────────────────────────
  useEffect(() => {
    if (!busId) return;
    let mounted = true;

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

      // Initialise position at first stop
      const first = stops[0];
      setCurrentCoords(first);
      prevCoordsRef.current = first;
      setRoutePointText(`1/${stops.length}`);

      // 3. Mark trip active
      await startTrip(busId);
      if (!mounted) return;

      // 4. Record real device GPS for route baking (works silently alongside simulation)
      routeIdRef.current = route.id;
      if (navigator.geolocation) {
        gpsWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            gpsRecordingRef.current.push({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          null,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
        );
      }

      // 5. Wait 2s then start GPS simulation
      await new Promise((r) => setTimeout(r, 2000));
      if (!mounted) return;

      // Fires every 2s. Three firings = one full stop-to-stop segment (6s total).
      // Sub-step 1 → bus at 1/3 of the way to next stop
      // Sub-step 2 → bus at 2/3 of the way
      // Sub-step 3 → bus arrives at next stop; index advances
      intervalRef.current = setInterval(async () => {
        const s       = stopsRef.current;
        const fromIdx = routeIndexRef.current;
        const toIdx   = fromIdx + 1;

        if (toIdx >= s.length) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          const last = s[s.length - 1];
          await updateBusLocation(busId, last.lat, last.lng, 0);
          if (mounted) setArrived(true);
          return;
        }

        subStepRef.current += 1;
        const t    = subStepRef.current / 3;   // 1/3 · 2/3 · 1
        const from = s[fromIdx];
        const to   = s[toIdx];
        const pos  = {
          lat: from.lat + (to.lat - from.lat) * t,
          lng: from.lng + (to.lng - from.lng) * t,
        };
        const speed = randomSpeed(bus.busType);

        setCurrentCoords(pos);
        setCurrentSpeed(speed);
        setUpdateCount((c) => c + 1);
        await updateBusLocation(busId, pos.lat, pos.lng, speed);

        if (subStepRef.current >= 3) {
          // Arrived at next stop — reset sub-step, advance stop index
          subStepRef.current    = 0;
          routeIndexRef.current = toIdx;

          const segDist = haversineDistance(from.lat, from.lng, to.lat, to.lng);
          distanceCoveredRef.current += segDist;
          prevCoordsRef.current = to;

          setDistanceCovered(distanceCoveredRef.current);
          setRoutePointText(`${toIdx + 1}/${s.length}`);
        }
      }, UPDATE_INTERVAL_MS);
    }

    init();
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
    };
  }, [busId]);

  // ── Stop trip ──────────────────────────────────────────────────────────────
  const handleStopTrip = async () => {
    setStopping(true);
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    // Stop GPS recording and save if we captured enough real points
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
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
        updateCount,
      });
    } catch (e) {
      console.warn('Could not save trip history:', e.message);
    }

    navigate('/driver-dashboard');
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const stops       = routeData?.stops || [];
  const origin      = stops[0]?.name            || '…';
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
            <span className="gps-dot" />
            GPS: ON
          </div>
        </div>
      </div>

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
          <div className="stat-value" style={{ fontSize: 18 }}>{routePointText}</div>
          <div className="stat-label">Stop Point</div>
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
                {stops[routeIndexRef.current]?.name || '—'}
              </p>
            </div>
            {stops[routeIndexRef.current + 1] && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Next Stop</p>
                <p style={{ fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>
                  {stops[routeIndexRef.current + 1].name}
                </p>
              </div>
            )}
          </div>
          <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            Updates every {UPDATE_INTERVAL_MS / 1000}s · {stops.length} stops on route
          </p>
        </div>
      )}

      {/* Route stop list */}
      <div style={{ padding: '16px', margin: '0 16px', background: '#0d2a3d', borderRadius: 10, marginTop: 12 }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Route Progress ({routeIndexRef.current + 1}/{stops.length} stops)
        </p>
        <div className="stop-list-scroll" style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, background: 'rgba(255,255,255,0.08)', zIndex: 0 }} />
          {stops.map((stop, idx) => {
            const isCovered = arrived ? true : idx < routeIndexRef.current;
            const isCurrent = !arrived && idx === routeIndexRef.current;
            const isNext    = !arrived && idx === routeIndexRef.current + 1;
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
