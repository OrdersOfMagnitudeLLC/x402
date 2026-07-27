const express = require('express');
const Redis = require('ioredis');

const router = express.Router();

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Namespace prefix for coordination operations
const NS_PREFIX = 'coordination:';

// POST /coordination/lock/acquire - Acquire a distributed lock
router.post('/lock/acquire', async (req, res) => {
  try {
    const { resource_id, ttl_seconds } = req.body;
    
    if (!resource_id || !ttl_seconds) {
      return res.status(400).json({ error: 'resource_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'lock:' + resource_id;
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    // SET with NX (only if not exists) and EX (expiry)
    const result = await redisClient.set(redisKey, token, 'NX', 'EX', ttl_seconds);
    
    if (result === null) {
      return res.json({ ok: false, locked: true });
    }
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Coordination lock acquire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/release - Release a distributed lock
router.post('/lock/release', async (req, res) => {
  try {
    const { resource_id, token } = req.body;
    
    if (!resource_id || !token) {
      return res.status(400).json({ error: 'resource_id and token are required' });
    }
    
    const redisKey = NS_PREFIX + 'lock:' + resource_id;
    
    // Lua script to ensure we only release our own lock
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, token);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination lock release error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/lock/status/:id - Check lock status
router.get('/lock/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const redisKey = NS_PREFIX + 'lock:' + id;
    
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 0) {
      return res.json({ locked: false, ttl: null });
    }
    
    const ttl = await redisClient.ttl(redisKey);
    
    res.json({ locked: true, ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Coordination lock status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/increment - Increment a counter
router.post('/counter/increment', async (req, res) => {
  try {
    const { counter_id, by } = req.body;
    
    if (!counter_id) {
      return res.status(400).json({ error: 'counter_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    const incrementBy = by || 1;
    
    const value = await redisClient.incrby(redisKey, incrementBy);
    
    res.json({ value });
  } catch (error) {
    console.error('Coordination counter increment error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/decrement - Decrement a counter
router.post('/counter/decrement', async (req, res) => {
  try {
    const { counter_id, by } = req.body;
    
    if (!counter_id) {
      return res.status(400).json({ error: 'counter_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    const decrementBy = by || 1;
    
    const value = await redisClient.decrby(redisKey, decrementBy);
    
    res.json({ value });
  } catch (error) {
    console.error('Coordination counter decrement error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/counter/get/:counter_id - Get counter value
router.get('/counter/get/:counter_id', async (req, res) => {
  try {
    const { counter_id } = req.params;
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    
    const value = await redisClient.get(redisKey);
    
    if (value === null) {
      return res.json({ value: 0 });
    }
    
    res.json({ value: parseInt(value, 10) });
  } catch (error) {
    console.error('Coordination counter get error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/reset - Reset a counter
router.post('/counter/reset', async (req, res) => {
  try {
    const { counter_id } = req.body;
    
    if (!counter_id) {
      return res.status(400).json({ error: 'counter_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    
    await redisClient.set(redisKey, 0);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination counter reset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/semaphore/acquire - Acquire semaphore position
router.post('/semaphore/acquire', async (req, res) => {
  try {
    const { sem_id, max } = req.body;
    
    if (!sem_id || !max) {
      return res.status(400).json({ error: 'sem_id and max are required' });
    }
    
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    const position = await redisClient.incr(redisKey);
    
    if (position > max) {
      await redisClient.decr(redisKey);
      return res.json({ ok: false, reason: 'semaphore_full' });
    }
    
    res.json({ ok: true, position });
  } catch (error) {
    console.error('Coordination semaphore acquire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/semaphore/release - Release semaphore position
router.post('/semaphore/release', async (req, res) => {
  try {
    const { sem_id } = req.body;
    
    if (!sem_id) {
      return res.status(400).json({ error: 'sem_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    
    const value = await redisClient.decr(redisKey);
    
    if (value < 0) {
      await redisClient.incr(redisKey);
      return res.json({ ok: false, reason: 'semaphore_empty' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination semaphore release error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/semaphore/status/:sem_id - Get semaphore status
router.get('/semaphore/status/:sem_id', async (req, res) => {
  try {
    const { sem_id } = req.params;
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    
    const count = await redisClient.get(redisKey);
    
    if (count === null) {
      return res.json({ count: 0, max: null });
    }
    
    res.json({ count: parseInt(count, 10), max: null });
  } catch (error) {
    console.error('Coordination semaphore status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/election/nominate - Nominate a candidate for election
router.post('/election/nominate', async (req, res) => {
  try {
    const { election_id, candidate_id } = req.body;
    
    if (!election_id || !candidate_id) {
      return res.status(400).json({ error: 'election_id and candidate_id are required' });
    }
    
    const redisKey = NS_PREFIX + 'election:' + election_id;
    const candidateKey = redisKey + ':candidate:' + candidate_id;
    
    await redisClient.hincrby(redisKey, candidate_id, 1);
    await redisClient.sadd(redisKey + ':candidates', candidate_id);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination election nominate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/election/result/:election_id - Get election result
router.get('/election/result/:election_id', async (req, res) => {
  try {
    const { election_id } = req.params;
    const redisKey = NS_PREFIX + 'election:' + election_id;
    
    const candidates = await redisClient.smembers(redisKey + ':candidates');
    
    if (candidates.length === 0) {
      return res.json({ leader: null, votes: {} });
    }
    
    const votes = {};
    let maxVotes = 0;
    let leader = null;
    
    for (const candidate of candidates) {
      const voteCount = await redisClient.hget(redisKey, candidate);
      const count = voteCount ? parseInt(voteCount, 10) : 0;
      votes[candidate] = count;
      
      if (count > maxVotes) {
        maxVotes = count;
        leader = candidate;
      }
    }
    
    res.json({ leader, votes });
  } catch (error) {
    console.error('Coordination election result error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/try-acquire - Try to acquire lock without blocking
router.post('/lock/try-acquire', async (req, res) => {
  try {
    const { resource_id, ttl_seconds } = req.body;
    
    if (!resource_id || !ttl_seconds) {
      return res.status(400).json({ error: 'resource_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'lock:' + resource_id;
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const result = await redisClient.set(redisKey, token, 'NX', 'EX', ttl_seconds);
    
    if (result === null) {
      return res.json({ ok: false, locked: true, token: null });
    }
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Coordination lock try-acquire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/renew - Renew a lock
router.post('/lock/renew', async (req, res) => {
  try {
    const { resource_id, token, ttl_seconds } = req.body;
    
    if (!resource_id || !token || !ttl_seconds) {
      return res.status(400).json({ error: 'resource_id, token, and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'lock:' + resource_id;
    
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, token, ttl_seconds);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination lock renew error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/extend - Extend lock TTL
router.post('/lock/extend', async (req, res) => {
  try {
    const { resource_id, token, additional_seconds } = req.body;
    
    if (!resource_id || !token || !additional_seconds) {
      return res.status(400).json({ error: 'resource_id, token, and additional_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'lock:' + resource_id;
    
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        local ttl = redis.call("ttl", KEYS[1])
        if ttl > 0 then
          return redis.call("expire", KEYS[1], ttl + ARGV[2])
        end
      end
      return 0
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, token, additional_seconds);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch_or_expired' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination lock extend error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/force-release - Force release a lock (without token)
router.post('/lock/force-release', async (req, res) => {
  try {
    const { resource_id } = req.body;
    
    if (!resource_id) {
      return res.status(400).json({ error: 'resource_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'lock:' + resource_id;
    const result = await redisClient.del(redisKey);
    
    res.json({ ok: true, removed: result });
  } catch (error) {
    console.error('Coordination lock force-release error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/lock/list - List all locks
router.get('/lock/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + 'lock:*';
    const keys = await redisClient.keys(pattern);
    
    const locks = await Promise.all(keys.map(async (key) => {
      const resource_id = key.replace(NS_PREFIX + 'lock:', '');
      const ttl = await redisClient.ttl(key);
      return { resource_id, ttl: ttl === -1 ? null : ttl };
    }));
    
    res.json({ locks });
  } catch (error) {
    console.error('Coordination lock list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/batch-acquire - Acquire multiple locks
router.post('/lock/batch-acquire', async (req, res) => {
  try {
    const { resource_ids, ttl_seconds } = req.body;
    
    if (!Array.isArray(resource_ids) || !ttl_seconds) {
      return res.status(400).json({ error: 'resource_ids array and ttl_seconds are required' });
    }
    
    const results = [];
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    for (const resource_id of resource_ids) {
      const redisKey = NS_PREFIX + 'lock:' + resource_id;
      const result = await redisClient.set(redisKey, token, 'NX', 'EX', ttl_seconds);
      results.push({ resource_id, acquired: result !== null });
    }
    
    const allAcquired = results.every(r => r.acquired);
    
    if (!allAcquired) {
      // Release any acquired locks
      for (const r of results) {
        if (r.acquired) {
          const redisKey = NS_PREFIX + 'lock:' + r.resource_id;
          await redisClient.del(redisKey);
        }
      }
    }
    
    res.json({ ok: allAcquired, token, results });
  } catch (error) {
    console.error('Coordination lock batch-acquire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lock/batch-release - Release multiple locks
router.post('/lock/batch-release', async (req, res) => {
  try {
    const { resource_ids, token } = req.body;
    
    if (!Array.isArray(resource_ids) || !token) {
      return res.status(400).json({ error: 'resource_ids array and token are required' });
    }
    
    const results = [];
    
    for (const resource_id of resource_ids) {
      const redisKey = NS_PREFIX + 'lock:' + resource_id;
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await redisClient.eval(luaScript, 1, redisKey, token);
      results.push({ resource_id, released: result === 1 });
    }
    
    res.json({ ok: true, results });
  } catch (error) {
    console.error('Coordination lock batch-release error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/set - Set counter value
router.post('/counter/set', async (req, res) => {
  try {
    const { counter_id, value } = req.body;
    
    if (!counter_id || value === undefined) {
      return res.status(400).json({ error: 'counter_id and value are required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    await redisClient.set(redisKey, value);
    
    res.json({ ok: true, value });
  } catch (error) {
    console.error('Coordination counter set error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/increment-with-expiry - Increment with expiry
router.post('/counter/increment-with-expiry', async (req, res) => {
  try {
    const { counter_id, by, ttl_seconds } = req.body;
    
    if (!counter_id) {
      return res.status(400).json({ error: 'counter_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    const incrementBy = by || 1;
    
    const value = await redisClient.incrby(redisKey, incrementBy);
    
    if (ttl_seconds) {
      await redisClient.expire(redisKey, ttl_seconds);
    }
    
    res.json({ value, ttl: ttl_seconds || null });
  } catch (error) {
    console.error('Coordination counter increment-with-expiry error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/counter/list - List all counters
router.get('/counter/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + 'counter:*';
    const keys = await redisClient.keys(pattern);
    
    const counters = await Promise.all(keys.map(async (key) => {
      const counter_id = key.replace(NS_PREFIX + 'counter:', '');
      const value = await redisClient.get(key);
      const ttl = await redisClient.ttl(key);
      return { counter_id, value: value ? parseInt(value, 10) : 0, ttl: ttl === -1 ? null : ttl };
    }));
    
    res.json({ counters });
  } catch (error) {
    console.error('Coordination counter list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/delete - Delete a counter
router.post('/counter/delete', async (req, res) => {
  try {
    const { counter_id } = req.body;
    
    if (!counter_id) {
      return res.status(400).json({ error: 'counter_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    const result = await redisClient.del(redisKey);
    
    res.json({ ok: true, removed: result });
  } catch (error) {
    console.error('Coordination counter delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/batch-increment - Increment multiple counters
router.post('/counter/batch-increment', async (req, res) => {
  try {
    const { counters } = req.body;
    
    if (!Array.isArray(counters)) {
      return res.status(400).json({ error: 'counters array is required' });
    }
    
    const results = [];
    
    for (const { counter_id, by } of counters) {
      const redisKey = NS_PREFIX + 'counter:' + counter_id;
      const incrementBy = by || 1;
      const value = await redisClient.incrby(redisKey, incrementBy);
      results.push({ counter_id, value });
    }
    
    res.json({ ok: true, results });
  } catch (error) {
    console.error('Coordination counter batch-increment error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/counter/compare-and-set - Compare and set
router.post('/counter/compare-and-set', async (req, res) => {
  try {
    const { counter_id, expected, new_value } = req.body;
    
    if (!counter_id || expected === undefined || new_value === undefined) {
      return res.status(400).json({ error: 'counter_id, expected, and new_value are required' });
    }
    
    const redisKey = NS_PREFIX + 'counter:' + counter_id;
    
    const luaScript = `
      local current = redis.call("get", KEYS[1])
      if current == ARGV[1] then
        redis.call("set", KEYS[1], ARGV[2])
        return 1
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, String(expected), String(new_value));
    
    res.json({ ok: result === 1, current: await redisClient.get(redisKey) });
  } catch (error) {
    console.error('Coordination counter compare-and-set error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/semaphore/set-max - Set semaphore max value
router.post('/semaphore/set-max', async (req, res) => {
  try {
    const { sem_id, max } = req.body;
    
    if (!sem_id || !max) {
      return res.status(400).json({ error: 'sem_id and max are required' });
    }
    
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    const configKey = NS_PREFIX + 'semaphore:' + sem_id + ':config';
    
    await redisClient.set(configKey, max);
    
    res.json({ ok: true, max });
  } catch (error) {
    console.error('Coordination semaphore set-max error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/semaphore/config/:sem_id - Get semaphore config
router.get('/semaphore/config/:sem_id', async (req, res) => {
  try {
    const { sem_id } = req.params;
    const configKey = NS_PREFIX + 'semaphore:' + sem_id + ':config';
    
    const max = await redisClient.get(configKey);
    
    res.json({ max: max ? parseInt(max, 10) : null });
  } catch (error) {
    console.error('Coordination semaphore config error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/semaphore/reset - Reset semaphore
router.post('/semaphore/reset', async (req, res) => {
  try {
    const { sem_id } = req.body;
    
    if (!sem_id) {
      return res.status(400).json({ error: 'sem_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    
    await redisClient.set(redisKey, 0);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination semaphore reset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/semaphore/list - List all semaphores
router.get('/semaphore/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + 'semaphore:*';
    const keys = await redisClient.keys(pattern);
    
    const semaphores = await Promise.all(keys.map(async (key) => {
      if (key.includes(':config')) return null;
      
      const sem_id = key.replace(NS_PREFIX + 'semaphore:', '');
      const count = await redisClient.get(key);
      const configKey = NS_PREFIX + 'semaphore:' + sem_id + ':config';
      const max = await redisClient.get(configKey);
      
      return { sem_id, count: count ? parseInt(count, 10) : 0, max: max ? parseInt(max, 10) : null };
    }));
    
    res.json({ semaphores: semaphores.filter(s => s !== null) });
  } catch (error) {
    console.error('Coordination semaphore list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/semaphore/delete - Delete semaphore
router.post('/semaphore/delete', async (req, res) => {
  try {
    const { sem_id } = req.body;
    
    if (!sem_id) {
      return res.status(400).json({ error: 'sem_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    const configKey = NS_PREFIX + 'semaphore:' + sem_id + ':config';
    
    await redisClient.del(redisKey, configKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination semaphore delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/semaphore/acquire-with-timeout - Acquire with timeout
router.post('/semaphore/acquire-with-timeout', async (req, res) => {
  try {
    const { sem_id, max, timeout_ms } = req.body;
    
    if (!sem_id || !max) {
      return res.status(400).json({ error: 'sem_id and max are required' });
    }
    
    const redisKey = NS_PREFIX + 'semaphore:' + sem_id;
    const startTime = Date.now();
    const timeout = timeout_ms || 5000;
    
    while (Date.now() - startTime < timeout) {
      const position = await redisClient.incr(redisKey);
      
      if (position <= max) {
        return res.json({ ok: true, position });
      }
      
      await redisClient.decr(redisKey);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    res.json({ ok: false, reason: 'timeout' });
  } catch (error) {
    console.error('Coordination semaphore acquire-with-timeout error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/election/reset - Reset election
router.post('/election/reset', async (req, res) => {
  try {
    const { election_id } = req.body;
    
    if (!election_id) {
      return res.status(400).json({ error: 'election_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'election:' + election_id;
    
    await redisClient.del(redisKey, redisKey + ':candidates');
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination election reset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/election/vote - Vote for a candidate
router.post('/election/vote', async (req, res) => {
  try {
    const { election_id, candidate_id, voter_id } = req.body;
    
    if (!election_id || !candidate_id || !voter_id) {
      return res.status(400).json({ error: 'election_id, candidate_id, and voter_id are required' });
    }
    
    const redisKey = NS_PREFIX + 'election:' + election_id;
    const voteKey = redisKey + ':vote:' + voter_id;
    
    // Check if already voted
    const existingVote = await redisClient.get(voteKey);
    if (existingVote) {
      return res.json({ ok: false, reason: 'already_voted', voted_for: existingVote });
    }
    
    await redisClient.hincrby(redisKey, candidate_id, 1);
    await redisClient.sadd(redisKey + ':candidates', candidate_id);
    await redisClient.set(voteKey, candidate_id);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination election vote error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/election/candidates/:election_id - Get all candidates
router.get('/election/candidates/:election_id', async (req, res) => {
  try {
    const { election_id } = req.params;
    const redisKey = NS_PREFIX + 'election:' + election_id;
    
    const candidates = await redisClient.smembers(redisKey + ':candidates');
    
    res.json({ candidates });
  } catch (error) {
    console.error('Coordination election candidates error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/election/withdraw - Withdraw a candidate
router.post('/election/withdraw', async (req, res) => {
  try {
    const { election_id, candidate_id } = req.body;
    
    if (!election_id || !candidate_id) {
      return res.status(400).json({ error: 'election_id and candidate_id are required' });
    }
    
    const redisKey = NS_PREFIX + 'election:' + election_id;
    
    await redisClient.hdel(redisKey, candidate_id);
    await redisClient.srem(redisKey + ':candidates', candidate_id);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination election withdraw error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/election/list - List all elections
router.get('/election/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + 'election:*';
    const keys = await redisClient.keys(pattern);
    
    const elections = [];
    
    for (const key of keys) {
      if (key.includes(':candidates') || key.includes(':vote:')) continue;
      
      const election_id = key.replace(NS_PREFIX + 'election:', '');
      const candidates = await redisClient.smembers(key + ':candidates');
      elections.push({ election_id, candidate_count: candidates.length });
    }
    
    res.json({ elections });
  } catch (error) {
    console.error('Coordination election list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/barrier/create - Create a barrier
router.post('/barrier/create', async (req, res) => {
  try {
    const { barrier_id, expected } = req.body;
    
    if (!barrier_id || !expected) {
      return res.status(400).json({ error: 'barrier_id and expected are required' });
    }
    
    const redisKey = NS_PREFIX + 'barrier:' + barrier_id;
    const configKey = redisKey + ':config';
    
    await redisClient.set(configKey, expected);
    await redisClient.del(redisKey);
    
    res.json({ ok: true, expected });
  } catch (error) {
    console.error('Coordination barrier create error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/barrier/wait - Wait at barrier
router.post('/barrier/wait', async (req, res) => {
  try {
    const { barrier_id, participant_id } = req.body;
    
    if (!barrier_id || !participant_id) {
      return res.status(400).json({ error: 'barrier_id and participant_id are required' });
    }
    
    const redisKey = NS_PREFIX + 'barrier:' + barrier_id;
    const configKey = redisKey + ':config';
    
    const expected = await redisClient.get(configKey);
    if (!expected) {
      return res.json({ ok: false, reason: 'barrier_not_found' });
    }
    
    const count = await redisClient.sadd(redisKey, participant_id);
    const currentCount = await redisClient.scard(redisKey);
    
    const released = currentCount >= parseInt(expected);
    
    res.json({ ok: true, released, current_count: currentCount, expected: parseInt(expected) });
  } catch (error) {
    console.error('Coordination barrier wait error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/barrier/reset - Reset barrier
router.post('/barrier/reset', async (req, res) => {
  try {
    const { barrier_id } = req.body;
    
    if (!barrier_id) {
      return res.status(400).json({ error: 'barrier_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'barrier:' + barrier_id;
    
    await redisClient.del(redisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination barrier reset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/barrier/status/:barrier_id - Get barrier status
router.get('/barrier/status/:barrier_id', async (req, res) => {
  try {
    const { barrier_id } = req.params;
    const redisKey = NS_PREFIX + 'barrier:' + barrier_id;
    const configKey = redisKey + ':config';
    
    const expected = await redisClient.get(configKey);
    const currentCount = await redisClient.scard(redisKey);
    
    res.json({ 
      expected: expected ? parseInt(expected) : null, 
      current_count: currentCount,
      released: expected ? currentCount >= parseInt(expected) : false
    });
  } catch (error) {
    console.error('Coordination barrier status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/rwlock/acquire-read - Acquire read lock
router.post('/rwlock/acquire-read', async (req, res) => {
  try {
    const { resource_id, ttl_seconds } = req.body;
    
    if (!resource_id || !ttl_seconds) {
      return res.status(400).json({ error: 'resource_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'rwlock:' + resource_id;
    const readLockKey = redisKey + ':readers';
    const writeLockKey = redisKey + ':writer';
    
    // Check if write lock exists
    const writeLock = await redisClient.exists(writeLockKey);
    if (writeLock) {
      return res.json({ ok: false, reason: 'write_lock_held' });
    }
    
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    await redisClient.sadd(readLockKey, token);
    await redisClient.expire(readLockKey, ttl_seconds);
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Coordination rwlock acquire-read error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/rwlock/acquire-write - Acquire write lock
router.post('/rwlock/acquire-write', async (req, res) => {
  try {
    const { resource_id, ttl_seconds } = req.body;
    
    if (!resource_id || !ttl_seconds) {
      return res.status(400).json({ error: 'resource_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'rwlock:' + resource_id;
    const readLockKey = redisKey + ':readers';
    const writeLockKey = redisKey + ':writer';
    
    // Check if any readers exist
    const readerCount = await redisClient.scard(readLockKey);
    if (readerCount > 0) {
      return res.json({ ok: false, reason: 'read_locks_held', count: readerCount });
    }
    
    // Check if write lock exists
    const writeLock = await redisClient.exists(writeLockKey);
    if (writeLock) {
      return res.json({ ok: false, reason: 'write_lock_held' });
    }
    
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const result = await redisClient.set(writeLockKey, token, 'NX', 'EX', ttl_seconds);
    
    if (result === null) {
      return res.json({ ok: false, reason: 'lock_failed' });
    }
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Coordination rwlock acquire-write error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/rwlock/release-read - Release read lock
router.post('/rwlock/release-read', async (req, res) => {
  try {
    const { resource_id, token } = req.body;
    
    if (!resource_id || !token) {
      return res.status(400).json({ error: 'resource_id and token are required' });
    }
    
    const redisKey = NS_PREFIX + 'rwlock:' + resource_id;
    const readLockKey = redisKey + ':readers';
    
    const removed = await redisClient.srem(readLockKey, token);
    
    res.json({ ok: true, removed: removed === 1 });
  } catch (error) {
    console.error('Coordination rwlock release-read error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/rwlock/release-write - Release write lock
router.post('/rwlock/release-write', async (req, res) => {
  try {
    const { resource_id, token } = req.body;
    
    if (!resource_id || !token) {
      return res.status(400).json({ error: 'resource_id and token are required' });
    }
    
    const redisKey = NS_PREFIX + 'rwlock:' + resource_id;
    const writeLockKey = redisKey + ':writer';
    
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(luaScript, 1, writeLockKey, token);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination rwlock release-write error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/rwlock/status/:resource_id - Get rwlock status
router.get('/rwlock/status/:resource_id', async (req, res) => {
  try {
    const { resource_id } = req.params;
    const redisKey = NS_PREFIX + 'rwlock:' + resource_id;
    const readLockKey = redisKey + ':readers';
    const writeLockKey = redisKey + ':writer';
    
    const readerCount = await redisClient.scard(readLockKey);
    const writeLock = await redisClient.exists(writeLockKey);
    const writeTtl = writeLock ? await redisClient.ttl(writeLockKey) : null;
    
    res.json({ 
      readers: readerCount, 
      write_locked: writeLock === 1,
      write_ttl: writeTtl === -1 ? null : writeTtl
    });
  } catch (error) {
    console.error('Coordination rwlock status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/leader/elect - Elect a leader
router.post('/leader/elect', async (req, res) => {
  try {
    const { leader_id, ttl_seconds } = req.body;
    
    if (!leader_id || !ttl_seconds) {
      return res.status(400).json({ error: 'leader_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'leader';
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const result = await redisClient.set(redisKey, JSON.stringify({ leader_id, token }), 'NX', 'EX', ttl_seconds);
    
    if (result === null) {
      const current = await redisClient.get(redisKey);
      const parsed = JSON.parse(current);
      return res.json({ ok: false, current_leader: parsed.leader_id });
    }
    
    res.json({ ok: true, leader_id, token });
  } catch (error) {
    console.error('Coordination leader elect error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/leader/heartbeat - Send heartbeat for leader
router.post('/leader/heartbeat', async (req, res) => {
  try {
    const { leader_id, token, ttl_seconds } = req.body;
    
    if (!leader_id || !token || !ttl_seconds) {
      return res.status(400).json({ error: 'leader_id, token, and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'leader';
    
    const luaScript = `
      local current = redis.call("get", KEYS[1])
      if current then
        local parsed = cjson.decode(current)
        if parsed.leader_id == ARGV[1] and parsed.token == ARGV[2] then
          redis.call("set", KEYS[1], current, "EX", ARGV[3])
          return 1
        end
      end
      return 0
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, leader_id, token, ttl_seconds);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'not_leader_or_token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination leader heartbeat error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/leader/status - Get leader status
router.get('/leader/status', async (req, res) => {
  try {
    const redisKey = NS_PREFIX + 'leader';
    
    const current = await redisClient.get(redisKey);
    
    if (!current) {
      return res.json({ leader: null, ttl: null });
    }
    
    const parsed = JSON.parse(current);
    const ttl = await redisClient.ttl(redisKey);
    
    res.json({ leader: parsed.leader_id, ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Coordination leader status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/leader/resign - Resign leadership
router.post('/leader/resign', async (req, res) => {
  try {
    const { leader_id, token } = req.body;
    
    if (!leader_id || !token) {
      return res.status(400).json({ error: 'leader_id and token are required' });
    }
    
    const redisKey = NS_PREFIX + 'leader';
    
    const luaScript = `
      local current = redis.call("get", KEYS[1])
      if current then
        local parsed = cjson.decode(current)
        if parsed.leader_id == ARGV[1] and parsed.token == ARGV[2] then
          redis.call("del", KEYS[1])
          return 1
        end
      end
      return 0
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, leader_id, token);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'not_leader_or_token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination leader resign error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/quorum/propose - Propose a value for quorum
router.post('/quorum/propose', async (req, res) => {
  try {
    const { quorum_id, value, required } = req.body;
    
    if (!quorum_id || value === undefined || !required) {
      return res.status(400).json({ error: 'quorum_id, value, and required are required' });
    }
    
    const redisKey = NS_PREFIX + 'quorum:' + quorum_id;
    const configKey = redisKey + ':config';
    
    await redisClient.set(configKey, required);
    await redisClient.set(redisKey, JSON.stringify({ value, timestamp: Date.now() }));
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination quorum propose error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/quorum/ack - Acknowledge a quorum proposal
router.post('/quorum/ack', async (req, res) => {
  try {
    const { quorum_id, node_id } = req.body;
    
    if (!quorum_id || !node_id) {
      return res.status(400).json({ error: 'quorum_id and node_id are required' });
    }
    
    const redisKey = NS_PREFIX + 'quorum:' + quorum_id;
    const ackKey = redisKey + ':acks';
    
    await redisClient.sadd(ackKey, node_id);
    const ackCount = await redisClient.scard(ackKey);
    
    const configKey = redisKey + ':config';
    const required = await redisClient.get(configKey);
    
    const reached = required ? ackCount >= parseInt(required) : false;
    
    res.json({ ok: true, ack_count: ackCount, required: required ? parseInt(required) : null, reached });
  } catch (error) {
    console.error('Coordination quorum ack error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/quorum/status/:quorum_id - Get quorum status
router.get('/quorum/status/:quorum_id', async (req, res) => {
  try {
    const { quorum_id } = req.params;
    const redisKey = NS_PREFIX + 'quorum:' + quorum_id;
    const ackKey = redisKey + ':acks';
    const configKey = redisKey + ':config';
    
    const proposal = await redisClient.get(redisKey);
    const ackCount = await redisClient.scard(ackKey);
    const required = await redisClient.get(configKey);
    
    res.json({ 
      proposal: proposal ? JSON.parse(proposal) : null,
      ack_count: ackCount,
      required: required ? parseInt(required) : null,
      reached: required ? ackCount >= parseInt(required) : false
    });
  } catch (error) {
    console.error('Coordination quorum status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/quorum/reset - Reset quorum
router.post('/quorum/reset', async (req, res) => {
  try {
    const { quorum_id } = req.body;
    
    if (!quorum_id) {
      return res.status(400).json({ error: 'quorum_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'quorum:' + quorum_id;
    const ackKey = redisKey + ':acks';
    const configKey = redisKey + ':config';
    
    await redisClient.del(redisKey, ackKey, configKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination quorum reset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/mutex/acquire - Acquire mutex (single holder)
router.post('/mutex/acquire', async (req, res) => {
  try {
    const { mutex_id, ttl_seconds } = req.body;
    
    if (!mutex_id || !ttl_seconds) {
      return res.status(400).json({ error: 'mutex_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'mutex:' + mutex_id;
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const result = await redisClient.set(redisKey, token, 'NX', 'EX', ttl_seconds);
    
    if (result === null) {
      return res.json({ ok: false, locked: true });
    }
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Coordination mutex acquire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/mutex/release - Release mutex
router.post('/mutex/release', async (req, res) => {
  try {
    const { mutex_id, token } = req.body;
    
    if (!mutex_id || !token) {
      return res.status(400).json({ error: 'mutex_id and token are required' });
    }
    
    const redisKey = NS_PREFIX + 'mutex:' + mutex_id;
    
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, token);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination mutex release error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/mutex/status/:mutex_id - Get mutex status
router.get('/mutex/status/:mutex_id', async (req, res) => {
  try {
    const { mutex_id } = req.params;
    const redisKey = NS_PREFIX + 'mutex:' + mutex_id;
    
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 0) {
      return res.json({ locked: false, ttl: null });
    }
    
    const ttl = await redisClient.ttl(redisKey);
    
    res.json({ locked: true, ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Coordination mutex status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/latch/countdown - Create countdown latch
router.post('/latch/countdown', async (req, res) => {
  try {
    const { latch_id, count } = req.body;
    
    if (!latch_id || !count) {
      return res.status(400).json({ error: 'latch_id and count are required' });
    }
    
    const redisKey = NS_PREFIX + 'latch:' + latch_id;
    
    await redisClient.set(redisKey, count);
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Coordination latch countdown error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/latch/decrement - Decrement latch
router.post('/latch/decrement', async (req, res) => {
  try {
    const { latch_id } = req.body;
    
    if (!latch_id) {
      return res.status(400).json({ error: 'latch_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'latch:' + latch_id;
    
    const value = await redisClient.decr(redisKey);
    
    if (value < 0) {
      await redisClient.incr(redisKey);
      return res.json({ ok: false, reason: 'already_zero', value: 0 });
    }
    
    res.json({ ok: true, value });
  } catch (error) {
    console.error('Coordination latch decrement error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/latch/status/:latch_id - Get latch status
router.get('/latch/status/:latch_id', async (req, res) => {
  try {
    const { latch_id } = req.params;
    const redisKey = NS_PREFIX + 'latch:' + latch_id;
    
    const value = await redisClient.get(redisKey);
    
    res.json({ value: value ? parseInt(value, 10) : 0, complete: value === '0' });
  } catch (error) {
    console.error('Coordination latch status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/flag/set - Set a distributed flag
router.post('/flag/set', async (req, res) => {
  try {
    const { flag_id, ttl_seconds } = req.body;
    
    if (!flag_id) {
      return res.status(400).json({ error: 'flag_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'flag:' + flag_id;
    
    if (ttl_seconds) {
      await redisClient.set(redisKey, '1', 'EX', ttl_seconds);
    } else {
      await redisClient.set(redisKey, '1');
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination flag set error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/flag/check/:flag_id - Check flag
router.get('/flag/check/:flag_id', async (req, res) => {
  try {
    const { flag_id } = req.params;
    const redisKey = NS_PREFIX + 'flag:' + flag_id;
    
    const exists = await redisClient.exists(redisKey);
    
    res.json({ set: exists === 1 });
  } catch (error) {
    console.error('Coordination flag check error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/flag/clear - Clear a flag
router.post('/flag/clear', async (req, res) => {
  try {
    const { flag_id } = req.body;
    
    if (!flag_id) {
      return res.status(400).json({ error: 'flag_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'flag:' + flag_id;
    
    await redisClient.del(redisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination flag clear error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/flag/toggle - Toggle a flag
router.post('/flag/toggle', async (req, res) => {
  try {
    const { flag_id } = req.body;
    
    if (!flag_id) {
      return res.status(400).json({ error: 'flag_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'flag:' + flag_id;
    
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 1) {
      await redisClient.del(redisKey);
      res.json({ ok: true, set: false });
    } else {
      await redisClient.set(redisKey, '1');
      res.json({ ok: true, set: true });
    }
  } catch (error) {
    console.error('Coordination flag toggle error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/sequence/next - Get next sequence number
router.post('/sequence/next', async (req, res) => {
  try {
    const { sequence_id } = req.body;
    
    if (!sequence_id) {
      return res.status(400).json({ error: 'sequence_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'sequence:' + sequence_id;
    
    const value = await redisClient.incr(redisKey);
    
    res.json({ value });
  } catch (error) {
    console.error('Coordination sequence next error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/sequence/reset - Reset sequence
router.post('/sequence/reset', async (req, res) => {
  try {
    const { sequence_id, start } = req.body;
    
    if (!sequence_id) {
      return res.status(400).json({ error: 'sequence_id is required' });
    }
    
    const redisKey = NS_PREFIX + 'sequence:' + sequence_id;
    
    await redisClient.set(redisKey, start || 0);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination sequence reset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/sequence/current/:sequence_id - Get current sequence value
router.get('/sequence/current/:sequence_id', async (req, res) => {
  try {
    const { sequence_id } = req.params;
    const redisKey = NS_PREFIX + 'sequence:' + sequence_id;
    
    const value = await redisClient.get(redisKey);
    
    res.json({ value: value ? parseInt(value, 10) : 0 });
  } catch (error) {
    console.error('Coordination sequence current error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lease/acquire - Acquire a lease
router.post('/lease/acquire', async (req, res) => {
  try {
    const { lease_id, ttl_seconds } = req.body;
    
    if (!lease_id || !ttl_seconds) {
      return res.status(400).json({ error: 'lease_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'lease:' + lease_id;
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const result = await redisClient.set(redisKey, JSON.stringify({ token, expires_at: Date.now() + (ttl_seconds * 1000) }), 'NX', 'EX', ttl_seconds);
    
    if (result === null) {
      return res.json({ ok: false, leased: true });
    }
    
    res.json({ ok: true, token, expires_at: Date.now() + (ttl_seconds * 1000) });
  } catch (error) {
    console.error('Coordination lease acquire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lease/renew - Renew a lease
router.post('/lease/renew', async (req, res) => {
  try {
    const { lease_id, token, ttl_seconds } = req.body;
    
    if (!lease_id || !token || !ttl_seconds) {
      return res.status(400).json({ error: 'lease_id, token, and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + 'lease:' + lease_id;
    
    const luaScript = `
      local current = redis.call("get", KEYS[1])
      if current then
        local parsed = cjson.decode(current)
        if parsed.token == ARGV[1] then
          parsed.expires_at = ARGV[2]
          redis.call("set", KEYS[1], cjson.encode(parsed), "EX", ARGV[3])
          return 1
        end
      end
      return 0
    `;
    
    const expiresAt = Date.now() + (ttl_seconds * 1000);
    const result = await redisClient.eval(luaScript, 1, redisKey, token, String(expiresAt), ttl_seconds);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch' });
    }
    
    res.json({ ok: true, expires_at: expiresAt });
  } catch (error) {
    console.error('Coordination lease renew error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /coordination/lease/status/:lease_id - Get lease status
router.get('/lease/status/:lease_id', async (req, res) => {
  try {
    const { lease_id } = req.params;
    const redisKey = NS_PREFIX + 'lease:' + lease_id;
    
    const current = await redisClient.get(redisKey);
    
    if (!current) {
      return res.json({ leased: false, expires_at: null });
    }
    
    const parsed = JSON.parse(current);
    const ttl = await redisClient.ttl(redisKey);
    
    res.json({ leased: true, token: parsed.token, expires_at: parsed.expires_at, ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Coordination lease status error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /coordination/lease/release - Release a lease
router.post('/lease/release', async (req, res) => {
  try {
    const { lease_id, token } = req.body;
    
    if (!lease_id || !token) {
      return res.status(400).json({ error: 'lease_id and token are required' });
    }
    
    const redisKey = NS_PREFIX + 'lease:' + lease_id;
    
    const luaScript = `
      local current = redis.call("get", KEYS[1])
      if current then
        local parsed = cjson.decode(current)
        if parsed.token == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
      end
      return 0
    `;
    
    const result = await redisClient.eval(luaScript, 1, redisKey, token);
    
    if (result === 0) {
      return res.json({ ok: false, reason: 'token_mismatch' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Coordination lease release error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
