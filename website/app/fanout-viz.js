/**
 * FanoutViz - Real-time fan-out flow diagram visualization
 * Renders one inbound event routing to N endpoints simultaneously
 */
class FanoutViz {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      demoMode: true,
      ...options
    };
    this.resizeObserver = null;
    this.retryInterval = null;
    this.timestampInterval = null;
    this.eventData = null;

    this.init();
  }

  init() {
    if (this.options.demoMode) {
      this.render(this.getDemoData());
    }
  }

  /**
   * Demo data for initialization
   */
  getDemoData() {
    return {
      id: 'evt_01j8kf3a2',
      type: 'payment.created',
      createdAt: new Date().toISOString(),
      deliveries: [
        { endpointId: 'ep-a', endpointUrl: 'api.orders.hookwing.com', status: 'delivered', attempts: 1, maxAttempts: 3, latencyMs: 48 },
        { endpointId: 'ep-b', endpointUrl: 'webhooks.crm.io/ingest', status: 'delivered', attempts: 1, maxAttempts: 3, latencyMs: 124 },
        { endpointId: 'ep-c', endpointUrl: 'notify.internal.dev/hook', status: 'retrying', attempts: 2, maxAttempts: 5, nextRetryAt: new Date(Date.now() + 15000).toISOString() },
        { endpointId: 'ep-d', endpointUrl: 'analytics.data.pipe/v2', status: 'failed', attempts: 3, maxAttempts: 3, movedToDlq: true }
      ]
    };
  }

  /**
   * Render the visualization with event data
   */
  render(eventData) {
    this.eventData = eventData;
    this.container.innerHTML = '';
    this.container.classList.add('fanout-viz');

    const layout = document.createElement('div');
    layout.className = 'fanout-layout';

    // Create SVG container for connectors (behind other elements)
    const svgContainer = document.createElement('div');
    svgContainer.className = 'fanout-connectors';
    svgContainer.setAttribute('aria-hidden', 'true');
    this.svgContainer = svgContainer;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    // Define arrow markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    const statuses = ['delivered', 'retrying', 'pending', 'failed'];
    statuses.forEach(status => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrowhead-${status}`);
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '6');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      path.setAttribute('points', '0 0, 7 3.5, 0 7');
      path.setAttribute('fill', this.getStatusColor(status));

      marker.appendChild(path);
      defs.appendChild(marker);
    });

    svg.appendChild(defs);
    svgContainer.appendChild(svg);
    layout.appendChild(svgContainer);

    // Event Node
    const eventNode = this.renderEventNode(eventData);
    const eventWrapper = document.createElement('div');
    eventWrapper.className = 'fanout-layout__event';
    eventWrapper.appendChild(eventNode);
    layout.appendChild(eventWrapper);

    // Dispatch Hub
    const hubNode = this.renderHub(eventData.deliveries.length);
    const hubWrapper = document.createElement('div');
    hubWrapper.className = 'fanout-layout__hub';
    hubWrapper.appendChild(hubNode);
    layout.appendChild(hubWrapper);

    // Endpoint Nodes
    const endpointsContainer = document.createElement('div');
    endpointsContainer.className = 'fanout-layout__endpoints';
    endpointsContainer.setAttribute('role', 'list');
    endpointsContainer.setAttribute('aria-label', 'Endpoint deliveries');

    eventData.deliveries.forEach((delivery, index) => {
      const endpointNode = this.renderEndpointNode(delivery, index);
      endpointsContainer.appendChild(endpointNode);
    });

    layout.appendChild(endpointsContainer);

    // Summary Bar
    const summary = this.renderSummary(eventData);
    layout.appendChild(summary);

    this.container.appendChild(layout);

    // Set up resize observer after render
    this.setupResizeObserver();

    // Start intervals for timestamps and retry countdown
    this.startIntervals(eventData);
  }

  /**
   * Render the event node
   */
  renderEventNode(eventData) {
    const node = document.createElement('div');
    node.className = 'fanout-event';
    node.setAttribute('role', 'listitem');
    node.setAttribute('aria-label', `Event: ${eventData.type}`);

    const createdAt = new Date(eventData.createdAt);
    const ageSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
    const isLive = ageSeconds < 30;

    // LIVE badge
    if (isLive) {
      const liveBadge = document.createElement('div');
      liveBadge.className = 'fanout-event__live';
      liveBadge.setAttribute('aria-label', 'Live event');

      const dot = document.createElement('span');
      dot.className = 'fanout-event__live-dot';

      liveBadge.appendChild(dot);
      liveBadge.appendChild(document.createTextNode('LIVE'));
      node.appendChild(liveBadge);
    }

    // Event type
    const typeEl = document.createElement('div');
    typeEl.className = 'fanout-event__type';
    typeEl.textContent = eventData.type.length > 22 ? eventData.type.slice(0, 22) + '…' : eventData.type;
    typeEl.setAttribute('title', eventData.type);
    node.appendChild(typeEl);

    // Event ID
    const idEl = document.createElement('div');
    idEl.className = 'fanout-event__id';
    idEl.textContent = this.formatEventId(eventData.id);
    node.appendChild(idEl);

    // Timestamp
    const timestampEl = document.createElement('div');
    timestampEl.className = 'fanout-event__timestamp';
    timestampEl.dataset.timestamp = eventData.createdAt;
    timestampEl.textContent = this.formatRelativeTime(eventData.createdAt);
    node.appendChild(timestampEl);

    return node;
  }

  /**
   * Render the dispatch hub
   */
  renderHub(endpointCount) {
    const hub = document.createElement('div');
    hub.className = 'fanout-hub';
    hub.setAttribute('aria-label', `Dispatch hub: ${endpointCount} endpoints`);

    const circle = document.createElement('div');
    circle.className = 'fanout-hub__circle';

    const ring = document.createElement('div');
    ring.className = 'fanout-hub__ring';
    circle.appendChild(ring);

    // 8 radiating lines icon
    const icon = document.createElement('div');
    icon.className = 'fanout-hub__icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
      </svg>
    `;
    circle.appendChild(icon);
    hub.appendChild(circle);

    const labels = document.createElement('div');
    labels.className = 'fanout-hub__label';

    const mainLabel = document.createElement('div');
    mainLabel.className = 'fanout-hub__label-main';
    mainLabel.textContent = 'fan-out';
    labels.appendChild(mainLabel);

    const countLabel = document.createElement('div');
    countLabel.className = 'fanout-hub__label-count';
    countLabel.textContent = `${endpointCount} endpoint${endpointCount !== 1 ? 's' : ''}`;
    labels.appendChild(countLabel);

    hub.appendChild(labels);

    return hub;
  }

  /**
   * Render an endpoint node
   */
  renderEndpointNode(delivery, index) {
    const node = document.createElement('div');
    node.className = 'endpoint-node';
    node.setAttribute('role', 'listitem');
    node.setAttribute('aria-label', `${delivery.endpointUrl}: ${delivery.status}`);

    // Left accent bar
    const accent = document.createElement('div');
    accent.className = `endpoint-node__accent endpoint-node__accent--${delivery.status}`;
    node.appendChild(accent);

    // Status dot
    const dot = document.createElement('div');
    dot.className = `endpoint-node__status-dot endpoint-node__status-dot--${delivery.status}`;
    node.appendChild(dot);

    // Info section
    const info = document.createElement('div');
    info.className = 'endpoint-node__info';

    const name = document.createElement('div');
    name.className = 'endpoint-node__name';
    name.textContent = this.truncateUrl(delivery.endpointUrl, 28);
    name.setAttribute('title', delivery.endpointUrl);
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'endpoint-node__meta';

    const attemptText = document.createElement('span');
    attemptText.textContent = `attempt ${delivery.attempts}`;
    meta.appendChild(attemptText);

    if (delivery.latencyMs !== undefined && delivery.latencyMs !== null) {
      meta.appendChild(document.createTextNode(' · '));
      const latency = document.createElement('span');
      latency.textContent = `${delivery.latencyMs}ms`;
      meta.appendChild(latency);
    }

    // Add retry countdown if retrying
    if (delivery.status === 'retrying' && delivery.nextRetryAt) {
      meta.appendChild(document.createTextNode(' · '));
      const retryCountdown = document.createElement('span');
      retryCountdown.className = 'endpoint-node__retry-countdown';
      retryCountdown.dataset.nextRetry = delivery.nextRetryAt;
      retryCountdown.textContent = this.getRetryCountdown(delivery.nextRetryAt);
      meta.appendChild(retryCountdown);
    }

    info.appendChild(meta);
    node.appendChild(info);

    // Status badge
    const badge = document.createElement('div');
    badge.className = `endpoint-node__status-badge endpoint-node__status-badge--${delivery.status}`;
    badge.textContent = delivery.status;
    node.appendChild(badge);

    return node;
  }

  /**
   * Render the summary bar
   */
  renderSummary(eventData) {
    const summary = document.createElement('div');
    summary.className = 'fanout-summary';

    const deliveries = eventData.deliveries;
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    const retrying = deliveries.filter(d => d.status === 'retrying').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;
    const latencies = deliveries.filter(d => d.latencyMs !== undefined).map(d => d.latencyMs);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    // Stats section
    const stats = document.createElement('div');
    stats.className = 'fanout-summary__stats';

    // Delivered
    const deliveredStat = document.createElement('div');
    deliveredStat.className = 'fanout-summary__stat';
    deliveredStat.innerHTML = `
      <span class="fanout-summary__stat-dot fanout-summary__stat-dot--delivered"></span>
      <span>${delivered} delivered</span>
    `;
    stats.appendChild(deliveredStat);

    // Retryng
    if (retrying > 0) {
      const retryingStat = document.createElement('div');
      retryingStat.className = 'fanout-summary__stat';
      retryingStat.innerHTML = `
        <span class="fanout-summary__stat-dot fanout-summary__stat-dot--retrying"></span>
        <span>${retrying} retrying</span>
      `;
      stats.appendChild(retryingStat);
    }

    // Failed
    if (failed > 0) {
      const failedStat = document.createElement('div');
      failedStat.className = 'fanout-summary__stat';
      failedStat.innerHTML = `
        <span class="fanout-summary__stat-dot fanout-summary__stat-dot--failed"></span>
        <span>${failed} failed</span>
      `;
      stats.appendChild(failedStat);
    }

    // Avg latency
    if (avgLatency > 0) {
      const latencyStat = document.createElement('div');
      latencyStat.className = 'fanout-summary__stat';
      latencyStat.textContent = `avg ${avgLatency}ms`;
      stats.appendChild(latencyStat);
    }

    summary.appendChild(stats);

    // Event ID
    const idEl = document.createElement('div');
    idEl.className = 'fanout-summary__id';
    idEl.textContent = eventData.id;
    summary.appendChild(idEl);

    // Replay button
    const replayBtn = document.createElement('button');
    replayBtn.className = 'fanout-summary__replay';
    replayBtn.textContent = 'Replay all';
    replayBtn.setAttribute('aria-label', 'Replay all failed deliveries');
    summary.appendChild(replayBtn);

    return summary;
  }

  /**
   * Calculate and draw connector lines
   */
  drawConnectors() {
    const svg = this.svgContainer.querySelector('svg');
    if (!svg) return;

    // Clear existing paths
    const existingPaths = svg.querySelectorAll('path:not([id^="arrowhead"])');
    existingPaths.forEach(p => p.remove());

    const layout = this.container.querySelector('.fanout-layout');
    const hub = layout.querySelector('.fanout-hub__circle');
    const endpoints = layout.querySelectorAll('.endpoint-node');

    if (!hub || endpoints.length === 0) return;

    // Get hub position (center)
    const hubRect = hub.getBoundingClientRect();
    const layoutRect = layout.getBoundingClientRect();

    const hubX = hubRect.left - layoutRect.left + hubRect.width / 2;
    const hubY = hubRect.top - layoutRect.top + hubRect.height / 2;

    // Draw line from event to hub
    const eventNode = layout.querySelector('.fanout-event');
    if (eventNode) {
      const eventRect = eventNode.getBoundingClientRect();
      const eventX = eventRect.right - layoutRect.left;
      const eventY = eventRect.top - layoutRect.top + eventRect.height / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${eventX} ${eventY} C ${eventX + 40} ${eventY}, ${hubX - 40} ${hubY}, ${hubX} ${hubY}`;
      path.setAttribute('d', d);
      path.setAttribute('class', 'connector--delivered');
      svg.appendChild(path);
    }

    // Draw lines from hub to each endpoint
    endpoints.forEach((endpoint, index) => {
      const endpointRect = endpoint.getBoundingClientRect();
      const endpointX = endpointRect.left - layoutRect.left;
      const endpointY = endpointRect.top - layoutRect.top + endpointRect.height / 2;

      const delivery = this.eventData?.deliveries[index];
      const status = delivery?.status || 'pending';

      // Calculate control points for bezier curve
      const midX = (hubX + endpointX) / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${hubX} ${hubY} C ${midX} ${hubY}, ${midX} ${endpointY}, ${endpointX - 7} ${endpointY}`;
      path.setAttribute('d', d);
      path.setAttribute('class', `connector--${status}`);
      path.setAttribute('marker-end', `url(#arrowhead-${status})`);
      svg.appendChild(path);
    });

    // Set SVG size to match layout
    svg.setAttribute('width', layoutRect.width);
    svg.setAttribute('height', layoutRect.height);
  }

  /**
   * Set up resize observer
   */
  setupResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.drawConnectors();
    });

    this.resizeObserver.observe(this.container);
  }

  /**
   * Start intervals for updating timestamps and retry countdowns
   */
  startIntervals(eventData) {
    // Clear existing intervals
    if (this.retryInterval) clearInterval(this.retryInterval);
    if (this.timestampInterval) clearInterval(this.timestampInterval);

    // Update timestamps every second
    this.timestampInterval = setInterval(() => {
      const timestamps = this.container.querySelectorAll('[data-timestamp]');
      timestamps.forEach(el => {
        el.textContent = this.formatRelativeTime(el.dataset.timestamp);
      });

      // Update event node live status
      const createdAt = new Date(eventData.createdAt);
      const ageSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
      const liveBadge = this.container.querySelector('.fanout-event__live');

      if (ageSeconds >= 30 && liveBadge) {
        liveBadge.remove();
      }
    }, 1000);

    // Update retry countdowns
    this.retryInterval = setInterval(() => {
      const countdowns = this.container.querySelectorAll('.endpoint-node__retry-countdown');
      countdowns.forEach(el => {
        const nextRetry = el.dataset.nextRetry;
        if (nextRetry) {
          el.textContent = this.getRetryCountdown(nextRetry);
        }
      });
    }, 1000);
  }

  /**
   * Format event ID (evt_xxxxx…xxxx)
   */
  formatEventId(id) {
    if (id.length <= 12) return id;
    return `${id.slice(0, 7)}…${id.slice(-4)}`;
  }

  /**
   * Truncate URL for display
   */
  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength - 1) + '…';
  }

  /**
   * Format relative time
   */
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = Math.floor((now - time) / 1000);

    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  /**
   * Get retry countdown text
   */
  getRetryCountdown(nextRetryAt) {
    const now = Date.now();
    const nextRetry = new Date(nextRetryAt).getTime();
    const diff = Math.max(0, Math.floor((nextRetry - now) / 1000));

    if (diff <= 0) return 'retrying...';
    return `retry in ${diff}s`;
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    const colors = {
      delivered: '#009D64',
      retrying: '#FFC107',
      pending: '#94A3B8',
      failed: '#DC2626'
    };
    return colors[status] || colors.pending;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    if (this.timestampInterval) {
      clearInterval(this.timestampInterval);
    }
    this.container.innerHTML = '';
  }
}

// Export for use
window.FanoutViz = FanoutViz;
