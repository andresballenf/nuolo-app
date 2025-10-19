// E2E mock: build a request payload with spatial hints and verify no raw coords leak into hints
// Run: npx ts-node scripts/mock-e2e-orientation.ts
import { deriveSpatialHints, Coord } from '../utils/geo';

function hasCoordPattern(s: string): boolean {
  // simple decimal degrees pattern
  return /-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/.test(s);
}

function hasAddressPattern(s: string): boolean {
  return /\b\d{1,5}\s+[A-ZÁÉÍÓÚÜÑ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÜÑ]?[\p{L}]+){0,3}\b/iu.test(s);
}

const user: Coord = { lat: 40.758, lng: -73.9855 }; // Times Square
const poi: Coord = { lat: 40.6892, lng: -74.0445 }; // Statue of Liberty
const hints = deriveSpatialHints({ user, poi, lang: 'es' });

const orientationText = `cardinal=${hints.cardinal8}, distancia=${hints.distanceText}`;

if (hasCoordPattern(orientationText)) {
  console.error('Orientation text should not contain coordinate patterns');
  process.exit(1);
}
if (hasAddressPattern(orientationText)) {
  console.error('Orientation text should not contain address-like patterns');
  process.exit(1);
}

const request = {
  attractionName: 'Estatua de la Libertad',
  attractionAddress: 'Liberty Island, New York, NY 10004',
  userLocation: user,
  poiLocation: poi,
  spatialHints: hints,
};

console.log('Request spatialHints:', request.spatialHints);
console.log('OK: orientation includes cardinal, no coordinate/address leaks in hints');
