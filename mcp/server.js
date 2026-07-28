const express = require('express');
const products = require('../products-all.json');

const router = express.Router();

// Helper function to get route path from product
function getRoutePath(product) {
  return product.route_path;
}

// Helper function to determine HTTP method based on category
function getHttpMethod(category) {
  // Categories 1-3 use GET, categories 4-8 use POST
  return category <= 3 ? 'GET' : 'POST';
}

// Generate MCP tool definitions from products-all.json
function generateTools() {
  return products.map(product => ({
    name: product.id,
    description: product.description,
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input data for the tool'
        }
      },
      required: ['input']
    }
  }));
}

// Handle tool execution by calling internal endpoint
async function executeTool(productId, input) {
  const product = products.find(p => p.id === productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const routePath = getRoutePath(product);
  const method = getHttpMethod(product.category);
  const secret = process.env.MCP_INTERNAL_SECRET || 'dev-secret';

  const url = `http://localhost:3000${routePath}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-mcp': secret
    }
  };

  if (method === 'POST') {
    options.body = JSON.stringify({ input });
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// SSE endpoint for MCP transport
router.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send keep-alive comments every 15 seconds
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// JSON-RPC endpoint
router.post('/', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32600,
        message: 'Invalid Request: JSON-RPC version must be 2.0'
      }
    });
  }

  try {
    let result;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'x402 MCP Server',
            version: '1.0.0'
          }
        };
        break;

      case 'tools/list':
        result = {
          tools: generateTools()
        };
        break;

      case 'tools/call':
        const { name, arguments: args } = params;
        result = await executeTool(name, args?.input);
        break;

      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
    }

    res.json({
      jsonrpc: '2.0',
      id,
      result
    });

  } catch (error) {
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
});

module.exports = router;
