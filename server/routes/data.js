const express = require('express');
const router = express.Router();
const products = require('../../products-all.json');

// Helper function to filter response fields
function filterResponse(data, fields) {
  if (!fields || !Array.isArray(fields)) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => {
      const filtered = {};
      fields.forEach(field => {
        if (item[field] !== undefined) {
          filtered[field] = item[field];
        }
      });
      return filtered;
    });
  } else {
    const filtered = {};
    fields.forEach(field => {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    });
    return filtered;
  }
}

// Category 1: Global Data Endpoints (cat1_001 - cat1_030)

// Route: cat1_001 - Crypto prices (CoinGecko)
// Variant A: price_usd = 0.005
router.get('/crypto-prices', async (req, res) => {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    const prices = await response.json();
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crypto prices' });
  }
});

// Route: cat1_002 - Crypto market cap + dominance (CoinGecko)
// Variant B: ab_price_usd = 0.0025
router.get('/crypto-market-cap', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_002');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crypto market cap data' });
  }
});

// Route: cat1_003 - Crypto funding rates (Binance/Bybit/OKX)
// Variant A: price_usd = 0.005
router.get('/crypto-funding-rates', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_003');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crypto funding rates' });
  }
});

// Route: cat1_004 - DeFi TVL by protocol (DeFiLlama)
// Variant B: ab_price_usd = 0.0025
router.get('/defi-tvl', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_004');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const top10 = data.slice(0, 10);
    const filteredData = filterResponse(top10, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch DeFi TVL data' });
  }
});

// Route: cat1_005 - Macro indicators — US (FRED)
// Variant A: price_usd = 0.005
router.get('/macro-indicators-us', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_005');
    const url = product.source_url.replace('DEMO_KEY', process.env.FRED_API_KEY || 'DEMO_KEY');
    const response = await fetch(url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch US macro indicators' });
  }
});

// Route: cat1_006 - Macro indicators — global (World Bank API)
// Variant B: ab_price_usd = 0.0025
router.get('/macro-indicators-global', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_006');
    const response = await fetch(product.source_url + '?format=json&per_page=10');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global macro indicators' });
  }
});

// Route: cat1_007 - Bond yields + yield curve (FRED)
// Variant A: price_usd = 0.005
router.get('/bond-yields', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_007');
    const url = product.source_url.replace('DEMO_KEY', process.env.FRED_API_KEY || 'DEMO_KEY');
    const response = await fetch(url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bond yields' });
  }
});

// Route: cat1_008 - Commodity prices (FRED/Quandl)
// Variant B: ab_price_usd = 0.0025
router.get('/commodity-prices', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_008');
    const response = await fetch(
      "https://api.worldbank.org/v2/en/indicator/PCOMM?format=json&per_page=10"
    );
    const data = await response.json();
    const filteredData = filterResponse(data[1] || data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch commodity prices' });
  }
});

// Route: cat1_009 - Exchange rates multi-source (ECB + FRED aggregated)
// Variant A: price_usd = 0.005
router.get('/exchange-rates', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_009');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = data.rates || data;
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

// Route: cat1_010 - Stock market data (Yahoo Finance)
// Variant B: ab_price_usd = 0.0025
router.get('/stock-market-data', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_010');
    const symbol = req.query.symbol || 'AAPL';
    const response = await fetch(product.source_url + `/${symbol}`);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock market data' });
  }
});

// Route: cat1_011 - SEC EDGAR filings lookup
// Variant A: price_usd = 0.005
router.get('/sec-edgar-filings', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_011');
    const query = req.query.q || 'AAPL';
    const response = await fetch(product.source_url + `?q=${query}&dateRange=custom`);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SEC EDGAR filings' });
  }
});

// Route: cat1_012 - Company registry (OpenCorporates)
// Variant B: ab_price_usd = 0.0025
router.get('/company-registry', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_012');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch company registry data' });
  }
});

// Route: cat1_013 - Sanctions screening (OFAC free list)
// Variant A: price_usd = 0.005
router.get('/sanctions-screening', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_013');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sanctions screening data' });
  }
});

// Route: cat1_014 - Patent search (USPTO API)
// Variant B: ab_price_usd = 0.0025
router.get('/patent-search', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_014');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patent search results' });
  }
});

// Route: cat1_015 - Scientific literature (arXiv API)
// Variant A: price_usd = 0.005
router.get('/scientific-literature', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_015');
    const response = await fetch(product.source_url + '?search_query=cat:cs.AI&max_results=5');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scientific literature' });
  }
});

// Route: cat1_016 - Clinical trials lookup (ClinicalTrials.gov)
// Variant B: ab_price_usd = 0.0025
router.get('/clinical-trials', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_016');
    const response = await fetch(product.source_url + '?pageSize=10');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clinical trials data' });
  }
});

