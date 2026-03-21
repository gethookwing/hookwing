import { describe, expect, it } from 'vitest';
import { VALID_SCOPES, validateScopes } from '../scopes';

describe('VALID_SCOPES', () => {
  it('contains all expected scopes', () => {
    expect(VALID_SCOPES).toContain('workspace:read');
    expect(VALID_SCOPES).toContain('keys:read');
    expect(VALID_SCOPES).toContain('keys:write');
    expect(VALID_SCOPES).toContain('endpoints:read');
    expect(VALID_SCOPES).toContain('endpoints:write');
    expect(VALID_SCOPES).toContain('events:read');
    expect(VALID_SCOPES).toContain('events:write');
    expect(VALID_SCOPES).toContain('deliveries:read');
    expect(VALID_SCOPES).toContain('analytics:read');
  });

  it('has exactly 9 scopes', () => {
    expect(VALID_SCOPES).toHaveLength(9);
  });
});

describe('validateScopes', () => {
  it('returns empty array for all valid scopes', () => {
    expect(validateScopes(['endpoints:read', 'events:write'])).toEqual([]);
  });

  it('returns invalid scopes', () => {
    expect(validateScopes(['endpoints:read', 'admin:sudo'])).toEqual(['admin:sudo']);
  });

  it('returns all invalid when none match', () => {
    expect(validateScopes(['foo:bar', 'baz:qux'])).toEqual(['foo:bar', 'baz:qux']);
  });

  it('returns empty for empty input', () => {
    expect(validateScopes([])).toEqual([]);
  });
});
