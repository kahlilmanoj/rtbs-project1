import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
// busStops.js is kept as a reference; seed data uses inline lat/lng directly.

// ─── Pure-JS Google Encoded Polyline encoder ──────────────────────────────────
// Encodes [{lat,lng}] to a polyline string without needing Google Maps loaded.
function encodePolylineValue(v) {
  v = v < 0 ? ~(v << 1) : v << 1;
  let s = '';
  while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
  return s + String.fromCharCode(v + 63);
}

export function encodePolylineJs(points) {
  let out = '', pLat = 0, pLng = 0;
  for (const { lat, lng } of points) {
    const eLat = Math.round(lat * 1e5);
    const eLng = Math.round(lng * 1e5);
    out += encodePolylineValue(eLat - pLat) + encodePolylineValue(eLng - pLng);
    pLat = eLat; pLng = eLng;
  }
  return out;
}

// ─── Delete all docs in a collection ─────────────────────────────────────────
async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, name, d.id))));
}

// ─── Seed Demo Data (TCE Madurai — Thiagarajar College of Engineering) ────────

export async function seedDemoData() {

  // ── Clear old data first ─────────────────────────────────────────────────────
  await clearCollection('routes');
  await clearCollection('buses');
  await clearCollection('busLocations');

  // ── TCE Madurai bus routes — all 5 buses terminate at TCE ────────────────────
  // Stops are stored with inline { name, lat, lng, order } — no lookup needed.
  const SEED = [
    {
      routeId: 'route-BUS-1', busId: 'BUS-1',
      routeName: 'Mattuthavani to Thiagarajar College of Engineering',
      busType: 'College Bus', fare: 45, distance: 14.2, duration: 45, schedule: '07:30 AM',
      stops: [
        { name:'Mattuthavani',                           lat:9.9441, lng:78.1561, order:1  },
        { name:'KK Nagar',                               lat:9.9350, lng:78.1460, order:2  },
        { name:'Thallakulam',                            lat:9.9323, lng:78.1383, order:3  },
        { name:'Goripalayam',                            lat:9.9135, lng:78.1171, order:4  },
        { name:'Simmakkal',                              lat:9.9178, lng:78.1155, order:5  },
        { name:'Sethupathi Higher Secondary School',     lat:9.9163, lng:78.1083, order:6  },
        { name:'Periyar Bus Stand',                      lat:9.9161, lng:78.1112, order:7  },
        { name:'Madura College',                         lat:9.9111, lng:78.1083, order:8  },
        { name:'Palanganatham',                          lat:9.9064, lng:78.0903, order:9  },
        { name:'Pykara',                                 lat:9.9012, lng:78.0862, order:10 },
        { name:'Pasumalai',                              lat:9.9056, lng:78.0761, order:11 },
        { name:'Thiagarajar College of Engineering',     lat:9.8816, lng:78.0825, order:12 },
      ],
      route_polyline: [
        {lat:9.9441,lng:78.1561},{lat:9.9405,lng:78.1520},{lat:9.9370,lng:78.1488},{lat:9.9350,lng:78.1460},
        {lat:9.9338,lng:78.1430},{lat:9.9328,lng:78.1405},{lat:9.9323,lng:78.1383},{lat:9.9290,lng:78.1348},
        {lat:9.9255,lng:78.1295},{lat:9.9210,lng:78.1252},{lat:9.9178,lng:78.1220},{lat:9.9155,lng:78.1195},
        {lat:9.9135,lng:78.1171},{lat:9.9152,lng:78.1162},{lat:9.9170,lng:78.1158},{lat:9.9178,lng:78.1155},
        {lat:9.9172,lng:78.1125},{lat:9.9165,lng:78.1100},{lat:9.9163,lng:78.1083},{lat:9.9162,lng:78.1100},
        {lat:9.9161,lng:78.1112},{lat:9.9138,lng:78.1100},{lat:9.9120,lng:78.1090},{lat:9.9111,lng:78.1083},
        {lat:9.9095,lng:78.1060},{lat:9.9080,lng:78.1020},{lat:9.9070,lng:78.0975},{lat:9.9064,lng:78.0903},
        {lat:9.9042,lng:78.0882},{lat:9.9025,lng:78.0870},{lat:9.9012,lng:78.0862},{lat:9.9028,lng:78.0825},
        {lat:9.9042,lng:78.0800},{lat:9.9056,lng:78.0761},{lat:9.9020,lng:78.0782},{lat:9.8980,lng:78.0800},
        {lat:9.8940,lng:78.0812},{lat:9.8900,lng:78.0820},{lat:9.8860,lng:78.0822},{lat:9.8838,lng:78.0824},
        {lat:9.8816,lng:78.0825},
      ],
    },
    {
      routeId: 'route-BUS-2', busId: 'BUS-2',
      routeName: 'Karuppayurani to Thiagarajar College of Engineering (Route A)',
      busType: 'College Bus', fare: 35, distance: 16.8, duration: 52, schedule: '07:15 AM',
      stops: [
        { name:'Karuppayurani',                          lat:9.9300, lng:78.1737, order:1  },
        { name:'Melamadai',                              lat:9.9285, lng:78.1625, order:2  },
        { name:'Paalpannai',                             lat:9.9255, lng:78.1482, order:3  },
        { name:'Anna Bus Stand',                         lat:9.9248, lng:78.1385, order:4  },
        { name:'Goripalayam',                            lat:9.9135, lng:78.1171, order:5  },
        { name:'Kelavasal',                              lat:9.9116, lng:78.1052, order:6  },
        { name:'Therukuvasal',                           lat:9.9098, lng:78.1018, order:7  },
        { name:'Madura College',                         lat:9.9111, lng:78.1083, order:8  },
        { name:'Vasantha Nagar',                         lat:9.9112, lng:78.0940, order:9  },
        { name:'Palanganatham',                          lat:9.9064, lng:78.0903, order:10 },
        { name:'Alagappan Nagar',                        lat:9.8981, lng:78.0953, order:11 },
        { name:'Moolakarai',                             lat:9.8900, lng:78.0872, order:12 },
        { name:'Thiagarajar College of Engineering',     lat:9.8816, lng:78.0825, order:13 },
      ],
      route_polyline: [
        {lat:9.9300,lng:78.1737},{lat:9.9292,lng:78.1682},{lat:9.9285,lng:78.1625},{lat:9.9272,lng:78.1558},
        {lat:9.9260,lng:78.1520},{lat:9.9255,lng:78.1482},{lat:9.9252,lng:78.1435},{lat:9.9250,lng:78.1410},
        {lat:9.9248,lng:78.1385},{lat:9.9225,lng:78.1340},{lat:9.9200,lng:78.1295},{lat:9.9172,lng:78.1248},
        {lat:9.9152,lng:78.1210},{lat:9.9135,lng:78.1171},{lat:9.9128,lng:78.1130},{lat:9.9120,lng:78.1092},
        {lat:9.9116,lng:78.1052},{lat:9.9108,lng:78.1035},{lat:9.9098,lng:78.1018},{lat:9.9103,lng:78.1042},
        {lat:9.9111,lng:78.1083},{lat:9.9115,lng:78.1020},{lat:9.9113,lng:78.0982},{lat:9.9112,lng:78.0940},
        {lat:9.9090,lng:78.0925},{lat:9.9075,lng:78.0915},{lat:9.9064,lng:78.0903},{lat:9.9035,lng:78.0928},
        {lat:9.9010,lng:78.0942},{lat:9.8981,lng:78.0953},{lat:9.8945,lng:78.0920},{lat:9.8922,lng:78.0898},
        {lat:9.8900,lng:78.0872},{lat:9.8868,lng:78.0850},{lat:9.8840,lng:78.0836},{lat:9.8816,lng:78.0825},
      ],
    },
    {
      routeId: 'route-BUS-3', busId: 'BUS-3',
      routeName: 'Karuppayurani to Thiagarajar College of Engineering (via Simmakkal)',
      busType: 'College Bus', fare: 65, distance: 17.1, duration: 53, schedule: '07:30 AM',
      stops: [
        { name:'Karuppayurani',                          lat:9.9300, lng:78.1737, order:1  },
        { name:'Melamadai',                              lat:9.9285, lng:78.1625, order:2  },
        { name:'Paalpannai',                             lat:9.9255, lng:78.1482, order:3  },
        { name:'Anna Bus Stand',                         lat:9.9248, lng:78.1385, order:4  },
        { name:'Goripalayam',                            lat:9.9135, lng:78.1171, order:5  },
        { name:'Simmakkal',                              lat:9.9178, lng:78.1155, order:6  },
        { name:'Sethupathi School',                      lat:9.9163, lng:78.1083, order:7  },
        { name:'Periyar Bus Stand',                      lat:9.9161, lng:78.1112, order:8  },
        { name:'Vasantha Nagar',                         lat:9.9112, lng:78.0940, order:9  },
        { name:'Palanganatham',                          lat:9.9064, lng:78.0903, order:10 },
        { name:'Alagappan Nagar',                        lat:9.8981, lng:78.0953, order:11 },
        { name:'Moolakarai',                             lat:9.8900, lng:78.0872, order:12 },
        { name:'Thiagarajar College of Engineering',     lat:9.8816, lng:78.0825, order:13 },
      ],
      route_polyline: [
        {lat:9.9300,lng:78.1737},{lat:9.9292,lng:78.1682},{lat:9.9285,lng:78.1625},{lat:9.9268,lng:78.1555},
        {lat:9.9255,lng:78.1482},{lat:9.9252,lng:78.1435},{lat:9.9248,lng:78.1385},{lat:9.9218,lng:78.1335},
        {lat:9.9188,lng:78.1280},{lat:9.9160,lng:78.1225},{lat:9.9135,lng:78.1171},{lat:9.9155,lng:78.1163},
        {lat:9.9170,lng:78.1158},{lat:9.9178,lng:78.1155},{lat:9.9172,lng:78.1125},{lat:9.9165,lng:78.1100},
        {lat:9.9163,lng:78.1083},{lat:9.9162,lng:78.1098},{lat:9.9161,lng:78.1112},{lat:9.9148,lng:78.1085},
        {lat:9.9135,lng:78.1058},{lat:9.9120,lng:78.1020},{lat:9.9112,lng:78.0978},{lat:9.9112,lng:78.0940},
        {lat:9.9090,lng:78.0925},{lat:9.9064,lng:78.0903},{lat:9.9035,lng:78.0928},{lat:9.8981,lng:78.0953},
        {lat:9.8940,lng:78.0912},{lat:9.8900,lng:78.0872},{lat:9.8858,lng:78.0848},{lat:9.8816,lng:78.0825},
      ],
    },
    {
      routeId: 'route-BUS-4', busId: 'BUS-4',
      routeName: 'Arapalayam to Thiagarajar College of Engineering',
      busType: 'College Bus', fare: 50, distance: 12.5, duration: 40, schedule: '07:45 AM',
      stops: [
        { name:'Arapalayam',                             lat:9.9316, lng:78.1023, order:1  },
        { name:'Guru Theatre',                           lat:9.9272, lng:78.1108, order:2  },
        { name:'Kalavasal',                              lat:9.9220, lng:78.1102, order:3  },
        { name:'KFC',                                    lat:9.9196, lng:78.1155, order:4  },
        { name:'Ponmeni',                                lat:9.9148, lng:78.0988, order:5  },
        { name:'Vasantha Nagar',                         lat:9.9112, lng:78.0940, order:6  },
        { name:'Palanganatham',                          lat:9.9064, lng:78.0903, order:7  },
        { name:'Alagappan Nagar',                        lat:9.8981, lng:78.0953, order:8  },
        { name:'Pykara',                                 lat:9.9012, lng:78.0862, order:9  },
        { name:'Pasumalai',                              lat:9.9056, lng:78.0761, order:10 },
        { name:'Moolakarai',                             lat:9.8900, lng:78.0872, order:11 },
        { name:'Thiagarajar College of Engineering',     lat:9.8816, lng:78.0825, order:12 },
      ],
      route_polyline: [
        {lat:9.9316,lng:78.1023},{lat:9.9298,lng:78.1058},{lat:9.9280,lng:78.1082},{lat:9.9272,lng:78.1108},
        {lat:9.9252,lng:78.1105},{lat:9.9235,lng:78.1103},{lat:9.9220,lng:78.1102},{lat:9.9210,lng:78.1122},
        {lat:9.9202,lng:78.1140},{lat:9.9196,lng:78.1155},{lat:9.9180,lng:78.1105},{lat:9.9165,lng:78.1055},
        {lat:9.9155,lng:78.1020},{lat:9.9148,lng:78.0988},{lat:9.9132,lng:78.0968},{lat:9.9122,lng:78.0955},
        {lat:9.9112,lng:78.0940},{lat:9.9090,lng:78.0925},{lat:9.9078,lng:78.0915},{lat:9.9064,lng:78.0903},
        {lat:9.9038,lng:78.0925},{lat:9.9012,lng:78.0940},{lat:9.8981,lng:78.0953},{lat:9.9010,lng:78.0905},
        {lat:9.9025,lng:78.0880},{lat:9.9012,lng:78.0862},{lat:9.9030,lng:78.0822},{lat:9.9044,lng:78.0795},
        {lat:9.9056,lng:78.0761},{lat:9.9015,lng:78.0785},{lat:9.8960,lng:78.0820},{lat:9.8928,lng:78.0845},
        {lat:9.8900,lng:78.0872},{lat:9.8862,lng:78.0850},{lat:9.8840,lng:78.0838},{lat:9.8816,lng:78.0825},
      ],
    },
    {
      routeId: 'route-BUS-5', busId: 'BUS-5',
      routeName: 'Park Town to Thiagarajar College of Engineering',
      busType: 'College Bus', fare: 30, distance: 18.0, duration: 57, schedule: '07:20 AM',
      stops: [
        { name:'Park Town',                              lat:9.9517, lng:78.1283, order:1  },
        { name:'Thabaal Thanthi Nagar',                  lat:9.9455, lng:78.1320, order:2  },
        { name:'BB Kulam',                               lat:9.9421, lng:78.1252, order:3  },
        { name:'Thamukkam',                              lat:9.9310, lng:78.1325, order:4  },
        { name:'Goripalayam',                            lat:9.9135, lng:78.1171, order:5  },
        { name:'Simmakkal',                              lat:9.9178, lng:78.1155, order:6  },
        { name:'Sethupathi School',                      lat:9.9163, lng:78.1083, order:7  },
        { name:'Periyar Bus Stand',                      lat:9.9161, lng:78.1112, order:8  },
        { name:'Vasantha Nagar',                         lat:9.9112, lng:78.0940, order:9  },
        { name:'Palanganatham',                          lat:9.9064, lng:78.0903, order:10 },
        { name:'Alagappan Nagar',                        lat:9.8981, lng:78.0953, order:11 },
        { name:'Moolakarai',                             lat:9.8900, lng:78.0872, order:12 },
        { name:'Thiagarajar College of Engineering',     lat:9.8816, lng:78.0825, order:13 },
      ],
      route_polyline: [
        {lat:9.9517,lng:78.1283},{lat:9.9492,lng:78.1298},{lat:9.9468,lng:78.1310},{lat:9.9455,lng:78.1320},
        {lat:9.9440,lng:78.1295},{lat:9.9430,lng:78.1272},{lat:9.9421,lng:78.1252},{lat:9.9385,lng:78.1275},
        {lat:9.9350,lng:78.1300},{lat:9.9330,lng:78.1313},{lat:9.9310,lng:78.1325},{lat:9.9272,lng:78.1302},
        {lat:9.9235,lng:78.1270},{lat:9.9198,lng:78.1238},{lat:9.9163,lng:78.1205},{lat:9.9135,lng:78.1171},
        {lat:9.9155,lng:78.1162},{lat:9.9170,lng:78.1158},{lat:9.9178,lng:78.1155},{lat:9.9172,lng:78.1122},
        {lat:9.9166,lng:78.1100},{lat:9.9163,lng:78.1083},{lat:9.9162,lng:78.1097},{lat:9.9161,lng:78.1112},
        {lat:9.9148,lng:78.1080},{lat:9.9135,lng:78.1050},{lat:9.9120,lng:78.1018},{lat:9.9115,lng:78.0980},
        {lat:9.9112,lng:78.0940},{lat:9.9090,lng:78.0922},{lat:9.9075,lng:78.0913},{lat:9.9064,lng:78.0903},
        {lat:9.9035,lng:78.0928},{lat:9.9010,lng:78.0942},{lat:9.8981,lng:78.0953},{lat:9.8945,lng:78.0918},
        {lat:9.8922,lng:78.0895},{lat:9.8900,lng:78.0872},{lat:9.8862,lng:78.0850},{lat:9.8840,lng:78.0836},
        {lat:9.8816,lng:78.0825},
      ],
    },
  ];

  for (const entry of SEED) {
    // Stops already have { name, lat, lng, order } — no lookup needed
    const resolvedStops = entry.stops;

    await setDoc(doc(db, 'routes', entry.routeId), {
      name: entry.routeName,
      stops: resolvedStops,
      route_polyline: entry.route_polyline,
      // encodedPolyline intentionally omitted — MapView computes it via
      // Directions API (segment-by-segment with shaping points) on first load,
      // then caches the result back to Firestore automatically.
    });
    await setDoc(doc(db, 'buses', entry.busId), {
      busNumber:   entry.busId,
      routeId:     entry.routeId,
      driverEmail: 'driver@test.com',
      schedule:    entry.schedule,
      busType:     entry.busType,
      fare:        entry.fare,
      distance:    entry.distance,
      duration:    entry.duration,
      status:      'idle',
    });
    await setDoc(doc(db, 'busLocations', entry.busId), {
      lat: resolvedStops[0].lat, lng: resolvedStops[0].lng,
      speed: 0, tripStatus: 'idle', timestamp: serverTimestamp(),
    });
  }

  console.log(`TCE Madurai data seeded — ${SEED.length} routes, ${SEED.length} buses.`);
}

