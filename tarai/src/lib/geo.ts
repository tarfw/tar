/**
 * Lightweight geo helpers using lat/lng strings stored in matter.geo.
 * Format: "lat,lng" (e.g. "12.9716,77.5946").
 *
 * Uses the haversine formula for great-circle distance.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function parseGeo(geo: string | null | undefined): GeoPoint | null {
  if (!geo) return null;
  const [latStr, lngStr] = geo.split(',');
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function encodeGeo(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two points in kilometers.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const x =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/**
 * Parse a radius string like "5km", "500m", or a number in kilometers.
 */
export function parseRadius(radius: string | number): number {
  if (typeof radius === 'number') return radius;
  const match = String(radius).trim().match(/^(\d+(?:\.\d+)?)\s*(km|m)?$/i);
  if (!match) return 5; // default 5km
  const value = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  return unit === 'm' ? value / 1000 : value;
}
