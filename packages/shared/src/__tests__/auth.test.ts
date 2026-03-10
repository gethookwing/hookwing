import { describe, expect, it } from 'vitest';
import {
  generateApiKey,
  generateId,
  hashApiKey,
  hashPassword,
  verifyApiKey,
  verifyPassword,
} from '../auth';

describe('generateApiKey', () => {
  it('should generate key with hk_live_ prefix', async () => {
    const { key } = await generateApiKey();
    expect(key).toMatch(/^hk_live_[a-zA-Z0-9]{32}$/);
  });

  it('should generate unique keys', async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { key } = await generateApiKey();
      keys.add(key);
    }
    expect(keys.size).toBe(100); // All unique
  });

  it('should return prefix of 12 characters', async () => {
    const { key, prefix } = await generateApiKey();
    expect(prefix).toBe(key.substring(0, 12));
    expect(prefix).toMatch(/^hk_live_[a-zA-Z0-9]{4}$/);
  });

  it('should return valid SHA-256 hash', async () => {
    const { key, hash } = await generateApiKey();
    const expectedHash = await hashApiKey(key);
    expect(hash).toBe(expectedHash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('hashApiKey', () => {
  it('should return SHA-256 hash in hex format', async () => {
    const hash = await hashApiKey('test-key');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce consistent hashes for same input', async () => {
    const key = 'test-key-123';
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await hashApiKey('key-1');
    const hash2 = await hashApiKey('key-2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyApiKey', () => {
  it('should return true for matching key and hash', async () => {
    const { key, hash } = await generateApiKey();
    const isValid = await verifyApiKey(key, hash);
    expect(isValid).toBe(true);
  });

  it('should return false for non-matching key and hash', async () => {
    const { hash } = await generateApiKey();
    const isValid = await verifyApiKey('wrong-key', hash as string);
    expect(isValid).toBe(false);
  });

  it('should return false for tampered hash', async () => {
    const { key, hash } = await generateApiKey();
    const tamperedHash = `${(hash as string).slice(0, -2)}ff`;
    const isValid = await verifyApiKey(key, tamperedHash);
    expect(isValid).toBe(false);
  });
});

describe('hashPassword', () => {
  it('should return a hash in salt:hash format', async () => {
    const hash = await hashPassword('testpassword');
    // Base64 can include = for padding
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
  });

  it('should produce different hashes for same password (due to random salt)', async () => {
    const hash1 = await hashPassword('testpassword');
    const hash2 = await hashPassword('testpassword');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different passwords', async () => {
    const hash1 = await hashPassword('password1');
    const hash2 = await hashPassword('password2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('should return true for correct password', async () => {
    const password = 'mysecurepassword';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should return false for incorrect password', async () => {
    const hash = await hashPassword('correctpassword');
    const isValid = await verifyPassword('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('should return false for tampered hash', async () => {
    const password = 'testpassword';
    const hash = await hashPassword(password);
    const tamperedHash = `${hash.slice(0, -2)}==`;
    const isValid = await verifyPassword(password, tamperedHash);
    expect(isValid).toBe(false);
  });

  it('should return false for malformed hash', async () => {
    const isValid = await verifyPassword('password', 'invalid-hash');
    expect(isValid).toBe(false);
  });
});

describe('generateId', () => {
  it('should generate ID with correct prefix', () => {
    const id = generateId('ws');
    expect(id).toMatch(/^ws_[a-zA-Z0-9]{16}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId('ws'));
    }
    expect(ids.size).toBe(100);
  });

  it('should work with different prefixes', () => {
    expect(generateId('key')).toMatch(/^key_[a-zA-Z0-9]{16}$/);
    expect(generateId('evt')).toMatch(/^evt_[a-zA-Z0-9]{16}$/);
    expect(generateId('ep')).toMatch(/^ep_[a-zA-Z0-9]{16}$/);
  });
});
