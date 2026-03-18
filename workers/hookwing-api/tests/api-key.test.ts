/**
 * API Key Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  getApiKeyPrefix,
  hashApiKey,
  hasScope,
  API_KEY_SCOPES,
  type ApiKey,
} from '../src/lib/auth';

describe('API Key Functions', () => {
  describe('generateApiKey', () => {
    it('should generate a key with hwk_ prefix', () => {
      const key = generateApiKey();

      expect(key.startsWith('hwk_')).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys with sufficient length', () => {
      const key = generateApiKey();

      // prefix (3) + underscore (1) + 32 random chars = 36 chars
      expect(key.length).toBeGreaterThanOrEqual(36);
    });
  });

  describe('getApiKeyPrefix', () => {
    it('should return first 12 characters', () => {
      const key = 'hwk_abc123def456ghi789jkl012mno345p';
      const prefix = getApiKeyPrefix(key);

      expect(prefix).toBe('hwk_abc123de');
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hash for same input', async () => {
      const key = 'test_key_123';
      const hash1 = await hashApiKey(key);
      const hash2 = await hashApiKey(key);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', async () => {
      const hash1 = await hashApiKey('key_1');
      const hash2 = await hashApiKey('key_2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string', async () => {
      const hash = await hashApiKey('test');

      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe('hasScope', () => {
    const keyWithRead: ApiKey = {
      id: 'ak_123',
      user_id: 'u_123',
      key_prefix: 'hwk_abc',
      key_hash: 'hash',
      name: 'Test Key',
      scopes: ['read'],
      last_used_at: null,
      expires_at: null,
      created_at: Date.now(),
      revoked_at: 0,
    };

    const keyWithReadWrite: ApiKey = {
      ...keyWithRead,
      scopes: ['read', 'write'],
    };

    const keyWithAllScopes: ApiKey = {
      ...keyWithRead,
      scopes: ['read', 'write', 'admin'],
    };

    it('should return true when key has required scope', () => {
      expect(hasScope(keyWithRead, ['read'])).toBe(true);
      expect(hasScope(keyWithReadWrite, ['write'])).toBe(true);
    });

    it('should return true when key has all required scopes', () => {
      expect(hasScope(keyWithAllScopes, ['read', 'write', 'admin'])).toBe(true);
    });

    it('should return false when key lacks required scope', () => {
      expect(hasScope(keyWithRead, ['write'])).toBe(false);
      expect(hasScope(keyWithRead, ['admin'])).toBe(false);
    });

    it('should return false when key does not have all required scopes', () => {
      expect(hasScope(keyWithReadWrite, ['read', 'admin'])).toBe(false);
    });

    it('should return false when key has empty scopes', () => {
      const emptyKey = { ...keyWithRead, scopes: [] };
      expect(hasScope(emptyKey, ['read'])).toBe(false);
    });
  });

  describe('API_KEY_SCOPES', () => {
    it('should have read scope', () => {
      expect(API_KEY_SCOPES.READ).toBe('read');
    });

    it('should have write scope', () => {
      expect(API_KEY_SCOPES.WRITE).toBe('write');
    });

    it('should have admin scope', () => {
      expect(API_KEY_SCOPES.ADMIN).toBe('admin');
    });
  });
});
