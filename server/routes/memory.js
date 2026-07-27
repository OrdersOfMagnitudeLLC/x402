const express = require('express');
const Redis = require('ioredis');

const router = express.Router();

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Namespace prefix for memory operations
const NS_PREFIX = 'memory:';

// POST /memory/set - Set a key with optional TTL
router.post('/set', async (req, res) => {
  try {
    const { key, value, ttl_seconds } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    
    if (ttl_seconds && ttl_seconds > 0) {
      await redisClient.setex(redisKey, ttl_seconds, JSON.stringify(value));
    } else {
      await redisClient.set(redisKey, JSON.stringify(value));
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory set error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/get/:key - Get a value by key
router.get('/get/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const value = await redisClient.get(redisKey);
    
    if (value === null) {
      return res.status(404).json({ error: 'key_not_found' });
    }
    
    res.json({ key, value: JSON.parse(value) });
  } catch (error) {
    console.error('Memory get error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/ttl/:key - Get TTL for a key
router.get('/ttl/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const ttl = await redisClient.ttl(redisKey);
    
    if (ttl === -2) {
      return res.status(404).json({ error: 'key_not_found' });
    }
    
    // -1 means no expiry
    res.json({ key, ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Memory ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /memory/delete/:key - Delete a key
router.delete('/delete/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const result = await redisClient.del(redisKey);
    
    if (result === 0) {
      return res.status(404).json({ error: 'key_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/batch-set - Set multiple keys
router.post('/batch-set', async (req, res) => {
  try {
    const { pairs } = req.body;
    
    if (!Array.isArray(pairs)) {
      return res.status(400).json({ error: 'pairs must be an array' });
    }
    
    let count = 0;
    for (const pair of pairs) {
      if (pair.key && pair.value !== undefined) {
        const redisKey = NS_PREFIX + pair.key;
        if (pair.ttl_seconds && pair.ttl_seconds > 0) {
          await redisClient.setex(redisKey, pair.ttl_seconds, JSON.stringify(pair.value));
        } else {
          await redisClient.set(redisKey, JSON.stringify(pair.value));
        }
        count++;
      }
    }
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Memory batch-set error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/batch-get - Get multiple keys
router.post('/batch-get', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys must be an array' });
    }
    
    const results = {};
    for (const key of keys) {
      const redisKey = NS_PREFIX + key;
      const value = await redisClient.get(redisKey);
      if (value !== null) {
        results[key] = JSON.parse(value);
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Memory batch-get error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/batch-delete - Delete multiple keys
router.post('/batch-delete', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys must be an array' });
    }
    
    const redisKeys = keys.map(k => NS_PREFIX + k);
    const count = await redisClient.del(...redisKeys);
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Memory batch-delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/increment - Increment a numeric value
router.post('/increment', async (req, res) => {
  try {
    const { key, by } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const incrementBy = by || 1;
    const value = await redisClient.incrby(redisKey, incrementBy);
    
    res.json({ value });
  } catch (error) {
    console.error('Memory increment error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/decrement - Decrement a numeric value
router.post('/decrement', async (req, res) => {
  try {
    const { key, by } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const decrementBy = by || 1;
    const value = await redisClient.decrby(redisKey, decrementBy);
    
    res.json({ value });
  } catch (error) {
    console.error('Memory decrement error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/append - Append to a string value
router.post('/append', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const length = await redisClient.append(redisKey, String(value));
    
    res.json({ length });
  } catch (error) {
    console.error('Memory append error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/exists/:key - Check if key exists
router.get('/exists/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const exists = await redisClient.exists(redisKey);
    
    res.json({ exists: exists === 1 });
  } catch (error) {
    console.error('Memory exists error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/rename - Rename a key
router.post('/rename', async (req, res) => {
  try {
    const { key, new_key } = req.body;
    
    if (!key || !new_key) {
      return res.status(400).json({ error: 'key and new_key are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const newRedisKey = NS_PREFIX + new_key;
    
    await redisClient.rename(redisKey, newRedisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory rename error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/copy - Copy a key
router.post('/copy', async (req, res) => {
  try {
    const { key, dest } = req.body;
    
    if (!key || !dest) {
      return res.status(400).json({ error: 'key and dest are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const destRedisKey = NS_PREFIX + dest;
    
    await redisClient.copy(redisKey, destRedisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory copy error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/persist/:key - Remove TTL from key
router.post('/persist/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const result = await redisClient.persist(redisKey);
    
    if (result === 0) {
      return res.status(404).json({ error: 'key_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory persist error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/expire - Set TTL on existing key
router.post('/expire', async (req, res) => {
  try {
    const { key, ttl_seconds } = req.body;
    
    if (!key || !ttl_seconds) {
      return res.status(400).json({ error: 'key and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const result = await redisClient.expire(redisKey, ttl_seconds);
    
    if (result === 0) {
      return res.status(404).json({ error: 'key_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory expire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/keys/:prefix - Get keys by prefix
router.get('/keys/:prefix', async (req, res) => {
  try {
    const { prefix } = req.params;
    const pattern = NS_PREFIX + prefix + '*';
    
    const keys = await redisClient.keys(pattern);
    
    // Remove namespace prefix from results
    const cleanKeys = keys.map(k => k.replace(NS_PREFIX, ''));
    
    res.json({ keys: cleanKeys });
  } catch (error) {
    console.error('Memory keys error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/size/:key - Get size of value in bytes
router.get('/size/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const value = await redisClient.get(redisKey);
    
    if (value === null) {
      return res.status(404).json({ error: 'key_not_found' });
    }
    
    const bytes = Buffer.byteLength(value, 'utf8');
    
    res.json({ bytes });
  } catch (error) {
    console.error('Memory size error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/getset - Set value and return old value
router.post('/getset', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const oldValue = await redisClient.getset(redisKey, JSON.stringify(value));
    
    res.json({ old_value: oldValue ? JSON.parse(oldValue) : null });
  } catch (error) {
    console.error('Memory getset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/setnx - Set only if key doesn't exist
router.post('/setnx', async (req, res) => {
  try {
    const { key, value, ttl_seconds } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const result = await redisClient.setnx(redisKey, JSON.stringify(value));
    
    if (result === 1 && ttl_seconds && ttl_seconds > 0) {
      await redisClient.expire(redisKey, ttl_seconds);
    }
    
    res.json({ ok: true, set: result === 1 });
  } catch (error) {
    console.error('Memory setnx error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/hset - Set hash field
router.post('/hset', async (req, res) => {
  try {
    const { key, field, value } = req.body;
    
    if (!key || !field || value === undefined) {
      return res.status(400).json({ error: 'key, field, and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    await redisClient.hset(redisKey, field, JSON.stringify(value));
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory hset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/hget - Get hash field
router.post('/hget', async (req, res) => {
  try {
    const { key, field } = req.body;
    
    if (!key || !field) {
      return res.status(400).json({ error: 'key and field are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const value = await redisClient.hget(redisKey, field);
    
    if (value === null) {
      return res.status(404).json({ error: 'field_not_found' });
    }
    
    res.json({ value: JSON.parse(value) });
  } catch (error) {
    console.error('Memory hget error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/hmset - Set multiple hash fields
router.post('/hmset', async (req, res) => {
  try {
    const { key, fields } = req.body;
    
    if (!key || !fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'key and fields object are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const redisFields = {};
    for (const [k, v] of Object.entries(fields)) {
      redisFields[k] = JSON.stringify(v);
    }
    
    await redisClient.hmset(redisKey, redisFields);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory hmset error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/hmget - Get multiple hash fields
router.post('/hmget', async (req, res) => {
  try {
    const { key, fields } = req.body;
    
    if (!key || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'key and fields array are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const values = await redisClient.hmget(redisKey, ...fields);
    
    const result = {};
    fields.forEach((field, i) => {
      result[field] = values[i] ? JSON.parse(values[i]) : null;
    });
    
    res.json({ values: result });
  } catch (error) {
    console.error('Memory hmget error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/hgetall/:key - Get all hash fields
router.get('/hgetall/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const fields = await redisClient.hgetall(redisKey);
    
    const result = {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = JSON.parse(v);
    }
    
    res.json({ fields: result });
  } catch (error) {
    console.error('Memory hgetall error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /memory/hdel - Delete hash field
router.delete('/hdel', async (req, res) => {
  try {
    const { key, field } = req.body;
    
    if (!key || !field) {
      return res.status(400).json({ error: 'key and field are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const result = await redisClient.hdel(redisKey, field);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory hdel error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/hkeys/:key - Get all hash field names
router.get('/hkeys/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const fields = await redisClient.hkeys(redisKey);
    
    res.json({ fields });
  } catch (error) {
    console.error('Memory hkeys error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/hlen/:key - Get hash field count
router.get('/hlen/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const count = await redisClient.hlen(redisKey);
    
    res.json({ count });
  } catch (error) {
    console.error('Memory hlen error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/lpush - Push to left of list
router.post('/lpush', async (req, res) => {
  try {
    const { key, values } = req.body;
    
    if (!key || !Array.isArray(values)) {
      return res.status(400).json({ error: 'key and values array are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const stringValues = values.map(v => JSON.stringify(v));
    const length = await redisClient.lpush(redisKey, ...stringValues);
    
    res.json({ length });
  } catch (error) {
    console.error('Memory lpush error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/rpush - Push to right of list
router.post('/rpush', async (req, res) => {
  try {
    const { key, values } = req.body;
    
    if (!key || !Array.isArray(values)) {
      return res.status(400).json({ error: 'key and values array are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const stringValues = values.map(v => JSON.stringify(v));
    const length = await redisClient.rpush(redisKey, ...stringValues);
    
    res.json({ length });
  } catch (error) {
    console.error('Memory rpush error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/lpop - Pop from left of list
router.post('/lpop', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const value = await redisClient.lpop(redisKey);
    
    if (value === null) {
      return res.json({ value: null });
    }
    
    res.json({ value: JSON.parse(value) });
  } catch (error) {
    console.error('Memory lpop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/rpop - Pop from right of list
router.post('/rpop', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const value = await redisClient.rpop(redisKey);
    
    if (value === null) {
      return res.json({ value: null });
    }
    
    res.json({ value: JSON.parse(value) });
  } catch (error) {
    console.error('Memory rpop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/lrange - Get range of list
router.get('/lrange', async (req, res) => {
  try {
    const { key, start, stop } = req.query;
    
    if (!key || start === undefined || stop === undefined) {
      return res.status(400).json({ error: 'key, start, and stop are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const items = await redisClient.lrange(redisKey, parseInt(start), parseInt(stop));
    
    const parsedItems = items.map(i => JSON.parse(i));
    
    res.json({ items: parsedItems });
  } catch (error) {
    console.error('Memory lrange error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/llen/:key - Get list length
router.get('/llen/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const length = await redisClient.llen(redisKey);
    
    res.json({ length });
  } catch (error) {
    console.error('Memory llen error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/sadd - Add to set
router.post('/sadd', async (req, res) => {
  try {
    const { key, members } = req.body;
    
    if (!key || !Array.isArray(members)) {
      return res.status(400).json({ error: 'key and members array are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const stringMembers = members.map(m => JSON.stringify(m));
    const added = await redisClient.sadd(redisKey, ...stringMembers);
    
    res.json({ added });
  } catch (error) {
    console.error('Memory sadd error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/srem - Remove from set
router.post('/srem', async (req, res) => {
  try {
    const { key, members } = req.body;
    
    if (!key || !Array.isArray(members)) {
      return res.status(400).json({ error: 'key and members array are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const stringMembers = members.map(m => JSON.stringify(m));
    const removed = await redisClient.srem(redisKey, ...stringMembers);
    
    res.json({ removed });
  } catch (error) {
    console.error('Memory srem error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/smembers/:key - Get all set members
router.get('/smembers/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const members = await redisClient.smembers(redisKey);
    const parsedMembers = members.map(m => JSON.parse(m));
    
    res.json({ members: parsedMembers });
  } catch (error) {
    console.error('Memory smembers error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/sismember - Check if member in set
router.post('/sismember', async (req, res) => {
  try {
    const { key, member } = req.body;
    
    if (!key || member === undefined) {
      return res.status(400).json({ error: 'key and member are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const isMember = await redisClient.sismember(redisKey, JSON.stringify(member));
    
    res.json({ member, is_member: isMember === 1 });
  } catch (error) {
    console.error('Memory sismember error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/scard/:key - Get set cardinality
router.get('/scard/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const count = await redisClient.scard(redisKey);
    
    res.json({ count });
  } catch (error) {
    console.error('Memory scard error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/sunion - Union of sets
router.post('/sunion', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys array is required' });
    }
    
    const redisKeys = keys.map(k => NS_PREFIX + k);
    const members = await redisClient.sunion(...redisKeys);
    const parsedMembers = members.map(m => JSON.parse(m));
    
    res.json({ members: parsedMembers });
  } catch (error) {
    console.error('Memory sunion error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/sinter - Intersection of sets
router.post('/sinter', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys array is required' });
    }
    
    const redisKeys = keys.map(k => NS_PREFIX + k);
    const members = await redisClient.sinter(...redisKeys);
    const parsedMembers = members.map(m => JSON.parse(m));
    
    res.json({ members: parsedMembers });
  } catch (error) {
    console.error('Memory sinter error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /memory/zadd - Add to sorted set
router.post('/zadd', async (req, res) => {
  try {
    const { key, score, member } = req.body;
    
    if (!key || score === undefined || member === undefined) {
      return res.status(400).json({ error: 'key, score, and member are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    await redisClient.zadd(redisKey, score, JSON.stringify(member));
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Memory zadd error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/zrange - Get range from sorted set
router.get('/zrange', async (req, res) => {
  try {
    const { key, start, stop } = req.query;
    
    if (!key || start === undefined || stop === undefined) {
      return res.status(400).json({ error: 'key, start, and stop are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const members = await redisClient.zrange(redisKey, parseInt(start), parseInt(stop));
    const parsedMembers = members.map(m => JSON.parse(m));
    
    res.json({ members: parsedMembers });
  } catch (error) {
    console.error('Memory zrange error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/zrank - Get rank of member in sorted set
router.get('/zrank', async (req, res) => {
  try {
    const { key, member } = req.query;
    
    if (!key || member === undefined) {
      return res.status(400).json({ error: 'key and member are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const rank = await redisClient.zrank(redisKey, JSON.stringify(member));
    
    if (rank === null) {
      return res.status(404).json({ error: 'member_not_found' });
    }
    
    res.json({ rank });
  } catch (error) {
    console.error('Memory zrank error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/zscore - Get score of member in sorted set
router.get('/zscore', async (req, res) => {
  try {
    const { key, member } = req.query;
    
    if (!key || member === undefined) {
      return res.status(400).json({ error: 'key and member are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const score = await redisClient.zscore(redisKey, JSON.stringify(member));
    
    if (score === null) {
      return res.status(404).json({ error: 'member_not_found' });
    }
    
    res.json({ score: parseFloat(score) });
  } catch (error) {
    console.error('Memory zscore error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /memory/zcard/:key - Get sorted set cardinality
router.get('/zcard/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const count = await redisClient.zcard(redisKey);
    
    res.json({ count });
  } catch (error) {
    console.error('Memory zcard error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
