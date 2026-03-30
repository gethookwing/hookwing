import { describe, it, expect } from 'vitest';
import {
  buildIngestAttributeBag,
  buildAuthAttributeBag,
  buildValidateAttributeBag,
  buildDeliveryAttemptAttributeBag,
} from '../../src/otel/spans';

describe('buildIngestAttributeBag', () => {
  it('includes required attributes for a successful ingest', () => {
    const bag = buildIngestAttributeBag({
      eventId: 'evt_abc123',
      eventType: 'order.created',
      responseStatusCode: 201,
    });
    expect(bag['hookwing.event_id']).toBe('evt_abc123');
    expect(bag['hookwing.event_type']).toBe('order.created');
    expect(bag['http.request.method']).toBe('POST');
    expect(bag['http.response.status_code']).toBe(201);
  });

  it('includes optional sourceId when provided', () => {
    const bag = buildIngestAttributeBag({
      eventId: 'evt_abc',
      eventType: 'ping',
      responseStatusCode: 201,
      sourceId: 'src_xyz',
    });
    expect(bag['hookwing.source_id']).toBe('src_xyz');
  });

  it('omits sourceId when not provided', () => {
    const bag = buildIngestAttributeBag({
      eventId: 'evt_abc',
      eventType: 'ping',
      responseStatusCode: 201,
    });
    expect('hookwing.source_id' in bag).toBe(false);
  });

  it('includes requestBodySize when provided', () => {
    const bag = buildIngestAttributeBag({
      eventId: 'evt_abc',
      eventType: 'ping',
      responseStatusCode: 201,
      requestBodySize: 512,
    });
    expect(bag['http.request.body.size']).toBe(512);
  });

  it('includes fanoutCount when provided', () => {
    const bag = buildIngestAttributeBag({
      eventId: 'evt_abc',
      eventType: 'ping',
      responseStatusCode: 201,
      fanoutCount: 3,
    });
    expect(bag['hookwing.fanout_count']).toBe(3);
  });

  it('event_id matches evt_ prefix pattern', () => {
    const bag = buildIngestAttributeBag({
      eventId: 'evt_deadbeef1234567890abcdef12345678',
      eventType: 'test',
      responseStatusCode: 201,
    });
    expect(String(bag['hookwing.event_id'])).toMatch(/^evt_/);
  });
});

describe('buildAuthAttributeBag', () => {
  it('sets auth.success=true for successful auth', () => {
    const bag = buildAuthAttributeBag({ success: true });
    expect(bag['hookwing.auth.success']).toBe(true);
  });

  it('sets auth.success=false for failed auth', () => {
    const bag = buildAuthAttributeBag({ success: false });
    expect(bag['hookwing.auth.success']).toBe(false);
  });

  it('includes workspaceId when provided', () => {
    const bag = buildAuthAttributeBag({ success: true, workspaceId: 'ws_123' });
    expect(bag['hookwing.workspace_id']).toBe('ws_123');
  });

  it('includes tier when provided', () => {
    const bag = buildAuthAttributeBag({ success: true, tier: 'stealth_jet' });
    expect(bag['hookwing.tier']).toBe('stealth_jet');
  });

  it('omits workspaceId and tier when not provided', () => {
    const bag = buildAuthAttributeBag({ success: true });
    expect('hookwing.workspace_id' in bag).toBe(false);
    expect('hookwing.tier' in bag).toBe(false);
  });
});

describe('buildValidateAttributeBag', () => {
  it('sets all required fields for valid event', () => {
    const bag = buildValidateAttributeBag({
      eventId: 'evt_abc',
      eventType: 'order.created',
      payloadSize: 256,
      valid: true,
    });
    expect(bag['hookwing.event_id']).toBe('evt_abc');
    expect(bag['hookwing.event_type']).toBe('order.created');
    expect(bag['hookwing.event.payload_size']).toBe(256);
    expect(bag['hookwing.event.valid']).toBe(true);
  });

  it('includes validation_error when invalid', () => {
    const bag = buildValidateAttributeBag({
      eventId: 'evt_abc',
      eventType: 'bad.event',
      payloadSize: 10,
      valid: false,
      validationError: 'missing required field: type',
    });
    expect(bag['hookwing.event.valid']).toBe(false);
    expect(bag['hookwing.event.validation_error']).toBe('missing required field: type');
  });

  it('omits validation_error when valid', () => {
    const bag = buildValidateAttributeBag({
      eventId: 'evt_abc',
      eventType: 'ping',
      payloadSize: 5,
      valid: true,
    });
    expect('hookwing.event.validation_error' in bag).toBe(false);
  });
});

describe('buildDeliveryAttemptAttributeBag', () => {
  it('sets all required attributes for a successful delivery', () => {
    const bag = buildDeliveryAttemptAttributeBag({
      endpointId: 'ep_111',
      deliveryId: 'del_222',
      attempt: 1,
      responseStatusCode: 200,
      durationMs: 150,
      success: true,
    });
    expect(bag['hookwing.endpoint_id']).toBe('ep_111');
    expect(bag['hookwing.delivery_id']).toBe('del_222');
    expect(bag['hookwing.delivery_attempt']).toBe(1);
    expect(bag['http.response.status_code']).toBe(200);
    expect(bag['hookwing.delivery.duration_ms']).toBe(150);
    expect(bag['hookwing.delivery.success']).toBe(true);
  });

  it('includes error.type on failure', () => {
    const bag = buildDeliveryAttemptAttributeBag({
      endpointId: 'ep_111',
      deliveryId: 'del_222',
      attempt: 2,
      responseStatusCode: 500,
      durationMs: 3000,
      success: false,
      errorType: 'http_5xx',
    });
    expect(bag['hookwing.delivery.success']).toBe(false);
    expect(bag['error.type']).toBe('http_5xx');
  });

  it('omits error.type on success', () => {
    const bag = buildDeliveryAttemptAttributeBag({
      endpointId: 'ep_111',
      deliveryId: 'del_222',
      attempt: 1,
      responseStatusCode: 200,
      durationMs: 50,
      success: true,
    });
    expect('error.type' in bag).toBe(false);
  });

  it('records timeout error type', () => {
    const bag = buildDeliveryAttemptAttributeBag({
      endpointId: 'ep_111',
      deliveryId: 'del_333',
      attempt: 3,
      responseStatusCode: 0,
      durationMs: 30000,
      success: false,
      errorType: 'timeout',
    });
    expect(bag['error.type']).toBe('timeout');
  });
});
