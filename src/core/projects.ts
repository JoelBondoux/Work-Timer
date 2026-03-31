import type { Client } from '@libsql/client';
import type { Project } from '../types.js';

function validateRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('Rate must be a non-negative finite number.');
  }
}

function validateMinBlockMinutes(minBlockMinutes: number): void {
  if (!Number.isInteger(minBlockMinutes) || minBlockMinutes < 0 || minBlockMinutes > 1440) {
    throw new Error('Minimum billing block must be an integer between 0 and 1440 minutes.');
  }
}

function validateProjectNumericOptions(opts?: { rate?: number; min_block_minutes?: number }): void {
  if (!opts) {
    return;
  }
  if (opts.rate !== undefined) {
    validateRate(opts.rate);
  }
  if (opts.min_block_minutes !== undefined) {
    validateMinBlockMinutes(opts.min_block_minutes);
  }
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as number,
    name: row.name as string,
    billing_rate: row.billing_rate as number | null,
    currency: row.currency as string | null,
    min_block_minutes: row.min_block_minutes as number | null,
    archived: row.archived as number,
    created_at: row.created_at as string,
  };
}

export async function createProject(
  client: Client,
  name: string,
  opts?: { rate?: number; currency?: string; min_block_minutes?: number }
): Promise<Project> {
  validateProjectNumericOptions(opts);

  const result = await client.execute({
    sql: `INSERT INTO projects (name, billing_rate, currency, min_block_minutes)
          VALUES (?, ?, ?, ?)`,
    args: [name, opts?.rate ?? null, opts?.currency ?? null, opts?.min_block_minutes ?? null],
  });

  const project = await getProjectById(client, Number(result.lastInsertRowid));
  if (!project) throw new Error('Failed to create project');
  return project;
}