// ─── Remove Bus (and its route + location doc) ────────────────────────────────

export async function removeBus(busId, routeId) {
  await Promise.all([
    deleteDoc(doc(db, 'buses', busId)),
    deleteDoc(doc(db, 'busLocations', busId)),
    deleteDoc(doc(db, 'routes', routeId)),
  ]);
}

// ─── Stop name aliases — maps common abbreviations to their full Firestore names ─
const STOP_ALIASES = {
  'tce':           'thiagarajar college of engineering',
  'thiagarajar':   'thiagarajar college of engineering',
  'mgr bus stand': 'mattuthavani',
  'mgr':           'mattuthavani',
};

function resolveStopTerm(term) {
  const lower = term.toLowerCase().trim();
  return STOP_ALIASES[lower] ?? lower;
}

// ─── Get Buses by Stops ───────────────────────────────────────────────────────

export async function getBusesByStops(fromStop, toStop) {
  const routesSnap = await getDocs(collection(db, 'routes'));

  const matchingRouteIds = [];

  routesSnap.forEach((routeDoc) => {
    const data = routeDoc.data();
    const stops = data.stops || [];

    const stopNames = stops.map((s) => s.name.toLowerCase());

    const fromLower = resolveStopTerm(fromStop);
    const toLower   = resolveStopTerm(toStop);

    const hasFrom = stopNames.some((name) => name.includes(fromLower) || fromLower.includes(name));
    const hasTo   = stopNames.some((name) => name.includes(toLower)   || toLower.includes(name));

    if (hasFrom && hasTo) {
      matchingRouteIds.push(routeDoc.id);
    }
  });

  if (matchingRouteIds.length === 0) return [];

  const buses = [];

  for (const routeId of matchingRouteIds) {
    const busQuery = query(
      collection(db, 'buses'),
      where('routeId', '==', routeId)
    );
    const busSnap = await getDocs(busQuery);
    busSnap.forEach((busDoc) => {
      buses.push({ id: busDoc.id, ...busDoc.data() });
    });
  }

  return buses;
}

