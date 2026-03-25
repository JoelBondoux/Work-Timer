import type { Client } from '@libsql/client';
import type { Session } from '../types.js';

function rowToSession(row: Record<string, unknown>): Session {
  return {
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
}

export interface SessionQueryFilters {
  projectName?: string;
  from?: string;
  to?: string;
  status?: 'running' | 'paused' | 'completed';
}

export async function querySessions(
  client: Client,
  filters: SessionQueryFilters = {}
): Promise<(Session & { project_name: string })[]> {
  const whereClauses: string[] = [];
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
  if (filters.status) {
    whereClauses.push('s.status = ?');
    args.push(filters.status);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await client.execute({
    sql: `SELECT s.*, p.name as project_name
          FROM sessions s
          JOIN projects p ON s.project_id = p.id
          ${whereStr}
          ORDER BY s.start_time DESC`,
    args,
  });

  return result.rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      ...rowToSession(r),
      project_name: r.project_name as string,
    };
  });
}

export async function getSession(client: Client, id: number): Promise<Session | null> {
  const result = await client.execute({
    sql: 'SELECT * FROM sessions WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToSession(result.rows[0] as unknown as Record<string, unknown>);
}

export async function markInvoiced(
  client: Client,
  sessionIds: number[],
  invoiceRef?: string
): Promise<number> {
  let updated = 0;
  for (const id of sessionIds) {
    const result = await client.execute({
      sql: `UPDATE sessions SET invoiced_at = datetime('now'), invoice_ref = ?
            WHERE id = ? AND status = 'completed'`,
      args: [invoiceRef ?? null, id],
    });
    updated += result.rowsAffected;
  }
  return updated;
}

export async function markPaid(client: Client, sessionIds: number[]): Promise<number> {
  let updated = 0;
  for (const id of sessionIds) {
    const result = await client.execute({
      sql: `UPDATE sessions SET paid_at = datetime('now')
            WHERE id = ? AND status = 'completed'`,
      args: [id],
    });
    updated += result.rowsAffected;
  }
  return updated;
}

export async function addSessionNote(
  client: Client,
  sessionId: number,
  note: string
): Promise<void> {
  const session = await getSession(client, sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const newNotes = session.notes ? `${session.notes}\n${note}` : note;
  await client.execute({
    sql: 'UPDATE sessions SET notes = ? WHERE id = ?',
    args: [newNotes, sessionId],
  });
}
