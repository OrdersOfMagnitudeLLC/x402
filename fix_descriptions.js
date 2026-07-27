#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const productsAllPath = path.join(__dirname, 'public/products-all.json');
const products = JSON.parse(fs.readFileSync(productsAllPath, 'utf8'));

// Noise words to strip from route paths
const noiseWords = ['open', 'api', 'v1', 'v2', 'get', 'data', 'endpoints', 'endpoint'];

// Category context mapping
const categoryContext = {
  'weather_environment': 'Weather',
  'reference_knowledge': 'Reference data',
  'geography_location': 'Geographic',
  'government_economic': 'Economic',
  'crypto_finance': 'Financial',
  'entertainment_media': 'Media',
  'compute': 'Compute',
  'information': 'Information'
};

function generateDescription(routePath, category) {
  if (!routePath) return 'Data endpoint';
  
  // Split route path and clean up
  const parts = routePath.split('/').filter(p => p && !noiseWords.includes(p.toLowerCase()));
  
  if (parts.length === 0) return 'Data endpoint';
  
  // Convert path parts to readable words
  const words = parts.map(part => {
    // Convert kebab-case to Title Case
    return part
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  });
  
  // Build description
  let description = words.join(' ');
  
  // Add category context if available
  const context = categoryContext[category];
  if (context) {
    description = `${context}: ${description}`;
  }
  
  // Limit to 12 words
  const wordArray = description.split(' ');
  if (wordArray.length > 12) {
    description = wordArray.slice(0, 12).join(' ');
  }
  
  return description;
}

// Filter entries with "API endpoint" in description
const entriesToFix = products.filter(p => 
  p.description && p.description.includes('API endpoint')
);

console.log(`Found ${entriesToFix.length} entries with "API endpoint" in description`);

// Fix descriptions
let fixedCount = 0;
entriesToFix.forEach(product => {
  const newDescription = generateDescription(product.route_path, product.category);
  if (newDescription !== product.description) {
    product.description = newDescription;
    fixedCount++;
  }
});

// Write updated file
fs.writeFileSync(productsAllPath, JSON.stringify(products, null, 2));

console.log(`Fixed ${fixedCount} descriptions`);
