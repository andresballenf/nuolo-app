#!/usr/bin/env node

/**
 * Lightweight static sanity check for Supabase Edge Functions.
 * We keep app tsconfig focused on React Native code, so this validates
 * edge function TypeScript syntax and blocks merge-conflict markers.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const rootDir = process.cwd();
const functionsDir = path.join(rootDir, 'supabase', 'functions');
const conflictMarkerRegex = /^(<{7}|={7}|>{7})/m;

function walkFiles(dir, collector = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collector);
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) {
      collector.push(fullPath);
    }
  }

  return collector;
}

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

if (!fs.existsSync(functionsDir)) {
  console.log('No supabase/functions directory found, skipping check.');
  process.exit(0);
}

const files = walkFiles(functionsDir).sort();
if (files.length === 0) {
  console.log('No Supabase function TypeScript files found, skipping check.');
  process.exit(0);
}

let hasErrors = false;
let checkedCount = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  checkedCount += 1;

  if (conflictMarkerRegex.test(source)) {
    hasErrors = true;
    console.error(`ERROR ${relative(file)}: unresolved merge-conflict marker found.`);
    continue;
  }

  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
      removeComments: false,
    },
    fileName: file,
    reportDiagnostics: true,
  });

  const diagnostics = (result.diagnostics || []).filter(
    diag => diag.category === ts.DiagnosticCategory.Error,
  );

  if (diagnostics.length > 0) {
    hasErrors = true;
    for (const diag of diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      if (diag.file && typeof diag.start === 'number') {
        const position = diag.file.getLineAndCharacterOfPosition(diag.start);
        const line = position.line + 1;
        const col = position.character + 1;
        console.error(`ERROR ${relative(file)}:${line}:${col} ${message}`);
      } else {
        console.error(`ERROR ${relative(file)} ${message}`);
      }
    }
  }
}

if (hasErrors) {
  console.error(`\nSupabase function check failed (${checkedCount} files checked).`);
  process.exit(1);
}

console.log(`Supabase function check passed (${checkedCount} files checked).`);
