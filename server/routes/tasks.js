const express = require('express');
const Redis = require('ioredis');

const router = express.Router();

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisClient.on('error', (err) => console.error('Redis error:', err.message));

// Namespace prefix for task queue operations
const NS_PREFIX = 'queue:';

// POST /tasks/push - Push a task to a queue
router.post('/push', async (req, res) => {
  try {
    const { queue_id, task } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ task, enqueued_at: new Date().toISOString() });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/pop - Pop a task from a queue
router.post('/pop', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    
    const taskData = await redisClient.lpop(redisKey);
    
    if (taskData === null) {
      return res.json({ task: null });
    }
    
    const parsed = JSON.parse(taskData);
    res.json({ task: parsed.task, enqueued_at: parsed.enqueued_at });
  } catch (error) {
    console.error('Tasks pop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/length/:queue_id - Get queue length
router.get('/length/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const redisKey = NS_PREFIX + queue_id;
    
    const length = await redisClient.llen(redisKey);
    
    res.json({ queue_id, length });
  } catch (error) {
    console.error('Tasks length error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/peek - Peek at next task without consuming
router.post('/peek', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = await redisClient.lindex(redisKey, 0);
    
    if (taskData === null) {
      return res.json({ task: null });
    }
    
    const parsed = JSON.parse(taskData);
    res.json({ task: parsed.task, enqueued_at: parsed.enqueued_at });
  } catch (error) {
    console.error('Tasks peek error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/batch-push - Push multiple tasks
router.post('/batch-push', async (req, res) => {
  try {
    const { queue_id, tasks } = req.body;
    
    if (!queue_id || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'queue_id and tasks array are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskDataList = tasks.map(task => 
      JSON.stringify({ task, enqueued_at: new Date().toISOString() })
    );
    
    const length = await redisClient.rpush(redisKey, ...taskDataList);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks batch-push error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/batch-pop - Pop multiple tasks
router.post('/batch-pop', async (req, res) => {
  try {
    const { queue_id, n } = req.body;
    
    if (!queue_id || !n) {
      return res.status(400).json({ error: 'queue_id and n are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = [];
    
    for (let i = 0; i < n; i++) {
      const taskData = await redisClient.lpop(redisKey);
      if (taskData === null) break;
      tasks.push(JSON.parse(taskData));
    }
    
    res.json({ tasks });
  } catch (error) {
    console.error('Tasks batch-pop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /tasks/clear - Clear a queue
router.delete('/clear', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const result = await redisClient.del(redisKey);
    
    res.json({ ok: true, removed: result });
  } catch (error) {
    console.error('Tasks clear error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/list - List all queues
router.get('/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const queues = await Promise.all(keys.map(async (key) => {
      const queueId = key.replace(NS_PREFIX, '');
      const length = await redisClient.llen(key);
      return { queue_id: queueId, length };
    }));
    
    res.json({ queues });
  } catch (error) {
    console.error('Tasks list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/requeue - Requeue a task
router.post('/requeue', async (req, res) => {
  try {
    const { queue_id, task } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ task, enqueued_at: new Date().toISOString(), requeued: true });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks requeue error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/priority-push - Push to priority queue
router.post('/priority-push', async (req, res) => {
  try {
    const { queue_id, task, score } = req.body;
    
    if (!queue_id || task === undefined || score === undefined) {
      return res.status(400).json({ error: 'queue_id, task, and score are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id + ':priority';
    const taskData = JSON.stringify({ task, enqueued_at: new Date().toISOString() });
    
    await redisClient.zadd(redisKey, score, taskData);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks priority-push error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/priority-pop - Pop from priority queue (highest score first)
router.post('/priority-pop', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id + ':priority';
    const results = await redisClient.zpopmax(redisKey);
    
    if (results.length === 0) {
      return res.json({ task: null });
    }
    
    const [taskData, score] = results;
    const parsed = JSON.parse(taskData);
    
    res.json({ task: parsed.task, score, enqueued_at: parsed.enqueued_at });
  } catch (error) {
    console.error('Tasks priority-pop error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/schedule - Schedule a delayed task
router.post('/schedule', async (req, res) => {
  try {
    const { queue_id, task, delay_seconds } = req.body;
    
    if (!queue_id || task === undefined || delay_seconds === undefined) {
      return res.status(400).json({ error: 'queue_id, task, and delay_seconds are required' });
    }
    
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled';
    const runAt = Date.now() + (delay_seconds * 1000);
    const taskData = JSON.stringify({ task, run_at: runAt, enqueued_at: new Date().toISOString() });
    
    await redisClient.zadd(scheduledKey, runAt, taskData);
    
    res.json({ ok: true, run_at: new Date(runAt).toISOString() });
  } catch (error) {
    console.error('Tasks schedule error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/scheduled/:queue_id - Get scheduled tasks
router.get('/scheduled/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled';
    
    const now = Date.now();
    const tasks = await redisClient.zrangebyscore(scheduledKey, 0, now);
    
    const parsedTasks = tasks.map(t => JSON.parse(t));
    
    res.json({ tasks: parsedTasks });
  } catch (error) {
    console.error('Tasks scheduled error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/dequeue-scheduled - Dequeue ready scheduled tasks
router.post('/dequeue-scheduled', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled';
    const mainKey = NS_PREFIX + queue_id;
    const now = Date.now();
    
    const tasks = await redisClient.zrangebyscore(scheduledKey, 0, now);
    
    if (tasks.length > 0) {
      await redisClient.zremrangebyscore(scheduledKey, 0, now);
      await redisClient.rpush(mainKey, ...tasks);
    }
    
    res.json({ ok: true, moved: tasks.length });
  } catch (error) {
    console.error('Tasks dequeue-scheduled error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/stats/:queue_id - Get queue statistics
router.get('/stats/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const redisKey = NS_PREFIX + queue_id;
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled';
    
    const length = await redisClient.llen(redisKey);
    const scheduledCount = await redisClient.zcard(scheduledKey);
    
    res.json({ queue_id, length, scheduled_count: scheduledCount });
  } catch (error) {
    console.error('Tasks stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/move - Move task between queues
router.post('/move', async (req, res) => {
  try {
    const { source_queue_id, dest_queue_id } = req.body;
    
    if (!source_queue_id || !dest_queue_id) {
      return res.status(400).json({ error: 'source_queue_id and dest_queue_id are required' });
    }
    
    const sourceKey = NS_PREFIX + source_queue_id;
    const destKey = NS_PREFIX + dest_queue_id;
    
    const taskData = await redisClient.lpop(sourceKey);
    
    if (taskData === null) {
      return res.json({ ok: false, reason: 'queue_empty' });
    }
    
    await redisClient.rpush(destKey, taskData);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks move error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/batch-move - Move multiple tasks
router.post('/batch-move', async (req, res) => {
  try {
    const { source_queue_id, dest_queue_id, n } = req.body;
    
    if (!source_queue_id || !dest_queue_id || !n) {
      return res.status(400).json({ error: 'source_queue_id, dest_queue_id, and n are required' });
    }
    
    const sourceKey = NS_PREFIX + source_queue_id;
    const destKey = NS_PREFIX + dest_queue_id;
    
    const tasks = [];
    for (let i = 0; i < n; i++) {
      const taskData = await redisClient.lpop(sourceKey);
      if (taskData === null) break;
      tasks.push(taskData);
    }
    
    if (tasks.length > 0) {
      await redisClient.rpush(destKey, ...tasks);
    }
    
    res.json({ ok: true, moved: tasks.length });
  } catch (error) {
    console.error('Tasks batch-move error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/peek-n - Peek at N tasks
router.get('/peek-n', async (req, res) => {
  try {
    const { queue_id, n } = req.query;
    
    if (!queue_id || !n) {
      return res.status(400).json({ error: 'queue_id and n are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = await redisClient.lrange(redisKey, 0, parseInt(n) - 1);
    
    const parsedTasks = tasks.map(t => JSON.parse(t));
    
    res.json({ tasks: parsedTasks });
  } catch (error) {
    console.error('Tasks peek-n error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/set-ttl - Set TTL on queue
router.post('/set-ttl', async (req, res) => {
  try {
    const { queue_id, ttl_seconds } = req.body;
    
    if (!queue_id || !ttl_seconds) {
      return res.status(400).json({ error: 'queue_id and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const result = await redisClient.expire(redisKey, ttl_seconds);
    
    if (result === 0) {
      return res.status(404).json({ error: 'queue_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks set-ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/ttl/:queue_id - Get queue TTL
router.get('/ttl/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const redisKey = NS_PREFIX + queue_id;
    
    const ttl = await redisClient.ttl(redisKey);
    
    if (ttl === -2) {
      return res.status(404).json({ error: 'queue_not_found' });
    }
    
    res.json({ ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Tasks ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/rename - Rename a queue
router.post('/rename', async (req, res) => {
  try {
    const { queue_id, new_queue_id } = req.body;
    
    if (!queue_id || !new_queue_id) {
      return res.status(400).json({ error: 'queue_id and new_queue_id are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const newRedisKey = NS_PREFIX + new_queue_id;
    
    await redisClient.rename(redisKey, newRedisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks rename error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/copy - Copy a queue
router.post('/copy', async (req, res) => {
  try {
    const { queue_id, dest_queue_id } = req.body;
    
    if (!queue_id || !dest_queue_id) {
      return res.status(400).json({ error: 'queue_id and dest_queue_id are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const destRedisKey = NS_PREFIX + dest_queue_id;
    
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    
    if (tasks.length > 0) {
      await redisClient.del(destRedisKey);
      await redisClient.rpush(destRedisKey, ...tasks);
    }
    
    res.json({ ok: true, count: tasks.length });
  } catch (error) {
    console.error('Tasks copy error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /tasks/batch-delete - Delete multiple queues
router.delete('/batch-delete', async (req, res) => {
  try {
    const { queue_ids } = req.body;
    
    if (!Array.isArray(queue_ids)) {
      return res.status(400).json({ error: 'queue_ids must be an array' });
    }
    
    const redisKeys = queue_ids.map(id => NS_PREFIX + id);
    const count = await redisClient.del(...redisKeys);
    
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Tasks batch-delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/size/:queue_id - Get queue size in bytes
router.get('/size/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const redisKey = NS_PREFIX + queue_id;
    
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    const bytes = tasks.reduce((sum, t) => sum + Buffer.byteLength(t, 'utf8'), 0);
    
    res.json({ bytes });
  } catch (error) {
    console.error('Tasks size error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-priority - Push with priority to sorted set
router.post('/push-with-priority', async (req, res) => {
  try {
    const { queue_id, task, priority } = req.body;
    
    if (!queue_id || task === undefined || priority === undefined) {
      return res.status(400).json({ error: 'queue_id, task, and priority are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id + ':priority';
    const taskData = JSON.stringify({ task, enqueued_at: new Date().toISOString() });
    
    await redisClient.zadd(redisKey, priority, taskData);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks push-with-priority error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/priority-range - Get range from priority queue
router.get('/priority-range', async (req, res) => {
  try {
    const { queue_id, start, stop } = req.query;
    
    if (!queue_id || start === undefined || stop === undefined) {
      return res.status(400).json({ error: 'queue_id, start, and stop are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id + ':priority';
    const tasks = await redisClient.zrange(redisKey, parseInt(start), parseInt(stop));
    
    const parsedTasks = tasks.map(t => JSON.parse(t));
    
    res.json({ tasks: parsedTasks });
  } catch (error) {
    console.error('Tasks priority-range error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/priority-remove - Remove from priority queue
router.post('/priority-remove', async (req, res) => {
  try {
    const { queue_id, task } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id + ':priority';
    const taskData = JSON.stringify({ task, enqueued_at: new Date().toISOString() });
    
    const removed = await redisClient.zrem(redisKey, taskData);
    
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('Tasks priority-remove error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/priority-count/:queue_id - Get priority queue count
router.get('/priority-count/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const redisKey = NS_PREFIX + queue_id + ':priority';
    
    const count = await redisClient.zcard(redisKey);
    
    res.json({ count });
  } catch (error) {
    console.error('Tasks priority-count error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/priority-clear - Clear priority queue
router.post('/priority-clear', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id + ':priority';
    await redisClient.del(redisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks priority-clear error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/set-max-length - Set max queue length
router.post('/set-max-length', async (req, res) => {
  try {
    const { queue_id, max_length } = req.body;
    
    if (!queue_id || !max_length) {
      return res.status(400).json({ error: 'queue_id and max_length are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const configKey = NS_PREFIX + queue_id + ':config';
    
    await redisClient.set(configKey, max_length);
    
    const currentLength = await redisClient.llen(redisKey);
    if (currentLength > max_length) {
      await redisClient.ltrim(redisKey, 0, max_length - 1);
    }
    
    res.json({ ok: true, max_length });
  } catch (error) {
    console.error('Tasks set-max-length error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/config/:queue_id - Get queue configuration
router.get('/config/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const configKey = NS_PREFIX + queue_id + ':config';
    
    const maxLength = await redisClient.get(configKey);
    
    res.json({ max_length: maxLength ? parseInt(maxLength) : null });
  } catch (error) {
    console.error('Tasks config error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-delay - Push with delay (same as schedule)
router.post('/push-with-delay', async (req, res) => {
  try {
    const { queue_id, task, delay_seconds } = req.body;
    
    if (!queue_id || task === undefined || delay_seconds === undefined) {
      return res.status(400).json({ error: 'queue_id, task, and delay_seconds are required' });
    }
    
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled';
    const runAt = Date.now() + (delay_seconds * 1000);
    const taskData = JSON.stringify({ task, run_at: runAt, enqueued_at: new Date().toISOString() });
    
    await redisClient.zadd(scheduledKey, runAt, taskData);
    
    res.json({ ok: true, run_at: new Date(runAt).toISOString() });
  } catch (error) {
    console.error('Tasks push-with-delay error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/range - Get range of tasks
router.get('/range', async (req, res) => {
  try {
    const { queue_id, start, stop } = req.query;
    
    if (!queue_id || start === undefined || stop === undefined) {
      return res.status(400).json({ error: 'queue_id, start, and stop are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = await redisClient.lrange(redisKey, parseInt(start), parseInt(stop));
    
    const parsedTasks = tasks.map(t => JSON.parse(t));
    
    res.json({ tasks: parsedTasks });
  } catch (error) {
    console.error('Tasks range error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/trim - Trim queue to max length
router.post('/trim', async (req, res) => {
  try {
    const { queue_id, max_length } = req.body;
    
    if (!queue_id || !max_length) {
      return res.status(400).json({ error: 'queue_id and max_length are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const length = await redisClient.llen(redisKey);
    
    if (length > max_length) {
      await redisClient.ltrim(redisKey, 0, max_length - 1);
    }
    
    const newLength = await redisClient.llen(redisKey);
    const removed = length - newLength;
    
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('Tasks trim error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-front - Push to front of queue
router.post('/push-front', async (req, res) => {
  try {
    const { queue_id, task } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ task, enqueued_at: new Date().toISOString() });
    
    const length = await redisClient.lpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-front error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/pop-back - Pop from back of queue
router.post('/pop-back', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = await redisClient.rpop(redisKey);
    
    if (taskData === null) {
      return res.json({ task: null });
    }
    
    const parsed = JSON.parse(taskData);
    res.json({ task: parsed.task, enqueued_at: parsed.enqueued_at });
  } catch (error) {
    console.error('Tasks pop-back error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/backup - Backup queue
router.post('/backup', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    
    const backup = {
      queue_id,
      backed_up_at: new Date().toISOString(),
      task_count: tasks.length,
      tasks: tasks.map(t => JSON.parse(t))
    };
    
    res.json({ backup });
  } catch (error) {
    console.error('Tasks backup error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/restore - Restore queue from backup
router.post('/restore', async (req, res) => {
  try {
    const { queue_id, backup } = req.body;
    
    if (!queue_id || !backup || !Array.isArray(backup.tasks)) {
      return res.status(400).json({ error: 'queue_id and backup with tasks array are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    
    await redisClient.del(redisKey);
    
    const taskDataList = backup.tasks.map(t => JSON.stringify(t));
    if (taskDataList.length > 0) {
      await redisClient.rpush(redisKey, ...taskDataList);
    }
    
    res.json({ ok: true, restored_count: taskDataList.length });
  } catch (error) {
    console.error('Tasks restore error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-metadata - Push with metadata
router.post('/push-with-metadata', async (req, res) => {
  try {
    const { queue_id, task, metadata } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ 
      task, 
      enqueued_at: new Date().toISOString(),
      metadata: metadata || {} 
    });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-with-metadata error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-retry - Push with retry count
router.post('/push-with-retry', async (req, res) => {
  try {
    const { queue_id, task, max_retries } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ 
      task, 
      enqueued_at: new Date().toISOString(),
      retry_count: 0,
      max_retries: max_retries || 3
    });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-with-retry error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/fail - Mark task as failed
router.post('/fail', async (req, res) => {
  try {
    const { queue_id, task, error } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const failedKey = NS_PREFIX + queue_id + ':failed';
    const taskData = JSON.stringify({ 
      task, 
      failed_at: new Date().toISOString(),
      error: error || 'unknown'
    });
    
    await redisClient.rpush(failedKey, taskData);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks fail error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/failed/:queue_id - Get failed tasks
router.get('/failed/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const failedKey = NS_PREFIX + queue_id + ':failed';
    
    const tasks = await redisClient.lrange(failedKey, 0, -1);
    const parsedTasks = tasks.map(t => JSON.parse(t));
    
    res.json({ tasks: parsedTasks });
  } catch (error) {
    console.error('Tasks failed error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/retry-failed - Retry failed tasks
router.post('/retry-failed', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const failedKey = NS_PREFIX + queue_id + ':failed';
    const mainKey = NS_PREFIX + queue_id;
    
    const tasks = await redisClient.lrange(failedKey, 0, -1);
    
    if (tasks.length > 0) {
      await redisClient.del(failedKey);
      await redisClient.rpush(mainKey, ...tasks);
    }
    
    res.json({ ok: true, retried: tasks.length });
  } catch (error) {
    console.error('Tasks retry-failed error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/clear-failed - Clear failed tasks
router.post('/clear-failed', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const failedKey = NS_PREFIX + queue_id + ':failed';
    await redisClient.del(failedKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks clear-failed error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-tags - Push with tags
router.post('/push-with-tags', async (req, res) => {
  try {
    const { queue_id, task, tags } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ 
      task, 
      enqueued_at: new Date().toISOString(),
      tags: tags || [] 
    });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-with-tags error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/by-tag/:queue_id - Get tasks by tag
router.get('/by-tag/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const { tag } = req.query;
    
    if (!tag) {
      return res.status(400).json({ error: 'tag query parameter is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    
    const filtered = tasks
      .map(t => JSON.parse(t))
      .filter(t => t.tags && t.tags.includes(tag));
    
    res.json({ tasks: filtered });
  } catch (error) {
    console.error('Tasks by-tag error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/tags/:queue_id - Get all tags in queue
router.get('/tags/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const redisKey = NS_PREFIX + queue_id;
    
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    const tagSet = new Set();
    
    tasks.forEach(t => {
      const parsed = JSON.parse(t);
      if (parsed.tags) {
        parsed.tags.forEach(tag => tagSet.add(tag));
      }
    });
    
    res.json({ tags: Array.from(tagSet) });
  } catch (error) {
    console.error('Tasks tags error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-deadline - Push with deadline
router.post('/push-with-deadline', async (req, res) => {
  try {
    const { queue_id, task, deadline_seconds } = req.body;
    
    if (!queue_id || task === undefined || deadline_seconds === undefined) {
      return res.status(400).json({ error: 'queue_id, task, and deadline_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const deadline = Date.now() + (deadline_seconds * 1000);
    const taskData = JSON.stringify({ 
      task, 
      enqueued_at: new Date().toISOString(),
      deadline 
    });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length, deadline: new Date(deadline).toISOString() });
  } catch (error) {
    console.error('Tasks push-with-deadline error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/cleanup-expired - Remove expired tasks
router.post('/cleanup-expired', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const now = Date.now();
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    
    const toKeep = [];
    let removed = 0;
    
    tasks.forEach(t => {
      const parsed = JSON.parse(t);
      if (!parsed.deadline || parsed.deadline > now) {
        toKeep.push(t);
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
    console.error('Tasks cleanup-expired error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-id - Push with custom ID
router.post('/push-with-id', async (req, res) => {
  try {
    const { queue_id, task, task_id } = req.body;
    
    if (!queue_id || task === undefined || !task_id) {
      return res.status(400).json({ error: 'queue_id, task, and task_id are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ 
      task, 
      task_id,
      enqueued_at: new Date().toISOString() 
    });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-with-id error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/by-id/:queue_id - Get task by ID
router.get('/by-id/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const { task_id } = req.query;
    
    if (!task_id) {
      return res.status(400).json({ error: 'task_id query parameter is required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    
    const found = tasks
      .map(t => JSON.parse(t))
      .find(t => t.task_id === task_id);
    
    if (!found) {
      return res.status(404).json({ error: 'task_not_found' });
    }
    
    res.json({ task: found });
  } catch (error) {
    console.error('Tasks by-id error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/remove-by-id - Remove task by ID
router.post('/remove-by-id', async (req, res) => {
  try {
    const { queue_id, task_id } = req.body;
    
    if (!queue_id || !task_id) {
      return res.status(400).json({ error: 'queue_id and task_id are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const tasks = await redisClient.lrange(redisKey, 0, -1);
    
    const toKeep = tasks.filter(t => {
      const parsed = JSON.parse(t);
      return parsed.task_id !== task_id;
    });
    
    await redisClient.del(redisKey);
    if (toKeep.length > 0) {
      await redisClient.rpush(redisKey, ...toKeep);
    }
    
    res.json({ ok: true, removed: tasks.length - toKeep.length });
  } catch (error) {
    console.error('Tasks remove-by-id error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-priority-and-delay - Push with both priority and delay
router.post('/push-with-priority-and-delay', async (req, res) => {
  try {
    const { queue_id, task, priority, delay_seconds } = req.body;
    
    if (!queue_id || task === undefined || priority === undefined || delay_seconds === undefined) {
      return res.status(400).json({ error: 'queue_id, task, priority, and delay_seconds are required' });
    }
    
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled:priority';
    const runAt = Date.now() + (delay_seconds * 1000);
    const taskData = JSON.stringify({ task, priority, run_at: runAt, enqueued_at: new Date().toISOString() });
    
    await redisClient.zadd(scheduledKey, runAt, taskData);
    
    res.json({ ok: true, run_at: new Date(runAt).toISOString() });
  } catch (error) {
    console.error('Tasks push-with-priority-and-delay error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/dequeue-scheduled-priority - Dequeue ready scheduled priority tasks
router.post('/dequeue-scheduled-priority', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const scheduledKey = NS_PREFIX + queue_id + ':scheduled:priority';
    const priorityKey = NS_PREFIX + queue_id + ':priority';
    const now = Date.now();
    
    const tasks = await redisClient.zrangebyscore(scheduledKey, 0, now);
    
    if (tasks.length > 0) {
      await redisClient.zremrangebyscore(scheduledKey, 0, now);
      
      for (const taskData of tasks) {
        const parsed = JSON.parse(taskData);
        await redisClient.zadd(priorityKey, parsed.priority, taskData);
      }
    }
    
    res.json({ ok: true, moved: tasks.length });
  } catch (error) {
    console.error('Tasks dequeue-scheduled-priority error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/all-stats - Get statistics for all queues
router.get('/all-stats', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const stats = await Promise.all(keys.map(async (key) => {
      if (key.includes(':')) return null; // Skip config/scheduled keys
      
      const queueId = key.replace(NS_PREFIX, '');
      const length = await redisClient.llen(key);
      const ttl = await redisClient.ttl(key);
      
      return { queue_id: queueId, length, ttl: ttl === -1 ? null : ttl };
    }));
    
    res.json({ stats: stats.filter(s => s !== null) });
  } catch (error) {
    console.error('Tasks all-stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-batch-with-ids - Push batch with IDs
router.post('/push-batch-with-ids', async (req, res) => {
  try {
    const { queue_id, tasks } = req.body;
    
    if (!queue_id || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'queue_id and tasks array are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskDataList = tasks.map(item => 
      JSON.stringify({ task: item.task, task_id: item.task_id, enqueued_at: new Date().toISOString() })
    );
    
    const length = await redisClient.rpush(redisKey, ...taskDataList);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-batch-with-ids error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/set-rate-limit - Set rate limit for queue
router.post('/set-rate-limit', async (req, res) => {
  try {
    const { queue_id, tasks_per_minute } = req.body;
    
    if (!queue_id || !tasks_per_minute) {
      return res.status(400).json({ error: 'queue_id and tasks_per_minute are required' });
    }
    
    const configKey = NS_PREFIX + queue_id + ':rate-limit';
    await redisClient.set(configKey, tasks_per_minute);
    
    res.json({ ok: true, tasks_per_minute });
  } catch (error) {
    console.error('Tasks set-rate-limit error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/rate-limit/:queue_id - Get rate limit
router.get('/rate-limit/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const configKey = NS_PREFIX + queue_id + ':rate-limit';
    
    const rateLimit = await redisClient.get(configKey);
    
    res.json({ tasks_per_minute: rateLimit ? parseInt(rateLimit) : null });
  } catch (error) {
    console.error('Tasks rate-limit error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/check-rate-limit - Check if rate limit allows task
router.post('/check-rate-limit', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const configKey = NS_PREFIX + queue_id + ':rate-limit';
    const counterKey = NS_PREFIX + queue_id + ':rate-counter';
    
    const rateLimit = await redisClient.get(configKey);
    if (!rateLimit) {
      return res.json({ allowed: true, reason: 'no_limit' });
    }
    
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    const count = await redisClient.zcount(counterKey, windowStart, now);
    
    if (count >= parseInt(rateLimit)) {
      return res.json({ allowed: false, reason: 'rate_limit_exceeded', count });
    }
    
    await redisClient.zadd(counterKey, now, Date.now().toString());
    await redisClient.expire(counterKey, 60);
    
    res.json({ allowed: true, count: count + 1 });
  } catch (error) {
    console.error('Tasks check-rate-limit error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/push-with-dependencies - Push task with dependencies
router.post('/push-with-dependencies', async (req, res) => {
  try {
    const { queue_id, task, depends_on } = req.body;
    
    if (!queue_id || task === undefined) {
      return res.status(400).json({ error: 'queue_id and task are required' });
    }
    
    const redisKey = NS_PREFIX + queue_id;
    const taskData = JSON.stringify({ 
      task, 
      enqueued_at: new Date().toISOString(),
      depends_on: depends_on || [],
      status: 'pending'
    });
    
    const length = await redisClient.rpush(redisKey, taskData);
    
    res.json({ ok: true, length });
  } catch (error) {
    console.error('Tasks push-with-dependencies error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/mark-complete - Mark task as complete
router.post('/mark-complete', async (req, res) => {
  try {
    const { queue_id, task_id } = req.body;
    
    if (!queue_id || !task_id) {
      return res.status(400).json({ error: 'queue_id and task_id are required' });
    }
    
    const completedKey = NS_PREFIX + queue_id + ':completed';
    const taskData = JSON.stringify({ 
      task_id, 
      completed_at: new Date().toISOString() 
    });
    
    await redisClient.rpush(completedKey, taskData);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks mark-complete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /tasks/completed/:queue_id - Get completed tasks
router.get('/completed/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const completedKey = NS_PREFIX + queue_id + ':completed';
    
    const tasks = await redisClient.lrange(completedKey, 0, -1);
    const parsedTasks = tasks.map(t => JSON.parse(t));
    
    res.json({ tasks: parsedTasks });
  } catch (error) {
    console.error('Tasks completed error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /tasks/clear-completed - Clear completed tasks
router.post('/clear-completed', async (req, res) => {
  try {
    const { queue_id } = req.body;
    
    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }
    
    const completedKey = NS_PREFIX + queue_id + ':completed';
    await redisClient.del(completedKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Tasks clear-completed error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
