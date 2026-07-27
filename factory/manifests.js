const fs = require('fs');
const path = require('path');

// Ensure public directory exists
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Read products.json
const productsPath = path.join(__dirname, '../products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// Filter out inactive products
const activeProducts = products.filter(p => p.active !== false);

// Read pioneer products
const pioneerPath = path.join(__dirname, '../scripts/pioneer_products.json');
const pioneerProducts = JSON.parse(fs.readFileSync(pioneerPath, 'utf8'));
const allProducts = [...activeProducts, ...pioneerProducts];

// Helper to extract param names from route path
function extractParams(routePath) {
  const params = [];
  const segments = routePath.split('/');
  segments.forEach(seg => {
    if (seg.startsWith(':')) {
      params.push(seg.substring(1));
    }
  });
  return params;
}

// Parameter schema mapping for GET endpoints
const parameterSchemas = {
  // No input required
  'cat1_001': [], // crypto-prices
  'cat1_002': [], // crypto-market-cap
  'cat1_003': [], // crypto-funding-rates
  'cat1_004': [], // defi-tvl
  'cat1_005': [], // macro-indicators-us
  'cat1_006': [], // macro-indicators-global
  'cat1_007': [], // bond-yields
  'cat1_013': [], // sanctions-screening
  'cat1_017': [], // drug-adverse-events
  'cat1_018': [], // fda-recalls
  'cat1_020': [], // earthquake-data
  'cat1_021': [], // air-quality
  'cat2_002': [], // bnm-exchange-rates
  'cat2_007': [], // malaysia-news-bahasa
  'cat2_012': [], // pakistan-news
  'cat1_009': [], // exchange-rates
  'cat1_016': [], // clinical-trials
  'cat1_019': [], // cve-vulnerabilities
  'cat3_018': [], // africa-macro-indicators
  
  // Query parameter required
  'cat1_010': [{name: 'symbol', in: 'query', required: true, schema: {type: 'string'}, description: 'Stock symbol'}], // stock-market-data
  'cat1_011': [{name: 'q', in: 'query', required: true, schema: {type: 'string'}, description: 'Search query for filings'}], // sec-edgar-filings
  'cat1_015': [{name: 'topic', in: 'query', required: true, schema: {type: 'string'}, description: 'Research topic'}], // scientific-literature
  'cat1_025': [{name: 'food_name', in: 'query', required: true, schema: {type: 'string'}, description: 'Food name to query'}], // nutrition-database
  'cat1_027': [{name: 'ip', in: 'query', required: true, schema: {type: 'string'}, description: 'IP address to geolocate'}], // ip-geolocation
  'cat3_011': [{name: 'symbol', in: 'query', required: true, schema: {type: 'string'}, description: 'Stock symbol'}], // india-nse-bse
  'cat3_012': [{name: 'symbol', in: 'query', required: true, schema: {type: 'string'}, description: 'Stock symbol'}], // brazil-bovespa
  'cat3_013': [{name: 'symbol', in: 'query', required: true, schema: {type: 'string'}, description: 'Stock symbol'}], // south-africa-jse
  'cat3_014': [{name: 'symbol', in: 'query', required: true, schema: {type: 'string'}, description: 'Stock symbol'}], // mexico-bmv
  'cat2_010': [{name: 'indicator', in: 'query', required: true, schema: {type: 'string'}, description: 'Economic indicator name'}], // pakistan-economic-data
  'cat1_022': [{name: 'location', in: 'query', required: true, schema: {type: 'string'}, description: 'Location for weather data'}], // weather-extremes
  'cat1_012': [{name: 'company_name', in: 'query', required: true, schema: {type: 'string'}, description: 'Company name to search'}], // company-registry
  'cat1_014': [{name: 'query', in: 'query', required: true, schema: {type: 'string'}, description: 'Patent search query'}], // patent-search
};

// Security mapping for free/identity-gated endpoints
const securitySchemas = {
  'cat2_001': [], // bursa-malaysia
  'cat2_009': [], // sbp-exchange-rates
  'cat2_011': [], // secp-company-registry
  'cat3_001': [], // sgx-singapore
  'cat2_012': [], // pakistan-news
};

// Determine HTTP method based on route path
function getMethod(routePath) {
  const postRoutes = [
    '/ai/', '/ns/', '/memory/', '/logging/', '/tasks/',
    '/notify/', '/verify/', '/coordination/', '/secrets/', '/simulate/'
  ];
  if (postRoutes.some(p => routePath.startsWith(p))) return 'POST';
  return 'GET';
}

// Infer category label from route path
function inferCategory(path) {
  if (!path) return 'unknown';
  const seg = path.split('/')[1];
  const map = {
    memory: 'OOM Memory',
    logging: 'OOM Lens',
    tasks: 'OOM Lens',
    notify: 'OOM Fleet',
    verify: 'KYA',
    secrets: 'KYA',
    coordination: 'OOM Fleet',
    simulate: 'OOM Simulate',
    finance: 'Finance',
    economy: 'Economy',
    compute: 'Compute',
    knowledge: 'Knowledge',
    environment: 'Environment',
    health: 'Health',
    geo: 'Geospatial',
    media: 'Media',
    science: 'Science',
    legal: 'Legal',
    security: 'Security',
    temporal: 'Temporal',
    geospatial: 'Geospatial',
    reference: 'Reference',
    search: 'Search'
  };
  return map[seg] || seg;
}

// Generate x402.json
function generateX402Json() {
  const catalog = {
    name: "Orders of Magnitude",
    description: "Agent infrastructure — memory, coordination, verification, simulation and 1400+ data endpoints.",
    type: "data",
    services: allProducts.map(product => ({
      endpoint: product.route_path,
      description: product.description,
      price: String(product.price_usd),
      asset: "USDC",
      network: "base",
      method: product.method || "GET",
      category: product.category
    }))
  };
  
  fs.writeFileSync(
    path.join(__dirname, '../public/x402.json'),
    JSON.stringify(catalog, null, 2)
  );
  
  // Also generate merged products-all.json
  generateProductsAllJson();
}

// Generate products-all.json (merged products + pioneer products)
function generateProductsAllJson() {
  fs.writeFileSync(
    path.join(__dirname, '../public/products-all.json'),
    JSON.stringify(allProducts, null, 2)
  );
}

// Generate llms.txt
function generateLlmsTxt() {
  let content = '';

  content += `# OOM API — Agent Infrastructure + Data\n`;
  content += `# Pay-per-call via x402 protocol (USDC on Base)\n`;
  content += `# Base URL: https://x402-api-production-5133.up.railway.app\n`;
  content += `# All endpoints return 402 with payment details. Include x-payment header to pay.\n`;
  content += `# Full manifest: /x402.json | OpenAPI: /openapi.json\n\n`;

  content += `## PIONEER INFRASTRUCTURE (Redis-backed, no external deps)\n\n`;

  // Group pioneer endpoints by category
  const pioneerCategories = {
    'OOM Memory': allProducts.filter(p => p.category === 'memory' || (p.route_path && p.route_path.startsWith('/memory/'))),
    'OOM Lens': allProducts.filter(p => (p.category === 'logging' || (p.route_path && p.route_path.startsWith('/logging/'))) || (p.category === 'tasks' || (p.route_path && p.route_path.startsWith('/tasks/')))),
    'OOM Fleet': allProducts.filter(p => (p.category === 'coordination' || (p.route_path && p.route_path.startsWith('/coordination/'))) || (p.category === 'notify' || (p.route_path && p.route_path.startsWith('/notify/')))),
    'KYA: Know Your Agent': allProducts.filter(p => (p.category === 'verify' || (p.route_path && p.route_path.startsWith('/verify/'))) || (p.category === 'secrets' || (p.route_path && p.route_path.startsWith('/secrets/')))),
    'OOM Simulate': allProducts.filter(p => p.category === 'simulate' || (p.route_path && p.route_path.startsWith('/simulate/')))
  };

  // OOM Memory
  content += `### OOM Memory — Persistent key-value store for agents\n`;
  pioneerCategories['OOM Memory'].forEach(p => {
    const method = getMethod(p.route_path || "");
    content += `${method} ${p.route_path} — ${p.description} — $${p.price_usd}\n`;
  });
  content += `\n`;

  // OOM Fleet
  content += `### OOM Fleet — Multi-agent coordination + notifications\n`;
  pioneerCategories['OOM Fleet'].forEach(p => {
    const method = getMethod(p.route_path || "");
    content += `${method} ${p.route_path} — ${p.description} — $${p.price_usd}\n`;
  });
  content += `\n`;

  // OOM Lens
  content += `### OOM Lens — Observability: logs + task queues\n`;
  pioneerCategories['OOM Lens'].forEach(p => {
    const method = getMethod(p.route_path || "");
    content += `${method} ${p.route_path} — ${p.description} — $${p.price_usd}\n`;
  });
  content += `\n`;

  // KYA
  content += `### KYA: Know Your Agent — Identity + secrets\n`;
  pioneerCategories['KYA: Know Your Agent'].forEach(p => {
    const method = getMethod(p.route_path || "");
    content += `${method} ${p.route_path} — ${p.description} — $${p.price_usd}\n`;
  });
  content += `\n`;

  // OOM Simulate
  content += `### OOM Simulate — Statistical compute\n`;
  pioneerCategories['OOM Simulate'].forEach(p => {
    const method = getMethod(p.route_path || "");
    content += `${method} ${p.route_path} — ${p.description} — $${p.price_usd}\n`;
  });
  content += `\n`;

  content += `## DATA ENDPOINTS\n\n`;

  // Group data endpoints by inferred category
  const dataCategories = {};
  allProducts.filter(p => !p.category || !['memory', 'logging', 'tasks', 'notify', 'verify', 'coordination', 'secrets', 'simulate'].includes(p.category)).forEach(p => {
    const cat = inferCategory(p.route_path);
    if (!dataCategories[cat]) dataCategories[cat] = [];
    dataCategories[cat].push(p);
  });

  // Show 3-5 examples per category
  Object.keys(dataCategories).sort().forEach(cat => {
    const endpoints = dataCategories[cat];
    content += `### ${cat}\n`;
    const examples = endpoints.slice(0, 5);
    examples.forEach(p => {
      const method = getMethod(p.route_path || "");
      content += `${method} ${p.route_path} — ${p.description} — $${p.price_usd}\n`;
    });
    if (endpoints.length > 5) {
      content += `...and ${endpoints.length - 5} more at /x402.json\n`;
    }
    content += `\n`;
  });

  fs.writeFileSync(
    path.join(__dirname, '../public/llms.txt'),
    content
  );
}

// Generate OpenAPI 3.0 spec
function generateOpenApiJson() {
  const openapi = {
    openapi: "3.0.0",
    info: {
      title: "Orders of Magnitude API",
      version: "1.0.0",
      description: "Data and AI services via x402 payment protocol",
      contact: {
        email: "orders@ofmagnitude.com"
      }
    },
    paths: {}
  };
  
  for (const product of allProducts) {
    const method = getMethod(product.route_path || "").toLowerCase();
    const path = product.route_path;
    
    // Skip endpoints with null route_path
    if (!path) continue;
    
    // Skip paths that don't match clean URL pattern
    if (!/^[a-z0-9\/:_\-\*]+$/i.test(path)) continue;
    
    if (!openapi.paths[path]) {
      openapi.paths[path] = {};
    }
    
    // Clean summary: remove source in parentheses
    const cleanSummary = (product.name || product.description || "").replace(/\s*\(.*?\)\s*/g, '').trim();
    
    // Generate description: what the data is + who would call this
    const domain = path.split('/')[1] || 'data';
    const description = `${product.description || cleanSummary}. Call when an agent needs ${domain} data.`;
    
    // Derive tags from route_path segments
    const segments = path.split('/').filter(s => s);
    const tags = [segments[0]]; // First segment = domain tag
    if (segments.length > 2 && segments[1] && !segments[1].startsWith(':')) {
      tags.push(segments[1]); // Geo segment if present and not parametric
    }
    tags.push(segments[segments.length - 1]); // Last segment = resource tag
    
    // Build input/output schema
    const params = extractParams(path);
    const inputProperties = {};
    params.forEach(param => {
      inputProperties[param] = { type: 'string' };
    });

    const outputProperties = {};
    if (product.response_fields && Array.isArray(product.response_fields) && product.response_fields.length > 0) {
      product.response_fields.forEach(field => {
        outputProperties[field] = { type: 'string', description: field };
      });
    } else {
      outputProperties.data = { type: 'object' };
    }

    const schema = {
      properties: {
        input: {
          type: 'object',
          properties: inputProperties
        },
        output: {
          type: 'object',
          properties: outputProperties
        }
      }
    };
    
    const operation = {
      summary: cleanSummary,
      description: description,
      tags: tags,
      "x-payment-info": {
        description: `Access ${cleanSummary} via x402 payment protocol`,
        price: {
          mode: "fixed",
          currency: "USD",
          amount: product.price_usd ? product.price_usd.toFixed(2) : "0.01"
        },
        protocols: ["x402"]
      },
      parameters: parameterSchemas[product.id] || [],
      security: securitySchemas[product.id] !== undefined ? securitySchemas[product.id] : undefined,
      responses: {
        "402": {
          description: "Payment Required - x402 payment protocol",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  accepts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        scheme: { type: "string" },
                        price: { type: "string" },
                        network: { type: "string" },
                        payTo: { type: "string" }
                      }
                    }
                  },
                  extensions: {
                    bazaar: {
                      info: {
                        title: "OOM Data API",
                        description: "Pay-per-call data endpoint via x402"
                      },
                      schema: schema
                    }
                  }
                }
              }
            }
          }
        },
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: outputProperties
              }
            }
          }
        }
      }
    };
    
    if (method === 'post') {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                input: { type: "string" }
              },
              required: ["input"]
            }
          }
        }
      };
    } else if (method === 'get' && (!parameterSchemas[product.id] || parameterSchemas[product.id].length === 0)) {
      // GET endpoints with no parameters need empty requestBody for x402scan
      operation.requestBody = {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {}
            }
          }
        }
      };
    }
    
    openapi.paths[path][method] = operation;
  }
  
  fs.writeFileSync(
    path.join(__dirname, '../public/openapi.json'),
    JSON.stringify(openapi, null, 2)
  );
}

// Generate all files
generateX402Json();
generateLlmsTxt();
generateOpenApiJson();

console.log('Generated manifest files:');
console.log('- public/x402.json');
console.log('- public/llms.txt');
console.log('- public/openapi.json');
