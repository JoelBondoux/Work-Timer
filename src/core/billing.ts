import type { Client } from '@libsql/client';
import type { Session, Project, Settings, BillingRecord, BillingSummary, ProjectTotal } from '../types.js';
import { getSettings, getEffectiveRate, getEffectiveCurrency, getEffectiveMinBlock } from './settings.js';
import { getSessionDurationMinutes } from './timer.js';
export function applyMinBlock(rawMinutes: number, minBlockMinutes: number): number {
  if (minBlockMinutes <= 0) return rawMinutes;
  return Math.ceil(rawMinutes / minBlockMinutes) * minBlockMinutes;
}

export function calculateAmount(billedMinutes: number, ratePerHour: number): number {
  return Math.round((billedMinutes / 60) * ratePerHour * 100) / 100;
}

export async function calculateBillingRecord(
  client: Client,
  session: Session,
  project: Project
): Promise<BillingRecord> {
  const rawMinutes = await getSessionDurationMinutes(client, session);
  const rate = await getEffectiveRate(client, project);
  const currency = await getEffectiveCurrency(client, project);
  const minBlock = await getEffectiveMinBlock(client, project);

  const billedMinutes = applyMinBlock(rawMinutes, minBlock);
  const amount = calculateAmount(billedMinutes, rate);

  return {
    session_id: session.id,
    project_name: project.name,
    date: session.start_time.split('T')[0],
    start_time: session.start_time,
    end_time: session.end_time ?? '',
    raw_duration_minutes: Math.round(rawMinutes * 100) / 100,
    billed_duration_minutes: billedMinutes,
    rate,
    currency,
    amount,
    invoiced: session.invoiced_at !== null,
    invoice_ref: session.invoice_ref,
    paid: session.paid_at !== null,
    notes: session.notes,
  };
}

export interface BillingQueryFilters {
  projectName?: string;
  from?: string;
  to?: string;
  unbilledOnly?: boolean;
  unpaidOnly?: boolean;
}

export async function getBillingSummary(
  client: Client,
  filters: BillingQueryFilters = {}
): Promise<BillingSummary> {
  const whereClauses: string[] = [`s.status = 'completed'`];
  const args: (string | number | null)[] = [];

  if (filters.projectName) {
    whereClauses.push('LOWER(p.name) = LOWER(?)');
    args.push(filters.projectName);
  }
  if (filters.from) {
    whereClauses.push('s.start_time >= ?');
    args.push(filters.from);
  }
  if (filters.to) {
    whereClauses.push('s.start_time <= ?');
    args.push(filters.to);
  }
  if (filters.unbilledOnly) {
    whereClauses.push('s.invoiced_at IS NULL');
  }
  if (filters.unpaidOnly) {
    whereClauses.push('s.paid_at IS NULL');
  }

  const result = await client.execute({
    sql: `SELECT s.*, p.name as project_name, p.billing_rate, p.currency as project_currency,
                 p.min_block_minutes
          FROM sessions s
          JOIN projects p ON s.project_id = p.id
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY s.start_time ASC`,
    args,
  });

  const settings = await getSettings(client);
  const records: BillingRecord[] = [];
  const totalsMap = new Map<string, ProjectTotal>();

  for (const row of result.rows) {
    const session: Session = {
      id: row.id as number,
      project_id: row.project_id as number,
      start_time: row.start_time as string,
      end_time: (row.end_time as string) || null,
      status: row.status as Session['status'],
      notes: (row.notes as string) || null,
      invoiced_at: (row.invoiced_at as string) || null,
      invoice_ref: (row.invoice_ref as string) || null,
      paid_at: (row.paid_at as string) || null,
      created_at: row.created_at as string,
    };

    const project: Project = {
      id: row.project_id as number,
      name: row.project_name as string,
      billing_rate: row.billing_rate as number | null,
      currency: (row.project_currency as string) || null,
      min_block_minutes: row.min_block_minutes as number | null,
      archived: 0,
      created_at: '',
    };

    const record = await calculateBillingRecord(client, session, project);
    records.push(record);

    // Accumulate totals
    const existing = totalsMap.get(project.name);
    if (existing) {
      existing.total_raw_minutes += record.raw_duration_minutes;
      existing.total_billed_minutes += record.billed_duration_minutes;
      existing.total_amount += record.amount;
    } else {
      totalsMap.set(project.name, {
        project_name: project.name,
        total_raw_minutes: record.raw_duration_minutes,
        total_billed_minutes: record.billed_duration_minutes,
        total_amount: record.amount,
        currency: record.currency,
      });
    }
  }

  // Round totals
  for (const total of totalsMap.values()) {
    total.total_amount = Math.round(total.total_amount * 100) / 100;
  }

  return { records, totals_by_project: totalsMap };
}
