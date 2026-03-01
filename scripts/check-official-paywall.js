#!/usr/bin/env node

/**
 * Enforce RevenueCat as the single official paywall path.
 *
 * Rules:
 * 1) Deprecated PaywallModal wrapper files must not exist.
 * 2) App code must not import deprecated PaywallModal wrapper paths.
 * 3) react-native-purchases-ui should only be imported in the centralized
 *    RevenueCat paywall component.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const SOURCE_ROOTS = ['app', 'components', 'contexts', 'hooks', 'services', 'lib', 'utils', 'config'];
const DEPRECATED_PAYWALL_FILES = [
  path.join(rootDir, 'components', 'ui', 'PaywallModal.tsx'),
  path.join(rootDir, 'components', 'purchase', 'PaywallModal.tsx'),
];

const RULES = [
  {
    id: 'deprecated-ui-paywall-import',
    regex: /from\s+['"][^'"]*components\/ui\/PaywallModal['"]/g,
    message: 'Import RevenueCatPaywallModal instead of deprecated ui/PaywallModal wrapper.',
  },
  {
    id: 'deprecated-purchase-paywall-import',
    regex: /from\s+['"][^'"]*components\/purchase\/PaywallModal['"]/g,
    message: 'Import RevenueCatPaywallModal instead of deprecated purchase/PaywallModal wrapper.',
  },
  {
    id: 'direct-purchases-ui-import',
    regex: /from\s+['"]react-native-purchases-ui['"]/g,
    message: 'Import react-native-purchases-ui only in the centralized RevenueCat paywall component.',
  },
  {
    id: 'legacy-purchase-hook-runtime-import',
    regex: /from\s+['"][^'"]*hooks\/usePurchaseIntegration['"]/g,
    message: 'Runtime code must not import usePurchaseIntegration; route paywall state through MonetizationContext.',
  },
  {
    id: 'legacy-purchase-hook-runtime-require',
    regex: /require\(\s*['"][^'"]*hooks\/usePurchaseIntegration['"]\s*\)/g,
    message: 'Runtime code must not require usePurchaseIntegration; route paywall state through MonetizationContext.',
  },
  {
    id: 'legacy-purchase-components-runtime-import',
    regex: /from\s+['"][^'"]*components\/purchase(?:\/[^'"]*)?['"]/g,
    message: 'Runtime code must not import from components/purchase; use RevenueCatPaywallModal + MonetizationContext.',
  },
  {
    id: 'legacy-purchase-components-runtime-require',
    regex: /require\(\s*['"][^'"]*components\/purchase(?:\/[^'"]*)?['"]\s*\)/g,
    message: 'Runtime code must not require components/purchase; use RevenueCatPaywallModal + MonetizationContext.',
  },
];

const ALLOWED_PATHS_BY_RULE = {
  'deprecated-ui-paywall-import': [],
  'deprecated-purchase-paywall-import': [],
  'direct-purchases-ui-import': [
    /^components\/ui\/RevenueCatPaywallModal\.tsx$/,
  ],
  'legacy-purchase-hook-runtime-import': [
    /^components\/purchase\/.+/,
    /^hooks\/usePurchaseIntegration\.ts$/,
  ],
  'legacy-purchase-hook-runtime-require': [
    /^components\/purchase\/.+/,
    /^hooks\/usePurchaseIntegration\.ts$/,
  ],
  'legacy-purchase-components-runtime-import': [
    /^components\/purchase\/.+/,
  ],
  'legacy-purchase-components-runtime-require': [
    /^components\/purchase\/.+/,
  ],
};

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

function isAllowed(ruleId, relPath) {
  const allowed = ALLOWED_PATHS_BY_RULE[ruleId] || [];
  return allowed.some(pattern => pattern.test(relPath));
}

const findings = [];

for (const deprecatedFile of DEPRECATED_PAYWALL_FILES) {
  if (fs.existsSync(deprecatedFile)) {
    findings.push({
      file: relativePath(deprecatedFile),
      message: 'Deprecated paywall wrapper file exists; use RevenueCatPaywallModal directly.',
    });
  }
}

for (const root of SOURCE_ROOTS) {
  const absoluteRoot = path.join(rootDir, root);
  if (!fs.existsSync(absoluteRoot)) continue;

  const files = walkFiles(absoluteRoot);
  for (const filePath of files) {
    const relPath = relativePath(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const rule of RULES) {
      if (isAllowed(rule.id, relPath)) continue;

      if (rule.regex.test(content)) {
        findings.push({
          file: relPath,
          message: rule.message,
        });
      }
      rule.regex.lastIndex = 0;
    }
  }
}

if (findings.length > 0) {
  console.error('Official paywall guard failed:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.message}`);
  }
  process.exit(1);
}

console.log('Official paywall guard passed.');
