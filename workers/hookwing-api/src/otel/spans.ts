import { SpanStatusCode, type Span } from '@opentelemetry/api';

// ── Ingest span attributes ────────────────────────────────────────────────────

export interface IngestAttrs {
  eventId: string;
  eventType: string;
  sourceId?: string;
  requestBodySize?: number;
  responseStatusCode: number;
  fanoutCount?: number;
}

export function setIngestAttributes(span: Span, attrs: IngestAttrs): void {
  span.setAttribute('hookwing.event_id', attrs.eventId);
  span.setAttribute('hookwing.event_type', attrs.eventType);
  if (attrs.sourceId) span.setAttribute('hookwing.source_id', attrs.sourceId);
  if (attrs.requestBodySize !== undefined) {
    span.setAttribute('http.request.body.size', attrs.requestBodySize);
  }
  span.setAttribute('http.request.method', 'POST');
  span.setAttribute('http.response.status_code', attrs.responseStatusCode);
  if (attrs.fanoutCount !== undefined) {
    span.setAttribute('hookwing.fanout_count', attrs.fanoutCount);
  }
  if (attrs.responseStatusCode >= 400) {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
}

// ── Auth verify span attributes ───────────────────────────────────────────────

export interface AuthAttrs {
  workspaceId?: string;
  tier?: string;
  success: boolean;
}

export function setAuthAttributes(span: Span, attrs: AuthAttrs): void {
  if (attrs.workspaceId) span.setAttribute('hookwing.workspace_id', attrs.workspaceId);
  if (attrs.tier) span.setAttribute('hookwing.tier', attrs.tier);
  span.setAttribute('hookwing.auth.success', attrs.success);
  if (!attrs.success) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'auth failed' });
  }
}

// ── Event validate span attributes ───────────────────────────────────────────

export interface ValidateAttrs {
  eventId: string;
  eventType: string;
  payloadSize: number;
  valid: boolean;
  validationError?: string;
}

export function setValidateAttributes(span: Span, attrs: ValidateAttrs): void {
  span.setAttribute('hookwing.event_id', attrs.eventId);
  span.setAttribute('hookwing.event_type', attrs.eventType);
  span.setAttribute('hookwing.event.payload_size', attrs.payloadSize);
  span.setAttribute('hookwing.event.valid', attrs.valid);
  if (!attrs.valid && attrs.validationError) {
    span.setAttribute('hookwing.event.validation_error', attrs.validationError);
    span.setStatus({ code: SpanStatusCode.ERROR, message: attrs.validationError });
  }
}

// ── Delivery attempt span attributes ─────────────────────────────────────────

export interface DeliveryAttemptAttrs {
  endpointId: string;
  deliveryId: string;
  attempt: number;
  responseStatusCode: number;
  durationMs: number;
  success: boolean;
  errorType?: string;
}

export function setDeliveryAttemptAttributes(span: Span, attrs: DeliveryAttemptAttrs): void {
  span.setAttribute('hookwing.endpoint_id', attrs.endpointId);
  span.setAttribute('hookwing.delivery_id', attrs.deliveryId);
  span.setAttribute('hookwing.delivery_attempt', attrs.attempt);
  span.setAttribute('http.response.status_code', attrs.responseStatusCode);
  span.setAttribute('hookwing.delivery.duration_ms', attrs.durationMs);
  span.setAttribute('hookwing.delivery.success', attrs.success);
  if (!attrs.success) {
    if (attrs.errorType) span.setAttribute('error.type', attrs.errorType);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: attrs.errorType ?? 'delivery failed',
    });
  }
}

// ── Build attribute bags for testing (no Span dependency) ────────────────────

export function buildIngestAttributeBag(attrs: IngestAttrs): Record<string, unknown> {
  const bag: Record<string, unknown> = {
    'hookwing.event_id': attrs.eventId,
    'hookwing.event_type': attrs.eventType,
    'http.request.method': 'POST',
    'http.response.status_code': attrs.responseStatusCode,
  };
  if (attrs.sourceId) bag['hookwing.source_id'] = attrs.sourceId;
  if (attrs.requestBodySize !== undefined) bag['http.request.body.size'] = attrs.requestBodySize;
  if (attrs.fanoutCount !== undefined) bag['hookwing.fanout_count'] = attrs.fanoutCount;
  return bag;
}

export function buildAuthAttributeBag(attrs: AuthAttrs): Record<string, unknown> {
  const bag: Record<string, unknown> = {
    'hookwing.auth.success': attrs.success,
  };
  if (attrs.workspaceId) bag['hookwing.workspace_id'] = attrs.workspaceId;
  if (attrs.tier) bag['hookwing.tier'] = attrs.tier;
  return bag;
}

export function buildValidateAttributeBag(attrs: ValidateAttrs): Record<string, unknown> {
  const bag: Record<string, unknown> = {
    'hookwing.event_id': attrs.eventId,
    'hookwing.event_type': attrs.eventType,
    'hookwing.event.payload_size': attrs.payloadSize,
    'hookwing.event.valid': attrs.valid,
  };
  if (!attrs.valid && attrs.validationError) {
    bag['hookwing.event.validation_error'] = attrs.validationError;
  }
  return bag;
}

export function buildDeliveryAttemptAttributeBag(
  attrs: DeliveryAttemptAttrs
): Record<string, unknown> {
  const bag: Record<string, unknown> = {
    'hookwing.endpoint_id': attrs.endpointId,
    'hookwing.delivery_id': attrs.deliveryId,
    'hookwing.delivery_attempt': attrs.attempt,
    'http.response.status_code': attrs.responseStatusCode,
    'hookwing.delivery.duration_ms': attrs.durationMs,
    'hookwing.delivery.success': attrs.success,
  };
  if (!attrs.success && attrs.errorType) bag['error.type'] = attrs.errorType;
  return bag;
}
