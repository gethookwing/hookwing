/**
 * PROD-157: IP Whitelist Tests
 *
 * Tests for IP whitelist feature on endpoint delivery.
 * Tier-gated: only Fighter Jet tier can use IP whitelist.
 */

import { endpointCreateSchema, endpointUpdateSchema, validateIpWhitelist } from '@hookwing/shared';
import { describe, expect, it } from 'vitest';

describe('validateIpWhitelist', () => {
  it('should accept empty array', () => {
    const result = validateIpWhitelist([]);
    expect(result.valid).toBe(true);
  });

  it('should accept undefined', () => {
    const result = validateIpWhitelist(undefined);
    expect(result.valid).toBe(true);
  });

  it('should accept valid IPv4 addresses', () => {
    const result = validateIpWhitelist(['192.168.1.1', '10.0.0.1']);
    expect(result.valid).toBe(true);
  });

  it('should accept valid IPv6 addresses', () => {
    const result = validateIpWhitelist(['::1', '2001:db8::1']);
    expect(result.valid).toBe(true);
  });

  it('should accept CIDR notation IPv4', () => {
    const result = validateIpWhitelist(['192.168.1.0/24', '10.0.0.0/8']);
    expect(result.valid).toBe(true);
  });

  it('should reject more than 50 IPs', () => {
    const ips: string[] = [];
    for (let i = 0; i < 51; i++) {
      ips.push(`192.168.1.${i}`);
    }
    const result = validateIpWhitelist(ips);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(!result.valid && result.error).toBe('Maximum 50 IP addresses allowed');
    }
  });

  it('should reject invalid IP addresses', () => {
    const result = validateIpWhitelist(['invalid-ip', '256.256.256.256']);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(!result.valid && result.error).toContain('Invalid IP address');
    }
  });

  it('should reject invalid CIDR prefix', () => {
    const result = validateIpWhitelist(['192.168.1.0/33']);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(!result.valid && result.error).toContain('Invalid IP address');
    }
  });
});

describe('endpointCreateSchema', () => {
  it('should accept valid ipWhitelist', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      ipWhitelist: ['192.168.1.1', '10.0.0.0/8'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty ipWhitelist', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      ipWhitelist: [],
    });
    expect(result.success).toBe(true);
  });

  it('should accept no ipWhitelist', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
    });
    expect(result.success).toBe(true);
  });
});

describe('endpointUpdateSchema', () => {
  it('should accept valid ipWhitelist', () => {
    const result = endpointUpdateSchema.safeParse({
      ipWhitelist: ['192.168.1.1'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept null ipWhitelist to clear', () => {
    const result = endpointUpdateSchema.safeParse({
      ipWhitelist: null,
    });
    expect(result.success).toBe(true);
  });
});
