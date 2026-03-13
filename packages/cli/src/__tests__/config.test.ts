import { describe, expect, it, vi } from 'vitest';
import { type Config, getApiKey } from '../config.js';

describe('getApiKey', () => {
  it('prefers env var over config', () => {
    vi.stubEnv('HOOKWING_API_KEY', 'env-key-123');
    const config: Config = {
      apiKey: 'config-key-456',
      baseUrl: 'https://api.hookwing.com',
      format: 'table',
    };
    expect(getApiKey(config)).toBe('env-key-123');
    vi.unstubAllEnvs();
  });

  it('falls back to config apiKey when env not set', () => {
    vi.stubEnv('HOOKWING_API_KEY', '');
    const config: Config = {
      apiKey: 'config-key-789',
      baseUrl: 'https://api.hookwing.com',
      format: 'table',
    };
    expect(getApiKey(config)).toBe('config-key-789');
    vi.unstubAllEnvs();
  });

  it('returns undefined when no key available', () => {
    vi.stubEnv('HOOKWING_API_KEY', '');
    const config: Config = {
      apiKey: '',
      baseUrl: 'https://api.hookwing.com',
      format: 'table',
    };
    expect(getApiKey(config)).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('handles missing env var gracefully', () => {
    vi.stubEnv('HOOKWING_API_KEY', '');
    const config: Config = {
      apiKey: 'fallback-key',
      baseUrl: 'https://api.hookwing.com',
      format: 'table',
    };
    expect(getApiKey(config)).toBe('fallback-key');
  });
});
