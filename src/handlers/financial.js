const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Determine cache TTL based on URL pattern
function getCacheTTL(sourceUrl) {
  // Crypto prices - 60s
  if (sourceUrl.includes('coingecko.com') || sourceUrl.includes('coinpaprika.com')) {
    return 60;
  }
  // Macro/FRED data - 3600s
  if (sourceUrl.includes('stlouisfed.org') || sourceUrl.includes('fred')) {
    return 3600;
  }
  // Other financial data - 300s
  return 300;
}

// Read stub file
function readStub(routePath) {
  const stubPath = path.join(__dirname, '../endpoints/financial', `${routePath}.json`);
  const stubContent = fs.readFileSync(stubPath, 'utf8');
  return JSON.parse(stubContent);
}

// Generic financial handler
async function handleFinancialRequest(req, res) {
  // Extract route path from URL (everything after /financial/)
  const routePath = req.originalRoutePath || req.path.replace('/financial/', '');
  
  try {
    // Check cache first
    const cacheKey = `cache:${routePath}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Read stub to get source URL
    const stub = readStub(routePath);
    let sourceUrl = stub.source_url;
    
    // Replace DEMO_KEY with actual FRED_API_KEY at runtime
    if (sourceUrl.includes('DEMO_KEY') && process.env.FRED_API_KEY) {
      sourceUrl = sourceUrl.replace('DEMO_KEY', process.env.FRED_API_KEY);
    }
    
    // Anti-IP-block headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/',
      'Cache-Control': 'no-cache'
    };
    
    // Fetch with retry logic
    let response;
    let retryCount = 0;
    const maxRetries = 1;
    let shouldBreak = false;
    
    // Special handling for llama.fi large responses
    const isLlamaFi = sourceUrl.includes('llama.fi/protocols');
    const timeout = isLlamaFi ? 15000 : 8000;
    
    while (retryCount <= maxRetries && !shouldBreak) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      console.log(`Fetching: ${sourceUrl} (attempt ${retryCount + 1})`);
      response = await fetch(sourceUrl, {
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`Response status: ${response.status}`);
      
      // Check if we should retry
      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying after 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      
      // If not retrying or success, break
      shouldBreak = true;
    }
    
    // CMC fallback for CoinGecko 403/429 errors
    if ((response.status === 403 || response.status === 429) && sourceUrl.includes('coingecko.com')) {
      if (retryCount >= maxRetries) {
        console.log('CoinGecko failed, trying CMC fallback...');
        
        // Map CoinGecko endpoint to CMC equivalent
        let cmcUrl;
        if (sourceUrl.includes('/simple/price')) {
          cmcUrl = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
        } else if (sourceUrl.includes('/global')) {
          cmcUrl = 'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest';
        } else {
          // No CMC equivalent for this endpoint
          cmcUrl = null;
        }
        
        if (cmcUrl) {
          // Add CMC API key
          const cmcHeaders = { ...headers };
          cmcHeaders['X-CMC_PRO_API_KEY'] = process.env.CMC_API_KEY;
          
          // Try CMC with same timeout
          const cmcController = new AbortController();
          const cmcTimeoutId = setTimeout(() => cmcController.abort(), timeout);
          
          console.log(`Fetching CMC: ${cmcUrl}`);
          response = await fetch(cmcUrl, {
            headers: cmcHeaders,
            signal: cmcController.signal
          });
          
          clearTimeout(cmcTimeoutId);
          console.log(`CMC response status: ${response.status}`);
        }
      }
    }
    
    // Check if response is OK after retries
    if (!response.ok) {
      return res.status(502).json({ error: 'upstream_unavailable' });
    }
    
    const text = await response.text();
    
    // Parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'invalid_response' });
    }
    
    // Special handling for llama.fi - truncate to 50 items with specific fields
    if (isLlamaFi && Array.isArray(data)) {
      const fields = ['id', 'name', 'symbol', 'tvl', 'chainTvl'];
      data = data.slice(0, 50).map(item => {
        const filtered = {};
        fields.forEach(field => {
          if (item[field] !== undefined) {
            filtered[field] = item[field];
          }
        });
        return filtered;
      });
    }
    
    // Cache the response
    const ttl = getCacheTTL(sourceUrl);
    await redisClient.setex(cacheKey, ttl, JSON.stringify(data));
    
    return res.json(data);
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Timeout error for:', routePath);
      return res.status(502).json({ error: 'upstream_unavailable' });
    }
    console.error('Financial handler error:', error);
    return res.status(502).json({ error: 'upstream_unavailable' });
  }
}

module.exports = { handleFinancialRequest };
