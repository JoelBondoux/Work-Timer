import { describe, it, expect, beforeEach } from 'vitest';
import type { Client } from '@libsql/client';
import { createMemoryClient } from '../db/client.js';
import { applyMinBlock, calculateAmount, calculateBillingRecord, getBillingSummary } from './billing.js';
import { createProject } from './projects.js';
import type { Session, Project } from '../types.js';

describe('applyMinBlock', () => {
  it('rounds up to nearest block', () => {
    expect(applyMinBlock(7, 15)).toBe(15);
    expect(applyMinBlock(16, 15)).toBe(30);
    expect(applyMinBlock(1, 15)).toBe(15);
  });

  it('returns exact value when on block boundary', () => {
    expect(applyMinBlock(15, 15)).toBe(15);
    expect(applyMinBlock(30, 15)).toBe(30);
    expect(applyMinBlock(60, 15)).toBe(60);
  });

  it('handles zero minutes', () => {
    expect(applyMinBlock(0, 15)).toBe(0);
  });

  it('handles zero block size (no rounding)', () => {
    expect(applyMinBlock(7, 0)).toBe(7);
    expect(applyMinBlock(23.5, 0)).toBe(23.5);
  });

  it('handles 1-minute blocks', () => {
    expect(applyMinBlock(7.3, 1)).toBe(8);
  });

  it('handles 6-minute (0.1h) blocks', () => {
    expect(applyMinBlock(7, 6)).toBe(12);
    expect(applyMinBlock(6, 6)).toBe(6);
    expect(applyMinBlock(13, 6)).toBe(18);
  });
});

describe('calculateAmount', () => {
  it('calculates basic hourly amount', () => {
    expect(calculateAmount(60, 100)).toBe(100);
    expect(calculateAmount(30, 100)).toBe(50);
    expect(calculateAmount(90, 100)).toBe(150);
  });

  it('rounds to 2 decimal places', () => {
    expect(calculateAmount(7, 100)).toBe(11.67);
    expect(calculateAmount(1, 100)).toBe(1.67);
  });

  it('handles zero rate', () => {
    expect(calculateAmount(60, 0)).toBe(0);
  });

  it('handles zero minutes', () => {
    expect(calculateAmount(0, 100)).toBe(0);
  });
});

