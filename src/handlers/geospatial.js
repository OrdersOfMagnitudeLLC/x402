const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisClient.on('error', (err) => console.error('Redis error:', err.message));

// Read stub file
function readStub(routePath) {
  const stubPath = path.join(__dirname, '../endpoints/geospatial', `${routePath}.json`);
  const stubContent = fs.readFileSync(stubPath, 'utf8');
  return JSON.parse(stubContent);
}

// Generic geospatial handler
async function handleGeospatialRequest(req, res) {
  // Extract route path from URL (everything after /geospatial/)
  const routePath = req.originalRoutePath || req.path.replace('/geospatial/', '');
  
  try {
    // Check cache first
    const cacheKey = `cache:${routePath}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Read stub to get source URL
    const stub = readStub(routePath);
    const sourceUrl = stub.source_url;
    
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
    
    while (retryCount <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
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
      break;
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
    
    // Cache the response (3600s = 1 hour)
    await redisClient.setex(cacheKey, 3600, JSON.stringify(data));
    
    return res.json(data);
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Timeout error for:', routePath);
      return res.status(502).json({ error: 'upstream_unavailable' });
    }
    console.error('Geospatial handler error:', error);
    return res.status(502).json({ error: 'upstream_unavailable' });
  }
}

module.exports = { handleGeospatialRequest };
