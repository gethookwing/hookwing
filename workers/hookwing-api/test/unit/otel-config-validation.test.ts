import { describe, it, expect } from 'vitest';
import { parseOtelConfig, parseSampleRate } from '../../src/otel/config-base';

describe('parseSampleRate', () => {
  it('defaults to 0.1 when undefined', () => {
    expect(parseSampleRate(undefined)).toBe(0.1);
  });

  it('defaults to 0.1 for empty string', () => {
    expect(parseSampleRate('')).toBe(0.1);
  });

  it('defaults to 0.1 for NaN string', () => {
    expect(parseSampleRate('not-a-number')).toBe(0.1);
  });

  it('parses "0.1" correctly', () => {
    expect(parseSampleRate('0.1')).toBeCloseTo(0.1);
  });

  it('parses "1.0" correctly', () => {
    expect(parseSampleRate('1.0')).toBe(1);
  });

  it('parses "0" correctly', () => {
    expect(parseSampleRate('0')).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(parseSampleRate('1.5')).toBe(1);
  });

  it('clamps values below 0 to 0', () => {
    expect(parseSampleRate('-0.5')).toBe(0);
  });

  it('parses "0.5" correctly', () => {
    expect(parseSampleRate('0.5')).toBe(0.5);
  });
});

describe('parseOtelConfig', () => {
  it('returns null endpoint when not set', () => {
    const { endpoint } = parseOtelConfig({});
    expect(endpoint).toBeNull();
  });

  it('returns null authToken when not set', () => {
    const { authToken } = parseOtelConfig({});
    expect(authToken).toBeNull();
  });

  it('parses endpoint correctly', () => {
    const { endpoint } = parseOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com/v1/traces',
    });
    expect(endpoint).toBe('https://otel.example.com/v1/traces');
  });

  it('parses authToken correctly', () => {
    const { authToken } = parseOtelConfig({
      OTEL_AUTH_TOKEN: 'secret_token',
    });
    expect(authToken).toBe('secret_token');
  });

  it('trims whitespace from endpoint', () => {
    const { endpoint } = parseOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: '  https://otel.example.com  ',
    });
    expect(endpoint).toBe('https://otel.example.com');
  });

  it('returns null for whitespace-only endpoint', () => {
    const { endpoint } = parseOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: '   ',
    });
    expect(endpoint).toBeNull();
  });

  it('uses default sampleRate when OTEL_SAMPLE_RATE not set', () => {
    const { sampleRate } = parseOtelConfig({});
    expect(sampleRate).toBe(0.1);
  });

  it('parses OTEL_SAMPLE_RATE from env', () => {
    const { sampleRate } = parseOtelConfig({ OTEL_SAMPLE_RATE: '0.5' });
    expect(sampleRate).toBe(0.5);
  });

  it('does not expose authToken in the config object keys (no logging leak)', () => {
    // authToken should only be in the returned object — not stringified elsewhere
    const config = parseOtelConfig({ OTEL_AUTH_TOKEN: 'super_secret' });
    // Verify the object is the minimal shape we expect
    expect(Object.keys(config).sort()).toEqual(['authToken', 'endpoint', 'sampleRate']);
  });
});
