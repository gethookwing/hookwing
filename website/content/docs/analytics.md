---
title: "Analytics API"
slug: "analytics"
summary: "Track webhook volume, delivery success rates, and usage against your tier limits with the analytics endpoints."
updatedAt: "2026-04-03"
---

## Overview

The analytics API provides usage metrics for your workspace — daily event volume, delivery success rates, and tier usage. Use it to monitor your webhook infrastructure, build internal dashboards, or track usage against your plan limits.

**Available on all tiers.** Data retention: 30 days (Warbird), 90 days (Stealth Jet).

## Daily Usage

Get day-by-day usage statistics for your workspace.

```bash
curl https://api.hookwing.com/v1/analytics/usage \
  -H "Authorization: Bearer hk_live_your_key"
```

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 30 | Number of days to look back (1–90) |

Response:

```json
{
  "workspace": {
    "id": "ws_abc123",
    "tier": "warbird"
  },
  "period": {
    "days": 30,
    "since": "2026-03-04"
  },
  "totals": {
    "eventsReceived": 12450,
    "deliveriesAttempted": 14200,
    "deliveriesSucceeded": 13900,
    "deliveriesFailed": 300,
    "deliverySuccessRate": 97.89
  },
  "daily": [
    {
      "date": "2026-04-03",
      "eventsReceived": 415,
      "deliveriesAttempted": 480,
      "deliveriesSucceeded": 470,
      "deliveriesFailed": 10
    }
  ]
}
```

### Metrics Explained

| Metric | Description |
|--------|-------------|
| `eventsReceived` | Total events ingested via the ingest URL |
| `deliveriesAttempted` | Total delivery HTTP requests made (including retries) |
| `deliveriesSucceeded` | Deliveries that received a 2xx response |
| `deliveriesFailed` | Deliveries that failed (non-2xx or network error) |
| `deliverySuccessRate` | Percentage of successful deliveries (0–100, two decimal places) |

## Usage Summary

Get a quick snapshot of today's usage and monthly quota consumption.

```bash
curl https://api.hookwing.com/v1/analytics/summary \
  -H "Authorization: Bearer hk_live_your_key"
```

Response:

```json
{
  "today": {
    "eventsReceived": 415,
    "deliveriesAttempted": 480,
    "deliveriesSucceeded": 470,
    "deliveriesFailed": 10
  },
  "month": {
    "eventsReceived": 12450,
    "limit": 500000,
    "percentUsed": 2.49
  },
  "tier": {
    "slug": "warbird",
    "name": "Warbird",
    "limits": {
      "max_events_per_month": 500000,
      "max_endpoints": 10,
      "max_payload_size_bytes": 65536,
      "rate_limit_per_second": 50,
      "retention_days": 30
    }
  }
}
```

The `month.percentUsed` field tells you how close you are to your tier's monthly event limit — useful for alerting or automated upgrade decisions.

## Use Cases

### Monitor delivery health

Poll the summary endpoint periodically to check your delivery success rate. Alert when it drops below your threshold:

```bash
# Check success rate in the last 7 days
curl "https://api.hookwing.com/v1/analytics/usage?days=7" \
  -H "Authorization: Bearer hk_live_your_key"
```

### Track usage for billing

Use the summary endpoint to monitor monthly event consumption and trigger alerts before hitting your tier limit.

### Build internal dashboards

Fetch daily usage data and pipe it into your monitoring stack (Grafana, Datadog, or a custom dashboard).

## Required Scopes

| Operation | Scope |
|-----------|-------|
| View usage and summary | `analytics:read` |
