import { getSettings, getEffectiveRate, getEffectiveCurrency, getEffectiveMinBlock } from './settings.js';
import { getSessionDurationMinutes } from './timer.js';
import { utcDbToLocal, utcDbToLocalDate, localToUtcRangeStart, localToUtcRangeEnd } from './time.js';
export function applyMinBlock(rawMinutes, minBlockMinutes) {
    if (minBlockMinutes <= 0)
        return rawMinutes;
    return Math.ceil(rawMinutes / minBlockMinutes) * minBlockMinutes;
}
export function calculateAmount(billedMinutes, ratePerHour) {
    return Math.round((billedMinutes / 60) * ratePerHour * 100) / 100;
}
export async function calculateBillingRecord(client, session, project) {
    const rawMinutes = await getSessionDurationMinutes(client, session);
    const rate = await getEffectiveRate(client, project);
    const currency = await getEffectiveCurrency(client, project);
    const minBlock = await getEffectiveMinBlock(client, project);
    const billedMinutes = applyMinBlock(rawMinutes, minBlock);
    const amount = calculateAmount(billedMinutes, rate);
    return {
        session_id: session.id,
        project_name: project.name,
        date: utcDbToLocalDate(session.start_time),
        start_time: utcDbToLocal(session.start_time),
        end_time: session.end_time ? utcDbToLocal(session.end_time) : '',
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
export async function getBillingSummary(client, filters = {}) {
    const whereClauses = [`s.status = 'completed'`];
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
    const records = [];
    const totalsMap = new Map();
    for (const row of result.rows) {
        const session = {
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
        const project = {
            id: row.project_id,
            name: row.project_name,
            billing_rate: row.billing_rate,
            currency: row.project_currency || null,
            min_block_minutes: row.min_block_minutes,
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
        }
        else {
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
//# sourceMappingURL=billing.js.map