// ─── Clear all cached route polylines (force recompute on next passenger view) ─

export async function clearRoutePolylineCache() {
  const snap = await getDocs(collection(db, 'routes'));
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(doc(db, 'routes', d.id), { encodedPolyline: null }),
    ),
  );
}

// ─── Clear cached polylines for routes with shaping-point fixes ───────────────
// Call this once after deploying the shaping-point update so those routes
// recompute via Directions API (with the new via: waypoints) on next load.
export async function bustShapingPointsCache() {
  const affected = [
    'route-BUS-1', 'route-BUS-2', 'route-BUS-3',
    'route-BUS-4', 'route-BUS-5',
  ];
  await Promise.all(
    affected.map((id) =>
      updateDoc(doc(db, 'routes', id), { encodedPolyline: null }).catch(() => {}),
    ),
  );
  console.log('✅ Route polyline cache cleared — routes will recompute on next load.');
}

// ─── Save raw GPS recording for a route ──────────────────────────────────────
// Called at the end of a real driver trip. Stores the raw watchPosition trace
// in Firestore so it can later be snapped + baked via bakeRecordedRoute().
export async function saveRawGpsPath(routeId, points) {
  if (points.length < 20) return; // too few to be meaningful
  await updateDoc(doc(db, 'routes', routeId), {
    recordedPolyline: points,
    recordedAt: new Date().toISOString(),
  });
  console.log(`GPS recording saved for ${routeId}: ${points.length} raw points`);
}

