import { localToUtcRangeStart, localToUtcRangeEnd, localDateTimeToUtcDb } from './time.js';
function rowToSession(row) {
    return {
        id: row.id,
        project_id: row.project_id,
        start_time: row.start_time,
        end_time: row.end_time || null,
        status: row.status,
        notes: row.notes || null,
        invoiced_at: row.invoiced_at || null,
        invoice_ref: row.invoice_ref || null,
        paid_at: row.paid_at || null,
        created_at: row.created_at,
    };
}
export async function querySessions(client, filters = {}) {
    const whereClauses = [];
    const args = [];
    if (filters.projectName) {
        whereClauses.push('LOWER(p.name) = LOWER(?)');
        args.push(filters.projectName);
    }
    if (filters.from) {
        whereClauses.push('s.start_time >= ?');
        args.push(localToUtcRangeStart(filters.from));
    }
    if (filters.to) {
        whereClauses.push('s.start_time <= ?');
        args.push(localToUtcRangeEnd(filters.to));
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
        const r = row;
        return {
            ...rowToSession(r),
            project_name: r.project_name,
        };
    });
}
export async function getSession(client, id) {
    const result = await client.execute({
        sql: 'SELECT * FROM sessions WHERE id = ?',
        args: [id],
    });
    if (result.rows.length === 0)
        return null;
    return rowToSession(result.rows[0]);
}
export async function markInvoiced(client, sessionIds, invoiceRef) {
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
export async function markPaid(client, sessionIds) {
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
export async function adjustSession(client, sessionId, opts) {
    if (!opts.start_time && !opts.end_time) {
        throw new Error('At least one of start_time or end_time must be provided.');
    }
    const session = await getSession(client, sessionId);
    if (!session)
        throw new Error(`Session not found: ${sessionId}`);
    const newStartUtc = opts.start_time
        ? localDateTimeToUtcDb(opts.start_time)
        : session.start_time;
    let newEndUtc = session.end_time;
    if (opts.end_time !== undefined) {
        if (session.status !== 'completed') {
            throw new Error(`Cannot set an end time on session #${sessionId} because it is still ${session.status}. Stop the timer first.`);
        }
        newEndUtc = localDateTimeToUtcDb(opts.end_time);
    }
    if (newEndUtc !== null && newStartUtc >= newEndUtc) {
        throw new Error('start_time must be before end_time.');
    }
    const setClauses = ['start_time = ?'];
    const args = [newStartUtc];
    if (newEndUtc !== session.end_time) {
        setClauses.push('end_time = ?');
        args.push(newEndUtc);
    }
    args.push(sessionId);
    await client.execute({
        sql: `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`,
        args,
    });
    const updated = await getSession(client, sessionId);
    if (!updated)
        throw new Error('Failed to update session');
    return updated;
}
export async function addSessionNote(client, sessionId, note) {
    const session = await getSession(client, sessionId);
    if (!session)
        throw new Error(`Session not found: ${sessionId}`);
    const newNotes = session.notes ? `${session.notes}\n${note}` : note;
    await client.execute({
        sql: 'UPDATE sessions SET notes = ? WHERE id = ?',
        args: [newNotes, sessionId],
    });
}
//# sourceMappingURL=sessions.js.map