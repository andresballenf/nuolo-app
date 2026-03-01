#!/usr/bin/env node

/**
 * Ensures monetization RPC v2 contract wiring stays intact.
 *
 * Checks:
 * 1) v2 SQL migration exists with required RPC definitions + grants.
 * 2) MonetizationService routes v2 access through MonetizationRpcContract.
 * 3) RevenueCat webhook still syncs entitlement state via v2 contract RPC.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const migrationDir = path.join(rootDir, 'supabase', 'migrations');
const contractFile = path.join(rootDir, 'services', 'MonetizationRpcContract.ts');
const serviceFile = path.join(rootDir, 'services', 'MonetizationService.ts');
const webhookFile = path.join(rootDir, 'supabase', 'functions', 'revenuecat-webhook', 'index.ts');

const findings = [];

const REQUIRED_SQL_SNIPPETS = [
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+get_user_subscription_state_v2\s*\(/i,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+get_user_entitlements_v2\s*\(/i,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+can_user_access_attraction_v2\s*\(/i,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+record_attraction_usage_v2\s*\(/i,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+get_user_subscription_state_v2\(UUID\)\s+TO\s+authenticated;/i,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+get_user_entitlements_v2\(UUID\)\s+TO\s+authenticated;/i,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+can_user_access_attraction_v2\(UUID,\s*TEXT\)\s+TO\s+authenticated;/i,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+record_attraction_usage_v2\(UUID,\s*TEXT\)\s+TO\s+authenticated;/i,
];

function readUtf8(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    findings.push(`${label} missing: ${path.relative(rootDir, filePath)}`);
    return false;
  }
  return true;
}

function findMonetizationV2Migration() {
  if (!fs.existsSync(migrationDir)) {
    findings.push('supabase/migrations directory missing');
    return null;
  }

  const migrationFiles = fs.readdirSync(migrationDir)
    .filter(file => file.endsWith('.sql') && file.includes('monetization_rpc_v2'))
    .sort();

  if (migrationFiles.length === 0) {
    findings.push('No monetization_rpc_v2 migration SQL file found');
    return null;
  }

  return path.join(migrationDir, migrationFiles[migrationFiles.length - 1]);
}

const migrationPath = findMonetizationV2Migration();
if (migrationPath) {
  const sql = readUtf8(migrationPath);
  if (!sql) {
    findings.push(`Unable to read migration file: ${path.relative(rootDir, migrationPath)}`);
  } else {
    for (const pattern of REQUIRED_SQL_SNIPPETS) {
      if (!pattern.test(sql)) {
        findings.push(
          `Migration missing required v2 contract statement (${pattern.toString()}) in ${path.relative(rootDir, migrationPath)}`
        );
      }
    }
  }
}

if (ensureFile(contractFile, 'Monetization RPC contract file')) {
  const contractContent = readUtf8(contractFile) || '';
  if (!/export\s+const\s+MONETIZATION_RPC_V2_CONTRACT_VERSION\s*=/.test(contractContent)) {
    findings.push('MonetizationRpcContract.ts must export MONETIZATION_RPC_V2_CONTRACT_VERSION');
  }
}

if (ensureFile(serviceFile, 'MonetizationService')) {
  const serviceContent = readUtf8(serviceFile) || '';
  const requiredPatterns = [
    /from\s+['"]\.\/MonetizationRpcContract['"]/,
    /monetizationRpcContract\.getSubscriptionStateV2\(/,
    /monetizationRpcContract\.getUserEntitlementsV2\(/,
    /monetizationRpcContract\.canUserAccessAttractionV2\(/,
    /monetizationRpcContract\.recordAttractionUsageV2\(/,
  ];

  for (const pattern of requiredPatterns) {
    if (!pattern.test(serviceContent)) {
      findings.push(`MonetizationService missing required contract usage: ${pattern.toString()}`);
    }
  }
}

if (ensureFile(webhookFile, 'RevenueCat webhook')) {
  const webhookContent = readUtf8(webhookFile) || '';
  if (!/get_user_entitlements_v2/.test(webhookContent)) {
    findings.push('RevenueCat webhook must continue using get_user_entitlements_v2 for entitlement sync');
  }
}

if (findings.length > 0) {
  console.error('Monetization RPC contract checks failed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Monetization RPC contract checks passed.');
