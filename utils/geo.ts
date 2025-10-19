export type Coord = { lat: number; lng: number };

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineDistanceMeters(a: Coord, b: Coord): number {
  const R = 6371000; // meters
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function bearingBetween(a: Coord, b: Coord): number {
  // Initial bearing from point a to point b in degrees [0,360)
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lng - a.lng);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let brng = toDegrees(Math.atan2(y, x));
  brng = (brng + 360) % 360;
  return brng;
}

const CARDINALS_16_EN = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'] as const;
const CARDINALS_16_ES = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'] as const; // O=Oeste, SSO=Sursuroeste, etc.
const CARDINALS_8_EN = ['N','NE','E','SE','S','SW','W','NW'] as const;
const CARDINALS_8_ES = ['N','NE','E','SE','S','SO','O','NO'] as const;

type Lang = 'en' | 'es';

export function bearingToCardinal(bearing: number, opts?: { directions?: 8 | 16; lang?: Lang }): string {
  const directions = opts?.directions ?? 16;
  const lang: Lang = opts?.lang ?? 'en';
  const set = directions === 16
    ? (lang === 'es' ? CARDINALS_16_ES : CARDINALS_16_EN)
    : (lang === 'es' ? CARDINALS_8_ES : CARDINALS_8_EN);
  const step = 360 / set.length;
  const index = Math.round(((bearing % 360) + 360) % 360 / step) % set.length;
  return set[index];
}

export function formatApproxDistance(distanceMeters: number, lang: Lang = 'en'): string {
  if (distanceMeters < 0) distanceMeters = 0;
  if (distanceMeters < 50) {
    return lang === 'es' ? 'a pocos metros' : 'a few meters';
  }
  if (distanceMeters < 1000) {
    // round to nearest 50m
    const rounded = Math.round(distanceMeters / 50) * 50;
    return lang === 'es' ? `a unos ${rounded} m` : `about ${rounded} m`;
  }
  const km = distanceMeters / 1000;
  const roundedKm = Math.round(km * 10) / 10; // 1 decimal
  return lang === 'es' ? `a unos ${roundedKm} km` : `about ${roundedKm} km`;
}

export function relativeDirectionFromHeading(bearing: number, heading: number, lang: Lang = 'en'): 'left' | 'right' | 'ahead' | 'behind' | 'izquierda' | 'derecha' | 'delante' | 'detras' {
  // Compute relative angle from user's heading to target bearing
  const rel = (((bearing - heading) % 360) + 360) % 360;
  if (rel <= 45 || rel >= 315) return lang === 'es' ? 'delante' : 'ahead';
  if (rel > 45 && rel < 135) return lang === 'es' ? 'derecha' : 'right';
  if (rel >= 135 && rel <= 225) return lang === 'es' ? 'detras' : 'behind';
  return lang === 'es' ? 'izquierda' : 'left';
}

export function deriveSpatialHints(params: { user: Coord; poi: Coord; lang?: Lang; heading?: number }): {
  bearing: number;
  cardinal16: string;
  cardinal8: string;
  distanceMeters: number;
  distanceText: string;
  relative?: string;
} {
  const lang = params.lang ?? 'en';
  const bearing = bearingBetween(params.user, params.poi);
  const cardinal16 = bearingToCardinal(bearing, { directions: 16, lang });
  const cardinal8 = bearingToCardinal(bearing, { directions: 8, lang });
  const distanceMeters = haversineDistanceMeters(params.user, params.poi);
  const distanceText = formatApproxDistance(distanceMeters, lang);
  let relative: string | undefined;
  if (typeof params.heading === 'number' && !isNaN(params.heading)) {
    relative = relativeDirectionFromHeading(bearing, params.heading, lang);
  }
  return { bearing, cardinal16, cardinal8, distanceMeters, distanceText, relative };
}
