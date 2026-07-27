const express = require('express');
const fs = require('fs');
const path = require('path');
const { handleGeospatialRequest } = require('../../src/handlers/geospatial');

const router = express.Router();

// Auto-register routes from all stubs in endpoints/geospatial/
const stubsDir = path.join(__dirname, '../../src/endpoints/geospatial');

try {
  const files = fs.readdirSync(stubsDir);
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      // Remove .json extension to get route path
      const routePath = file.replace('.json', '');
      
      // Register GET route - use a simple catch-all pattern
      router.get(`/${routePath}`, (req, res, next) => {
        // Override the path to include the full route
        req.originalRoutePath = routePath;
        handleGeospatialRequest(req, res, next);
      });
    }
  });
  
  console.log(`Registered ${files.length} geospatial routes`);
} catch (error) {
  console.error('Error loading geospatial stubs:', error);
}

module.exports = router;
