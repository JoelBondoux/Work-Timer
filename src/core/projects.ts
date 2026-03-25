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