// ─── Bake a route from GPS recording via Roads API snapToRoads ────────────────
// Call this once per route after a real driver trip has been recorded.
// Snaps the raw GPS trace to actual roads, encodes the result, and saves it
// as encodedPolyline — which MapView will use for every future load.
export async function bakeRecordedRoute(routeId, roadsApiKey) {
  const routeSnap = await getDoc(doc(db, 'routes', routeId));
  if (!routeSnap.exists()) throw new Error('Route not found');

  const rawPoints = routeSnap.data().recordedPolyline;
  if (!rawPoints?.length) throw new Error('No GPS recording found — drive the route first');

  const BATCH = 100; // Roads API limit per request
  const snapped = [];

  for (let i = 0; i < rawPoints.length; i += BATCH) {
    const batch = rawPoints.slice(i, i + BATCH);
    const path  = batch.map((p) => `${p.lat},${p.lng}`).join('|');
    const res   = await fetch(
      `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${roadsApiKey}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Roads API ${res.status}`);
    }
    const data = await res.json();
    (data.snappedPoints || []).forEach((p) =>
      snapped.push({ lat: p.location.latitude, lng: p.location.longitude }),
    );
  }

  if (snapped.length === 0) throw new Error('Roads API returned no points');

  await updateDoc(doc(db, 'routes', routeId), {
    encodedPolyline:  encodePolylineJs(snapped),
    polylineSource:   'roads_api_gps_recording',
    polylineBakedAt:  new Date().toISOString(),
  });

  return snapped.length;
}

