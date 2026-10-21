const EARTH_RADIUS_METERS = 6371000;

/**
 * Computes the great-circle distance between two geographic coordinates in meters
 * using the Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  // Floating-point rounding can push `a` slightly above 1 (e.g. 1.0000000000000002)
  // for near-antipodal points. An unclamped `1 - a` would go negative, sqrt would
  // return NaN, and `NaN > allowedRadius` is false — letting an out-of-range
  // check-in succeed. Clamp to the mathematically valid domain instead.
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return EARTH_RADIUS_METERS * c;
}
