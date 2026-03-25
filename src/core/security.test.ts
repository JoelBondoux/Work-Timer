import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeSpreadsheetCell } from './export.js';
import { resolveMcpOutputPath } from './output-path.js';
import { sanitizeTerminalText } from './format.js';
import { createMemoryClient } from '../db/client.js';
import { createProject, updateProject } from './projects.js';

describe('sanitizeSpreadsheetCell', () => {
  it('prefixes dangerous formula-leading values with apostrophe', () => {
    expect(sanitizeSpreadsheetCell('=HYPERLINK("http://evil")')).toBe('\'=HYPERLINK("http://evil")');
    expect(sanitizeSpreadsheetCell('@SUM(1,2)')).toBe('\'@SUM(1,2)');
    expect(sanitizeSpreadsheetCell('   +cmd')).toBe('\'   +cmd');
  });

  it('keeps plain numeric values unchanged', () => {
    expect(sanitizeSpreadsheetCell('-12.5')).toBe('-12.5');
    expect(sanitizeSpreadsheetCell('+12')).toBe('+12');
  });

  it('keeps regular text unchanged', () => {
    expect(sanitizeSpreadsheetCell('Client Alpha')).toBe('Client Alpha');
  });
});

describe('resolveMcpOutputPath', () => {
  it('resolves relative paths under export root', () => {
    const root = mkdtempSync(join(tmpdir(), 'work-timer-security-'));
    try {
      const resolved = resolveMcpOutputPath('monthly/report', '.csv', root);
      expect(resolved.startsWith(root)).toBe(true);
      expect(resolved.endsWith(join('monthly', 'report.csv'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects absolute paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'work-timer-security-'));
    try {
      expect(() => resolveMcpOutputPath('C:/Windows/system32/config.csv', '.csv', root)).toThrow(
        'output_path must be relative'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects path traversal', () => {
    const root = mkdtempSync(join(tmpdir(), 'work-timer-security-'));
    try {
      expect(() => resolveMcpOutputPath('../outside.csv', '.csv', root)).toThrow('escapes');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('enforces extension', () => {
    const root = mkdtempSync(join(tmpdir(), 'work-timer-security-'));
    try {
      expect(() => resolveMcpOutputPath('report.txt', '.csv', root)).toThrow('must use the .csv');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('sanitizeTerminalText', () => {
  it('removes ANSI escape sequences and control chars', () => {
    const value = '\u001b[31mALERT\u001b[0m\nnext\tline\u0007';
    expect(sanitizeTerminalText(value)).toBe('ALERT next line');
  });
});

describe('project numeric validation', () => {
  it('rejects invalid billing rates', async () => {
    const client = await createMemoryClient();
    await expect(createProject(client, 'Bad Rate', { rate: Number.NaN })).rejects.toThrow(
      'Rate must be a non-negative finite number.'
    );
  });

  it('rejects non-integer minimum block', async () => {
    const client = await createMemoryClient();
    await expect(createProject(client, 'Bad Block', { min_block_minutes: 7.5 })).rejects.toThrow(
      'Minimum billing block must be an integer between 0 and 1440 minutes.'
    );
  });

  it('rejects invalid update values', async () => {
    const client = await createMemoryClient();
    await createProject(client, 'Update Test', { rate: 100, min_block_minutes: 15 });
    await expect(updateProject(client, 'Update Test', { min_block_minutes: -1 })).rejects.toThrow(
      'Minimum billing block must be an integer between 0 and 1440 minutes.'
    );
  });
});
