#!/usr/bin/env node

/**
 * Telemetry reliability health gate.
 *
 * Ensures the core KPI counters requested by the reliability plan
 * are still wired in runtime code paths.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const checks = [
  {
    file: 'app/_layout.tsx',
    pattern: /TelemetryService\.increment\('session_start'\)/,
    message: 'Root layout must increment session_start on app bootstrap.',
  },
  {
    file: 'components/ErrorBoundary.tsx',
    pattern: /TelemetryService\.increment\('session_crash_boundary'\)/,
    message: 'ErrorBoundary must increment session_crash_boundary for crash-free session KPI.',
  },
  {
    file: 'contexts/AuthContext.tsx',
    pattern: /TelemetryService\.increment\('auth_sign_in_success'\)/,
    message: 'AuthContext must increment auth_sign_in_success.',
  },
  {
    file: 'components/ui/RevenueCatPaywallModal.tsx',
    pattern: /TelemetryService\.increment\('paywall_open_attempt'\)/,
    message: 'RevenueCat paywall must increment paywall_open_attempt.',
  },
  {
    file: 'components/ui/RevenueCatPaywallModal.tsx',
    pattern: /TelemetryService\.increment\('paywall_open_success'\)/,
    message: 'RevenueCat paywall must increment paywall_open_success.',
  },
  {
    file: 'hooks/useMapAudioGuide.ts',
    pattern: /TelemetryService\.increment\('audio_generation_attempt'\)/,
    message: 'Audio generation flow must increment audio_generation_attempt.',
  },
  {
    file: 'hooks/useMapAudioGuide.ts',
    pattern: /TelemetryService\.increment\('audio_generation_success'\)/,
    message: 'Audio generation flow must increment audio_generation_success.',
  },
  {
    file: 'hooks/useMapAudioGuide.ts',
    pattern: /TelemetryService\.increment\('audio_generation_error'\)/,
    message: 'Audio generation flow must increment audio_generation_error.',
  },
  {
    file: 'services/TelemetryService.ts',
    pattern: /getReliabilityDashboardSnapshot\(\)/,
    message: 'TelemetryService must expose getReliabilityDashboardSnapshot() for diagnostics.',
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
  console.error('Telemetry health checks failed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Telemetry health checks passed.');
