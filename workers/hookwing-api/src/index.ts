/**
 * Hookwing API - Webhook Infrastructure
 * 
 * Endpoints:
 * - POST /webhooks - Create a new webhook delivery
 * - GET /webhooks/:id - Get webhook status
 * - GET /health - Health check
 */

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (path === '/health' || path === '/health/') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      version: 'v1',
      environment: 'staging'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (path === '/' || path === '') {
    return new Response(JSON.stringify({
      name: 'Hookwing API',
      version: 'v1',
      docs: 'https://hookwing.com/docs'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if ((path === '/v1/webhooks' || path === '/v1/webhooks/') && request.method === 'POST') {
    try {
      const body = await request.json();
      const { destination, event, payload } = body;
      
      if (!destination) {
        return new Response(JSON.stringify({ error: 'destination is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const webhook = {
        id: 'wh_' + crypto.randomUUID(),
        destination,
        event: event || 'webhook',
        payload: payload || {},
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      
      return new Response(JSON.stringify(webhook), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (path.startsWith('/v1/webhooks/') && request.method === 'GET') {
    const id = path.split('/v1/webhooks/')[1];
    
    return new Response(JSON.stringify({
      id,
      status: 'delivered',
      attempts: [
        { status: 'delivered', code: 200, timestamp: new Date().toISOString() }
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
