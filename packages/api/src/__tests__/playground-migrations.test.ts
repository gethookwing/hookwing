/**
 * Playground migration coverage tests
 *
 * Validates that all SQL migrations referenced by the Drizzle schema
 * are included in the deploy workflows. This prevents Drizzle from
 * generating INSERT/SELECT statements referencing columns that don't
 * exist in the deployed D1 database.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

function getMigrationFiles(): string[] {
  const migrationsDir = resolve(ROOT, 'migrations');
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function getWorkflowMigrations(workflowPath: string): string[] {
  const content = readFileSync(resolve(ROOT, workflowPath), 'utf-8');
  const matches = content.match(/migrations\/\d{4}_[^\s'"]+\.sql/g) || [];
  return [
    ...new Set(matches.map((m) => m.replace('../../migrations/', '').replace('migrations/', ''))),
  ].sort();
}

describe('Deploy workflow migration coverage', () => {
  const allMigrations = getMigrationFiles();
  const devMigrations = getWorkflowMigrations('.github/workflows/deploy-dev.yml');
  const prodMigrations = getWorkflowMigrations('.github/workflows/deploy-prod.yml');

  it('should have all migrations included in deploy-dev.yml', () => {
    const missing = allMigrations.filter((m) => !devMigrations.includes(m));
    expect(missing).toEqual([]);
  });

  it('should have all migrations included in deploy-prod.yml', () => {
    const missing = allMigrations.filter((m) => !prodMigrations.includes(m));
    expect(missing).toEqual([]);
  });

  it('should have at least one migration file', () => {
    expect(allMigrations.length).toBeGreaterThan(0);
  });
});