// Route: cat1_017 - Drug adverse events (OpenFDA)
// Variant A: price_usd = 0.005
router.get('/drug-adverse-events', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_017');
    const response = await fetch(product.source_url + '?limit=10');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drug adverse events' });
  }
});

// Route: cat1_018 - FDA recalls (OpenFDA)
// Variant B: ab_price_usd = 0.0025
router.get('/fda-recalls', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_018');
    const response = await fetch(product.source_url + '?limit=10');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FDA recalls' });
  }
});

// Route: cat1_019 - CVE vulnerability lookup (NVD)
// Variant A: price_usd = 0.005
router.get('/cve-vulnerabilities', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_019');
    const response = await fetch(product.source_url + '?resultsPerPage=10');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CVE vulnerabilities' });
  }
});

// Route: cat1_020 - Earthquake/seismic data (USGS)
// Variant B: ab_price_usd = 0.0025
router.get('/earthquake-data', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_020');
    const response = await fetch(product.source_url + '?format=geojson&limit=10&orderby=time');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch earthquake data' });
  }
});

// Route: cat1_021 - Air quality index (OpenAQ)
// Variant A: price_usd = 0.005
router.get('/air-quality', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_021');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch air quality data' });
  }
});

// Route: cat1_022 - Weather extremes (NOAA)
// Variant B: ab_price_usd = 0.0025
router.get('/weather-extremes', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_022');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather extremes' });
  }
});

// Route: cat1_023 - Job market data (BLS)
// Variant A: price_usd = 0.005
router.get('/job-market-data', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_023');
    const response = await fetch(
      "https://api.bls.gov/publicAPI/v1/timeseries/data/LAUCN040010000000005"
    );
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job market data' });
  }
});

// Route: cat1_024 - Academic citation graph (OpenCitations)
// Variant B: ab_price_usd = 0.0025
router.get('/academic-citations', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_024');
    const response = await fetch(product.source_url + 'citations/');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch academic citation data' });
  }
});

// Route: cat1_025 - Nutrition database (USDA FoodData)
// Variant A: price_usd = 0.005
router.get('/nutrition-database', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_025');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch nutrition database' });
  }
});

// Route: cat1_026 - Domain WHOIS + DNS
// Variant B: ab_price_usd = 0.0025
router.get('/domain-whois-dns', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_026');
    const domain = req.query.domain || 'example.com';
    const response = await fetch(product.source_url + domain);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch domain WHOIS/DNS data' });
  }
});

// Route: cat1_027 - IP geolocation (ip-api free tier)
// Variant A: price_usd = 0.005
router.get('/ip-geolocation', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_027');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch IP geolocation' });
  }
});

// Route: cat1_028 - Email validation (syntax + MX)
// Variant B: ab_price_usd = 0.0025
router.get('/email-validation', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_028');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate email' });
  }
});

// Route: cat1_029 - Economic indicators (OECD)
// Variant A: price_usd = 0.005
router.get('/economic-indicators-oecd', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat1_029');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OECD economic indicators' });
  }
});

// Route: cat1_030 - Port/shipping AIS data (MarineTraffic free)
// Variant B: ab_price_usd = 0.0025
router.get('/shipping-ais-data', async (req, res) => {
  try {
    res.status(200).json({
      message: "AIS data requires premium access. Upgrade endpoint available at /data/shipping-ais-premium",
      upgrade_endpoint: "/data/shipping-ais-premium"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return upgrade message' });
  }
});

// Category 2: Regional Data - Malaysia & Pakistan (cat2_001 - cat2_012)

// Route: cat2_001 - Bursa Malaysia stock prices
// Variant A: price_usd = 0.005
router.get('/bursa-malaysia', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_002 - BNM exchange rates
// Variant B: ab_price_usd = 0.0025
router.get('/bnm-exchange-rates', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat2_002');
    const response = await fetch(product.source_url + '?currency=USD');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch BNM exchange rates' });
  }
});

// Route: cat2_003 - Malaysia economic indicators
// Variant A: price_usd = 0.005
router.get('/malaysia-economic-indicators', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_004 - Malaysia property transactions
// Variant B: ab_price_usd = 0.0025
router.get('/malaysia-property-transactions', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_005 - SSM company lookup
// Variant A: price_usd = 0.005
router.get('/ssm-company-lookup', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_006 - Malaysia news — English
// Variant B: ab_price_usd = 0.0025
router.get('/malaysia-news-english', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat2_006');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Malaysia news (English)' });
  }
});