// ─── Get Bus Route ────────────────────────────────────────────────────────────

export async function getBusRoute(busId) {
  const busSnap = await getDoc(doc(db, 'buses', busId));
  if (!busSnap.exists()) return null;

  const busData = busSnap.data();
  const routeSnap = await getDoc(doc(db, 'routes', busData.routeId));
  if (!routeSnap.exists()) return null;

  return { id: routeSnap.id, ...routeSnap.data() };
}

// ─── Update Bus Location ──────────────────────────────────────────────────────

export async function updateBusLocation(busId, lat, lng, speed) {
  await setDoc(
    doc(db, 'busLocations', busId),
    {
      lat,
      lng,
      speed,
      tripStatus: 'active',
      timestamp: serverTimestamp(),
    },
    { merge: true }
  );
}

// ─── Start Trip ───────────────────────────────────────────────────────────────

export async function startTrip(busId) {
  await updateDoc(doc(db, 'buses', busId), {
    status: 'active',
  });
  await setDoc(
    doc(db, 'busLocations', busId),
    { tripStatus: 'active', tripStartedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── Stop Trip ────────────────────────────────────────────────────────────────

export async function stopTrip(busId) {
  await updateDoc(doc(db, 'buses', busId), {
    status: 'idle',
  });
  await setDoc(
    doc(db, 'busLocations', busId),
    { tripStatus: 'idle', speed: 0 },
    { merge: true }
  );
}

// ─── Get All Buses ────────────────────────────────────────────────────────────

export async function getAllBuses() {
  const snap = await getDocs(collection(db, 'buses'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Trip History ─────────────────────────────────────────────────────────────

export async function saveTripHistory({ busId, busNumber, routeName, driverEmail, startTime, distanceKm, updateCount }) {
  await addDoc(collection(db, 'tripHistory'), {
    busId,
    busNumber,
    routeName,
    driverEmail,
    startTime,
    endTime: serverTimestamp(),
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    updateCount,
    status: 'completed',
  });
}

export async function getTripHistory(driverEmail) {
  try {
    const q = query(
      collection(db, 'tripHistory'),
      where('driverEmail', '==', driverEmail),
      orderBy('endTime', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // orderBy requires a composite index — fallback without ordering
    const q = query(collection(db, 'tripHistory'), where('driverEmail', '==', driverEmail));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0));
  }
}

export async function clearTripHistory(driverEmail) {
  const q = query(collection(db, 'tripHistory'), where('driverEmail', '==', driverEmail));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'tripHistory', d.id))));
}

// ─── Add a custom route + bus created by a driver ────────────────────────────
export async function addCustomRoute(
  { busNumber, routeName, busType, fare, distance, duration, schedule, stops },
  driverEmail,
) {
  const routeId = `route-${busNumber}`;
  const resolvedStops = stops.map((s, i) => ({
    name: s.name, lat: s.lat, lng: s.lng, order: i + 1,
  }));

  await setDoc(doc(db, 'routes', routeId), {
    name: routeName,
    stops: resolvedStops,
    route_polyline: [],
    // encodedPolyline omitted — MapView will compute via Directions API on first view
  });
  await setDoc(doc(db, 'buses', busNumber), {
    busNumber,
    routeId,
    driverEmail,
    schedule,
    busType,
    fare:     Number(fare),
    distance: Number(distance),
    duration: Number(duration),
    status:   'idle',
  });
  await setDoc(doc(db, 'busLocations', busNumber), {
    lat: resolvedStops[0].lat,
    lng: resolvedStops[0].lng,
    speed: 0, tripStatus: 'idle', timestamp: serverTimestamp(),
  });
}

// ─── Auto-seed if Firestore is empty ─────────────────────────────────────────
// Call this on any page that needs data. It checks first so it's safe to call
// multiple times — it will only seed when the buses collection is empty.

export async function ensureDemoData() {
  try {
    const bus1 = await getDoc(doc(db, 'buses', 'BUS-1'));
    if (bus1.exists()) return;
    console.log('Firestore missing data — seeding TCE Madurai college bus routes…');
    await seedDemoData();
    console.log('✅ Demo data seeded successfully.');
  } catch (err) {
    if (err.code === 'permission-denied') {
      console.error(
        '🔴 Firestore permission denied.\n' +
        'Go to Firebase Console → Firestore → Rules and set:\n' +
        '  allow read, write: if request.auth != null;'
      );
    } else {
      console.warn('ensureDemoData error:', err.message);
    }
  }
}
