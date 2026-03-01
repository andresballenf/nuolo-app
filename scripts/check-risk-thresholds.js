#!/usr/bin/env node

/**
 * Enforces non-regression thresholds on top risk files.
 * Keeps file size, `any` usage, and direct console logging bounded.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const RISK_THRESHOLDS = [
  {
    file: 'app/map.tsx',
    maxLines: 700,
    maxAny: 1,
    maxConsole: 0,
  },
  {
    file: 'contexts/AuthContext.tsx',
    maxLines: 1300,
    maxAny: 5,
    maxConsole: 0,
  },
  {
    file: 'services/MonetizationService.ts',
    maxLines: 1300,
    maxAny: 5,
    maxConsole: 0,
  },
  {
    file: 'components/ui/MaterialBottomSheet.tsx',
    maxLines: 850,
    maxAny: 1,
    maxConsole: 6,
  },
  {
    file: 'components/map/MapView.tsx',
    maxLines: 650,
    maxAny: 2,
    maxConsole: 0,
  },
  {
    file: 'contexts/AppContext.tsx',
    maxLines: 300,
    maxAny: 0,
    maxConsole: 0,
  },
  {
    file: 'services/AttractionInfoService.ts',
    maxLines: 700,
    maxAny: 5,
    maxConsole: 0,
  },
  {
    file: 'hooks/useMapAudioGuide.ts',
    maxLines: 650,
    maxAny: 0,
    maxConsole: 0,
  },
];

function countMatches(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

const findings = [];

for (const threshold of RISK_THRESHOLDS) {
  const absolutePath = path.join(ROOT, threshold.file);
  if (!fs.existsSync(absolutePath)) {
    findings.push(`${threshold.file}: file not found`);
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split('\n').length;
  const anyCount = countMatches(content, /\bany\b/g);
  const consoleCount = countMatches(content, /console\.(log|error|warn|info|debug)/g);

  if (lines > threshold.maxLines) {
    findings.push(
      `${threshold.file}: line count ${lines} exceeds max ${threshold.maxLines}`
    );
  }

  if (anyCount > threshold.maxAny) {
    findings.push(
      `${threshold.file}: any count ${anyCount} exceeds max ${threshold.maxAny}`
    );
  }

  if (consoleCount > threshold.maxConsole) {
    findings.push(
      `${threshold.file}: console count ${consoleCount} exceeds max ${threshold.maxConsole}`
    );
  }
}

if (findings.length > 0) {
  console.error('Risk threshold checks failed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Risk threshold checks passed.');
