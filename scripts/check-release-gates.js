#!/usr/bin/env node

/**
 * Release reliability gate checks.
 *
 * These checks are intentionally static and fast:
 * - Startup runtime env health checks are wired
 * - Telemetry auto-flush is wired in root layout
 * - Production error tracking initialization is wired
 * - Logger exposes production error-tracking adapter hooks
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const checks = [
  {
    file: 'app/_layout.tsx',
    id: 'startup-runtime-health-check',
    pattern: /runStartupHealthChecks\(\)/,
    message: 'Root layout must call runStartupHealthChecks() during startup.',
  },
  {
    file: 'app/_layout.tsx',
    id: 'telemetry-autoflush-start',
    pattern: /TelemetryService\.startAutoFlush\(/,
    message: 'Root layout must start telemetry auto-flush.',
  },
  {
    file: 'app/_layout.tsx',
    id: 'telemetry-autoflush-stop',
    pattern: /TelemetryService\.stopAutoFlush\(/,
    message: 'Root layout must stop telemetry auto-flush on cleanup.',
  },
  {
    file: 'app/_layout.tsx',
    id: 'error-tracking-init',
    pattern: /initializeErrorTracking\(\)/,
    message: 'Root layout must initialize production error tracking.',
  },
  {
    file: 'app/_layout.tsx',
    id: 'error-tracking-shutdown',
    pattern: /shutdownErrorTracking\(\)/,
    message: 'Root layout must shutdown error tracking on cleanup.',
  },
  {
    file: 'services/RuntimeHealthService.ts',
    id: 'runtime-health-report-type',
    pattern: /export interface RuntimeHealthReport/,
    message: 'RuntimeHealthService must expose RuntimeHealthReport.',
  },
  {
    file: 'lib/logger.ts',
    id: 'error-tracking-adapter',
    pattern: /export function setErrorTrackingAdapter/,
    message: 'Logger must expose setErrorTrackingAdapter for production error tracking.',
  },
];

const findings = [];

for (const check of checks) {
  const absolutePath = path.join(rootDir, check.file);
  if (!fs.existsSync(absolutePath)) {
    findings.push({
      file: check.file,
      issue: `Missing required file for check: ${check.id}`,
    });
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  if (!check.pattern.test(content)) {
    findings.push({
      file: check.file,
      issue: check.message,
    });
  }
}

if (findings.length > 0) {
  console.error('Release gate checks failed:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.issue}`);
  }
  process.exit(1);
}

console.log('Release gate checks passed.');
