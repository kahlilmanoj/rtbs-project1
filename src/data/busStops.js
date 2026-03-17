/**
 * Thiagarajar College of Engineering (TCE) — Madurai Bus Stop Database
 *
 * All 5 TCE bus routes terminate at:
 *   Thiagarajar College of Engineering, Thiruparankundram, Madurai – 625015
 *
 * Coordinates sourced from latlong.net, indiamapia.com, and mappls.com.
 */

export const STOP_DB = {

  // ── Common Destination ──────────────────────────────────────────────────────

  tce: {
    id: 'tce',
    name: 'TCE',
    fullName: 'Thiagarajar College of Engineering (TCE)',
    lat: 9.8816, lng: 78.0825,
  },

  // ── Major Bus Stands ────────────────────────────────────────────────────────

  mattuthavani: {
    id: 'mattuthavani',
    name: 'Mattuthavani',
    fullName: 'Mattuthavani (MGR Bus Stand)',
    lat: 9.9441, lng: 78.1561,
  },

  anna_bus_stand: {
    id: 'anna_bus_stand',
    name: 'Anna Bus Stand',
    fullName: 'Anna Bus Stand',
    lat: 9.9248, lng: 78.1385,
  },

  periyar_bus_stand: {
    id: 'periyar_bus_stand',
    name: 'Periyar Bus Stand',
    fullName: 'Periyar Bus Stand',
    lat: 9.9161, lng: 78.1112,
  },

  // ── Route Origins ────────────────────────────────────────────────────────────

  karuppayurani: {
    id: 'karuppayurani',
    name: 'Karuppayurani',
    fullName: 'Karuppayurani',
    lat: 9.9300, lng: 78.1737,
  },

  arapalayam: {
    id: 'arapalayam',
    name: 'Arapalayam',
    fullName: 'Arapalayam',
    lat: 9.9316, lng: 78.1023,
  },

  park_town: {
    id: 'park_town',
    name: 'Park Town',
    fullName: 'Park Town',
    lat: 9.9517, lng: 78.1283,
  },

  // ── Bus 1 Stops (Mattuthavani – TCE) ────────────────────────────────────────

  kk_nagar: {
    id: 'kk_nagar',
    name: 'KK Nagar',
    fullName: 'KK Nagar',
    lat: 9.9350, lng: 78.1460,
  },

  thallakulam: {
    id: 'thallakulam',
    name: 'Thallakulam',
    fullName: 'Thallakulam',
    lat: 9.9323, lng: 78.1383,
  },

  goripalayam: {
    id: 'goripalayam',
    name: 'Goripalayam',
    fullName: 'Goripalayam',
    lat: 9.9135, lng: 78.1171,
  },

  simmakkal: {
    id: 'simmakkal',
    name: 'Simmakkal',
    fullName: 'Simmakkal',
    lat: 9.9178, lng: 78.1155,
  },

  sethupathi_school: {
    id: 'sethupathi_school',
    name: 'Sethupathi School',
    fullName: 'Sethupathi Higher Secondary School',
    lat: 9.9163, lng: 78.1083,
  },

  madura_college: {
    id: 'madura_college',
    name: 'Madura College',
    fullName: 'Madura College',
    lat: 9.9111, lng: 78.1083,
  },

  palanganatham: {
    id: 'palanganatham',
    name: 'Palanganatham',
    fullName: 'Palanganatham',
    lat: 9.9064, lng: 78.0903,
  },

  pykara: {
    id: 'pykara',
    name: 'Pykara',
    fullName: 'Pykara',
    lat: 9.9012, lng: 78.0862,
  },

  pasumalai: {
    id: 'pasumalai',
    name: 'Pasumalai',
    fullName: 'Pasumalai',
    lat: 9.9056, lng: 78.0761,
  },

  // ── Bus 2 & 3 Stops (Karuppayurani – TCE) ───────────────────────────────────

  melamadai: {
    id: 'melamadai',
    name: 'Melamadai',
    fullName: 'Melamadai',
    lat: 9.9285, lng: 78.1625,
  },

  paalpannai: {
    id: 'paalpannai',
    name: 'Paalpannai',
    fullName: 'Paalpannai',
    lat: 9.9255, lng: 78.1482,
  },

  kelavasal: {
    id: 'kelavasal',
    name: 'Kelavasal',
    fullName: 'Kelavasal',
    lat: 9.9116, lng: 78.1052,
  },

  therukuvasal: {
    id: 'therukuvasal',
    name: 'Therukuvasal',
    fullName: 'Therukuvasal',
    lat: 9.9098, lng: 78.1018,
  },

  vasantha_nagar: {
    id: 'vasantha_nagar',
    name: 'Vasantha Nagar',
    fullName: 'Vasantha Nagar',
    lat: 9.9112, lng: 78.0940,
  },

  alagappan_nagar: {
    id: 'alagappan_nagar',
    name: 'Alagappan Nagar',
    fullName: 'Alagappan Nagar',
    lat: 9.8981, lng: 78.0953,
  },

  moolakarai: {
    id: 'moolakarai',
    name: 'Moolakarai',
    fullName: 'Moolakarai',
    lat: 9.8900, lng: 78.0872,
  },

  // ── Bus 4 Stops (Arapalayam – TCE) ──────────────────────────────────────────

  guru_theatre: {
    id: 'guru_theatre',
    name: 'Guru Theatre',
    fullName: 'Guru Theatre',
    lat: 9.9272, lng: 78.1108,
  },

  kalavasal: {
    id: 'kalavasal',
    name: 'Kalavasal',
    fullName: 'Kalavasal',
    lat: 9.9220, lng: 78.1102,
  },

  kfc: {
    id: 'kfc',
    name: 'KFC',
    fullName: 'KFC (Main Road)',
    lat: 9.9196, lng: 78.1155,
  },

  ponmeni: {
    id: 'ponmeni',
    name: 'Ponmeni',
    fullName: 'Ponmeni',
    lat: 9.9148, lng: 78.0988,
  },

  // ── Bus 5 Stops (Park Town – TCE) ───────────────────────────────────────────

  thabaal_thanthi_nagar: {
    id: 'thabaal_thanthi_nagar',
    name: 'Thabaal Thanthi Nagar',
    fullName: 'Thabaal Thanthi Nagar',
    lat: 9.9455, lng: 78.1320,
  },

  bb_kulam: {
    id: 'bb_kulam',
    name: 'BB Kulam',
    fullName: 'BB Kulam (Bibi Kulam)',
    lat: 9.9421, lng: 78.1252,
  },

  thamukkam: {
    id: 'thamukkam',
    name: 'Thamukkam',
    fullName: 'Thamukkam',
    lat: 9.9310, lng: 78.1325,
  },
};

/**
 * Resolve a stop to {name, lat, lng}.
 * @param {string} stopId - Key in STOP_DB
 */
export function getStopCoords(stopId) {
  const stop = STOP_DB[stopId];
  if (!stop) throw new Error(`Unknown bus stop id: "${stopId}"`);
  return { name: stop.name, lat: stop.lat, lng: stop.lng };
}
