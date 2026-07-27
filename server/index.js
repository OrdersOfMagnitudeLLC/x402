const express = require('express');
const { baseX402Middleware } = require('../middleware/x402');
const idempotencyMiddleware = require('../middleware/idempotency');
const dataRouter = require('./routes/data');
const aiRouter = require('./routes/ai');
const nsRouter = require('./routes/ns');
const financialRouter = require('./routes/financial');
const temporalRouter = require('./routes/temporal');
const geospatialRouter = require('./routes/geospatial');
const referenceRouter = require('./routes/reference');
const memoryRouter = require('./routes/memory');
const loggingRouter = require('./routes/logging');
const tasksRouter = require('./routes/tasks');
const notifyRouter = require('./routes/notify');
const verifyRouter = require('./routes/verify');
const coordinationRouter = require('./routes/coordination');
const secretsRouter = require('./routes/secrets');
const simulateRouter = require('./routes/simulate');
const mcpRouter = require('../mcp/server');
const { mountMCP } = require('./mcp-http');
const Redis = require('ioredis');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

// Middleware
app.use(express.json());
app.use(express.static(require('path').join(__dirname, '../public')));

// Bazaar discovery header on all responses
app.use((req, res, next) => {
  res.setHeader('x-bazaar-endpoint', 'true');
  next();
});

// Health check (before x402 enforcement)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve x402.json manifest at both /x402.json and /.well-known/x402.json
app.get('/.well-known/x402.json', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/x402.json'));
});

// Temporary flush endpoint (protected)
app.post('/admin/flush-redis', async (req, res) => {
  if (req.headers['x-secret'] !== process.env.MCP_INTERNAL_SECRET)
    return res.status(403).json({ error: 'forbidden' });
  await redisClient.flushall();
  res.json({ ok: true });
});

// Inject bazaar schema into 402 response body (before x402 middleware)
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  
  res.status = function(code) {
    if (code === 402) {
      res._is402 = true;
    }
    return originalStatus(code);
  };
  
  res.json = function(body) {
    // Check if this is a 402 payment response
    if (res._is402 || res.statusCode === 402) {
      body = body || {};
      body.extensions = body.extensions || {};
      body.extensions.bazaar = {
        info: {
          title: "OOM Data API",
          description: "Pay-per-call data endpoint via x402"
        },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            input: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  const: "http"
                },
                method: {
                  type: "string",
                  enum: ["GET"]
                }
              },
              required: ["type", "method"],
              additionalProperties: false
            },
            output: {
              type: "object",
              properties: {
                type: {
                  type: "string"
                },
                data: {
                  type: "object"
                }
              },
              required: ["type"]
            }
          },
          required: ["input"]
        }
      };
    }
    return originalJson(body);
  };
  
  next();
});

const searchRouter = require('./routes/search');
app.use('/search', searchRouter);

// Mount MCP HTTP transport (must be before payment middleware)
mountMCP(app).catch((error) => {
  console.error('Failed to mount MCP HTTP transport:', error);
});

app.use(baseX402Middleware);
app.use(idempotencyMiddleware);

// Mount data router at /data
app.use('/data', dataRouter);

// Mount ai router at /ai
app.use('/ai', aiRouter);

// Mount ns router at /ns
app.use('/ns', nsRouter);

// Mount financial router at /financial
app.use('/financial', financialRouter);

// Mount temporal router at /temporal
app.use('/temporal', temporalRouter);

// Mount geospatial router at /geospatial
app.use('/geospatial', geospatialRouter);

// Mount reference router at /reference
app.use('/reference', referenceRouter);

// Mount memory router at /memory
app.use('/memory', memoryRouter);

// Mount logging router at /logging
app.use('/logging', loggingRouter);

// Mount tasks router at /tasks
app.use('/tasks', tasksRouter);

// Mount notify router at /notify
app.use('/notify', notifyRouter);

// Mount verify router at /verify
app.use('/verify', verifyRouter);

// Mount coordination router at /coordination
app.use('/coordination', coordinationRouter);

// Mount secrets router at /secrets
app.use('/secrets', secretsRouter);

// Mount simulate router at /simulate
app.use('/simulate', simulateRouter);

// Mount MCP router at /mcp
app.use('/mcp', mcpRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
