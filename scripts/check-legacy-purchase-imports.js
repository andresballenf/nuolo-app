#!/usr/bin/env node

/**
 * Prevent reintroduction of deprecated PurchaseContext usage.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const SOURCE_ROOTS = ['app', 'components', 'contexts', 'hooks', 'services', 'lib', 'utils', 'config'];

const LEGACY_IMPORT_PATTERNS = [
  {
    id: 'PurchaseContext import',
    regex: /from\s+['"][^'"]*contexts\/PurchaseContext['"]/g,
  },
  {
    id: 'PurchaseContext require',
    regex: /require\(\s*['"][^'"]*contexts\/PurchaseContext['"]\s*\)/g,
  },
];

const DEPRECATED_CONTEXT_PATH = path.join(rootDir, 'contexts', 'PurchaseContext.tsx');

function walkFiles(dir, collector = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collector);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx')) continue;

    collector.push(fullPath);
  }

  return collector;
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll('\\\\', '/');
}

const findings = [];

if (fs.existsSync(DEPRECATED_CONTEXT_PATH)) {
  findings.push({
    file: relativePath(DEPRECATED_CONTEXT_PATH),
    issue: 'Deprecated PurchaseContext file exists; remove it and use MonetizationContext.',
  });
}

for (const root of SOURCE_ROOTS) {
  const absoluteRoot = path.join(rootDir, root);
  if (!fs.existsSync(absoluteRoot)) continue;

  const files = walkFiles(absoluteRoot);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of LEGACY_IMPORT_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({ file: relativePath(file), issue: pattern.id });
      }
      pattern.regex.lastIndex = 0;
    }
  }
}

if (findings.length > 0) {
  console.error('Legacy purchase import guard failed:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.issue}`);
  }
  process.exit(1);
}

console.log('Legacy purchase import guard passed.');
