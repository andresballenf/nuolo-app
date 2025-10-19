// Simple unit checks for utils/geo bearing/cardinal helpers
// Run: npx ts-node scripts/test-geo.ts (or compile TS then run with node)

import { bearingToCardinal } from '../utils/geo';

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    console.error(`Assertion failed: ${msg}. Expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

// 8-wind EN
assertEqual(bearingToCardinal(0, { directions: 8, lang: 'en' }), 'N', '0° -> N');
assertEqual(bearingToCardinal(44, { directions: 8, lang: 'en' }), 'NE', '44° -> NE');
assertEqual(bearingToCardinal(90, { directions: 8, lang: 'en' }), 'E', '90° -> E');
assertEqual(bearingToCardinal(135, { directions: 8, lang: 'en' }), 'SE', '135° -> SE');
assertEqual(bearingToCardinal(180, { directions: 8, lang: 'en' }), 'S', '180° -> S');
assertEqual(bearingToCardinal(225, { directions: 8, lang: 'en' }), 'SW', '225° -> SW');
assertEqual(bearingToCardinal(270, { directions: 8, lang: 'en' }), 'W', '270° -> W');
assertEqual(bearingToCardinal(315, { directions: 8, lang: 'en' }), 'NW', '315° -> NW');

// 8-wind ES
assertEqual(bearingToCardinal(0, { directions: 8, lang: 'es' }), 'N', '0° -> N (ES)');
assertEqual(bearingToCardinal(90, { directions: 8, lang: 'es' }), 'E', '90° -> E (ES)');
assertEqual(bearingToCardinal(180, { directions: 8, lang: 'es' }), 'S', '180° -> S (ES)');
assertEqual(bearingToCardinal(270, { directions: 8, lang: 'es' }), 'O', '270° -> O (ES)');
assertEqual(bearingToCardinal(225, { directions: 8, lang: 'es' }), 'SO', '225° -> SO (ES)');

// 16-wind ES checks
assertEqual(bearingToCardinal(22.5, { directions: 16, lang: 'es' }), 'NNE', '22.5° -> NNE (ES)');
assertEqual(bearingToCardinal(292.5, { directions: 16, lang: 'es' }), 'ONO', '292.5° -> ONO (ES)');

console.log('All geo cardinal tests passed.');
