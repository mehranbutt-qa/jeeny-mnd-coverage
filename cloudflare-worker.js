/**
 * Cloudflare Worker — TestRail CORS Proxy
 * 
 * Deploy this at: https://workers.cloudflare.com (free account)
 * 
 * Steps:
 * 1. Go to https://workers.cloudflare.com and sign up (free)
 * 2. Click "Create Worker"
 * 3. Replace the default code with this entire file
 * 4. Click "Save and Deploy"
 * 5. Copy your worker URL (e.g. https://testrail-proxy.YOUR-NAME.workers.dev)
 * 6. In the presentation, click Refresh → paste that URL as the Proxy URL
 */

const TESTRAIL_HOST = 'jeeny1.testrail.io';

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/ping') {
      return Response.json({ ok: true, proxy: 'TestRail Cloudflare Worker' }, { headers: corsHeaders });
    }

    // Forward to TestRail
    const targetUrl = `https://${TESTRAIL_HOST}${url.pathname}${url.search}`;

    const trResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    const body = await trResponse.text();

    return new Response(body, {
      status: trResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  },
};
