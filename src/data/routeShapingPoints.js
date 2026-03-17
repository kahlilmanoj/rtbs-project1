/**
 * Hidden "via:" shaping waypoints for TCE Madurai bus routes.
 *
 * These are injected between stop pairs to force the Directions API onto
 * the correct road without adding visible stopover markers on the map.
 *
 * All 5 TCE routes use baked route_polyline arrays stored in Firestore,
 * so shaping points are provided here only as a fallback if the Directions
 * API picks a significantly wrong road between stops.
 */

export const ROUTE_SHAPING_POINTS = {
  'route-BUS-1': {},
  'route-BUS-2': {},
  'route-BUS-3': {},
  'route-BUS-4': {},
  'route-BUS-5': {},
};