export async function updateProject(
  client: Client,
  nameOrId: string | number,
  updates: { rate?: number; currency?: string; min_block_minutes?: number; archived?: boolean }
): Promise<Project> {
  validateProjectNumericOptions(updates);

  const project = typeof nameOrId === 'number'
    ? await getProjectById(client, nameOrId)
    : await getProjectByName(client, nameOrId);

  if (!project) throw new Error(`Project not found: ${nameOrId}`);

  const setClauses: string[] = [];
  const args: (string | number | null)[] = [];

  if (updates.rate !== undefined) {
    setClauses.push('billing_rate = ?');
    args.push(updates.rate);
  }
  if (updates.currency !== undefined) {
    setClauses.push('currency = ?');
    args.push(updates.currency);
  }
  if (updates.min_block_minutes !== undefined) {
    setClauses.push('min_block_minutes = ?');
    args.push(updates.min_block_minutes);
  }
  if (updates.archived !== undefined) {
    setClauses.push('archived = ?');
    args.push(updates.archived ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return project;
  }

  args.push(project.id);
  await client.execute({
    sql: `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  });

  const updated = await getProjectById(client, project.id);
  if (!updated) throw new Error('Failed to update project');
  return updated;
}

export async function getProjectById(client: Client, id: number): Promise<Project | null> {
  const result = await client.execute({
    sql: 'SELECT * FROM projects WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToProject(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getProjectByName(client: Client, name: string): Promise<Project | null> {
  const result = await client.execute({
    sql: 'SELECT * FROM projects WHERE LOWER(name) = LOWER(?)',
    args: [name],
  });
  if (result.rows.length === 0) return null;
  return rowToProject(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getProject(client: Client, nameOrId: string | number): Promise<Project | null> {
  if (typeof nameOrId === 'number') {
    return getProjectById(client, nameOrId);
  }
  // Try as number first (in case a numeric string is passed)
  const asNum = parseInt(nameOrId, 10);
  if (!isNaN(asNum) && String(asNum) === nameOrId) {
    return getProjectById(client, asNum);
  }
  return getProjectByName(client, nameOrId);
}

export async function getOrCreateProject(
  client: Client,
  name: string,
  opts?: { rate?: number; currency?: string; min_block_minutes?: number }
): Promise<Project> {
  const existing = await getProjectByName(client, name);
  if (existing) return existing;
  return createProject(client, name, opts);
}

export async function listProjects(client: Client, includeArchived = false): Promise<Project[]> {
  const sql = includeArchived
    ? 'SELECT * FROM projects ORDER BY name'
    : 'SELECT * FROM projects WHERE archived = 0 ORDER BY name';
  const result = await client.execute(sql);
  return result.rows.map((row) => rowToProject(row as unknown as Record<string, unknown>));
}

function normalizeForComparison(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  let intersection = 0;
  for (const [bg, count] of bigramsA) {
    intersection += Math.min(count, bigramsB.get(bg) ?? 0);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

export async function renameProject(
  client: Client,
  oldName: string,
  newName: string,
): Promise<Project> {
  const project = await getProjectByName(client, oldName);
  if (!project) throw new Error(`Project not found: "${oldName}"`);

  const conflict = await getProjectByName(client, newName);
  if (conflict) throw new Error(`A project named "${newName}" already exists.`);

  await client.execute({
    sql: 'UPDATE projects SET name = ? WHERE id = ?',
    args: [newName, project.id],
  });

  const updated = await getProjectById(client, project.id);
  if (!updated) throw new Error('Failed to rename project');
  return updated;
}

export async function deleteProject(
  client: Client,
  name: string,
  opts?: { force?: boolean },
): Promise<void> {
  const project = await getProjectByName(client, name);
  if (!project) throw new Error(`Project not found: "${name}"`);

  const active = await client.execute({
    sql: `SELECT id FROM sessions WHERE project_id = ? AND status IN ('running', 'paused')`,
    args: [project.id],
  });
  if (active.rows.length > 0) {
    throw new Error(`Cannot delete "${name}": it has a running or paused timer. Stop it first.`);
  }

  const sessions = await client.execute({
    sql: 'SELECT id FROM sessions WHERE project_id = ?',
    args: [project.id],
  });

  if (sessions.rows.length > 0 && !opts?.force) {
    throw new Error(
      `Project "${name}" has ${sessions.rows.length} session(s). Use --force to permanently delete it and all its sessions.`
    );
  }

  if (sessions.rows.length > 0) {
    await client.execute({
      sql: 'DELETE FROM pauses WHERE session_id IN (SELECT id FROM sessions WHERE project_id = ?)',
      args: [project.id],
    });
    await client.execute({
      sql: 'DELETE FROM sessions WHERE project_id = ?',
      args: [project.id],
    });
  }

  await client.execute({
    sql: 'DELETE FROM projects WHERE id = ?',
    args: [project.id],
  });
}

export async function mergeProjects(
  client: Client,
  sourceName: string,
  targetName: string,
): Promise<{ sessionsMoved: number; target: Project }> {
  const source = await getProjectByName(client, sourceName);
  if (!source) throw new Error(`Source project not found: "${sourceName}"`);

  const target = await getProjectByName(client, targetName);
  if (!target) throw new Error(`Target project not found: "${targetName}"`);

  if (source.id === target.id) {
    throw new Error('Source and target project are the same.');
  }

  const active = await client.execute({
    sql: `SELECT id FROM sessions WHERE project_id = ? AND status IN ('running', 'paused')`,
    args: [source.id],
  });
  if (active.rows.length > 0) {
    throw new Error(`Cannot merge: "${sourceName}" has a running or paused timer. Stop it first.`);
  }

  const result = await client.execute({
    sql: 'UPDATE sessions SET project_id = ? WHERE project_id = ?',
    args: [target.id, source.id],
  });

  const sessionsMoved = result.rowsAffected ?? 0;

  await client.execute({
    sql: 'DELETE FROM projects WHERE id = ?',
    args: [source.id],
  });

  const updatedTarget = await getProjectById(client, target.id);
  return { sessionsMoved, target: updatedTarget! };
}

/**
 * Returns active projects whose names are similar to the given name.
 * Normalises names by lowercasing and stripping spaces before comparison,
 * so "BoldBathroom" and "Bold Bathroom" are treated as identical.
 */
export async function findSimilarProjects(
  client: Client,
  name: string,
  threshold = 0.6
): Promise<Project[]> {
  const all = await listProjects(client, false);
  const normalized = normalizeForComparison(name);
  return all.filter((p) => {
    const pNorm = normalizeForComparison(p.name);
    if (pNorm === normalized) return true;
    return bigramSimilarity(normalized, pNorm) >= threshold;
  });
}
