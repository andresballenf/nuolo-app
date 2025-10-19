// Lightweight unit tests for map settings merge behavior
// Run manually by reading as documentation; no test runner is configured.

import { mergeMapSettings, DEFAULT_SETTINGS, type MapSettings } from '../contexts/MapSettingsContext';

// Basic assertions
const original: MapSettings = { ...DEFAULT_SETTINGS };
const updated = mergeMapSettings(original, { showsTraffic: true, tilt: 30 });

if (!updated.showsTraffic) {
  throw new Error('mergeMapSettings failed to set showsTraffic');
}
if (updated.tilt !== 30) {
  throw new Error('mergeMapSettings failed to set tilt');
}

// Ensure immutability
if (original.showsTraffic !== false) {
  throw new Error('mergeMapSettings mutated original object');
}

console.log('mapSettingsReducer.test: OK');
