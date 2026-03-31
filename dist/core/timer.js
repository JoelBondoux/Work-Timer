import { getOrCreateProject } from './projects.js';
import { utcDbToLocal } from './time.js';
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
export async function startTimer(client, projectName, opts) {
    const project = await getOrCreateProject(client, projectName, {
        rate: opts?.rate,
        currency: opts?.currency,
    });
    // Check if project already has a running/paused session
    const existing = await client.execute({
        sql: `SELECT * FROM sessions WHERE project_id = ? AND status IN ('running', 'paused')`,
        args: [project.id],
    });
    if (existing.rows.length > 0) {
        const s = rowToSession(existing.rows[0]);
        throw new Error(`Project "${project.name}" already has a ${s.status} timer (session #${s.id}, started ${utcDbToLocal(s.start_time)})`);
    }
    const result = await client.execute({
        sql: `INSERT INTO sessions (project_id, start_time, status, notes)
          VALUES (?, datetime('now'), 'running', ?)`,
        args: [project.id, opts?.notes ?? null],
    });
    const session = await getSessionById(client, Number(result.lastInsertRowid));
    if (!session)
        throw new Error('Failed to create session');
    return { ...session, project_name: project.name };
}
export async function stopTimer(client, projectName) {
    const session = await findActiveSession(client, projectName);
    // If paused, close the open pause first
    if (session.status === 'paused') {
        await client.execute({
            sql: `UPDATE pauses SET pause_end = datetime('now') WHERE session_id = ? AND pause_end IS NULL`,
            args: [session.id],
        });
    }
    await client.execute({
        sql: `UPDATE sessions SET end_time = datetime('now'), status = 'completed' WHERE id = ?`,
        args: [session.id],
    });
    const updated = await getSessionById(client, session.id);
    if (!updated)
        throw new Error('Failed to stop session');
    const projectResult = await client.execute({
        sql: 'SELECT name FROM projects WHERE id = ?',
        args: [updated.project_id],
    });
    const projectName2 = projectResult.rows[0].name;
    return { ...updated, project_name: projectName2 };
}
export async function pauseTimer(client, projectName) {
    const session = await findActiveSession(client, projectName, 'running');
    await client.execute({
        sql: `INSERT INTO pauses (session_id, pause_start) VALUES (?, datetime('now'))`,
        args: [session.id],
    });
    await client.execute({
        sql: `UPDATE sessions SET status = 'paused' WHERE id = ?`,
        args: [session.id],
    });
    const updated = await getSessionById(client, session.id);
    if (!updated)
        throw new Error('Failed to pause session');
    const projectResult = await client.execute({
        sql: 'SELECT name FROM projects WHERE id = ?',
        args: [updated.project_id],
    });
    return { ...updated, project_name: projectResult.rows[0].name };
}
export async function resumeTimer(client, projectName) {
    const session = await findActiveSession(client, projectName, 'paused');
    // Close the open pause
    await client.execute({
        sql: `UPDATE pauses SET pause_end = datetime('now') WHERE session_id = ? AND pause_end IS NULL`,
        args: [session.id],
    });
    await client.execute({
        sql: `UPDATE sessions SET status = 'running' WHERE id = ?`,
        args: [session.id],
    });
    const updated = await getSessionById(client, session.id);
    if (!updated)
        throw new Error('Failed to resume session');
    const projectResult = await client.execute({
        sql: 'SELECT name FROM projects WHERE id = ?',
        args: [updated.project_id],
    });
    return { ...updated, project_name: projectResult.rows[0].name };
}
export async function getRunningTimers(client) {
    const result = await client.execute(`SELECT s.id as session_id, s.project_id, p.name as project_name,
            s.start_time, s.status, s.notes
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     WHERE s.status IN ('running', 'paused')
     ORDER BY s.start_time DESC`);
    const timers = [];
    for (const row of result.rows) {
        const sessionId = row.session_id;
        const startTime = row.start_time;
        const pauseMinutes = await getTotalPauseMinutes(client, sessionId);
        const totalMinutes = (Date.now() - new Date(startTime + 'Z').getTime()) / 60000 - pauseMinutes;
        timers.push({
            session_id: sessionId,
            project_id: row.project_id,
            project_name: row.project_name,
            start_time: startTime,
            status: row.status,
            elapsed_minutes: Math.max(0, totalMinutes),
            notes: row.notes || null,
        });
    }
    return timers;
}
export async function getSessionDurationMinutes(client, session) {
    if (!session.end_time) {
        // Still running — use current time
        const pauseMinutes = await getTotalPauseMinutes(client, session.id);
        const totalMinutes = (Date.now() - new Date(session.start_time + 'Z').getTime()) / 60000 - pauseMinutes;
        return Math.max(0, totalMinutes);
    }
    const totalMinutes = (new Date(session.end_time + 'Z').getTime() - new Date(session.start_time + 'Z').getTime()) / 60000;
    const pauseMinutes = await getTotalPauseMinutes(client, session.id);
    return Math.max(0, totalMinutes - pauseMinutes);
}
async function getTotalPauseMinutes(client, sessionId) {
    const result = await client.execute({
        sql: 'SELECT pause_start, pause_end FROM pauses WHERE session_id = ?',
        args: [sessionId],
    });
    let totalMs = 0;
    for (const row of result.rows) {
        const start = new Date(row.pause_start + 'Z').getTime();
        const end = row.pause_end
            ? new Date(row.pause_end + 'Z').getTime()
            : Date.now();
        totalMs += end - start;
    }
    return totalMs / 60000;
}
async function getSessionById(client, id) {
    const result = await client.execute({
        sql: 'SELECT * FROM sessions WHERE id = ?',
        args: [id],
    });
    if (result.rows.length === 0)
        return null;
    return rowToSession(result.rows[0]);
}
async function findActiveSession(client, projectName, requiredStatus) {
    if (projectName) {
        const projectResult = await client.execute({
            sql: 'SELECT id, name FROM projects WHERE LOWER(name) = LOWER(?)',
            args: [projectName],
        });
        if (projectResult.rows.length === 0) {
            throw new Error(`Project not found: ${projectName}`);
        }
        const projectId = projectResult.rows[0].id;
        const statusFilter = requiredStatus
            ? `AND status = '${requiredStatus}'`
            : `AND status IN ('running', 'paused')`;
        const result = await client.execute({
            sql: `SELECT * FROM sessions WHERE project_id = ? ${statusFilter} ORDER BY start_time DESC LIMIT 1`,
            args: [projectId],
        });
        if (result.rows.length === 0) {
            const stateDesc = requiredStatus ?? 'running or paused';
            throw new Error(`No ${stateDesc} timer found for project "${projectName}"`);
        }
        return rowToSession(result.rows[0]);
    }
    // No project specified — find most recent active session
    const statusFilter = requiredStatus
        ? `WHERE status = '${requiredStatus}'`
        : `WHERE status IN ('running', 'paused')`;
    const result = await client.execute(`SELECT * FROM sessions ${statusFilter} ORDER BY start_time DESC LIMIT 1`);
    if (result.rows.length === 0) {
        const stateDesc = requiredStatus ?? 'running or paused';
        throw new Error(`No ${stateDesc} timers found`);
    }
    return rowToSession(result.rows[0]);
}
//# sourceMappingURL=timer.js.map