// Route: cat2_007 - Malaysia news — Bahasa
// Variant A: price_usd = 0.005
router.get('/malaysia-news-bahasa', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat2_007');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Malaysia news (Bahasa)' });
  }
});

// Route: cat2_008 - PSX Pakistan stock prices
// Variant B: ab_price_usd = 0.0025
router.get('/psx-pakistan', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_009 - SBP exchange rates
// Variant A: price_usd = 0.005
router.get('/sbp-exchange-rates', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat2_009');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SBP exchange rates' });
  }
});

// Route: cat2_010 - Pakistan economic data
// Variant B: ab_price_usd = 0.0025
router.get('/pakistan-economic-data', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_011 - SECP company registry
// Variant A: price_usd = 0.005
router.get('/secp-company-registry', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat2_012 - Pakistan news aggregation
// Variant B: ab_price_usd = 0.0025
router.get('/pakistan-news', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat2_012');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Pakistan news' });
  }
});

// Category 3: Regional Data - Asia, Africa, Americas (cat3_001 - cat3_018)

// Route: cat3_001 - SGX Singapore equities
// Variant A: price_usd = 0.005
router.get('/sgx-singapore', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_002 - IDX Indonesia equities
// Variant B: ab_price_usd = 0.0025
router.get('/idx-indonesia', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_003 - SET Thailand equities
// Variant A: price_usd = 0.005
router.get('/set-thailand', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_004 - PSE Philippines equities
// Variant B: ab_price_usd = 0.0025
router.get('/pse-philippines', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_005 - Saudi Tadawul
// Variant A: price_usd = 0.005
router.get('/saudi-tadawul', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_006 - UAE ADX data
// Variant B: ab_price_usd = 0.0025
router.get('/uae-adx', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_007 - Egypt EGX data
// Variant A: price_usd = 0.005
router.get('/egypt-egx', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_008 - Nigeria NGX data
// Variant B: ab_price_usd = 0.0025
router.get('/nigeria-ngx', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_009 - Kenya NSE data
// Variant A: price_usd = 0.005
router.get('/kenya-nse', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_010 - Turkey BIST data
// Variant B: ab_price_usd = 0.0025
router.get('/turkey-bist', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_011 - India NSE/BSE
// Variant A: price_usd = 0.005
router.get('/india-nse-bse', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat3_011');
    const response = await fetch(product.source_url + '/^NSEI');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch India NSE/BSE data' });
  }
});

// Route: cat3_012 - Brazil BOVESPA
// Variant B: ab_price_usd = 0.0025
router.get('/brazil-bovespa', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat3_012');
    const response = await fetch(product.source_url + '/^BVSP');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Brazil BOVESPA data' });
  }
});

// Route: cat3_013 - South Africa JSE
// Variant A: price_usd = 0.005
router.get('/south-africa-jse', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat3_013');
    const response = await fetch(product.source_url + '/^J203');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch South Africa JSE data' });
  }
});

// Route: cat3_014 - Mexico BMV
// Variant B: ab_price_usd = 0.0025
router.get('/mexico-bmv', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat3_014');
    const response = await fetch(product.source_url + '/^MXX');
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Mexico BMV data' });
  }
});

// Route: cat3_015 - Gulf macro indicators (GCC Stat)
// Variant A: price_usd = 0.005
router.get('/gulf-macro-indicators', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_016 - MENA news aggregation (English)
// Variant B: ab_price_usd = 0.0025
router.get('/mena-news-english', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat3_016');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch MENA news (English)' });
  }
});

// Route: cat3_017 - ASEAN economic indicators (ASEAN Stats)
// Variant A: price_usd = 0.005
router.get('/asean-economic-indicators', async (req, res) => {
  try {
    res.status(200).json({
      message: "This endpoint is coming soon. Premium access will be available.",
      status: "coming_soon"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to return status message' });
  }
});

// Route: cat3_018 - Africa macro indicators (World Bank filtered)
// Variant B: ab_price_usd = 0.0025
router.get('/africa-macro-indicators', async (req, res) => {
  try {
    const product = products.find(p => p.id === 'cat3_018');
    const response = await fetch(product.source_url);
    const data = await response.json();
    const filteredData = filterResponse(data, product.response_fields);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Africa macro indicators' });
  }
});

// Dynamic routes for all active data endpoints
const genericHandler = require('../../src/handlers/data/generic');

products
  .filter(p =>
    p.active === true &&
    (p.handler === 'data/generic' || !p.handler) &&
    (p.route_path || p.path)
  )
  .forEach(product => {
    const routePath = product.route_path || product.path;
    const method = (product.method || 'GET').toLowerCase();
    if (router[method]) {
      router[method](routePath, (req, res) => genericHandler(req, res, product));
    }
  });

module.exports = router;
