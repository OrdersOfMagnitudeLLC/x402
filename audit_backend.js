const fs = require('fs');
const https = require('https');
const http = require('http');

const TIMEOUT_MS = 15000;

// Read products.json
const products = JSON.parse(fs.readFileSync('./products.json', 'utf8'));

// Filter to only products with route_path (the 90 live endpoints)
const liveProducts = products.filter(p => p.route_path);

console.log(`Testing ${liveProducts.length} upstream sources...\n`);

const results = {
  working: [],
  broken_key: [],
  broken_dead: [],
  broken_error: []
};

async function testUpstream(product) {
  const { id, name, source_url, route_path } = product;
  const startTime = Date.now();

  // Skip if source_url is not a real URL
  if (!source_url || !source_url.startsWith('http')) {
    const result = {
      id,
      name,
      route_path,
      source_url,
      status: 'SKIP',
      responseTime: 0,
      reason: 'Not a real URL (likely RSS aggregation or similar)'
    };
    results.broken_error.push(result);
    console.log(`⏭️  SKIP ${route_path} - ${name} (not a real URL)`);
    return;
  }

  return new Promise((resolve) => {
    // Determine if http or https
    const protocol = source_url.startsWith('https') ? https : http;
    const urlObj = new URL(source_url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (source_url.startsWith('https') ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; x402-audit/1.0)',
        'Accept': 'application/json'
      },
      timeout: TIMEOUT_MS
    };

    const req = protocol.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        const result = {
          id,
          name,
          route_path,
          source_url,
          status: res.statusCode,
          responseTime,
          bodyLength: body.length
        };

        // Categorize the result
        if (res.statusCode === 401 || res.statusCode === 403) {
          result.reason = 'API key required or unauthorized';
          results.broken_key.push(result);
          console.log(`🔑 BROKEN_KEY ${route_path} - ${res.statusCode} (${responseTime}ms) - ${name}`);
        } else if (res.statusCode >= 500) {
          result.reason = 'Upstream server error';
          results.broken_error.push(result);
          console.log(`❌ BROKEN_ERROR ${route_path} - ${res.statusCode} (${responseTime}ms) - ${name}`);
        } else if (res.statusCode === 404 || res.statusCode === 400) {
          result.reason = 'Dead endpoint or bad request';
          results.broken_dead.push(result);
          console.log(`💀 BROKEN_DEAD ${route_path} - ${res.statusCode} (${responseTime}ms) - ${name}`);
        } else if (res.statusCode === 200 || res.statusCode === 201) {
          // Check if we got real data
          if (body.length > 50 && !body.includes('error') && !body.includes('Error')) {
            result.reason = 'Real data returned';
            results.working.push(result);
            console.log(`✓ WORKING ${route_path} - ${res.statusCode} (${responseTime}ms) - ${name}`);
          } else {
            result.reason = 'Empty or error response';
            results.broken_error.push(result);
            console.log(`❌ BROKEN_ERROR ${route_path} - ${res.statusCode} (${responseTime}ms) - ${name} (empty/error response)`);
          }
        } else {
          result.reason = `Unexpected status ${res.statusCode}`;
          results.broken_error.push(result);
          console.log(`❌ BROKEN_ERROR ${route_path} - ${res.statusCode} (${responseTime}ms) - ${name}`);
        }

        resolve();
      });
    });

    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      const result = {
        id,
        name,
        route_path,
        source_url,
        status: 'ERROR',
        responseTime,
        reason: err.message
      };
      
      // Categorize error
      if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
        results.broken_dead.push(result);
        console.log(`💀 BROKEN_DEAD ${route_path} - ${err.message} (${responseTime}ms) - ${name}`);
      } else {
        results.broken_error.push(result);
        console.log(`❌ BROKEN_ERROR ${route_path} - ${err.message} (${responseTime}ms) - ${name}`);
      }
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      const result = {
        id,
        name,
        route_path,
        source_url,
        status: 'TIMEOUT',
        responseTime,
        reason: 'Request timeout'
      };
      results.broken_dead.push(result);
      console.log(`💀 BROKEN_DEAD ${route_path} - TIMEOUT (${responseTime}ms) - ${name}`);
      resolve();
    });

    req.end();
  });
}

async function runAudit() {
  // Test endpoints in batches to avoid overwhelming upstream servers
  const batchSize = 3;
  for (let i = 0; i < liveProducts.length; i += batchSize) {
    const batch = liveProducts.slice(i, i + batchSize);
    await Promise.all(batch.map(testUpstream));
    // Delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(70));
  console.log('BACKEND AUDIT SUMMARY');
  console.log('='.repeat(70));
  console.log(`WORKING: ${results.working.length}`);
  console.log(`BROKEN_KEY (API key required): ${results.broken_key.length}`);
  console.log(`BROKEN_DEAD (dead/changed URL): ${results.broken_dead.length}`);
  console.log(`BROKEN_ERROR (upstream error): ${results.broken_error.length}`);

  if (results.broken_key.length > 0) {
    console.log('\nBROKEN_KEY (API key required):');
    results.broken_key.forEach(r => {
      console.log(`  ${r.route_path} - ${r.name}`);
      console.log(`    Source: ${r.source_url}`);
      console.log(`    Reason: ${r.reason}`);
    });
  }

  if (results.broken_dead.length > 0) {
    console.log('\nBROKEN_DEAD (dead/changed URL):');
    results.broken_dead.forEach(r => {
      console.log(`  ${r.route_path} - ${r.name}`);
      console.log(`    Source: ${r.source_url}`);
      console.log(`    Reason: ${r.reason}`);
    });
  }

  if (results.broken_error.length > 0) {
    console.log('\nBROKEN_ERROR (upstream error):');
    results.broken_error.forEach(r => {
      console.log(`  ${r.route_path} - ${r.name}`);
      console.log(`    Source: ${r.source_url}`);
      console.log(`    Reason: ${r.reason}`);
    });
  }

  console.log('\n' + '='.repeat(70));
}

runAudit().catch(console.error);
