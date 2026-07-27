const express = require('express');
const fs = require('fs');
const path = require('path');
const { handleReferenceRequest } = require('../../src/handlers/reference');

const router = express.Router();

// Auto-register routes from all stubs in endpoints/reference/
const stubsDir = path.join(__dirname, '../../src/endpoints/reference');

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
        handleReferenceRequest(req, res, next);
      });
    }
  });
  
  console.log(`Registered ${files.length} reference routes`);
} catch (error) {
  console.error('Error loading reference stubs:', error);
}

module.exports = router;
