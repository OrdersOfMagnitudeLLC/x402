const fs = require('fs');
const https = require('https');

const BASE_URL = 'https://x402-api-production-5133.up.railway.app';
const TIMEOUT_MS = 10000;

// Read OpenAPI spec to get all endpoints
const spec = JSON.parse(fs.readFileSync('./public/openapi.json', 'utf8'));

const endpoints = [];
Object.entries(spec.paths).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, op]) => {
    endpoints.push({
      method: method.toUpperCase(),
      path,
      summary: op.summary
    });
  });
});

console.log(`Testing ${endpoints.length} endpoints...\n`);

const results = {
  pass: [],
  broken: [],
  misconfigured: []
};

async function testEndpoint(endpoint) {
  const { method, path, summary } = endpoint;
  const url = `${BASE_URL}${path}`;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method,
      headers: {
        'User-Agent': 'x402-audit/1.0'
      },
      timeout: TIMEOUT_MS
    };

    const req = https.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        const result = {
          method,
          path,
          summary,
          status: res.statusCode,
          responseTime,
          body: body.substring(0, 500) // Truncate for logging
        };

        // Check for 402 with payment challenge
        if (res.statusCode === 402) {
          // 402 is the correct response for x402 payment required
          // The body format may vary, but 402 itself indicates the endpoint is working
          results.pass.push(result);
          console.log(`✓ PASS ${method} ${path} - ${res.statusCode} (${responseTime}ms)`);
        } else if (res.statusCode === 200) {
          results.misconfigured.push(result);
          console.log(`⚠ MISCONFIGURED ${method} ${path} - ${res.statusCode} (should be 402) (${responseTime}ms)`);
        } else if (res.statusCode === 500 || res.statusCode === 404) {
          results.broken.push(result);
          console.log(`✗ BROKEN ${method} ${path} - ${res.statusCode} (${responseTime}ms)`);
        } else {
          results.broken.push(result);
          console.log(`✗ BROKEN ${method} ${path} - ${res.statusCode} (unexpected) (${responseTime}ms)`);
        }

        resolve();
      });
    });

    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      const result = {
        method,
        path,
        summary,
        status: 'ERROR',
        responseTime,
        error: err.message
      };
      results.broken.push(result);
      console.log(`✗ BROKEN ${method} ${path} - ${err.message} (${responseTime}ms)`);
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      const result = {
        method,
        path,
        summary,
        status: 'TIMEOUT',
        responseTime
      };
      results.broken.push(result);
      console.log(`✗ BROKEN ${method} ${path} - TIMEOUT (${responseTime}ms)`);
      resolve();
    });

    // For POST requests, send empty body
    if (method === 'POST') {
      req.setHeader('Content-Type', 'application/json');
      req.write(JSON.stringify({ input: 'test' }));
    }

    req.end();
  });
}

async function runAudit() {
  // Test endpoints in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < endpoints.length; i += batchSize) {
    const batch = endpoints.slice(i, i + batchSize);
    await Promise.all(batch.map(testEndpoint));
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`PASS: ${results.pass.length}`);
  console.log(`BROKEN: ${results.broken.length}`);
  console.log(`MISCONFIGURED: ${results.misconfigured.length}`);

  if (results.broken.length > 0) {
    console.log('\nBROKEN ENDPOINTS:');
    results.broken.forEach(r => {
      console.log(`  ${r.method} ${r.path} - ${r.status} (${r.responseTime}ms)`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }

  if (results.misconfigured.length > 0) {
    console.log('\nMISCONFIGURED ENDPOINTS:');
    results.misconfigured.forEach(r => {
      console.log(`  ${r.method} ${r.path} - ${r.status} (${r.responseTime}ms)`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

runAudit().catch(console.error);
