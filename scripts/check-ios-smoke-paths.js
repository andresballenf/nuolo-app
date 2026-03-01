#!/usr/bin/env node

/**
 * iOS smoke regression gate (static).
 *
 * Verifies critical route wiring for auth/map/paywall/audio flows.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const checks = [
  {
    file: 'app/_layout.tsx',
    pattern: /<Stack\.Screen name="auth"/,
    message: 'Auth route must remain registered in root stack.',
  },
  {
    file: 'app/_layout.tsx',
    pattern: /<Stack\.Screen name="map"/,
    message: 'Map route must remain registered in root stack.',
  },
  {
    file: 'app/map.tsx',
    pattern: /RevenueCatPaywallModal/,
    message: 'Map flow must keep RevenueCat paywall modal wiring.',
  },
  {
    file: 'app/map.tsx',
    pattern: /MapViewComponent/,
    message: 'Map flow must keep map view wiring.',
  },
  {
    file: 'hooks/useMapAudioGuide.ts',
    pattern: /generateChunkedAudio|generateAudio\(/,
    message: 'Audio guide flow must keep audio generation path wiring.',
  },
  {
    file: 'contexts/AuthContext.tsx',
    pattern: /const signIn = async/,
    message: 'Auth context must keep signIn path.',
  },
];

const findings = [];

for (const check of checks) {
  const absolutePath = path.join(rootDir, check.file);
  if (!fs.existsSync(absolutePath)) {
    findings.push(`Missing required file: ${check.file}`);
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  if (!check.pattern.test(content)) {
    findings.push(`${check.file}: ${check.message}`);
  }
}

if (findings.length > 0) {
  console.error('iOS smoke path checks failed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('iOS smoke path checks passed.');
