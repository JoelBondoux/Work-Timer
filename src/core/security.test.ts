import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeSpreadsheetCell } from './export.js';
import { resolveMcpOutputPath } from './output-path.js';
import { sanitizeTerminalText } from './format.js';
import { createMemoryClient } from '../db/client.js';
import { createProject, updateProject, deleteProject, mergeProjects } from './projects.js';
import { requireConfirmation } from '../mcp/safety.js';

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

describe('project destructive operations are transactional', () => {
  it('rolls back deleteProject if a mid-operation delete fails', async () => {
    const client = await createMemoryClient();
    const project = await createProject(client, 'Rollback Delete');

    const inserted = await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-01T09:00:00', '2026-01-01T10:00:00', 'completed')`,
      args: [project.id],
    });
    const sessionId = Number(inserted.lastInsertRowid);

    await client.execute({
      sql: `INSERT INTO pauses (session_id, pause_start, pause_end)
            VALUES (?, '2026-01-01T09:30:00', '2026-01-01T09:35:00')`,
      args: [sessionId],
    });

    await client.execute(
      `CREATE TRIGGER fail_delete_sessions
       BEFORE DELETE ON sessions
       WHEN OLD.project_id = ${project.id}
       BEGIN
         SELECT RAISE(ABORT, 'fail_delete_sessions');
       END`
    );

    await expect(deleteProject(client, 'Rollback Delete', { force: true })).rejects.toThrow('fail_delete_sessions');

    const projectRows = await client.execute({ sql: 'SELECT COUNT(*) as c FROM projects WHERE id = ?', args: [project.id] });
    const sessionRows = await client.execute({ sql: 'SELECT COUNT(*) as c FROM sessions WHERE id = ?', args: [sessionId] });
    const pauseRows = await client.execute({ sql: 'SELECT COUNT(*) as c FROM pauses WHERE session_id = ?', args: [sessionId] });

    expect(Number(projectRows.rows[0].c as number | bigint)).toBe(1);
    expect(Number(sessionRows.rows[0].c as number | bigint)).toBe(1);
    expect(Number(pauseRows.rows[0].c as number | bigint)).toBe(1);
  });

  it('rolls back mergeProjects if source deletion fails after session reassignment', async () => {
    const client = await createMemoryClient();
    const source = await createProject(client, 'Rollback Source');
    const target = await createProject(client, 'Rollback Target');

    const inserted = await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-01T09:00:00', '2026-01-01T10:00:00', 'completed')`,
      args: [source.id],
    });
    const sessionId = Number(inserted.lastInsertRowid);

    await client.execute(
      `CREATE TRIGGER fail_delete_source_project
       BEFORE DELETE ON projects
       WHEN OLD.id = ${source.id}
       BEGIN
         SELECT RAISE(ABORT, 'fail_delete_source_project');
       END`
    );

    await expect(mergeProjects(client, 'Rollback Source', 'Rollback Target')).rejects.toThrow('fail_delete_source_project');

    const sourceRows = await client.execute({ sql: 'SELECT COUNT(*) as c FROM projects WHERE id = ?', args: [source.id] });
    const sessionProject = await client.execute({ sql: 'SELECT project_id FROM sessions WHERE id = ?', args: [sessionId] });

    expect(Number(sourceRows.rows[0].c as number | bigint)).toBe(1);
    expect(Number(sessionProject.rows[0].project_id as number | bigint)).toBe(source.id);
  });
});

describe('MCP destructive action confirmation', () => {
  it('allows dry run without confirm phrase', () => {
    const result = requireConfirmation(true, undefined, 'DELETE PROJECT Alpha');
    expect(result.allowed).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it('rejects execution without exact phrase', () => {
    const result = requireConfirmation(false, 'DELETE PROJECT alpha', 'DELETE PROJECT Alpha');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Confirmation required');
  });

  it('allows execution with exact phrase', () => {
    const result = requireConfirmation(false, 'MERGE PROJECT A INTO B', 'MERGE PROJECT A INTO B');
    expect(result.allowed).toBe(true);
  });
});
