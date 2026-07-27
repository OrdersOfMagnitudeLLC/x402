const express = require('express');
const Redis = require('ioredis');

const router = express.Router();

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Namespace prefix for webhook registry
const NS_PREFIX = 'webhook:';

// POST /notify/register - Register a webhook for an event
router.post('/register', async (req, res) => {
  try {
    const { event, webhook_url } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const webhook = { id, url: webhook_url, registered_at: new Date().toISOString() };
    
    await redisClient.sadd(redisKey, JSON.stringify(webhook));
    
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Notify register error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire - Fire an event to all registered webhooks
router.post('/fire', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let fired = 0;
    const results = [];
    
    for (const webhookStr of webhooks) {
      try {
        const webhook = JSON.parse(webhookStr);
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, payload })
        });
        
        if (response.ok) {
          fired++;
          results.push({ id: webhook.id, status: 'success' });
        } else {
          results.push({ id: webhook.id, status: 'failed', code: response.status });
        }
      } catch (e) {
        results.push({ id: JSON.parse(webhookStr).id, status: 'error', error: e.message });
      }
    }
    
    res.json({ ok: true, fired, total: webhooks.length, results });
  } catch (error) {
    console.error('Notify fire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/list/:event - List all webhooks for an event
router.get('/list/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const redisKey = NS_PREFIX + event;
    
    const webhooks = await redisClient.smembers(redisKey);
    
    const parsedWebhooks = webhooks.map(w => JSON.parse(w));
    
    res.json({ event, webhooks: parsedWebhooks });
  } catch (error) {
    console.error('Notify list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /notify/unregister - Unregister a webhook
router.delete('/unregister', async (req, res) => {
  try {
    const { event, webhook_url } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhook = { url: webhook_url };
    const webhookStr = JSON.stringify(webhook);
    
    const removed = await redisClient.srem(redisKey, webhookStr);
    
    res.json({ ok: true, removed: removed === 1 });
  } catch (error) {
    console.error('Notify unregister error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/events - List all events with webhooks
router.get('/events', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const events = keys.map(k => k.replace(NS_PREFIX, ''));
    
    res.json({ events });
  } catch (error) {
    console.error('Notify events error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/batch-fire - Fire multiple events
router.post('/batch-fire', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events must be an array' });
    }
    
    let totalFired = 0;
    const results = [];
    
    for (const { event, payload } of events) {
      const redisKey = NS_PREFIX + event;
      const webhooks = await redisClient.smembers(redisKey);
      
      for (const webhookStr of webhooks) {
        try {
          const webhook = JSON.parse(webhookStr);
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, payload })
          });
          
          if (response.ok) {
            totalFired++;
            results.push({ event, id: webhook.id, status: 'success' });
          } else {
            results.push({ event, id: webhook.id, status: 'failed', code: response.status });
          }
        } catch (e) {
          results.push({ event, id: JSON.parse(webhookStr).id, status: 'error', error: e.message });
        }
      }
    }
    
    res.json({ ok: true, fired: totalFired, results });
  } catch (error) {
    console.error('Notify batch-fire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/test - Test a webhook URL
router.post('/test', async (req, res) => {
  try {
    const { webhook_url } = req.body;
    
    if (!webhook_url) {
      return res.status(400).json({ error: 'webhook_url is required' });
    }
    
    const testPayload = { test: true, timestamp: new Date().toISOString() };
    
    try {
      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      
      res.json({ ok: true, status: response.status, status_text: response.statusText });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  } catch (error) {
    console.error('Notify test error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/pause - Pause event notifications
router.post('/pause', async (req, res) => {
  try {
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const pauseKey = NS_PREFIX + event + ':paused';
    await redisClient.set(pauseKey, 'true');
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Notify pause error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/resume - Resume event notifications
router.post('/resume', async (req, res) => {
  try {
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const pauseKey = NS_PREFIX + event + ':paused';
    await redisClient.del(pauseKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Notify resume error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/count/:event - Count webhooks for event
router.get('/count/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const redisKey = NS_PREFIX + event;
    
    const count = await redisClient.scard(redisKey);
    
    res.json({ event, count });
  } catch (error) {
    console.error('Notify count error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /notify/clear - Clear all webhooks for event
router.delete('/clear', async (req, res) => {
  try {
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const removed = await redisClient.del(redisKey);
    
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('Notify clear error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/register-with-headers - Register webhook with custom headers
router.post('/register-with-headers', async (req, res) => {
  try {
    const { event, webhook_url, headers } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const webhook = { id, url: webhook_url, headers: headers || {}, registered_at: new Date().toISOString() };
    
    await redisClient.sadd(redisKey, JSON.stringify(webhook));
    
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Notify register-with-headers error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/register-with-secret - Register webhook with secret for signature
router.post('/register-with-secret', async (req, res) => {
  try {
    const { event, webhook_url, secret } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const webhook = { id, url: webhook_url, secret, registered_at: new Date().toISOString() };
    
    await redisClient.sadd(redisKey, JSON.stringify(webhook));
    
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Notify register-with-secret error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire-with-retry - Fire event with retry logic
router.post('/fire-with-retry', async (req, res) => {
  try {
    const { event, payload, max_retries } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let fired = 0;
    const results = [];
    const maxRetries = max_retries || 3;
    
    for (const webhookStr of webhooks) {
      let success = false;
      let lastError = null;
      
      for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
        try {
          const webhook = JSON.parse(webhookStr);
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, payload, attempt: attempt + 1 })
          });
          
          if (response.ok) {
            success = true;
            fired++;
            results.push({ id: webhook.id, status: 'success', attempts: attempt + 1 });
          } else {
            lastError = `HTTP ${response.status}`;
          }
        } catch (e) {
          lastError = e.message;
        }
        
        if (!success && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      
      if (!success) {
        results.push({ id: JSON.parse(webhookStr).id, status: 'failed', error: lastError });
      }
    }
    
    res.json({ ok: true, fired, total: webhooks.length, results });
  } catch (error) {
    console.error('Notify fire-with-retry error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/paused/:event - Check if event is paused
router.get('/paused/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const pauseKey = NS_PREFIX + event + ':paused';
    
    const paused = await redisClient.exists(pauseKey);
    
    res.json({ paused: paused === 1 });
  } catch (error) {
    console.error('Notify paused error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/batch-register - Register multiple webhooks
router.post('/batch-register', async (req, res) => {
  try {
    const { event, webhook_urls } = req.body;
    
    if (!event || !Array.isArray(webhook_urls)) {
      return res.status(400).json({ error: 'event and webhook_urls array are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const ids = [];
    
    for (const url of webhook_urls) {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const webhook = { id, url, registered_at: new Date().toISOString() };
      await redisClient.sadd(redisKey, JSON.stringify(webhook));
      ids.push(id);
    }
    
    res.json({ ok: true, ids });
  } catch (error) {
    console.error('Notify batch-register error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/batch-unregister - Unregister multiple webhooks
router.post('/batch-unregister', async (req, res) => {
  try {
    const { event, webhook_urls } = req.body;
    
    if (!event || !Array.isArray(webhook_urls)) {
      return res.status(400).json({ error: 'event and webhook_urls array are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    let removed = 0;
    
    for (const url of webhook_urls) {
      const webhook = { url };
      const webhookStr = JSON.stringify(webhook);
      removed += await redisClient.srem(redisKey, webhookStr);
    }
    
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('Notify batch-unregister error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/stats/:event - Get event statistics
router.get('/stats/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const redisKey = NS_PREFIX + event;
    const statsKey = NS_PREFIX + event + ':stats';
    
    const count = await redisClient.scard(redisKey);
    const stats = await redisClient.hgetall(statsKey);
    
    const parsedStats = {};
    for (const [k, v] of Object.entries(stats)) {
      parsedStats[k] = parseInt(v);
    }
    
    res.json({ event, webhook_count: count, stats: parsedStats });
  } catch (error) {
    console.error('Notify stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire-async - Fire event asynchronously (store for later)
router.post('/fire-async', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const queueKey = NS_PREFIX + 'async:queue';
    const task = { event, payload, queued_at: new Date().toISOString() };
    
    await redisClient.rpush(queueKey, JSON.stringify(task));
    
    res.json({ ok: true, queued: true });
  } catch (error) {
    console.error('Notify fire-async error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/process-async - Process async queue
router.post('/process-async', async (req, res) => {
  try {
    const { limit } = req.body;
    const maxTasks = limit || 10;
    
    const queueKey = NS_PREFIX + 'async:queue';
    const processed = [];
    
    for (let i = 0; i < maxTasks; i++) {
      const taskStr = await redisClient.lpop(queueKey);
      if (!taskStr) break;
      
      const task = JSON.parse(taskStr);
      const redisKey = NS_PREFIX + task.event;
      const webhooks = await redisClient.smembers(redisKey);
      
      let fired = 0;
      for (const webhookStr of webhooks) {
        try {
          const webhook = JSON.parse(webhookStr);
          await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: task.event, payload: task.payload })
          });
          fired++;
        } catch (e) {
          // Continue even if webhook fails
        }
      }
      
      processed.push({ event: task.event, fired });
    }
    
    res.json({ ok: true, processed });
  } catch (error) {
    console.error('Notify process-async error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/async-queue-size - Get async queue size
router.get('/async-queue-size', async (req, res) => {
  try {
    const queueKey = NS_PREFIX + 'async:queue';
    const size = await redisClient.llen(queueKey);
    
    res.json({ size });
  } catch (error) {
    console.error('Notify async-queue-size error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/register-with-retry-config - Register with retry configuration
router.post('/register-with-retry-config', async (req, res) => {
  try {
    const { event, webhook_url, retry_config } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const webhook = { 
      id, 
      url: webhook_url, 
      retry_config: retry_config || { max_retries: 3, backoff_ms: 1000 },
      registered_at: new Date().toISOString() 
    };
    
    await redisClient.sadd(redisKey, JSON.stringify(webhook));
    
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Notify register-with-retry-config error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/update-webhook - Update webhook configuration
router.post('/update-webhook', async (req, res) => {
  try {
    const { event, webhook_id, updates } = req.body;
    
    if (!event || !webhook_id) {
      return res.status(400).json({ error: 'event and webhook_id are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let updated = false;
    for (const webhookStr of webhooks) {
      const webhook = JSON.parse(webhookStr);
      if (webhook.id === webhook_id) {
        const updatedWebhook = { ...webhook, ...updates, updated_at: new Date().toISOString() };
        await redisClient.srem(redisKey, webhookStr);
        await redisClient.sadd(redisKey, JSON.stringify(updatedWebhook));
        updated = true;
        break;
      }
    }
    
    res.json({ ok: true, updated });
  } catch (error) {
    console.error('Notify update-webhook error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/webhook/:event/:id - Get specific webhook
router.get('/webhook/:event/:id', async (req, res) => {
  try {
    const { event, id } = req.params;
    const redisKey = NS_PREFIX + event;
    
    const webhooks = await redisClient.smembers(redisKey);
    
    for (const webhookStr of webhooks) {
      const webhook = JSON.parse(webhookStr);
      if (webhook.id === id) {
        return res.json({ webhook });
      }
    }
    
    res.status(404).json({ error: 'webhook_not_found' });
  } catch (error) {
    console.error('Notify webhook error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire-to-specific - Fire to specific webhook only
router.post('/fire-to-specific', async (req, res) => {
  try {
    const { event, webhook_id, payload } = req.body;
    
    if (!event || !webhook_id) {
      return res.status(400).json({ error: 'event and webhook_id are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    for (const webhookStr of webhooks) {
      const webhook = JSON.parse(webhookStr);
      if (webhook.id === webhook_id) {
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, payload })
          });
          
          return res.json({ ok: response.ok, status: response.status });
        } catch (e) {
          return res.json({ ok: false, error: e.message });
        }
      }
    }
    
    res.status(404).json({ error: 'webhook_not_found' });
  } catch (error) {
    console.error('Notify fire-to-specific error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/set-rate-limit - Set rate limit for event
router.post('/set-rate-limit', async (req, res) => {
  try {
    const { event, fires_per_minute } = req.body;
    
    if (!event || !fires_per_minute) {
      return res.status(400).json({ error: 'event and fires_per_minute are required' });
    }
    
    const rateLimitKey = NS_PREFIX + event + ':ratelimit';
    await redisClient.set(rateLimitKey, fires_per_minute);
    
    res.json({ ok: true, fires_per_minute });
  } catch (error) {
    console.error('Notify set-rate-limit error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/rate-limit/:event - Get rate limit
router.get('/rate-limit/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const rateLimitKey = NS_PREFIX + event + ':ratelimit';
    
    const rateLimit = await redisClient.get(rateLimitKey);
    
    res.json({ fires_per_minute: rateLimit ? parseInt(rateLimit) : null });
  } catch (error) {
    console.error('Notify rate-limit error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/check-rate-limit - Check if rate limit allows fire
router.post('/check-rate-limit', async (req, res) => {
  try {
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const rateLimitKey = NS_PREFIX + event + ':ratelimit';
    const counterKey = NS_PREFIX + event + ':counter';
    
    const rateLimit = await redisClient.get(rateLimitKey);
    if (!rateLimit) {
      return res.json({ allowed: true, reason: 'no_limit' });
    }
    
    const now = Date.now();
    const windowStart = now - 60000;
    
    const count = await redisClient.zcount(counterKey, windowStart, now);
    
    if (count >= parseInt(rateLimit)) {
      return res.json({ allowed: false, reason: 'rate_limit_exceeded', count });
    }
    
    await redisClient.zadd(counterKey, now, Date.now().toString());
    await redisClient.expire(counterKey, 60);
    
    res.json({ allowed: true, count: count + 1 });
  } catch (error) {
    console.error('Notify check-rate-limit error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/register-with-filter - Register webhook with event filter
router.post('/register-with-filter', async (req, res) => {
  try {
    const { event, webhook_url, filter } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const webhook = { id, url: webhook_url, filter, registered_at: new Date().toISOString() };
    
    await redisClient.sadd(redisKey, JSON.stringify(webhook));
    
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Notify register-with-filter error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire-with-filter - Fire event with filter application
router.post('/fire-with-filter', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let fired = 0;
    const results = [];
    
    for (const webhookStr of webhooks) {
      try {
        const webhook = JSON.parse(webhookStr);
        
        // Apply filter if present
        if (webhook.filter) {
          let matches = true;
          for (const [key, value] of Object.entries(webhook.filter)) {
            if (payload[key] !== value) {
              matches = false;
              break;
            }
          }
          if (!matches) {
            results.push({ id: webhook.id, status: 'skipped', reason: 'filter_mismatch' });
            continue;
          }
        }
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, payload })
        });
        
        if (response.ok) {
          fired++;
          results.push({ id: webhook.id, status: 'success' });
        } else {
          results.push({ id: webhook.id, status: 'failed', code: response.status });
        }
      } catch (e) {
        results.push({ id: JSON.parse(webhookStr).id, status: 'error', error: e.message });
      }
    }
    
    res.json({ ok: true, fired, total: webhooks.length, results });
  } catch (error) {
    console.error('Notify fire-with-filter error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/set-webhook-ttl - Set TTL on webhook registration
router.post('/set-webhook-ttl', async (req, res) => {
  try {
    const { event, ttl_seconds } = req.body;
    
    if (!event || !ttl_seconds) {
      return res.status(400).json({ error: 'event and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const result = await redisClient.expire(redisKey, ttl_seconds);
    
    if (result === 0) {
      return res.status(404).json({ error: 'event_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Notify set-webhook-ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/ttl/:event - Get webhook TTL
router.get('/ttl/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const redisKey = NS_PREFIX + event;
    
    const ttl = await redisClient.ttl(redisKey);
    
    if (ttl === -2) {
      return res.status(404).json({ error: 'event_not_found' });
    }
    
    res.json({ ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Notify ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/rename-event - Rename event
router.post('/rename-event', async (req, res) => {
  try {
    const { event, new_event } = req.body;
    
    if (!event || !new_event) {
      return res.status(400).json({ error: 'event and new_event are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const newRedisKey = NS_PREFIX + new_event;
    
    await redisClient.rename(redisKey, newRedisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Notify rename-event error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/copy-event - Copy event webhooks
router.post('/copy-event', async (req, res) => {
  try {
    const { event, dest_event } = req.body;
    
    if (!event || !dest_event) {
      return res.status(400).json({ error: 'event and dest_event are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const destRedisKey = NS_PREFIX + dest_event;
    
    const webhooks = await redisClient.smembers(redisKey);
    
    if (webhooks.length > 0) {
      await redisClient.del(destRedisKey);
      for (const webhook of webhooks) {
        await redisClient.sadd(destRedisKey, webhook);
      }
    }
    
    res.json({ ok: true, count: webhooks.length });
  } catch (error) {
    console.error('Notify copy-event error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/merge-events - Merge webhooks from multiple events
router.post('/merge-events', async (req, res) => {
  try {
    const { source_events, dest_event } = req.body;
    
    if (!Array.isArray(source_events) || !dest_event) {
      return res.status(400).json({ error: 'source_events array and dest_event are required' });
    }
    
    const destRedisKey = NS_PREFIX + dest_event;
    let count = 0;
    
    for (const event of source_events) {
      const redisKey = NS_PREFIX + event;
      const webhooks = await redisClient.smembers(redisKey);
      
      for (const webhook of webhooks) {
        await redisClient.sadd(destRedisKey, webhook);
        count++;
      }
    }
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Notify merge-events error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/batch-clear - Clear multiple events
router.post('/batch-clear', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events must be an array' });
    }
    
    const redisKeys = events.map(e => NS_PREFIX + e);
    const count = await redisClient.del(...redisKeys);
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Notify batch-clear error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/all-stats - Get statistics for all events
router.get('/all-stats', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const stats = await Promise.all(keys.map(async (key) => {
      if (key.includes(':')) return null;
      
      const event = key.replace(NS_PREFIX, '');
      const count = await redisClient.scard(key);
      
      return { event, webhook_count: count };
    }));
    
    res.json({ stats: stats.filter(s => s !== null) });
  } catch (error) {
    console.error('Notify all-stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/register-with-metadata - Register webhook with metadata
router.post('/register-with-metadata', async (req, res) => {
  try {
    const { event, webhook_url, metadata } = req.body;
    
    if (!event || !webhook_url) {
      return res.status(400).json({ error: 'event and webhook_url are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const webhook = { id, url: webhook_url, metadata: metadata || {}, registered_at: new Date().toISOString() };
    
    await redisClient.sadd(redisKey, JSON.stringify(webhook));
    
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Notify register-with-metadata error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/set-event-metadata - Set metadata for event
router.post('/set-event-metadata', async (req, res) => {
  try {
    const { event, metadata } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const metadataKey = NS_PREFIX + event + ':metadata';
    await redisClient.set(metadataKey, JSON.stringify(metadata || {}));
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Notify set-event-metadata error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/event-metadata/:event - Get event metadata
router.get('/event-metadata/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const metadataKey = NS_PREFIX + event + ':metadata';
    
    const metadataStr = await redisClient.get(metadataKey);
    
    if (!metadataStr) {
      return res.json({ metadata: {} });
    }
    
    res.json({ metadata: JSON.parse(metadataStr) });
  } catch (error) {
    console.error('Notify event-metadata error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire-with-signature - Fire event with HMAC signature
router.post('/fire-with-signature', async (req, res) => {
  try {
    const { event, payload, secret } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const crypto = require('crypto');
    const payloadStr = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret || 'default-secret').update(payloadStr).digest('hex');
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let fired = 0;
    const results = [];
    
    for (const webhookStr of webhooks) {
      try {
        const webhook = JSON.parse(webhookStr);
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature
          },
          body: JSON.stringify({ event, payload })
        });
        
        if (response.ok) {
          fired++;
          results.push({ id: webhook.id, status: 'success' });
        } else {
          results.push({ id: webhook.id, status: 'failed', code: response.status });
        }
      } catch (e) {
        results.push({ id: JSON.parse(webhookStr).id, status: 'error', error: e.message });
      }
    }
    
    res.json({ ok: true, fired, total: webhooks.length, results });
  } catch (error) {
    console.error('Notify fire-with-signature error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/verify-signature - Verify webhook signature
router.post('/verify-signature', async (req, res) => {
  try {
    const { payload, signature, secret } = req.body;
    
    if (!payload || !signature) {
      return res.status(400).json({ error: 'payload and signature are required' });
    }
    
    const crypto = require('crypto');
    const payloadStr = JSON.stringify(payload);
    const expectedSignature = crypto.createHmac('sha256', secret || 'default-secret').update(payloadStr).digest('hex');
    
    const valid = signature === expectedSignature;
    
    res.json({ valid });
  } catch (error) {
    console.error('Notify verify-signature error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/set-webhook-active - Set webhook active status
router.post('/set-webhook-active', async (req, res) => {
  try {
    const { event, webhook_id, active } = req.body;
    
    if (!event || !webhook_id) {
      return res.status(400).json({ error: 'event and webhook_id are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let updated = false;
    for (const webhookStr of webhooks) {
      const webhook = JSON.parse(webhookStr);
      if (webhook.id === webhook_id) {
        const updatedWebhook = { ...webhook, active: active !== false, updated_at: new Date().toISOString() };
        await redisClient.srem(redisKey, webhookStr);
        await redisClient.sadd(redisKey, JSON.stringify(updatedWebhook));
        updated = true;
        break;
      }
    }
    
    res.json({ ok: true, updated });
  } catch (error) {
    console.error('Notify set-webhook-active error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/get-active-webhooks/:event - Get only active webhooks
router.post('/get-active-webhooks/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const redisKey = NS_PREFIX + event;
    
    const webhooks = await redisClient.smembers(redisKey);
    
    const activeWebhooks = webhooks
      .map(w => JSON.parse(w))
      .filter(w => w.active !== false);
    
    res.json({ event, webhooks: activeWebhooks });
  } catch (error) {
    console.error('Notify get-active-webhooks error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/set-webhook-priority - Set webhook priority
router.post('/set-webhook-priority', async (req, res) => {
  try {
    const { event, webhook_id, priority } = req.body;
    
    if (!event || !webhook_id) {
      return res.status(400).json({ error: 'event and webhook_id are required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    let updated = false;
    for (const webhookStr of webhooks) {
      const webhook = JSON.parse(webhookStr);
      if (webhook.id === webhook_id) {
        const updatedWebhook = { ...webhook, priority: priority || 0, updated_at: new Date().toISOString() };
        await redisClient.srem(redisKey, webhookStr);
        await redisClient.sadd(redisKey, JSON.stringify(updatedWebhook));
        updated = true;
        break;
      }
    }
    
    res.json({ ok: true, updated });
  } catch (error) {
    console.error('Notify set-webhook-priority error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/fire-by-priority - Fire webhooks in priority order
router.post('/fire-by-priority', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const webhooks = await redisClient.smembers(redisKey);
    
    const sortedWebhooks = webhooks
      .map(w => JSON.parse(w))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    let fired = 0;
    const results = [];
    
    for (const webhook of sortedWebhooks) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, payload })
        });
        
        if (response.ok) {
          fired++;
          results.push({ id: webhook.id, status: 'success', priority: webhook.priority });
        } else {
          results.push({ id: webhook.id, status: 'failed', code: response.status, priority: webhook.priority });
        }
      } catch (e) {
        results.push({ id: webhook.id, status: 'error', error: e.message, priority: webhook.priority });
      }
    }
    
    res.json({ ok: true, fired, total: sortedWebhooks.length, results });
  } catch (error) {
    console.error('Notify fire-by-priority error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/set-event-description - Set event description
router.post('/set-event-description', async (req, res) => {
  try {
    const { event, description } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const descKey = NS_PREFIX + event + ':description';
    await redisClient.set(descKey, description || '');
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Notify set-event-description error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /notify/event-description/:event - Get event description
router.get('/event-description/:event', async (req, res) => {
  try {
    const { event } = req.params;
    const descKey = NS_PREFIX + event + ':description';
    
    const description = await redisClient.get(descKey);
    
    res.json({ description: description || '' });
  } catch (error) {
    console.error('Notify event-description error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/export-event - Export event configuration
router.post('/export-event', async (req, res) => {
  try {
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }
    
    const redisKey = NS_PREFIX + event;
    const descKey = NS_PREFIX + event + ':description';
    const metadataKey = NS_PREFIX + event + ':metadata';
    
    const webhooks = await redisClient.smembers(redisKey);
    const description = await redisClient.get(descKey);
    const metadataStr = await redisClient.get(metadataKey);
    
    const exportData = {
      event,
      description: description || '',
      metadata: metadataStr ? JSON.parse(metadataStr) : {},
      webhooks: webhooks.map(w => JSON.parse(w)),
      exported_at: new Date().toISOString()
    };
    
    res.json({ export: exportData });
  } catch (error) {
    console.error('Notify export-event error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /notify/import-event - Import event configuration
router.post('/import-event', async (req, res) => {
  try {
    const { export: importData } = req.body;
    
    if (!importData || !importData.event) {
      return res.status(400).json({ error: 'export with event is required' });
    }
    
    const redisKey = NS_PREFIX + importData.event;
    const descKey = NS_PREFIX + importData.event + ':description';
    const metadataKey = NS_PREFIX + importData.event + ':metadata';
    
    await redisClient.del(redisKey);
    
    for (const webhook of importData.webhooks) {
      await redisClient.sadd(redisKey, JSON.stringify(webhook));
    }
    
    if (importData.description) {
      await redisClient.set(descKey, importData.description);
    }
    
    if (importData.metadata) {
      await redisClient.set(metadataKey, JSON.stringify(importData.metadata));
    }
    
    res.json({ ok: true, imported_count: importData.webhooks.length });
  } catch (error) {
    console.error('Notify import-event error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
