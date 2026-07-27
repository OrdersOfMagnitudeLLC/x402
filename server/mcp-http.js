const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

// Load products-all.json at startup
const productsPath = path.join(__dirname, '../public/products-all.json');
let productsData = [];

try {
  const rawData = fs.readFileSync(productsPath, 'utf8');
  productsData = JSON.parse(rawData);
  console.error(`Loaded ${productsData.length} endpoints from products-all.json`);
} catch (error) {
  console.error(`Error loading products-all.json: ${error.message}`);
  process.exit(1);
}

// Factory function to create a new MCP server instance
function createMCPServer() {
  const server = new Server(
    {
      name: 'x402-endpoint-catalog',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_endpoints',
          description: 'Search for API endpoints by query string. Searches across endpoint names, descriptions, and categories.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query to match against endpoint names, descriptions, and categories',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'list_categories',
          description: 'List all unique endpoint categories with their counts',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'search_endpoints') {
        const { query } = args;
        const searchQuery = query.toLowerCase();

        // Search across name, description, and category
        const results = productsData.filter((endpoint) => {
          return (
            endpoint.name?.toLowerCase().includes(searchQuery) ||
            endpoint.description?.toLowerCase().includes(searchQuery) ||
            endpoint.category?.toLowerCase().includes(searchQuery) ||
            endpoint.id?.toLowerCase().includes(searchQuery)
          );
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query,
                  count: results.length,
                  results: results.map((ep) => ({
                    id: ep.id,
                    name: ep.name,
                    category: ep.category,
                    price_usd: ep.price_usd,
                    description: ep.description,
                    route_path: ep.route_path,
                    source_url: ep.source_url,
                    response_fields: ep.response_fields,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } else if (name === 'list_categories') {
        // Count endpoints per category
        const categoryCounts = {};
        productsData.forEach((endpoint) => {
          const category = endpoint.category || 'uncategorized';
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });

        // Convert to sorted array
        const categories = Object.entries(categoryCounts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total_categories: categories.length,
                  total_endpoints: productsData.length,
                  categories,
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Mount MCP server on Express app at /mcp
async function mountMCP(app) {
  app.get('/mcp', (req, res) => {
    res.status(200).json({ status: 'ok', name: 'x402-endpoint-catalog', version: '1.0.0' });
  });

  app.post('/mcp', async (req, res) => {
    const server = createMCPServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  console.error('x402 MCP server mounted at /mcp with HTTP transport');
}

module.exports = { mountMCP };
