import { describe, it, expect } from 'vitest';
import { createMemoryClient } from '../db/client.js';
import { createProject } from './projects.js';
import { exportXlsx } from './export.js';

describe('exportXlsx', () => {
  it('returns a valid XLSX zip buffer', async () => {
    const client = await createMemoryClient();
    const project = await createProject(client, 'Client Alpha', { rate: 150, currency: 'USD' });

    await client.execute({
      sql: `INSERT INTO sessions (project_id, start_time, end_time, status, notes)
            VALUES (?, '2026-03-15T09:00:00', '2026-03-15T11:30:00', 'completed', 'Sprint planning')`,
      args: [project.id],
    });

    const buffer = await exportXlsx(client, { projectName: 'Client Alpha' });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });
});
