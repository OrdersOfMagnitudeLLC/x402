const express = require('express');
const fs = require('fs');
const path = require('path');
const { handleTemporalRequest } = require('../../src/handlers/temporal');

const router = express.Router();

// Auto-register routes from all stubs in endpoints/temporal/
const stubsDir = path.join(__dirname, '../../src/endpoints/temporal');

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
        handleTemporalRequest(req, res, next);
      });
    }
  });
  
  console.log(`Registered ${files.length} temporal routes`);
} catch (error) {
  console.error('Error loading temporal stubs:', error);
}

module.exports = router;
