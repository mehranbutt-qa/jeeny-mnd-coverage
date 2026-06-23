/**
 * proxy.js — Local CORS proxy for TestRail
 * Runs a tiny HTTP server on localhost:3131 that forwards requests to TestRail.
 * This bypasses the browser's CORS restriction when opening presentation.html locally.
 *
 * Usage:
 *   node proxy.js
 *
 * Then open presentation.html and click "Refresh from TestRail".
 * The proxy URL will be pre-filled automatically: http://localhost:3131
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT = 3131;
const TESTRAIL_HOST = 'jeeny1.testrail.io';

const server = http.createServer((req, res) => {
  // CORS headers — allow the browser to call us
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, proxy: 'TestRail CORS Proxy', port: PORT }));
    return;
  }

  // Forward everything else to TestRail
  // Expected: /index.php?/api/v2/...
  const parsed   = url.parse(req.url);
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing Authorization header' }));
    return;
  }

  const options = {
    hostname: TESTRAIL_HOST,
    path:     req.url,   // pass through as-is
    method:   req.method,
    headers: {
      'Authorization':  authHeader,
      'Content-Type':   'application/json',
      'User-Agent':     'MnD-Coverage-Dashboard/1.0',
    },
  };

  const proxy = https.request(options, (trRes) => {
    res.writeHead(trRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    trRes.pipe(res, { end: true });
  });

  proxy.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
  });

  req.pipe(proxy, { end: true });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ✅ TestRail CORS Proxy running');
  console.log(`  👉 http://localhost:${PORT}`);
  console.log('');
  console.log('  Open presentation.html in your browser,');
  console.log('  then click "🔄 Refresh from TestRail".');
  console.log('  The proxy URL is pre-filled automatically.');
  console.log('');
  console.log('  Press Ctrl+C to stop.');
});
