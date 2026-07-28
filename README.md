# OOM x402 API

Pay-per-call API platform exposing 1,000+ endpoints across data, compute, coordination, memory, verification, and agent infrastructure categories.

**Base URL:** https://x402-api-production-5133.up.railway.app

## Making a Call

All endpoints return 402 with payment details. Include the `x-payment` header to pay and receive the response.

```bash
curl -X GET "https://x402-api-production-5133.up.railway.app/weather/current/37.7749/-122.4194" \
  -H "x-payment: <payment-token>"
```

## Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| ai_analysis | 10 | AI-powered analysis tools for text, images, and data patterns |
| ai_media | 10 | AI media generation and processing capabilities |
| compute | 39 | General-purpose compute and processing endpoints |
| crypto_finance | 80 | Cryptocurrency prices, market data, DeFi metrics, and funding rates |
| entertainment_media | 29 | Entertainment industry data including movies, music, and gaming |
| geography_location | 249 | Geographic data, location services, and mapping information |
| government | 81 | Government data, public records, and administrative information |
| government_economic | 116 | Economic indicators, fiscal data, and government financial reports |
| health_medical | 29 | Medical data, health statistics, and healthcare information |
| information | 202 | General information retrieval and reference data |
| ns_compute | 20 | Specialized compute endpoints for specific processing tasks |
| reference_knowledge | 16 | Encyclopedic knowledge and reference materials |
| regional_finance | 4 | Regional financial data and market information |
| sea_finance | 5 | Southeast Asia-specific financial and economic data |
| social_trends | 14 | Social media trends, sentiment analysis, and cultural data |
| sports | 22 | Sports data, scores, statistics, and event information |
| weather_environment | 85 | Weather forecasts, environmental data, and climate information |

## Payment Model

x402 protocol with USDC on Base network. Pay-per-call pricing with no subscription required. Each endpoint call costs a small fraction of a cent, deducted automatically via the x402 payment protocol.

## MCP Server

For Model Context Protocol integration, use the npm package:

```bash
npm install oom-x402-mcp
```

See [mcp-package/README.md](./mcp-package/README.md) for MCP server configuration.

## Links

- Endpoint manifest: https://x402-api-production-5133.up.railway.app/x402.json
- Agent schema: https://x402-api-production-5133.up.railway.app/llms.txt
- OpenAPI spec: https://x402-api-production-5133.up.railway.app/openapi.json
