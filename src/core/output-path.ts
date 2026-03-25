import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';

const MCP_EXPORT_ROOT = join(homedir(), '.work-timer', 'exports');

function normalizeForCompare(path: string): string {
  const normalized = normalize(path);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function getMcpExportRoot(): string {
  return MCP_EXPORT_ROOT;
}

export function resolveMcpOutputPath(
  outputPath: string,
  defaultExtension: '.csv' | '.xlsx',
  rootDir = MCP_EXPORT_ROOT
): string {
  const raw = outputPath.trim();
  if (!raw) {
    throw new Error('output_path must not be empty.');
  }
  if (raw.includes('\0')) {
    throw new Error('output_path contains invalid characters.');
  }
  if (isAbsolute(raw)) {
    throw new Error('output_path must be relative to the Work-Timer export directory.');
  }

  const pathWithExt = extname(raw) ? raw : `${raw}${defaultExtension}`;
  const ext = extname(pathWithExt).toLowerCase();
  if (ext !== defaultExtension) {
    throw new Error(`output_path must use the ${defaultExtension} extension.`);
  }

  const root = normalize(resolve(rootDir));
  const target = normalize(resolve(root, pathWithExt));
  const rootCmp = normalizeForCompare(root);
  const targetCmp = normalizeForCompare(target);

  if (targetCmp !== rootCmp && !targetCmp.startsWith(`${rootCmp}${sep}`)) {
    throw new Error('output_path escapes the Work-Timer export directory.');
  }

  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  return target;
}
