#!/usr/bin/env node

/**
 * Prevent accidental secret leakage in tracked config files.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const findings = [];

function addFinding(file, message) {
  findings.push({ file, message });
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  const text = readText(filePath);
  if (text == null) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    addFinding(filePath, `invalid JSON: ${error.message}`);
    return null;
  }
}

function checkForRegexLeaks(filePath, content) {
  const rules = [
    {
      name: 'Google Maps API key',
      regex: /AIza[0-9A-Za-z_-]{35}/,
    },
    {
      name: 'RevenueCat API key',
      regex: /\b(?:appl|goog)_[A-Za-z0-9]{16,}\b/,
    },
    {
      name: 'JWT-like token',
      regex: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/,
    },
  ];

  for (const rule of rules) {
    if (rule.regex.test(content)) {
      addFinding(filePath, `${rule.name} literal detected`);
    }
  }
}

function checkEasJson() {
  const filePath = path.join(rootDir, 'eas.json');
  const content = readText(filePath);
  if (content == null) return;

  checkForRegexLeaks(filePath, content);

  const parsed = readJson(filePath);
  if (!parsed || typeof parsed !== 'object') return;

  const disallowedEnvKeys = new Set([
    'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
    'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ]);

  const build = parsed.build;
  if (!build || typeof build !== 'object') return;

  for (const [profileName, profileConfig] of Object.entries(build)) {
    if (!profileConfig || typeof profileConfig !== 'object') continue;
    const env = profileConfig.env;
    if (!env || typeof env !== 'object') continue;

    for (const key of Object.keys(env)) {
      if (disallowedEnvKeys.has(key)) {
        addFinding(
          filePath,
          `build.${profileName}.env.${key} must not be committed in eas.json (use EAS env/secrets instead)`,
        );
      }
    }
  }
}

function checkCredentialsJson() {
  const filePath = path.join(rootDir, 'credentials.json');
  const content = readText(filePath);
  if (content == null) return;

  checkForRegexLeaks(filePath, content);

  const parsed = readJson(filePath);
  if (!parsed || typeof parsed !== 'object') return;

  const password = parsed?.ios?.distributionCertificate?.password;
  if (typeof password === 'string') {
    const safePlaceholder = password.startsWith('__SET_') || password.toLowerCase().startsWith('your_');
    if (!safePlaceholder) {
      addFinding(
        filePath,
        'ios.distributionCertificate.password looks like a real secret; store this outside git',
      );
    }
  }
}

function checkNativeIosFiles() {
  const files = [
    path.join(rootDir, 'ios', 'Nuolo', 'AppDelegate.swift'),
    path.join(rootDir, 'ios', 'Nuolo', 'Info.plist'),
  ];

  for (const filePath of files) {
    const content = readText(filePath);
    if (content == null) continue;
    checkForRegexLeaks(filePath, content);
  }
}

checkEasJson();
checkCredentialsJson();
checkNativeIosFiles();

if (findings.length > 0) {
  console.error('Secret leakage check failed:');
  for (const finding of findings) {
    const relative = path.relative(rootDir, finding.file) || finding.file;
    console.error(`- ${relative}: ${finding.message}`);
  }
  process.exit(1);
}

console.log('Secret leakage check passed.');
