#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = process.cwd();
const outDir = path.join(rootDir, '.tmp-tests');
const compiledUnitDir = path.join(outDir, 'tests', 'unit');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

fs.rmSync(outDir, { recursive: true, force: true });

const compileStatus = run('npx', ['tsc', '-p', 'tsconfig.automated-tests.json']);
if (compileStatus !== 0) {
  process.exit(compileStatus);
}

const testFiles = collectTestFiles(compiledUnitDir);
if (testFiles.length === 0) {
  console.error('No compiled unit tests found.');
  process.exit(1);
}

let failed = 0;
for (const testFile of testFiles) {
  const relative = path.relative(rootDir, testFile);
  console.log(`\n[unit] ${relative}`);
  const status = run('node', [testFile]);
  if (status !== 0) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\nUnit tests failed: ${failed}/${testFiles.length}`);
  process.exit(1);
}

console.log(`\nUnit tests passed: ${testFiles.length}/${testFiles.length}`);
