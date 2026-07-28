# OOM x402 MCP Server

MCP server exposing 1,000+ pay-per-call API endpoints across data, compute, coordination, memory, verification, and agent infrastructure categories.

## Installation
```json
{
  "mcpServers": {
    "oom-x402": {
      "command": "npx",
      "args": ["oom-x402-mcp"]
    }
  }
}
```

## Available Categories

- **ai_analysis** (10 endpoints): AI-powered analysis tools for text, images, and data patterns
- **ai_media** (10 endpoints): AI media generation and processing capabilities
- **compute** (39 endpoints): General-purpose compute and processing endpoints
- **crypto_finance** (80 endpoints): Cryptocurrency prices, market data, DeFi metrics, and funding rates
- **entertainment_media** (29 endpoints): Entertainment industry data including movies, music, and gaming
- **geography_location** (249 endpoints): Geographic data, location services, and mapping information
- **government** (81 endpoints): Government data, public records, and administrative information
- **government_economic** (116 endpoints): Economic indicators, fiscal data, and government financial reports
- **health_medical** (29 endpoints): Medical data, health statistics, and healthcare information
- **information** (202 endpoints): General information retrieval and reference data
- **ns_compute** (20 endpoints): Specialized compute endpoints for specific processing tasks
- **reference_knowledge** (16 endpoints): Encyclopedic knowledge and reference materials
- **regional_finance** (4 endpoints): Regional financial data and market information
- **sea_finance** (5 endpoints): Southeast Asia-specific financial and economic data
- **social_trends** (14 endpoints): Social media trends, sentiment analysis, and cultural data
- **sports** (22 endpoints): Sports data, scores, statistics, and event information
- **weather_environment** (85 endpoints): Weather forecasts, environmental data, and climate information

## Payment

x402 protocol with USDC on Base network. Pay-per-call pricing with no subscription required. Each endpoint call costs a small fraction of a cent, deducted automatically via the x402 payment protocol.

## Links

- API base: https://x402-api-production-5133.up.railway.app
- Endpoint manifest: https://x402-api-production-5133.up.railway.app/x402.json
- Agent schema: https://x402-api-production-5133.up.railway.app/llms.txt