describe('calculateBillingRecord (integration)', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createMemoryClient();
  });

  it('calculates billing for a simple completed session', async () => {
    const project = await createProject(client, 'Test Project', {
      rate: 150,
      currency: 'USD',
      min_block_minutes: 15,
    });

    // Insert a completed session: 45 minutes
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-15T10:00:00', '2026-01-15T10:45:00', 'completed')`,
      args: [project.id],
    });

    const result = await client.execute('SELECT * FROM sessions WHERE project_id = ?', [project.id]);
    const session: Session = {
      id: result.rows[0].id as number,
      project_id: project.id,
      start_time: '2026-01-15T10:00:00',
      end_time: '2026-01-15T10:45:00',
      status: 'completed',
      notes: null,
      invoiced_at: null,
      invoice_ref: null,
      paid_at: null,
      created_at: result.rows[0].created_at as string,
    };

    const record = await calculateBillingRecord(client, session, project);
    expect(record.raw_duration_minutes).toBe(45);
    expect(record.billed_duration_minutes).toBe(45); // 45 is already a multiple of 15
    expect(record.rate).toBe(150);
    expect(record.currency).toBe('USD');
    expect(record.amount).toBe(112.5); // 45/60 * 150
    expect(record.project_name).toBe('Test Project');
  });

  it('applies min block rounding', async () => {
    const project = await createProject(client, 'Rounding Test', {
      rate: 100,
      currency: 'EUR',
      min_block_minutes: 15,
    });

    // Insert a 7-minute session
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-15T10:00:00', '2026-01-15T10:07:00', 'completed')`,
      args: [project.id],
    });

    const result = await client.execute('SELECT * FROM sessions WHERE project_id = ?', [project.id]);
    const session: Session = {
      id: result.rows[0].id as number,
      project_id: project.id,
      start_time: '2026-01-15T10:00:00',
      end_time: '2026-01-15T10:07:00',
      status: 'completed',
      notes: null,
      invoiced_at: null,
      invoice_ref: null,
      paid_at: null,
      created_at: result.rows[0].created_at as string,
    };

    const record = await calculateBillingRecord(client, session, project);
    expect(record.raw_duration_minutes).toBe(7);
    expect(record.billed_duration_minutes).toBe(15); // Rounded up
    expect(record.amount).toBe(25); // 15/60 * 100
  });

  it('subtracts pause time from duration', async () => {
    const project = await createProject(client, 'Pause Test', {
      rate: 120,
      currency: 'GBP',
      min_block_minutes: 15,
    });

    // 60-minute session with a 15-minute pause = 45 minutes actual
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-15T10:00:00', '2026-01-15T11:00:00', 'completed')`,
      args: [project.id],
    });

    const sessionResult = await client.execute('SELECT id FROM sessions WHERE project_id = ?', [project.id]);
    const sessionId = sessionResult.rows[0].id as number;

    // Add a 15-minute pause
    await client.execute({
      sql: `INSERT INTO pauses (session_id, pause_start, pause_end)
            VALUES (?, '2026-01-15T10:20:00', '2026-01-15T10:35:00')`,
      args: [sessionId],
    });

    const result = await client.execute('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    const session: Session = {
      id: sessionId,
      project_id: project.id,
      start_time: '2026-01-15T10:00:00',
      end_time: '2026-01-15T11:00:00',
      status: 'completed',
      notes: null,
      invoiced_at: null,
      invoice_ref: null,
      paid_at: null,
      created_at: result.rows[0].created_at as string,
    };

    const record = await calculateBillingRecord(client, session, project);
    expect(record.raw_duration_minutes).toBe(45);
    expect(record.billed_duration_minutes).toBe(45);
    expect(record.amount).toBe(90); // 45/60 * 120
  });

  it('uses global defaults when project has no rate', async () => {
    // Set global defaults
    await client.execute({
      sql: `UPDATE settings SET value = '200' WHERE key = 'default_rate'`,
      args: [],
    });
    await client.execute({
      sql: `UPDATE settings SET value = 'AUD' WHERE key = 'default_currency'`,
      args: [],
    });

    const project = await createProject(client, 'Default Test');

    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-15T10:00:00', '2026-01-15T11:00:00', 'completed')`,
      args: [project.id],
    });

    const result = await client.execute('SELECT * FROM sessions WHERE project_id = ?', [project.id]);
    const session: Session = {
      id: result.rows[0].id as number,
      project_id: project.id,
      start_time: '2026-01-15T10:00:00',
      end_time: '2026-01-15T11:00:00',
      status: 'completed',
      notes: null,
      invoiced_at: null,
      invoice_ref: null,
      paid_at: null,
      created_at: result.rows[0].created_at as string,
    };

    const record = await calculateBillingRecord(client, session, project);
    expect(record.rate).toBe(200);
    expect(record.currency).toBe('AUD');
    expect(record.amount).toBe(200); // 60/60 * 200
  });
});

describe('getBillingSummary', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createMemoryClient();
  });

  it('aggregates totals across sessions', async () => {
    const project = await createProject(client, 'Summary Test', {
      rate: 100,
      currency: 'USD',
      min_block_minutes: 15,
    });

    // Two 1-hour sessions
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-15T10:00:00', '2026-01-15T11:00:00', 'completed')`,
      args: [project.id],
    });
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-16T10:00:00', '2026-01-16T11:00:00', 'completed')`,
      args: [project.id],
    });

    const summary = await getBillingSummary(client);
    expect(summary.records).toHaveLength(2);

    const total = summary.totals_by_project.get('Summary Test');
    expect(total).toBeDefined();
    expect(total!.total_billed_minutes).toBe(120);
    expect(total!.total_amount).toBe(200);
  });

  it('filters by date range', async () => {
    const project = await createProject(client, 'Date Filter', { rate: 100 });

    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-10T10:00:00', '2026-01-10T11:00:00', 'completed')`,
      args: [project.id],
    });
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-02-10T10:00:00', '2026-02-10T11:00:00', 'completed')`,
      args: [project.id],
    });

    const summary = await getBillingSummary(client, { from: '2026-02-01' });
    expect(summary.records).toHaveLength(1);
    expect(summary.records[0].date).toBe('2026-02-10');
  });

  it('filters unbilled only', async () => {
    const project = await createProject(client, 'Invoice Filter', { rate: 100 });

    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status, invoiced_at)
            VALUES (?, '2026-01-10T10:00:00', '2026-01-10T11:00:00', 'completed', '2026-01-15')`,
      args: [project.id],
    });
    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status)
            VALUES (?, '2026-01-11T10:00:00', '2026-01-11T11:00:00', 'completed')`,
      args: [project.id],
    });

    const summary = await getBillingSummary(client, { unbilledOnly: true });
    expect(summary.records).toHaveLength(1);
    expect(summary.records[0].invoiced).toBe(false);
  });
});
