const express = require('express');
const Redis = require('ioredis');

const router = express.Router();

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Namespace prefix for logging operations
const NS_PREFIX = 'log:';

// POST /logging/append - Append an entry to a log
router.post('/append', async (req, res) => {
  try {
    const { log_id, entry } = req.body;
    
    if (!log_id || entry === undefined) {
      return res.status(400).json({ error: 'log_id and entry are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, entry });
    
    const length = await redisClient.lpush(redisKey, logEntry);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Logging append error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/read/:log_id?limit=100 - Read entries from a log
router.get('/read/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const redisKey = NS_PREFIX + log_id;
    
    const entries = await redisClient.lrange(redisKey, 0, limit - 1);
    
    if (entries.length === 0) {
      return res.json({ log_id, entries: [] });
    }
    
    const parsedEntries = entries.map(e => JSON.parse(e));
    
    res.json({ log_id, entries: parsedEntries });
  } catch (error) {
    console.error('Logging read error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /logging/clear/:log_id - Clear a log
router.delete('/clear/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const result = await redisClient.del(redisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Logging clear error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/count/:log_id - Get log entry count
router.get('/count/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const count = await redisClient.llen(redisKey);
    
    res.json({ count });
  } catch (error) {
    console.error('Logging count error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/tail/:log_id?n=10 - Get last N entries
router.get('/tail/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const n = parseInt(req.query.n) || 10;
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, n - 1);
    
    const parsedEntries = entries.map(e => JSON.parse(e));
    
    res.json({ log_id, entries: parsedEntries });
  } catch (error) {
    console.error('Logging tail error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/head/:log_id?n=10 - Get first N entries (oldest)
router.get('/head/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const n = parseInt(req.query.n) || 10;
    
    const redisKey = NS_PREFIX + log_id;
    const length = await redisClient.llen(redisKey);
    const entries = await redisClient.lrange(redisKey, -n, -1);
    
    const parsedEntries = entries.map(e => JSON.parse(e));
    
    res.json({ log_id, entries: parsedEntries });
  } catch (error) {
    console.error('Logging head error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/get/:log_id/:index - Get entry at specific index
router.get('/get/:log_id/:index', async (req, res) => {
  try {
    const { log_id, index } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const entry = await redisClient.lindex(redisKey, parseInt(index));
    
    if (entry === null) {
      return res.status(404).json({ error: 'entry_not_found' });
    }
    
    res.json({ entry: JSON.parse(entry) });
  } catch (error) {
    console.error('Logging get error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/search - Search log for keyword
router.post('/search', async (req, res) => {
  try {
    const { log_id, keyword } = req.body;
    
    if (!log_id || !keyword) {
      return res.status(400).json({ error: 'log_id and keyword are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const matches = entries
      .map(e => JSON.parse(e))
      .filter(e => JSON.stringify(e.entry).toLowerCase().includes(keyword.toLowerCase()));
    
    res.json({ matches });
  } catch (error) {
    console.error('Logging search error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/list - List all log IDs
router.get('/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const logIds = keys.map(k => k.replace(NS_PREFIX, ''));
    
    res.json({ log_ids: logIds });
  } catch (error) {
    console.error('Logging list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/merge - Merge multiple logs
router.post('/merge', async (req, res) => {
  try {
    const { source_ids, dest_id } = req.body;
    
    if (!Array.isArray(source_ids) || !dest_id) {
      return res.status(400).json({ error: 'source_ids array and dest_id are required' });
    }
    
    const destRedisKey = NS_PREFIX + dest_id;
    let count = 0;
    
    for (const sourceId of source_ids) {
      const sourceRedisKey = NS_PREFIX + sourceId;
      const entries = await redisClient.lrange(sourceRedisKey, 0, -1);
      
      if (entries.length > 0) {
        await redisClient.rpush(destRedisKey, ...entries);
        count += entries.length;
      }
    }
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Logging merge error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/stats/:log_id - Get log statistics
router.get('/stats/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const count = await redisClient.llen(redisKey);
    
    if (count === 0) {
      return res.json({ count: 0, first: null, last: null });
    }
    
    const firstEntry = await redisClient.lindex(redisKey, 0);
    const lastEntry = await redisClient.lindex(redisKey, -1);
    
    res.json({ 
      count, 
      first: firstEntry ? JSON.parse(firstEntry) : null,
      last: lastEntry ? JSON.parse(lastEntry) : null
    });
  } catch (error) {
    console.error('Logging stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/trim - Trim log to max entries
router.post('/trim', async (req, res) => {
  try {
    const { log_id, max_entries } = req.body;
    
    if (!log_id || !max_entries) {
      return res.status(400).json({ error: 'log_id and max_entries are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const length = await redisClient.llen(redisKey);
    
    if (length > max_entries) {
      await redisClient.ltrim(redisKey, 0, max_entries - 1);
    }
    
    const newLength = await redisClient.llen(redisKey);
    const removed = length - newLength;
    
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('Logging trim error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/export - Export all log entries
router.post('/export', async (req, res) => {
  try {
    const { log_id } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const parsedEntries = entries.map(e => JSON.parse(e));
    
    res.json({ entries: parsedEntries });
  } catch (error) {
    console.error('Logging export error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/batch-append - Append multiple entries
router.post('/batch-append', async (req, res) => {
  try {
    const { log_id, entries } = req.body;
    
    if (!log_id || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'log_id and entries array are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const timestamp = new Date().toISOString();
    
    const logEntries = entries.map(entry => 
      JSON.stringify({ timestamp, entry })
    );
    
    const length = await redisClient.lpush(redisKey, ...logEntries);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Logging batch-append error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/append-with-level - Append with log level
router.post('/append-with-level', async (req, res) => {
  try {
    const { log_id, entry, level } = req.body;
    
    if (!log_id || entry === undefined) {
      return res.status(400).json({ error: 'log_id and entry are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, level: level || 'info', entry });
    
    const length = await redisClient.lpush(redisKey, logEntry);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Logging append-with-level error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/filter/:log_id - Filter by level
router.get('/filter/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const { level } = req.query;
    
    if (!level) {
      return res.status(400).json({ error: 'level query parameter is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const filtered = entries
      .map(e => JSON.parse(e))
      .filter(e => e.level === level);
    
    res.json({ log_id, entries: filtered });
  } catch (error) {
    console.error('Logging filter error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/set-ttl - Set TTL on log
router.post('/set-ttl', async (req, res) => {
  try {
    const { log_id, ttl_seconds } = req.body;
    
    if (!log_id || !ttl_seconds) {
      return res.status(400).json({ error: 'log_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const result = await redisClient.expire(redisKey, ttl_seconds);
    
    if (result === 0) {
      return res.status(404).json({ error: 'log_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Logging set-ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/ttl/:log_id - Get log TTL
router.get('/ttl/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const ttl = await redisClient.ttl(redisKey);
    
    if (ttl === -2) {
      return res.status(404).json({ error: 'log_not_found' });
    }
    
    res.json({ ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Logging ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/rpush - Append to end (oldest first)
router.post('/rpush', async (req, res) => {
  try {
    const { log_id, entry } = req.body;
    
    if (!log_id || entry === undefined) {
      return res.status(400).json({ error: 'log_id and entry are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, entry });
    
    const length = await redisClient.rpush(redisKey, logEntry);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Logging rpush error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/lpop - Remove from head (newest)
router.post('/lpop', async (req, res) => {
  try {
    const { log_id } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entry = await redisClient.lpop(redisKey);
    
    if (entry === null) {
      return res.json({ entry: null });
    }
    
    res.json({ entry: JSON.parse(entry) });
  } catch (error) {
    console.error('Logging lpop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/rpop - Remove from tail (oldest)
router.post('/rpop', async (req, res) => {
  try {
    const { log_id } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entry = await redisClient.rpop(redisKey);
    
    if (entry === null) {
      return res.json({ entry: null });
    }
    
    res.json({ entry: JSON.parse(entry) });
  } catch (error) {
    console.error('Logging rpop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/rotate - Rotate log (archive and clear)
router.post('/rotate', async (req, res) => {
  try {
    const { log_id } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const archiveKey = NS_PREFIX + log_id + ':archive:' + Date.now();
    
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    if (entries.length > 0) {
      await redisClient.rpush(archiveKey, ...entries);
    }
    
    await redisClient.del(redisKey);
    
    res.json({ ok: true, archived_to: archiveKey.replace(NS_PREFIX, ''), count: entries.length });
  } catch (error) {
    console.error('Logging rotate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/range - Get range of entries
router.get('/range', async (req, res) => {
  try {
    const { log_id, start, stop } = req.query;
    
    if (!log_id || start === undefined || stop === undefined) {
      return res.status(400).json({ error: 'log_id, start, and stop are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, parseInt(start), parseInt(stop));
    
    const parsedEntries = entries.map(e => JSON.parse(e));
    
    res.json({ entries: parsedEntries });
  } catch (error) {
    console.error('Logging range error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/batch-delete - Delete multiple logs
router.post('/batch-delete', async (req, res) => {
  try {
    const { log_ids } = req.body;
    
    if (!Array.isArray(log_ids)) {
      return res.status(400).json({ error: 'log_ids must be an array' });
    }
    
    const redisKeys = log_ids.map(id => NS_PREFIX + id);
    const count = await redisClient.del(...redisKeys);
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Logging batch-delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/rename - Rename a log
router.post('/rename', async (req, res) => {
  try {
    const { log_id, new_log_id } = req.body;
    
    if (!log_id || !new_log_id) {
      return res.status(400).json({ error: 'log_id and new_log_id are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const newRedisKey = NS_PREFIX + new_log_id;
    
    await redisClient.rename(redisKey, newRedisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Logging rename error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/copy - Copy a log
router.post('/copy', async (req, res) => {
  try {
    const { log_id, dest_log_id } = req.body;
    
    if (!log_id || !dest_log_id) {
      return res.status(400).json({ error: 'log_id and dest_log_id are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const destRedisKey = NS_PREFIX + dest_log_id;
    
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    if (entries.length > 0) {
      await redisClient.del(destRedisKey);
      await redisClient.rpush(destRedisKey, ...entries);
    }
    
    res.json({ ok: true, count: entries.length });
  } catch (error) {
    console.error('Logging copy error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/size/:log_id - Get log size in bytes
router.get('/size/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const entries = await redisClient.lrange(redisKey, 0, -1);
    const bytes = entries.reduce((sum, e) => sum + Buffer.byteLength(e, 'utf8'), 0);
    
    res.json({ bytes });
  } catch (error) {
    console.error('Logging size error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/append-with-metadata - Append with custom metadata
router.post('/append-with-metadata', async (req, res) => {
  try {
    const { log_id, entry, metadata } = req.body;
    
    if (!log_id || entry === undefined) {
      return res.status(400).json({ error: 'log_id and entry are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, entry, metadata: metadata || {} });
    
    const length = await redisClient.lpush(redisKey, logEntry);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Logging append-with-metadata error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/aggregate - Aggregate logs by time window
router.post('/aggregate', async (req, res) => {
  try {
    const { log_id, window_minutes } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const windowMs = (window_minutes || 5) * 60 * 1000;
    const aggregated = {};
    
    entries.forEach(e => {
      const parsed = JSON.parse(e);
      const time = new Date(parsed.timestamp).getTime();
      const windowStart = Math.floor(time / windowMs) * windowMs;
      
      if (!aggregated[windowStart]) {
        aggregated[windowStart] = { count: 0, entries: [] };
      }
      
      aggregated[windowStart].count++;
      aggregated[windowStart].entries.push(parsed);
    });
    
    res.json({ aggregated });
  } catch (error) {
    console.error('Logging aggregate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/set-max-length - Set max length with auto-trim
router.post('/set-max-length', async (req, res) => {
  try {
    const { log_id, max_length } = req.body;
    
    if (!log_id || !max_length) {
      return res.status(400).json({ error: 'log_id and max_length are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const configKey = NS_PREFIX + log_id + ':config';
    
    await redisClient.set(configKey, max_length);
    
    const currentLength = await redisClient.llen(redisKey);
    if (currentLength > max_length) {
      await redisClient.ltrim(redisKey, 0, max_length - 1);
    }
    
    res.json({ ok: true, max_length });
  } catch (error) {
    console.error('Logging set-max-length error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/config/:log_id - Get log configuration
router.get('/config/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const configKey = NS_PREFIX + log_id + ':config';
    
    const maxLength = await redisClient.get(configKey);
    
    res.json({ max_length: maxLength ? parseInt(maxLength) : null });
  } catch (error) {
    console.error('Logging config error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/backup - Backup log to JSON
router.post('/backup', async (req, res) => {
  try {
    const { log_id } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const parsedEntries = entries.map(e => JSON.parse(e));
    const backup = {
      log_id,
      backed_up_at: new Date().toISOString(),
      entry_count: parsedEntries.length,
      entries: parsedEntries
    };
    
    res.json({ backup });
  } catch (error) {
    console.error('Logging backup error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/restore - Restore log from backup
router.post('/restore', async (req, res) => {
  try {
    const { log_id, backup } = req.body;
    
    if (!log_id || !backup || !Array.isArray(backup.entries)) {
      return res.status(400).json({ error: 'log_id and backup with entries array are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    
    await redisClient.del(redisKey);
    
    const logEntries = backup.entries.map(e => JSON.stringify(e));
    if (logEntries.length > 0) {
      await redisClient.rpush(redisKey, ...logEntries);
    }
    
    res.json({ ok: true, restored_count: logEntries.length });
  } catch (error) {
    console.error('Logging restore error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/purge-old - Purge entries older than timestamp
router.post('/purge-old', async (req, res) => {
  try {
    const { log_id, older_than } = req.body;
    
    if (!log_id || !older_than) {
      return res.status(400).json({ error: 'log_id and older_than timestamp are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const cutoff = new Date(older_than).getTime();
    const toKeep = [];
    let removed = 0;
    
    entries.forEach(e => {
      const parsed = JSON.parse(e);
      const entryTime = new Date(parsed.timestamp).getTime();
      
      if (entryTime >= cutoff) {
        toKeep.push(e);
      } else {
        removed++;
      }
    });
    
    await redisClient.del(redisKey);
    if (toKeep.length > 0) {
      await redisClient.rpush(redisKey, ...toKeep);
    }
    
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('Logging purge-old error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/levels/:log_id - Get unique log levels
router.get('/levels/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const entries = await redisClient.lrange(redisKey, 0, -1);
    const levels = new Set();
    
    entries.forEach(e => {
      const parsed = JSON.parse(e);
      if (parsed.level) {
        levels.add(parsed.level);
      }
    });
    
    res.json({ levels: Array.from(levels) });
  } catch (error) {
    console.error('Logging levels error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/subscribe - Subscribe to log (webhook)
router.post('/subscribe', async (req, res) => {
  try {
    const { log_id, webhook_url } = req.body;
    
    if (!log_id || !webhook_url) {
      return res.status(400).json({ error: 'log_id and webhook_url are required' });
    }
    
    const subKey = NS_PREFIX + log_id + ':subscribers';
    await redisClient.sadd(subKey, webhook_url);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Logging subscribe error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/subscribers/:log_id - Get log subscribers
router.get('/subscribers/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const subKey = NS_PREFIX + log_id + ':subscribers';
    
    const subscribers = await redisClient.smembers(subKey);
    
    res.json({ subscribers });
  } catch (error) {
    console.error('Logging subscribers error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /logging/unsubscribe - Unsubscribe from log
router.delete('/unsubscribe', async (req, res) => {
  try {
    const { log_id, webhook_url } = req.body;
    
    if (!log_id || !webhook_url) {
      return res.status(400).json({ error: 'log_id and webhook_url are required' });
    }
    
    const subKey = NS_PREFIX + log_id + ':subscribers';
    await redisClient.srem(subKey, webhook_url);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Logging unsubscribe error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/notify - Notify subscribers of new entry
router.post('/notify', async (req, res) => {
  try {
    const { log_id, entry } = req.body;
    
    if (!log_id || entry === undefined) {
      return res.status(400).json({ error: 'log_id and entry are required' });
    }
    
    const subKey = NS_PREFIX + log_id + ':subscribers';
    const subscribers = await redisClient.smembers(subKey);
    
    const timestamp = new Date().toISOString();
    const payload = { log_id, timestamp, entry };
    
    let notified = 0;
    for (const url of subscribers) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        notified++;
      } catch (e) {
        // Continue even if one webhook fails
      }
    }
    
    res.json({ ok: true, notified });
  } catch (error) {
    console.error('Logging notify error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/append-with-tags - Append with tags
router.post('/append-with-tags', async (req, res) => {
  try {
    const { log_id, entry, tags } = req.body;
    
    if (!log_id || entry === undefined) {
      return res.status(400).json({ error: 'log_id and entry are required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, entry, tags: tags || [] });
    
    const length = await redisClient.lpush(redisKey, logEntry);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Logging append-with-tags error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/by-tag/:log_id - Get entries by tag
router.get('/by-tag/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const { tag } = req.query;
    
    if (!tag) {
      return res.status(400).json({ error: 'tag query parameter is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    const filtered = entries
      .map(e => JSON.parse(e))
      .filter(e => e.tags && e.tags.includes(tag));
    
    res.json({ log_id, entries: filtered });
  } catch (error) {
    console.error('Logging by-tag error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/tags/:log_id - Get all tags in log
router.get('/tags/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const redisKey = NS_PREFIX + log_id;
    
    const entries = await redisClient.lrange(redisKey, 0, -1);
    const tagSet = new Set();
    
    entries.forEach(e => {
      const parsed = JSON.parse(e);
      if (parsed.tags) {
        parsed.tags.forEach(t => tagSet.add(t));
      }
    });
    
    res.json({ tags: Array.from(tagSet) });
  } catch (error) {
    console.error('Logging tags error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/set-retention - Set retention policy
router.post('/set-retention', async (req, res) => {
  try {
    const { log_id, days } = req.body;
    
    if (!log_id || !days) {
      return res.status(400).json({ error: 'log_id and days are required' });
    }
    
    const configKey = NS_PREFIX + log_id + ':retention';
    const ttlSeconds = days * 24 * 60 * 60;
    
    await redisClient.set(configKey, ttlSeconds);
    await redisClient.expire(NS_PREFIX + log_id, ttlSeconds);
    
    res.json({ ok: true, retention_days: days });
  } catch (error) {
    console.error('Logging set-retention error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/retention/:log_id - Get retention policy
router.get('/retention/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const configKey = NS_PREFIX + log_id + ':retention';
    
    const ttlSeconds = await redisClient.get(configKey);
    
    if (!ttlSeconds) {
      return res.json({ retention_days: null });
    }
    
    const days = parseInt(ttlSeconds) / (24 * 60 * 60);
    
    res.json({ retention_days: days });
  } catch (error) {
    console.error('Logging retention error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/archive - Archive log to separate key
router.post('/archive', async (req, res) => {
  try {
    const { log_id } = req.body;
    
    if (!log_id) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    
    const redisKey = NS_PREFIX + log_id;
    const archiveKey = NS_PREFIX + log_id + ':archived:' + Date.now();
    
    const entries = await redisClient.lrange(redisKey, 0, -1);
    
    if (entries.length > 0) {
      await redisClient.rpush(archiveKey, ...entries);
    }
    
    res.json({ ok: true, archive_id: archiveKey.replace(NS_PREFIX, ''), count: entries.length });
  } catch (error) {
    console.error('Logging archive error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /logging/archives/:log_id - List archives for a log
router.get('/archives/:log_id', async (req, res) => {
  try {
    const { log_id } = req.params;
    const pattern = NS_PREFIX + log_id + ':archived:*';
    
    const keys = await redisClient.keys(pattern);
    const archives = keys.map(k => ({
      id: k.replace(NS_PREFIX, ''),
      created_at: k.split(':').pop()
    }));
    
    res.json({ archives });
  } catch (error) {
    console.error('Logging archives error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /logging/restore-archive - Restore from archive
router.post('/restore-archive', async (req, res) => {
  try {
    const { archive_id } = req.body;
    
    if (!archive_id) {
      return res.status(400).json({ error: 'archive_id is required' });
    }
    
    const archiveKey = NS_PREFIX + archive_id;
    const logId = archive_id.split(':archived:')[0];
    const logKey = NS_PREFIX + logId;
    
    const entries = await redisClient.lrange(archiveKey, 0, -1);
    
    await redisClient.rpush(logKey, ...entries);
    
    res.json({ ok: true, restored_count: entries.length, to_log: logId });
  } catch (error) {
    console.error('Logging restore-archive error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /logging/delete-archive - Delete archive
router.delete('/delete-archive', async (req, res) => {
  try {
    const { archive_id } = req.body;
    
    if (!archive_id) {
      return res.status(400).json({ error: 'archive_id is required' });
    }
    
    const archiveKey = NS_PREFIX + archive_id;
    await redisClient.del(archiveKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Logging delete-archive error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
