import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  workspaces,
  apiKeys,
  endpoints,
  events,
  deliveries,
  usageDaily,
  oauthAccounts,
  deadLetterItems,
  customDomains,
  feedback,
  passwordResetTokens,
  idempotencyKeys,
  routingRules,
} from '@hookwing/shared';

// Get all table names from Drizzle schema
const DRIZZLE_TABLES = [
  'workspaces',
  'api_keys',
  'endpoints',
  'events',
  'deliveries',
  'usage_daily',
  'oauth_accounts',
  'dead_letter_items',
  'custom_domains',
  'feedback',
  'password_reset_tokens',
  'idempotency_keys',
  'routing_rules',
];

describe('Schema integrity', () => {
  // Get migration files - resolve from workspace root (4 levels up from __tests__)
  const migrationsDir = path.resolve(__dirname, '../../../../migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  it('all Drizzle tables have corresponding migrations', () => {
    // Read all migration SQL files
    let allMigrations = '';
    for (const file of migrationFiles) {
      allMigrations += fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    }

    // Verify every Drizzle table name appears in migrations
    for (const tableName of DRIZZLE_TABLES) {
      const tableExistsInMigrations = allMigrations.includes(`CREATE TABLE ${tableName}`) ||
        allMigrations.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`);

      expect(tableExistsInMigrations, `Table "${tableName}" defined in Drizzle schema but not found in migrations`).toBe(true);
    }
  });

  it('workspaces table has all expected columns', () => {
    const migrationsContent = migrationFiles
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n');

    // Key columns that must exist in migrations for workspaces
    const requiredColumns = [
      'id',
      'email',
      'password_hash',
      'name',
      'slug',
      'tier_slug',
      'created_at',
      'updated_at',
      'agent_upgrade_behavior',
      'is_playground',
      'captcha_enabled',
      'totp_secret',
      'totp_enabled',
    ];

    for (const col of requiredColumns) {
      expect(migrationsContent, `Missing column "${col}" in workspaces table`).includes(col);
    }
  });

  it('endpoints table has all expected columns', () => {
    const migrationsContent = migrationFiles
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n');

    // Key columns that must exist in migrations for endpoints
    const requiredColumns = [
      'id',
      'workspace_id',
      'url',
      'description',
      'secret',
      'event_types',
      'is_active',
      'fanout_enabled',
      'rate_limit_per_second',
      'metadata',
      'custom_headers',
      'ip_whitelist',
      'created_at',
      'updated_at',
    ];

    for (const col of requiredColumns) {
      expect(migrationsContent, `Missing column "${col}" in endpoints table`).includes(col);
    }
  });

  it('deliveries table has all expected columns', () => {
    const migrationsContent = migrationFiles
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n');

    // Key columns that must exist in migrations for deliveries
    const requiredColumns = [
      'id',
      'event_id',
      'endpoint_id',
      'workspace_id',
      'attempt_number',
      'status',
      'priority',
      'response_status_code',
      'response_body',
      'response_headers',
      'error_message',
      'duration_ms',
      'next_retry_at',
      'delivered_at',
      'created_at',
    ];

    for (const col of requiredColumns) {
      expect(migrationsContent, `Missing column "${col}" in deliveries table`).includes(col);
    }
  });

  it('events table has all expected columns', () => {
    const migrationsContent = migrationFiles
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n');

    const requiredColumns = [
      'id',
      'workspace_id',
      'event_type',
      'payload',
      'headers',
      'source_ip',
      'received_at',
      'processed_at',
      'status',
    ];

    for (const col of requiredColumns) {
      expect(migrationsContent, `Missing column "${col}" in events table`).includes(col);
    }
  });

  it('routing_rules table exists with all columns', () => {
    const migrationsContent = migrationFiles
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n');

    const requiredColumns = [
      'id',
      'workspace_id',
      'name',
      'priority',
      'conditions',
      'action_type',
      'action_endpoint_id',
      'action_transform',
      'enabled',
      'created_at',
      'updated_at',
    ];

    for (const col of requiredColumns) {
      expect(migrationsContent, `Missing column "${col}" in routing_rules table`).includes(col);
    }
  });
});
