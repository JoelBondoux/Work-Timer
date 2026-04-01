#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const workspaceRoot = process.cwd();

const rootsToScan = [
  'src',
  'docs',
  '.github',
  'README.md',
  'CHANGELOG.md',
  'package.json',
  'install.ps1',
  'install.sh',
];

const ignoredDirNames = new Set(['node_modules', '.git', 'dist']);
const allowedTextExtensions = new Set(['.ts', '.js', '.mjs', '.json', '.yml', '.yaml', '.md', '.ps1', '.sh']);

const forbiddenPatterns = [
  {
    label: 'debugger statement',
    regex: /(^|\s)debugger\s*;/m,
  },
  {
    label: 'console.debug call',
    regex: /\bconsole\.debug\s*\(/m,
  },
  {
    label: '@ts-ignore directive',
    regex: /@ts-ignore/m,
  },
  {
    label: 'release placeholder tag',
    regex: /REMOVE_BEFORE_RELEASE|TEMP_DEBUG|DEV_ONLY|DO_NOT_SHIP|WIP_RELEASE/m,
  },
  {
    label: 'merge conflict marker',
    regex: /^<{7}|^={7}|^>{7}/m,
  },
];

const errors = [];

function isTextFile(path) {
  for (const ext of allowedTextExtensions) {
    if (path.endsWith(ext)) return true;
  }
  return false;
}

function collectFiles(path) {
  const absolutePath = join(workspaceRoot, path);
  const stats = statSync(absolutePath, { throwIfNoEntry: false });
  if (!stats) {
    return;
  }

  if (stats.isDirectory()) {
    const entries = readdirSync(absolutePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirNames.has(entry.name)) {
        continue;
      }
      collectFiles(join(path, entry.name));
    }
    return;
  }

  if (!isTextFile(path)) {
    return;
  }

  const content = readFileSync(absolutePath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) {
      errors.push(`${relative(workspaceRoot, absolutePath)}: found ${pattern.label}`);
    }
  }
}

for (const root of rootsToScan) {
  collectFiles(root);
}

const packageJson = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));
if (typeof packageJson.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  errors.push(
    `package.json: version must be stable semver (x.y.z) without prerelease tags; received "${packageJson.version}"`
  );
}

if (errors.length > 0) {
  console.error('Production readiness check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Production readiness check passed.');
