#!/usr/bin/env node

const { spawnSync } = require('child_process');

const integrationChecks = [
  {
    name: 'RevenueCat-only paywall path',
    command: 'node',
    args: ['scripts/check-official-paywall.js'],
  },
  {
    name: 'Monetization RPC v2 contract',
    command: 'node',
    args: ['scripts/check-monetization-rpc-contract.js'],
  },
  {
    name: 'iOS critical smoke path wiring',
    command: 'node',
    args: ['scripts/check-ios-smoke-paths.js'],
  },
];

let failed = 0;

for (const check of integrationChecks) {
  console.log(`\n[integration] ${check.name}`);

  const result = spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if ((result.status ?? 1) !== 0) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\nIntegration checks failed: ${failed}/${integrationChecks.length}`);
  process.exit(1);
}

console.log(`\nIntegration checks passed: ${integrationChecks.length}/${integrationChecks.length}`);
