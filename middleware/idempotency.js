const Redis = require('ioredis');
const crypto = require('crypto');

let redis;

try {
  redis = new Redis(process.env.REDIS_URL);
  redis.on('error', (err) => {
    console.warn('Redis connection error (failing open):', err.message);
  });
} catch (err) {
  console.warn('Redis initialization failed (failing open):', err.message);
  redis = null;
}

function generateIdempotencyKey(req) {
  const signature = req.headers['x-payment-signature'] || '';
  const path = req.path;
  const body = JSON.stringify(req.body);
  const data = signature + path + body;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function idempotencyMiddleware(req, res, next) {
  if (!redis) {
    console.warn('Redis unavailable, skipping idempotency check');
    return next();
  }

  const key = generateIdempotencyKey(req);

  try {
    const cached = await redis.get(key);
    if (cached) {
      console.log('Idempotency key hit, returning cached response');
      return res.json(JSON.parse(cached));
    }
  } catch (err) {
    console.warn('Redis GET failed (failing open):', err.message);
  }

  // Cache the response after it's sent
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    try {
      redis.setex(key, 86400, JSON.stringify(data)).catch((err) => {
        console.warn('Redis SET failed:', err.message);
      });
    } catch (err) {
      console.warn('Failed to cache response:', err.message);
    }
    return originalJson(data);
  };

  next();
}

module.exports = idempotencyMiddleware;
