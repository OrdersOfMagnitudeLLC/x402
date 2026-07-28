const express = require('express');
const Redis = require('ioredis');
const crypto = require('crypto');

const router = express.Router();

// Redis client (using ioredis to match project dependencies)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisClient.on('error', (err) => console.error('Redis error:', err.message));

// Namespace prefix for secrets operations
const NS_PREFIX = 'secrets:';

// Get encryption key from environment or use default for development
const ENCRYPTION_KEY = process.env.SECRETS_KEY || 'default-32-character-key-for-dev-only';
const ALGORITHM = 'aes-256-gcm';

// Encrypt value using AES-256-GCM
function encrypt(value) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  };
}

// Decrypt value using AES-256-GCM
function decrypt(encryptedData) {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// POST /secrets/store - Store an encrypted secret
router.post('/store', async (req, res) => {
  try {
    const { key, value, ttl_seconds, one_time } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const encrypted = encrypt(value);
    const secretData = {
      encrypted,
      token,
      one_time: one_time || false,
      created_at: new Date().toISOString()
    };
    
    if (ttl_seconds && ttl_seconds > 0) {
      await redisClient.setex(redisKey, ttl_seconds, JSON.stringify(secretData));
    } else {
      await redisClient.set(redisKey, JSON.stringify(secretData));
    }
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Secrets store error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/retrieve/:key?token= - Retrieve and decrypt a secret
router.get('/retrieve/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { token } = req.query;
    
    const redisKey = NS_PREFIX + key;
    const secretDataStr = await redisClient.get(redisKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const secretData = JSON.parse(secretDataStr);
    
    // Verify token if provided
    if (token && secretData.token !== token) {
      return res.status(403).json({ error: 'invalid_token' });
    }
    
    // Decrypt the value
    const value = decrypt(secretData.encrypted);
    
    // If one-time secret, delete it after retrieval
    if (secretData.one_time) {
      await redisClient.del(redisKey);
    }
    
    res.json({ value });
  } catch (error) {
    console.error('Secrets retrieve error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /secrets/delete/:key - Delete a secret
router.delete('/delete/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const result = await redisClient.del(redisKey);
    
    if (result === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/exists/:key - Check if a secret exists
router.get('/exists/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 0) {
      return res.json({ exists: false, ttl: null });
    }
    
    const ttl = await redisClient.ttl(redisKey);
    
    res.json({ exists: true, ttl: ttl === -1 ? null : ttl });
  } catch (error) {
    console.error('Secrets exists error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/generate - Generate a random secret
router.post('/generate', async (req, res) => {
  try {
    const { type, length } = req.body;
    
    const secretLength = length || 16;
    let value;
    
    switch (type) {
      case 'hex':
        value = crypto.randomBytes(Math.ceil(secretLength / 2)).toString('hex').slice(0, secretLength);
        break;
      case 'alphanumeric':
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        value = Array.from({ length: secretLength }, () => 
          chars[Math.floor(Math.random() * chars.length)]
        ).join('');
        break;
      case 'uuid':
        value = crypto.randomUUID();
        break;
      case 'pin':
        const digits = '0123456789';
        value = Array.from({ length: secretLength }, () => 
          digits[Math.floor(Math.random() * digits.length)]
        ).join('');
        break;
      case 'passphrase':
        const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu'];
        const wordCount = secretLength || 4;
        value = Array.from({ length: wordCount }, () => 
          words[Math.floor(Math.random() * words.length)]
        ).join('-');
        break;
      default:
        return res.status(400).json({ error: 'invalid_type' });
    }
    
    res.json({ value });
  } catch (error) {
    console.error('Secrets generate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/rotate - Rotate a secret value
router.post('/rotate', async (req, res) => {
  try {
    const { key, new_value } = req.body;
    
    if (!key || new_value === undefined) {
      return res.status(400).json({ error: 'key and new_value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const existingDataStr = await redisClient.get(redisKey);
    
    if (existingDataStr === null) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const existingData = JSON.parse(existingDataStr);
    const encrypted = encrypt(new_value);
    
    const secretData = {
      encrypted,
      token: existingData.token,
      one_time: existingData.one_time,
      rotated_at: new Date().toISOString(),
      created_at: existingData.created_at
    };
    
    // Preserve existing TTL
    const ttl = await redisClient.ttl(redisKey);
    if (ttl > 0) {
      await redisClient.setex(redisKey, ttl, JSON.stringify(secretData));
    } else {
      await redisClient.set(redisKey, JSON.stringify(secretData));
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets rotate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/list - List all secret keys
router.get('/list', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const secretKeys = keys.map(key => key.replace(NS_PREFIX, ''));
    
    res.json({ keys: secretKeys, count: secretKeys.length });
  } catch (error) {
    console.error('Secrets list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/metadata/:key - Get secret metadata without decrypting
router.get('/metadata/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const redisKey = NS_PREFIX + key;
    
    const secretDataStr = await redisClient.get(redisKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const secretData = JSON.parse(secretDataStr);
    const ttl = await redisClient.ttl(redisKey);
    
    res.json({
      key,
      one_time: secretData.one_time,
      created_at: secretData.created_at,
      rotated_at: secretData.rotated_at || null,
      ttl: ttl === -1 ? null : ttl
    });
  } catch (error) {
    console.error('Secrets metadata error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/update-ttl - Update secret TTL
router.post('/update-ttl', async (req, res) => {
  try {
    const { key, ttl_seconds } = req.body;
    
    if (!key || ttl_seconds === undefined) {
      return res.status(400).json({ error: 'key and ttl_seconds are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    
    const exists = await redisClient.exists(redisKey);
    if (exists === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    if (ttl_seconds > 0) {
      await redisClient.expire(redisKey, ttl_seconds);
    } else if (ttl_seconds === 0) {
      await redisClient.persist(redisKey);
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets update-ttl error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/copy - Copy a secret to a new key
router.post('/copy', async (req, res) => {
  try {
    const { source_key, target_key } = req.body;
    
    if (!source_key || !target_key) {
      return res.status(400).json({ error: 'source_key and target_key are required' });
    }
    
    const sourceRedisKey = NS_PREFIX + source_key;
    const targetRedisKey = NS_PREFIX + target_key;
    
    const secretDataStr = await redisClient.get(sourceRedisKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'source_secret_not_found' });
    }
    
    const secretData = JSON.parse(secretDataStr);
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const newSecretData = {
      ...secretData,
      token,
      created_at: new Date().toISOString(),
      copied_from: source_key
    };
    
    await redisClient.set(targetRedisKey, JSON.stringify(newSecretData));
    
    res.json({ ok: true, token });
  } catch (error) {
    console.error('Secrets copy error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/move - Move a secret to a new key
router.post('/move', async (req, res) => {
  try {
    const { source_key, target_key } = req.body;
    
    if (!source_key || !target_key) {
      return res.status(400).json({ error: 'source_key and target_key are required' });
    }
    
    const sourceRedisKey = NS_PREFIX + source_key;
    const targetRedisKey = NS_PREFIX + target_key;
    
    const secretDataStr = await redisClient.get(sourceRedisKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'source_secret_not_found' });
    }
    
    await redisClient.set(targetRedisKey, secretDataStr);
    await redisClient.del(sourceRedisKey);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets move error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/batch-store - Store multiple secrets
router.post('/batch-store', async (req, res) => {
  try {
    const { secrets } = req.body;
    
    if (!Array.isArray(secrets)) {
      return res.status(400).json({ error: 'secrets array is required' });
    }
    
    const results = [];
    
    for (const { key, value, ttl_seconds, one_time } of secrets) {
      if (!key || value === undefined) {
        results.push({ key, ok: false, error: 'key and value are required' });
        continue;
      }
      
      const redisKey = NS_PREFIX + key;
      const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      
      const encrypted = encrypt(value);
      const secretData = {
        encrypted,
        token,
        one_time: one_time || false,
        created_at: new Date().toISOString()
      };
      
      if (ttl_seconds && ttl_seconds > 0) {
        await redisClient.setex(redisKey, ttl_seconds, JSON.stringify(secretData));
      } else {
        await redisClient.set(redisKey, JSON.stringify(secretData));
      }
      
      results.push({ key, ok: true, token });
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Secrets batch-store error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/batch-retrieve - Retrieve multiple secrets
router.post('/batch-retrieve', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys array is required' });
    }
    
    const results = [];
    
    for (const key of keys) {
      const redisKey = NS_PREFIX + key;
      const secretDataStr = await redisClient.get(redisKey);
      
      if (secretDataStr === null) {
        results.push({ key, ok: false, error: 'secret_not_found' });
        continue;
      }
      
      const secretData = JSON.parse(secretDataStr);
      const value = decrypt(secretData.encrypted);
      
      if (secretData.one_time) {
        await redisClient.del(redisKey);
      }
      
      results.push({ key, ok: true, value });
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Secrets batch-retrieve error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/batch-delete - Delete multiple secrets
router.post('/batch-delete', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys array is required' });
    }
    
    const results = [];
    
    for (const key of keys) {
      const redisKey = NS_PREFIX + key;
      const result = await redisClient.del(redisKey);
      results.push({ key, deleted: result === 1 });
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Secrets batch-delete error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/hash - Hash a value
router.post('/hash', async (req, res) => {
  try {
    const { value, algorithm } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const algo = algorithm || 'sha256';
    const hash = crypto.createHash(algo).update(String(value)).digest('hex');
    
    res.json({ hash, algorithm: algo });
  } catch (error) {
    console.error('Secrets hash error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/hmac - Generate HMAC
router.post('/hmac', async (req, res) => {
  try {
    const { value, secret, algorithm } = req.body;
    
    if (!value || !secret) {
      return res.status(400).json({ error: 'value and secret are required' });
    }
    
    const algo = algorithm || 'sha256';
    const hmac = crypto.createHmac(algo, secret).update(String(value)).digest('hex');
    
    res.json({ hmac, algorithm: algo });
  } catch (error) {
    console.error('Secrets hmac error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/compare - Compare two values (constant-time)
router.post('/compare', async (req, res) => {
  try {
    const { value1, value2 } = req.body;
    
    if (value1 === undefined || value2 === undefined) {
      return res.status(400).json({ error: 'value1 and value2 are required' });
    }
    
    const hash1 = crypto.createHash('sha256').update(String(value1)).digest();
    const hash2 = crypto.createHash('sha256').update(String(value2)).digest();
    
    const equal = crypto.timingSafeEqual(hash1, hash2);
    
    res.json({ equal });
  } catch (error) {
    console.error('Secrets compare error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/encrypt - Encrypt a value without storing
router.post('/encrypt', async (req, res) => {
  try {
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const encrypted = encrypt(value);
    
    res.json({ encrypted });
  } catch (error) {
    console.error('Secrets encrypt error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/decrypt - Decrypt a value
router.post('/decrypt', async (req, res) => {
  try {
    const { encrypted } = req.body;
    
    if (!encrypted) {
      return res.status(400).json({ error: 'encrypted is required' });
    }
    
    const value = decrypt(encrypted);
    
    res.json({ value });
  } catch (error) {
    console.error('Secrets decrypt error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/backup - Backup all secrets
router.post('/backup', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const backup = {};
    
    for (const key of keys) {
      const secretDataStr = await redisClient.get(key);
      const ttl = await redisClient.ttl(key);
      backup[key] = {
        data: secretDataStr,
        ttl: ttl === -1 ? null : ttl
      };
    }
    
    res.json({ backup, count: keys.length });
  } catch (error) {
    console.error('Secrets backup error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/restore - Restore secrets from backup
router.post('/restore', async (req, res) => {
  try {
    const { backup } = req.body;
    
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: 'backup object is required' });
    }
    
    const results = [];
    
    for (const [key, value] of Object.entries(backup)) {
      if (value.ttl && value.ttl > 0) {
        await redisClient.setex(key, value.ttl, value.data);
      } else {
        await redisClient.set(key, value.data);
      }
      results.push({ key, restored: true });
    }
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Secrets restore error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/tag - Add tag to secret
router.post('/tag', async (req, res) => {
  try {
    const { key, tag } = req.body;
    
    if (!key || !tag) {
      return res.status(400).json({ error: 'key and tag are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const tagKey = NS_PREFIX + 'tags:' + key;
    
    const exists = await redisClient.exists(redisKey);
    if (exists === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    await redisClient.sadd(tagKey, tag);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets tag error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/tags/:key - Get tags for a secret
router.get('/tags/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const tagKey = NS_PREFIX + 'tags:' + key;
    
    const tags = await redisClient.smembers(tagKey);
    
    res.json({ tags });
  } catch (error) {
    console.error('Secrets tags error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/untag - Remove tag from secret
router.post('/untag', async (req, res) => {
  try {
    const { key, tag } = req.body;
    
    if (!key || !tag) {
      return res.status(400).json({ error: 'key and tag are required' });
    }
    
    const tagKey = NS_PREFIX + 'tags:' + key;
    
    const removed = await redisClient.srem(tagKey, tag);
    
    res.json({ ok: true, removed: removed === 1 });
  } catch (error) {
    console.error('Secrets untag error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/by-tag/:tag - Get secrets by tag
router.get('/by-tag/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const pattern = NS_PREFIX + 'tags:*';
    const keys = await redisClient.keys(pattern);
    
    const matchingKeys = [];
    
    for (const key of keys) {
      const hasTag = await redisClient.sismember(key, tag);
      if (hasTag) {
        const secretKey = key.replace(NS_PREFIX + 'tags:', '');
        matchingKeys.push(secretKey);
      }
    }
    
    res.json({ keys: matchingKeys, count: matchingKeys.length });
  } catch (error) {
    console.error('Secrets by-tag error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/share - Generate a shareable link for a secret
router.post('/share', async (req, res) => {
  try {
    const { key, ttl_seconds, max_accesses } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const shareToken = crypto.randomBytes(32).toString('hex');
    const shareKey = NS_PREFIX + 'share:' + shareToken;
    
    const shareData = {
      key,
      max_accesses: max_accesses || 1,
      access_count: 0,
      created_at: new Date().toISOString()
    };
    
    if (ttl_seconds && ttl_seconds > 0) {
      await redisClient.setex(shareKey, ttl_seconds, JSON.stringify(shareData));
    } else {
      await redisClient.set(shareKey, JSON.stringify(shareData));
    }
    
    res.json({ ok: true, share_token: shareToken });
  } catch (error) {
    console.error('Secrets share error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/retrieve-share/:share_token - Retrieve secret via share token
router.get('/retrieve-share/:share_token', async (req, res) => {
  try {
    const { share_token } = req.params;
    const shareKey = NS_PREFIX + 'share:' + share_token;
    
    const shareDataStr = await redisClient.get(shareKey);
    
    if (shareDataStr === null) {
      return res.status(404).json({ error: 'share_not_found_or_expired' });
    }
    
    const shareData = JSON.parse(shareDataStr);
    
    if (shareData.max_accesses && shareData.access_count >= shareData.max_accesses) {
      await redisClient.del(shareKey);
      return res.status(403).json({ error: 'share_access_limit_reached' });
    }
    
    const redisKey = NS_PREFIX + shareData.key;
    const secretDataStr = await redisClient.get(redisKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const secretData = JSON.parse(secretDataStr);
    const value = decrypt(secretData.encrypted);
    
    // Increment access count
    shareData.access_count++;
    await redisClient.set(shareKey, JSON.stringify(shareData));
    
    // Delete if max accesses reached
    if (shareData.max_accesses && shareData.access_count >= shareData.max_accesses) {
      await redisClient.del(shareKey);
    }
    
    // Delete if one-time secret
    if (secretData.one_time) {
      await redisClient.del(redisKey);
    }
    
    res.json({ value });
  } catch (error) {
    console.error('Secrets retrieve-share error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/revoke-share - Revoke a share
router.post('/revoke-share', async (req, res) => {
  try {
    const { share_token } = req.body;
    
    if (!share_token) {
      return res.status(400).json({ error: 'share_token is required' });
    }
    
    const shareKey = NS_PREFIX + 'share:' + share_token;
    const result = await redisClient.del(shareKey);
    
    res.json({ ok: true, revoked: result === 1 });
  } catch (error) {
    console.error('Secrets revoke-share error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/version - Create a new version of a secret
router.post('/version', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const existingDataStr = await redisClient.get(redisKey);
    
    const encrypted = encrypt(value);
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    if (existingDataStr) {
      // Archive current version
      const existingData = JSON.parse(existingDataStr);
      const version = existingData.version || 1;
      const archiveKey = NS_PREFIX + key + ':v' + version;
      await redisClient.set(archiveKey, existingDataStr);
      
      const secretData = {
        encrypted,
        token,
        one_time: existingData.one_time,
        version: version + 1,
        created_at: new Date().toISOString()
      };
      
      const ttl = await redisClient.ttl(redisKey);
      if (ttl > 0) {
        await redisClient.setex(redisKey, ttl, JSON.stringify(secretData));
      } else {
        await redisClient.set(redisKey, JSON.stringify(secretData));
      }
      
      res.json({ ok: true, version: version + 1 });
    } else {
      const secretData = {
        encrypted,
        token,
        one_time: false,
        version: 1,
        created_at: new Date().toISOString()
      };
      
      await redisClient.set(redisKey, JSON.stringify(secretData));
      
      res.json({ ok: true, version: 1 });
    }
  } catch (error) {
    console.error('Secrets version error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/versions/:key - List all versions of a secret
router.get('/versions/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const pattern = NS_PREFIX + key + ':v*';
    const keys = await redisClient.keys(pattern);
    
    const versions = keys.map(k => {
      const match = k.match(/:v(\d+)$/);
      return match ? parseInt(match[1], 10) : null;
    }).filter(v => v !== null);
    
    versions.sort((a, b) => a - b);
    
    res.json({ versions });
  } catch (error) {
    console.error('Secrets versions error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/retrieve-version/:key/:version - Retrieve a specific version
router.get('/retrieve-version/:key/:version', async (req, res) => {
  try {
    const { key, version } = req.params;
    const archiveKey = NS_PREFIX + key + ':v' + version;
    
    const secretDataStr = await redisClient.get(archiveKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'version_not_found' });
    }
    
    const secretData = JSON.parse(secretDataStr);
    const value = decrypt(secretData.encrypted);
    
    res.json({ value, version: parseInt(version, 10) });
  } catch (error) {
    console.error('Secrets retrieve-version error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/restore-version - Restore a specific version
router.post('/restore-version', async (req, res) => {
  try {
    const { key, version } = req.body;
    
    if (!key || !version) {
      return res.status(400).json({ error: 'key and version are required' });
    }
    
    const archiveKey = NS_PREFIX + key + ':v' + version;
    const redisKey = NS_PREFIX + key;
    
    const secretDataStr = await redisClient.get(archiveKey);
    
    if (secretDataStr === null) {
      return res.status(404).json({ error: 'version_not_found' });
    }
    
    const secretData = JSON.parse(secretDataStr);
    const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    secretData.token = token;
    secretData.restored_from = version;
    secretData.restored_at = new Date().toISOString();
    
    await redisClient.set(redisKey, JSON.stringify(secretData));
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets restore-version error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/delete-versions - Delete all archived versions
router.post('/delete-versions', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const pattern = NS_PREFIX + key + ':v*';
    const keys = await redisClient.keys(pattern);
    
    let deleted = 0;
    for (const k of keys) {
      deleted += await redisClient.del(k);
    }
    
    res.json({ ok: true, deleted });
  } catch (error) {
    console.error('Secrets delete-versions error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/audit-log - Log secret access
router.post('/audit-log', async (req, res) => {
  try {
    const { key, action, user_id } = req.body;
    
    if (!key || !action) {
      return res.status(400).json({ error: 'key and action are required' });
    }
    
    const auditKey = NS_PREFIX + 'audit:' + key;
    const logEntry = {
      action,
      user_id: user_id || null,
      timestamp: new Date().toISOString()
    };
    
    await redisClient.lpush(auditKey, JSON.stringify(logEntry));
    await redisClient.ltrim(auditKey, 0, 99); // Keep last 100 entries
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets audit-log error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/audit-log/:key - Get audit log for a secret
router.get('/audit-log/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const auditKey = NS_PREFIX + 'audit:' + key;
    
    const logs = await redisClient.lrange(auditKey, 0, -1);
    
    const parsedLogs = logs.map(log => JSON.parse(log));
    
    res.json({ logs: parsedLogs, count: parsedLogs.length });
  } catch (error) {
    console.error('Secrets audit-log error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/set-policy - Set access policy for a secret
router.post('/set-policy', async (req, res) => {
  try {
    const { key, policy } = req.body;
    
    if (!key || !policy) {
      return res.status(400).json({ error: 'key and policy are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const policyKey = NS_PREFIX + 'policy:' + key;
    await redisClient.set(policyKey, JSON.stringify(policy));
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets set-policy error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/policy/:key - Get access policy for a secret
router.get('/policy/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const policyKey = NS_PREFIX + 'policy:' + key;
    
    const policyStr = await redisClient.get(policyKey);
    
    if (!policyStr) {
      return res.json({ policy: null });
    }
    
    const policy = JSON.parse(policyStr);
    
    res.json({ policy });
  } catch (error) {
    console.error('Secrets policy error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/check-access - Check if access is allowed by policy
router.post('/check-access', async (req, res) => {
  try {
    const { key, user_id, action } = req.body;
    
    if (!key || !action) {
      return res.status(400).json({ error: 'key and action are required' });
    }
    
    const policyKey = NS_PREFIX + 'policy:' + key;
    const policyStr = await redisClient.get(policyKey);
    
    if (!policyStr) {
      return res.json({ allowed: true, reason: 'no_policy' });
    }
    
    const policy = JSON.parse(policyStr);
    
    // Simple policy check - can be extended
    if (policy.allowed_users && user_id) {
      const allowed = policy.allowed_users.includes(user_id);
      return res.json({ allowed, reason: allowed ? 'user_allowed' : 'user_not_allowed' });
    }
    
    if (policy.allowed_actions) {
      const allowed = policy.allowed_actions.includes(action);
      return res.json({ allowed, reason: allowed ? 'action_allowed' : 'action_not_allowed' });
    }
    
    res.json({ allowed: true, reason: 'default_allow' });
  } catch (error) {
    console.error('Secrets check-access error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/expire - Set expiration time for a secret
router.post('/expire', async (req, res) => {
  try {
    const { key, expires_at } = req.body;
    
    if (!key || !expires_at) {
      return res.status(400).json({ error: 'key and expires_at are required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const exists = await redisClient.exists(redisKey);
    
    if (exists === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    const expireDate = new Date(expires_at);
    const now = new Date();
    const ttlSeconds = Math.max(0, Math.floor((expireDate - now) / 1000));
    
    if (ttlSeconds > 0) {
      await redisClient.expire(redisKey, ttlSeconds);
    } else {
      await redisClient.del(redisKey);
      return res.json({ ok: true, expired: true });
    }
    
    res.json({ ok: true, expires_at });
  } catch (error) {
    console.error('Secrets expire error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/search - Search secrets by metadata
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const results = [];
    
    for (const key of keys) {
      if (key.includes(':tags:') || key.includes(':audit:') || key.includes(':policy:') || key.includes(':share:')) {
        continue;
      }
      
      const secretKey = key.replace(NS_PREFIX, '');
      if (secretKey.toLowerCase().includes(query.toLowerCase())) {
        results.push(secretKey);
      }
    }
    
    res.json({ keys: results, count: results.length });
  } catch (error) {
    console.error('Secrets search error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/stats - Get statistics about secrets
router.get('/stats', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    let totalSecrets = 0;
    let oneTimeSecrets = 0;
    let expiringSecrets = 0;
    
    for (const key of keys) {
      if (key.includes(':tags:') || key.includes(':audit:') || key.includes(':policy:') || key.includes(':share:') || key.includes(':v')) {
        continue;
      }
      
      totalSecrets++;
      
      const secretDataStr = await redisClient.get(key);
      if (secretDataStr) {
        const secretData = JSON.parse(secretDataStr);
        if (secretData.one_time) oneTimeSecrets++;
        
        const ttl = await redisClient.ttl(key);
        if (ttl > 0 && ttl !== -1) expiringSecrets++;
      }
    }
    
    res.json({
      total_secrets: totalSecrets,
      one_time_secrets: oneTimeSecrets,
      expiring_secrets: expiringSecrets,
      permanent_secrets: totalSecrets - expiringSecrets
    });
  } catch (error) {
    console.error('Secrets stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/clear-expired - Clear all expired secrets
router.post('/clear-expired', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    let cleared = 0;
    
    for (const key of keys) {
      if (key.includes(':tags:') || key.includes(':audit:') || key.includes(':policy:') || key.includes(':share:') || key.includes(':v')) {
        continue;
      }
      
      const ttl = await redisClient.ttl(key);
      if (ttl === -2) {
        await redisClient.del(key);
        cleared++;
      }
    }
    
    res.json({ ok: true, cleared });
  } catch (error) {
    console.error('Secrets clear-expired error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/import - Import secrets from JSON
router.post('/import', async (req, res) => {
  try {
    const { secrets } = req.body;
    
    if (!secrets || typeof secrets !== 'object') {
      return res.status(400).json({ error: 'secrets object is required' });
    }
    
    const results = [];
    
    for (const [key, value] of Object.entries(secrets)) {
      const redisKey = NS_PREFIX + key;
      const token = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      
      const encrypted = encrypt(value);
      const secretData = {
        encrypted,
        token,
        one_time: false,
        created_at: new Date().toISOString(),
        imported: true
      };
      
      await redisClient.set(redisKey, JSON.stringify(secretData));
      results.push({ key, ok: true });
    }
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Secrets import error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/export - Export all secrets (decrypted)
router.get('/export', async (req, res) => {
  try {
    const pattern = NS_PREFIX + '*';
    const keys = await redisClient.keys(pattern);
    
    const exported = {};
    
    for (const key of keys) {
      if (key.includes(':tags:') || key.includes(':audit:') || key.includes(':policy:') || key.includes(':share:') || key.includes(':v')) {
        continue;
      }
      
      const secretDataStr = await redisClient.get(key);
      if (secretDataStr) {
        const secretData = JSON.parse(secretDataStr);
        const secretKey = key.replace(NS_PREFIX, '');
        try {
          exported[secretKey] = decrypt(secretData.encrypted);
        } catch (e) {
          exported[secretKey] = '[decryption_error]';
        }
      }
    }
    
    res.json({ secrets: exported, count: Object.keys(exported).length });
  } catch (error) {
    console.error('Secrets export error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/validate - Validate a secret value against rules
router.post('/validate', async (req, res) => {
  try {
    const { value, rules } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const validationRules = rules || {};
    const errors = [];
    
    if (validationRules.min_length && String(value).length < validationRules.min_length) {
      errors.push(`minimum_length: ${validationRules.min_length}`);
    }
    
    if (validationRules.max_length && String(value).length > validationRules.max_length) {
      errors.push(`maximum_length: ${validationRules.max_length}`);
    }
    
    if (validationRules.require_uppercase && !/[A-Z]/.test(value)) {
      errors.push('requires_uppercase');
    }
    
    if (validationRules.require_lowercase && !/[a-z]/.test(value)) {
      errors.push('requires_lowercase');
    }
    
    if (validationRules.require_number && !/\d/.test(value)) {
      errors.push('requires_number');
    }
    
    if (validationRules.require_special && !/[^a-zA-Z0-9]/.test(value)) {
      errors.push('requires_special_character');
    }
    
    if (validationRules.pattern && !new RegExp(validationRules.pattern).test(value)) {
      errors.push('pattern_mismatch');
    }
    
    res.json({ valid: errors.length === 0, errors });
  } catch (error) {
    console.error('Secrets validate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/lock - Lock a secret (prevent modifications)
router.post('/lock', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const redisKey = NS_PREFIX + key;
    const lockKey = NS_PREFIX + 'lock:' + key;
    
    const exists = await redisClient.exists(redisKey);
    if (exists === 0) {
      return res.status(404).json({ error: 'secret_not_found' });
    }
    
    await redisClient.set(lockKey, '1');
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Secrets lock error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/unlock - Unlock a secret
router.post('/unlock', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    
    const lockKey = NS_PREFIX + 'lock:' + key;
    
    const result = await redisClient.del(lockKey);
    
    res.json({ ok: true, unlocked: result === 1 });
  } catch (error) {
    console.error('Secrets unlock error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /secrets/is-locked/:key - Check if a secret is locked
router.get('/is-locked/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const lockKey = NS_PREFIX + 'lock:' + key;
    
    const locked = await redisClient.exists(lockKey) === 1;
    
    res.json({ locked });
  } catch (error) {
    console.error('Secrets is-locked error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/encrypt-with-key - Encrypt with custom key
router.post('/encrypt-with-key', async (req, res) => {
  try {
    const { value, key } = req.body;
    
    if (value === undefined || !key) {
      return res.status(400).json({ error: 'value and key are required' });
    }
    
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    res.json({
      encrypted: {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
      }
    });
  } catch (error) {
    console.error('Secrets encrypt-with-key error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /secrets/decrypt-with-key - Decrypt with custom key
router.post('/decrypt-with-key', async (req, res) => {
  try {
    const { encrypted, key } = req.body;
    
    if (!encrypted || !key) {
      return res.status(400).json({ error: 'encrypted and key are required' });
    }
    
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    res.json({ value: JSON.parse(decrypted) });
  } catch (error) {
    console.error('Secrets decrypt-with-key error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
