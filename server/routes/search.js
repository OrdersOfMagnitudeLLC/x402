const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Cache merged products at startup
const productsAllPath = path.join(__dirname, '../../public/products-all.json');
const allProducts = JSON.parse(fs.readFileSync(productsAllPath, 'utf8'));

// Search endpoint
router.get('/', (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter ?q=' });
  }

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/);

  // Score each endpoint
  const scored = allProducts.map(product => {
    let score = 0;
    
    const name = (product.name || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    const category = String(product.category || '').toLowerCase();
    const routePath = (product.route_path || '').toLowerCase();

    // Exact match in name = 3pts
    if (name.includes(queryLower)) {
      score += 3;
    }

    // Description match = 2pts per term
    queryTerms.forEach(term => {
      if (description.includes(term)) {
        score += 2;
      }
    });

    // Category match = 1pt
    if (category.includes(queryLower)) {
      score += 1;
    }

    // Route path match = 1pt
    if (routePath.includes(queryLower)) {
      score += 1;
    }

    return {
      endpoint: product.route_path,
      description: product.description,
      category: product.category,
      price_usd: product.price_usd,
      method: product.method || 'GET',
      score
    };
  });

  // Filter out zero scores and sort by score descending
  const results = scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  res.json({
    query: query,
    count: results.length,
    results
  });
});

module.exports = router;
