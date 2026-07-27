const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// POST /simulate/random - Generate random numbers from various distributions
router.post('/random', async (req, res) => {
  try {
    const { distribution, params } = req.body;
    
    let value;
    
    switch (distribution) {
      case 'uniform':
        const { min = 0, max = 1 } = params || {};
        value = Math.random() * (max - min) + min;
        break;
      case 'normal':
        const { mean = 0, std = 1 } = params || {};
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        value = z * std + mean;
        break;
      case 'poisson':
        const { lambda = 1 } = params || {};
        // Knuth's algorithm
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
          k++;
          p *= Math.random();
        } while (p > L);
        value = k - 1;
        break;
      case 'exponential':
        const { rate = 1 } = params || {};
        value = -Math.log(1 - Math.random()) / rate;
        break;
      default:
        return res.status(400).json({ error: 'invalid_distribution' });
    }
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate random error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/montecarlo - Monte Carlo simulation
router.post('/montecarlo', async (req, res) => {
  try {
    const { trials, expression } = req.body;
    
    if (!trials || trials < 1) {
      return res.status(400).json({ error: 'trials must be >= 1' });
    }
    
    const values = [];
    
    // Simple expression evaluation - in production, use a proper expression parser
    for (let i = 0; i < trials; i++) {
      let result;
      const x = Math.random();
      
      // Basic expression support
      if (expression === 'x') {
        result = x;
      } else if (expression === 'x*x') {
        result = x * x;
      } else if (expression === 'Math.sin(x)') {
        result = Math.sin(x);
      } else if (expression === 'Math.cos(x)') {
        result = Math.cos(x);
      } else if (expression === 'Math.sqrt(x)') {
        result = Math.sqrt(x);
      } else {
        // Default to uniform random
        result = Math.random();
      }
      
      values.push(result);
    }
    
    // Calculate statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    // Sort for percentiles
    values.sort((a, b) => a - b);
    const p5Index = Math.floor(values.length * 0.05);
    const p95Index = Math.floor(values.length * 0.95);
    const p5 = values[p5Index];
    const p95 = values[p95Index];
    
    res.json({ mean, std, p5, p95, trials });
  } catch (error) {
    console.error('Simulate montecarlo error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/sample - Sample from a population
router.post('/sample', async (req, res) => {
  try {
    const { population, n, replace } = req.body;
    
    if (!Array.isArray(population)) {
      return res.status(400).json({ error: 'population must be an array' });
    }
    
    if (!n || n < 1) {
      return res.status(400).json({ error: 'n must be >= 1' });
    }
    
    const shouldReplace = replace !== false;
    const sample = [];
    
    for (let i = 0; i < n; i++) {
      const index = Math.floor(Math.random() * population.length);
      sample.push(population[index]);
      
      if (!shouldReplace) {
        // Remove sampled item for without-replace sampling
        population.splice(index, 1);
      }
    }
    
    res.json({ sample });
  } catch (error) {
    console.error('Simulate sample error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/abtest - A/B test variant selection
router.post('/abtest', async (req, res) => {
  try {
    const { variants, weights } = req.body;
    
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'variants must be a non-empty array' });
    }
    
    // Use weights if provided, otherwise equal weights
    const variantWeights = weights || variants.map(() => 1);
    
    // Calculate total weight
    const totalWeight = variantWeights.reduce((a, b) => a + b, 0);
    
    // Generate random value
    const random = Math.random() * totalWeight;
    
    // Select variant based on cumulative weight
    let cumulativeWeight = 0;
    let selected = variants[0];
    
    for (let i = 0; i < variants.length; i++) {
      cumulativeWeight += variantWeights[i];
      if (random <= cumulativeWeight) {
        selected = variants[i];
        break;
      }
    }
    
    res.json({ selected });
  } catch (error) {
    console.error('Simulate abtest error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/dice - Dice roll simulation
router.post('/dice', async (req, res) => {
  try {
    const { sides, count } = req.body;
    
    const numSides = sides || 6;
    const numRolls = count || 1;
    
    if (numSides < 2) {
      return res.status(400).json({ error: 'sides must be >= 2' });
    }
    
    if (numRolls < 1) {
      return res.status(400).json({ error: 'count must be >= 1' });
    }
    
    const rolls = [];
    let total = 0;
    
    for (let i = 0; i < numRolls; i++) {
      const roll = Math.floor(Math.random() * numSides) + 1;
      rolls.push(roll);
      total += roll;
    }
    
    res.json({ rolls, total });
  } catch (error) {
    console.error('Simulate dice error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/shuffle - Shuffle an array
router.post('/shuffle', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    
    // Fisher-Yates shuffle
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    res.json({ result });
  } catch (error) {
    console.error('Simulate shuffle error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/uuid - Generate a UUID
router.post('/uuid', async (req, res) => {
  try {
    const uuid = crypto.randomUUID();
    res.json({ uuid });
  } catch (error) {
    console.error('Simulate uuid error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/weighted - Weighted random selection
router.post('/weighted', async (req, res) => {
  try {
    const { options, weights } = req.body;
    
    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'options must be a non-empty array' });
    }
    
    if (!Array.isArray(weights) || weights.length !== options.length) {
      return res.status(400).json({ error: 'weights must be an array of same length as options' });
    }
    
    // Calculate total weight
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    // Generate random value
    const random = Math.random() * totalWeight;
    
    // Select option based on cumulative weight
    let cumulativeWeight = 0;
    let selected = options[0];
    
    for (let i = 0; i < options.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        selected = options[i];
        break;
      }
    }
    
    res.json({ selected });
  } catch (error) {
    console.error('Simulate weighted error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/coin - Coin flip simulation
router.post('/coin', async (req, res) => {
  try {
    const { count } = req.body;
    const numFlips = count || 1;
    
    const flips = [];
    let heads = 0;
    
    for (let i = 0; i < numFlips; i++) {
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      flips.push(result);
      if (result === 'heads') heads++;
    }
    
    res.json({ flips, heads, tails: numFlips - heads });
  } catch (error) {
    console.error('Simulate coin error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/card - Card draw simulation
router.post('/card', async (req, res) => {
  try {
    const { count, decks } = req.body;
    const numDraws = count || 1;
    const numDecks = decks || 1;
    
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    // Create deck(s)
    let deck = [];
    for (let d = 0; d < numDecks; d++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank });
        }
      }
    }
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Draw cards
    const drawn = deck.slice(0, numDraws);
    
    res.json({ cards: drawn, remaining: deck.length - numDraws });
  } catch (error) {
    console.error('Simulate card error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/string - Random string generation
router.post('/string', async (req, res) => {
  try {
    const { length, charset } = req.body;
    const strLength = length || 16;
    
    let chars = charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    let result = '';
    for (let i = 0; i < strLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    res.json({ string: result });
  } catch (error) {
    console.error('Simulate string error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/date - Random date generation
router.post('/date', async (req, res) => {
  try {
    const { start, end } = req.body;
    
    const startDate = start ? new Date(start) : new Date(2000, 0, 1);
    const endDate = end ? new Date(end) : new Date();
    
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    const randomTime = startTime + Math.random() * (endTime - startTime);
    const randomDate = new Date(randomTime);
    
    res.json({ date: randomDate.toISOString() });
  } catch (error) {
    console.error('Simulate date error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/name - Random name generation
router.post('/name', async (req, res) => {
  try {
    const { type } = req.body;
    
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    if (type === 'first') {
      res.json({ name: firstName });
    } else if (type === 'last') {
      res.json({ name: lastName });
    } else {
      res.json({ name: `${firstName} ${lastName}` });
    }
  } catch (error) {
    console.error('Simulate name error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/email - Random email generation
router.post('/email', async (req, res) => {
  try {
    const { domain } = req.body;
    
    const usernames = ['user', 'john', 'jane', 'test', 'admin', 'guest', 'member', 'player', 'buyer', 'seller'];
    const domains = domain ? [domain] : ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com'];
    
    const username = usernames[Math.floor(Math.random() * usernames.length)] + Math.floor(Math.random() * 1000);
    const emailDomain = domains[Math.floor(Math.random() * domains.length)];
    
    res.json({ email: `${username}@${emailDomain}` });
  } catch (error) {
    console.error('Simulate email error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/phone - Random phone number generation
router.post('/phone', async (req, res) => {
  try {
    const { country } = req.body;
    
    let phone;
    
    if (country === 'US') {
      const areaCode = Math.floor(Math.random() * 800) + 200;
      const prefix = Math.floor(Math.random() * 800) + 200;
      const line = Math.floor(Math.random() * 10000);
      phone = `(${areaCode}) ${prefix}-${line.toString().padStart(4, '0')}`;
    } else {
      phone = '+' + Math.floor(Math.random() * 9000000000 + 1000000000);
    }
    
    res.json({ phone });
  } catch (error) {
    console.error('Simulate phone error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/color - Random color generation
router.post('/color', async (req, res) => {
  try {
    const { format } = req.body;
    
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    
    let color;
    if (format === 'rgb') {
      color = `rgb(${r}, ${g}, ${b})`;
    } else if (format === 'hsl') {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      color = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    } else {
      color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    res.json({ color, r, g, b });
  } catch (error) {
    console.error('Simulate color error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/ip - Random IP address generation
router.post('/ip', async (req, res) => {
  try {
    const { version } = req.body;
    
    let ip;
    if (version === 'ipv6') {
      const segments = [];
      for (let i = 0; i < 8; i++) {
        segments.push(Math.floor(Math.random() * 65536).toString(16));
      }
      ip = segments.join(':');
    } else {
      ip = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    }
    
    res.json({ ip });
  } catch (error) {
    console.error('Simulate ip error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/coordinates - Random coordinates generation
router.post('/coordinates', async (req, res) => {
  try {
    const { bounds } = req.body;
    
    const defaultBounds = bounds || {
      minLat: -90, maxLat: 90,
      minLon: -180, maxLon: 180
    };
    
    const lat = Math.random() * (defaultBounds.maxLat - defaultBounds.minLat) + defaultBounds.minLat;
    const lon = Math.random() * (defaultBounds.maxLon - defaultBounds.minLon) + defaultBounds.minLon;
    
    res.json({ latitude: lat, longitude: lon });
  } catch (error) {
    console.error('Simulate coordinates error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/boolean - Random boolean generation
router.post('/boolean', async (req, res) => {
  try {
    const { probability } = req.body;
    const prob = probability !== undefined ? probability : 0.5;
    
    const value = Math.random() < prob;
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate boolean error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/choice - Random choice from array
router.post('/choice', async (req, res) => {
  try {
    const { options } = req.body;
    
    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'options must be a non-empty array' });
    }
    
    const selected = options[Math.floor(Math.random() * options.length)];
    
    res.json({ selected });
  } catch (error) {
    console.error('Simulate choice error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/choices - Multiple random choices
router.post('/choices', async (req, res) => {
  try {
    const { options, n, unique } = req.body;
    
    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'options must be a non-empty array' });
    }
    
    const numChoices = n || 1;
    const shouldUnique = unique !== false;
    
    const selected = [];
    const available = [...options];
    
    for (let i = 0; i < numChoices; i++) {
      if (available.length === 0) break;
      
      const index = Math.floor(Math.random() * available.length);
      selected.push(available[index]);
      
      if (shouldUnique) {
        available.splice(index, 1);
      }
    }
    
    res.json({ selected });
  } catch (error) {
    console.error('Simulate choices error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/permutation - Random permutation
router.post('/permutation', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    res.json({ permutation: result });
  } catch (error) {
    console.error('Simulate permutation error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/combination - Random combination
router.post('/combination', async (req, res) => {
  try {
    const { items, k } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    
    if (!k || k < 1 || k > items.length) {
      return res.status(400).json({ error: 'k must be between 1 and items.length' });
    }
    
    const available = [...items];
    const combination = [];
    
    for (let i = 0; i < k; i++) {
      const index = Math.floor(Math.random() * available.length);
      combination.push(available[index]);
      available.splice(index, 1);
    }
    
    res.json({ combination });
  } catch (error) {
    console.error('Simulate combination error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/random-walk - Random walk simulation
router.post('/random-walk', async (req, res) => {
  try {
    const { steps, start, step_size } = req.body;
    
    const numSteps = steps || 100;
    const startValue = start || 0;
    const stepSize = step_size || 1;
    
    const path = [startValue];
    let current = startValue;
    
    for (let i = 0; i < numSteps; i++) {
      const direction = Math.random() < 0.5 ? 1 : -1;
      current += direction * stepSize;
      path.push(current);
    }
    
    res.json({ path, final: current });
  } catch (error) {
    console.error('Simulate random-walk error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/brownian - Brownian motion simulation
router.post('/brownian', async (req, res) => {
  try {
    const { steps, dt, volatility } = req.body;
    
    const numSteps = steps || 100;
    const deltaT = dt || 0.01;
    const vol = volatility || 1;
    
    const path = [0];
    let current = 0;
    
    for (let i = 0; i < numSteps; i++) {
      const randomNormal = () => {
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      };
      
      current += vol * Math.sqrt(deltaT) * randomNormal();
      path.push(current);
    }
    
    res.json({ path, final: current });
  } catch (error) {
    console.error('Simulate brownian error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/geometric - Geometric distribution
router.post('/geometric', async (req, res) => {
  try {
    const { p } = req.body;
    const probability = p || 0.5;
    
    if (probability <= 0 || probability > 1) {
      return res.status(400).json({ error: 'p must be between 0 and 1' });
    }
    
    const value = Math.floor(Math.log(1 - Math.random()) / Math.log(1 - probability)) + 1;
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate geometric error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/binomial - Binomial distribution
router.post('/binomial', async (req, res) => {
  try {
    const { n, p } = req.body;
    const trials = n || 10;
    const probability = p || 0.5;
    
    if (probability < 0 || probability > 1) {
      return res.status(400).json({ error: 'p must be between 0 and 1' });
    }
    
    let successes = 0;
    for (let i = 0; i < trials; i++) {
      if (Math.random() < probability) successes++;
    }
    
    res.json({ successes, trials });
  } catch (error) {
    console.error('Simulate binomial error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/gamma - Gamma distribution
router.post('/gamma', async (req, res) => {
  try {
    const { shape, scale } = req.body;
    const k = shape || 1;
    const theta = scale || 1;
    
    // Marsaglia and Tsang's method
    let d = k - 1/3;
    let c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      let x, v;
      do {
        x = randomNormal();
        v = 1 + c * x;
      } while (v <= 0);
      
      v = v * v * v;
      let u = Math.random();
      
      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return res.json({ value: d * v * theta });
      }
      
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return res.json({ value: d * v * theta });
      }
    }
    
    function randomNormal() {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  } catch (error) {
    console.error('Simulate gamma error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/beta - Beta distribution
router.post('/beta', async (req, res) => {
  try {
    const { alpha, beta } = req.body;
    const a = alpha || 1;
    const b = beta || 1;
    
    // Generate using gamma distribution
    const x = gammaSample(a);
    const y = gammaSample(b);
    const value = x / (x + y);
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate beta error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
  
  function gammaSample(shape) {
    let d = shape - 1/3;
    let c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      let x, v;
      do {
        x = randomNormal();
        v = 1 + c * x;
      } while (v <= 0);
      
      v = v * v * v;
      let u = Math.random();
      
      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v;
      }
      
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
    
    function randomNormal() {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  }
});

// POST /simulate/weibull - Weibull distribution
router.post('/weibull', async (req, res) => {
  try {
    const { shape, scale } = req.body;
    const k = shape || 1;
    const lambda = scale || 1;
    
    const u = Math.random();
    const value = lambda * Math.pow(-Math.log(1 - u), 1 / k);
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate weibull error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/lognormal - Log-normal distribution
router.post('/lognormal', async (req, res) => {
  try {
    const { mean, std } = req.body;
    const mu = mean || 0;
    const sigma = std || 1;
    
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = Math.exp(mu + sigma * z);
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate lognormal error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/triangular - Triangular distribution
router.post('/triangular', async (req, res) => {
  try {
    const { min, max, mode } = req.body;
    const a = min || 0;
    const b = max || 1;
    const c = mode || (a + b) / 2;
    
    const u = Math.random();
    let value;
    
    if (u < (c - a) / (b - a)) {
      value = a + Math.sqrt(u * (b - a) * (c - a));
    } else {
      value = b - Math.sqrt((1 - u) * (b - a) * (b - c));
    }
    
    res.json({ value });
  } catch (error) {
    console.error('Simulate triangular error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/bootstrap - Bootstrap sampling
router.post('/bootstrap', async (req, res) => {
  try {
    const { sample, iterations } = req.body;
    
    if (!Array.isArray(sample) || sample.length === 0) {
      return res.status(400).json({ error: 'sample must be a non-empty array' });
    }
    
    const numIterations = iterations || 1000;
    const means = [];
    
    for (let i = 0; i < numIterations; i++) {
      const bootstrapSample = [];
      for (let j = 0; j < sample.length; j++) {
        bootstrapSample.push(sample[Math.floor(Math.random() * sample.length)]);
      }
      const mean = bootstrapSample.reduce((a, b) => a + b, 0) / bootstrapSample.length;
      means.push(mean);
    }
    
    // Calculate statistics
    const bootstrapMean = means.reduce((a, b) => a + b, 0) / means.length;
    const variance = means.reduce((a, b) => a + Math.pow(b - bootstrapMean, 2), 0) / means.length;
    const std = Math.sqrt(variance);
    
    means.sort((a, b) => a - b);
    const ciLower = means[Math.floor(means.length * 0.025)];
    const ciUpper = means[Math.floor(means.length * 0.975)];
    
    res.json({ 
      mean: bootstrapMean, 
      std, 
      confidence_interval: { lower: ciLower, upper: ciUpper } 
    });
  } catch (error) {
    console.error('Simulate bootstrap error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/markov-chain - Markov chain simulation
router.post('/markov-chain', async (req, res) => {
  try {
    const { states, transitions, start_state, steps } = req.body;
    
    if (!states || !transitions) {
      return res.status(400).json({ error: 'states and transitions are required' });
    }
    
    const numSteps = steps || 10;
    let currentState = start_state || states[0];
    const path = [currentState];
    
    for (let i = 0; i < numSteps; i++) {
      const transitionProbs = transitions[currentState] || {};
      const totalProb = Object.values(transitionProbs).reduce((a, b) => a + b, 0);
      
      if (totalProb === 0) break;
      
      let random = Math.random() * totalProb;
      let cumulative = 0;
      
      for (const [nextState, prob] of Object.entries(transitionProbs)) {
        cumulative += prob;
        if (random <= cumulative) {
          currentState = nextState;
          break;
        }
      }
      
      path.push(currentState);
    }
    
    res.json({ path });
  } catch (error) {
    console.error('Simulate markov-chain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/queue - Queue simulation
router.post('/queue', async (req, res) => {
  try {
    const { arrival_rate, service_rate, time_units } = req.body;
    
    const lambda = arrival_rate || 1;
    const mu = service_rate || 1.5;
    const time = time_units || 100;
    
    let queue = [];
    let queueLengths = [];
    let waitTimes = [];
    let currentTime = 0;
    let nextArrival = -Math.log(1 - Math.random()) / lambda;
    let nextDeparture = Infinity;
    
    for (let t = 0; t < time; t++) {
      currentTime = t;
      
      // Process arrivals
      while (nextArrival <= currentTime) {
        queue.push({ arrivalTime: nextArrival });
        nextArrival = currentTime - Math.log(1 - Math.random()) / lambda;
      }
      
      // Process departures
      if (queue.length > 0 && nextDeparture <= currentTime) {
        const customer = queue.shift();
        waitTimes.push(currentTime - customer.arrivalTime);
        if (queue.length > 0) {
          nextDeparture = currentTime - Math.log(1 - Math.random()) / mu;
        } else {
          nextDeparture = Infinity;
        }
      } else if (queue.length > 0 && nextDeparture === Infinity) {
        nextDeparture = currentTime - Math.log(1 - Math.random()) / mu;
      }
      
      queueLengths.push(queue.length);
    }
    
    const avgQueueLength = queueLengths.reduce((a, b) => a + b, 0) / queueLengths.length;
    const avgWaitTime = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
    
    res.json({ 
      avg_queue_length: avgQueueLength, 
      avg_wait_time: avgWaitTime,
      total_served: waitTimes.length
    });
  } catch (error) {
    console.error('Simulate queue error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/growth - Growth simulation
router.post('/growth', async (req, res) => {
  try {
    const { initial, rate, time_units, carrying_capacity } = req.body;
    
    const P0 = initial || 100;
    const r = rate || 0.1;
    const time = time_units || 100;
    const K = carrying_capacity || 1000;
    
    const values = [P0];
    let current = P0;
    
    for (let t = 1; t <= time; t++) {
      // Logistic growth model
      current = current + r * current * (1 - current / K);
      values.push(current);
    }
    
    res.json({ values, final: current });
  } catch (error) {
    console.error('Simulate growth error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/decay - Decay simulation
router.post('/decay', async (req, res) => {
  try {
    const { initial, rate, time_units } = req.body;
    
    const N0 = initial || 100;
    const lambda = rate || 0.1;
    const time = time_units || 100;
    
    const values = [N0];
    
    for (let t = 1; t <= time; t++) {
      const value = N0 * Math.exp(-lambda * t);
      values.push(value);
    }
    
    res.json({ values, final: values[values.length - 1] });
  } catch (error) {
    console.error('Simulate decay error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/oscillation - Oscillation simulation
router.post('/oscillation', async (req, res) => {
  try {
    const { amplitude, frequency, phase, time_units } = req.body;
    
    const A = amplitude || 1;
    const f = frequency || 1;
    const phi = phase || 0;
    const time = time_units || 100;
    
    const values = [];
    
    for (let t = 0; t <= time; t++) {
      const value = A * Math.sin(2 * Math.PI * f * t + phi);
      values.push(value);
    }
    
    res.json({ values });
  } catch (error) {
    console.error('Simulate oscillation error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/noise - Noise generation
router.post('/noise', async (req, res) => {
  try {
    const { type, samples, amplitude } = req.body;
    
    const numSamples = samples || 100;
    const amp = amplitude || 1;
    const noiseType = type || 'white';
    
    const values = [];
    
    for (let i = 0; i < numSamples; i++) {
      let value;
      
      switch (noiseType) {
        case 'white':
          value = (Math.random() * 2 - 1) * amp;
          break;
        case 'gaussian':
          const u1 = Math.random();
          const u2 = Math.random();
          value = (Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)) * amp;
          break;
        case 'pink':
          // Simplified pink noise approximation
          value = (Math.random() * 2 - 1) * amp / Math.sqrt(i + 1);
          break;
        default:
          value = (Math.random() * 2 - 1) * amp;
      }
      
      values.push(value);
    }
    
    res.json({ values, type: noiseType });
  } catch (error) {
    console.error('Simulate noise error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/timeseries - Time series simulation
router.post('/timeseries', async (req, res) => {
  try {
    const { trend, seasonality, noise, points } = req.body;
    
    const trendValue = trend || 0.01;
    const seasonalityValue = seasonality || 0.5;
    const noiseValue = noise || 0.1;
    const numPoints = points || 100;
    
    const values = [];
    
    for (let t = 0; t < numPoints; t++) {
      const trendComponent = trendValue * t;
      const seasonalComponent = seasonalityValue * Math.sin(2 * Math.PI * t / 12);
      const noiseComponent = (Math.random() - 0.5) * 2 * noiseValue;
      
      const value = trendComponent + seasonalComponent + noiseComponent;
      values.push(value);
    }
    
    res.json({ values });
  } catch (error) {
    console.error('Simulate timeseries error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/graph - Random graph generation
router.post('/graph', async (req, res) => {
  try {
    const { nodes, edge_probability, directed } = req.body;
    
    const numNodes = nodes || 10;
    const prob = edge_probability || 0.5;
    const isDirected = directed || false;
    
    const edges = [];
    
    for (let i = 0; i < numNodes; i++) {
      for (let j = isDirected ? 0 : i + 1; j < numNodes; j++) {
        if (i === j) continue;
        
        if (Math.random() < prob) {
          edges.push([i, j]);
          if (!isDirected && i < j) {
            edges.push([j, i]);
          }
        }
      }
    }
    
    res.json({ nodes: numNodes, edges });
  } catch (error) {
    console.error('Simulate graph error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/epidemic - Epidemic simulation (SIR model)
router.post('/epidemic', async (req, res) => {
  try {
    const { population, infected, recovery_rate, infection_rate, days } = req.body;
    
    const N = population || 1000;
    const I0 = infected || 1;
    const gamma = recovery_rate || 0.1;
    const beta = infection_rate || 0.3;
    const numDays = days || 100;
    
    let S = N - I0;
    let I = I0;
    let R = 0;
    
    const history = { S: [S], I: [I], R: [R] };
    
    for (let day = 1; day <= numDays; day++) {
      const newInfected = (beta * S * I) / N;
      const newRecovered = gamma * I;
      
      S -= newInfected;
      I += newInfected - newRecovered;
      R += newRecovered;
      
      history.S.push(S);
      history.I.push(I);
      history.R.push(R);
    }
    
    res.json({ history, final: { S, I, R } });
  } catch (error) {
    console.error('Simulate epidemic error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/game-theory - Prisoner's dilemma simulation
router.post('/game-theory', async (req, res) => {
  try {
    const { strategy1, strategy2, rounds } = req.body;
    
    const numRounds = rounds || 10;
    const strategies = {
      'cooperate': () => 'cooperate',
      'defect': () => 'defect',
      'tit-for-tat': (history) => history.length === 0 ? 'cooperate' : history[history.length - 1].opponent,
      'random': () => Math.random() < 0.5 ? 'cooperate' : 'defect'
    };
    
    const getMove = (strategy, history) => {
      const fn = strategies[strategy] || strategies['random'];
      return fn(history);
    };
    
    const payoff = {
      'cooperate-cooperate': [3, 3],
      'cooperate-defect': [0, 5],
      'defect-cooperate': [5, 0],
      'defect-defect': [1, 1]
    };
    
    let score1 = 0;
    let score2 = 0;
    const history1 = [];
    const history2 = [];
    
    for (let i = 0; i < numRounds; i++) {
      const move1 = getMove(strategy1, history1);
      const move2 = getMove(strategy2, history2);
      
      const key = `${move1}-${move2}`;
      const [p1, p2] = payoff[key];
      
      score1 += p1;
      score2 += p2;
      
      history1.push({ self: move1, opponent: move2 });
      history2.push({ self: move2, opponent: move1 });
    }
    
    res.json({ 
      player1: { score: score1, strategy: strategy1 },
      player2: { score: score2, strategy: strategy2 },
      rounds: numRounds
    });
  } catch (error) {
    console.error('Simulate game-theory error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/auction - Auction simulation
router.post('/auction', async (req, res) => {
  try {
    const { bidders, reserve_price, rounds } = req.body;
    
    const numBidders = bidders || 5;
    const reserve = reserve_price || 10;
    const numRounds = rounds || 10;
    
    let currentBid = reserve;
    let winner = null;
    let winningBid = reserve;
    
    for (let round = 0; round < numRounds; round++) {
      let newBid = null;
      let bidder = null;
      
      for (let i = 0; i < numBidders; i++) {
        const maxBid = currentBid + Math.random() * 50;
        if (maxBid > currentBid && (!newBid || maxBid > newBid)) {
          newBid = maxBid;
          bidder = i;
        }
      }
      
      if (newBid) {
        currentBid = newBid;
        winner = bidder;
        winningBid = newBid;
      } else {
        break;
      }
    }
    
    res.json({ winner, winning_bid: winningBid, rounds_completed: Math.min(numRounds, numRounds) });
  } catch (error) {
    console.error('Simulate auction error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/voting - Voting simulation
router.post('/voting', async (req, res) => {
  try {
    const { candidates, voters, preferences } = req.body;
    
    const numCandidates = candidates || 3;
    const numVoters = voters || 100;
    const pref = preferences || 'random';
    
    const candidateNames = Array.from({ length: numCandidates }, (_, i) => `Candidate ${i + 1}`);
    const votes = {};
    
    for (const name of candidateNames) {
      votes[name] = 0;
    }
    
    for (let i = 0; i < numVoters; i++) {
      let selected;
      
      if (pref === 'random') {
        selected = candidateNames[Math.floor(Math.random() * candidateNames.length)];
      } else if (pref === 'biased') {
        // Bias towards first candidate
        const rand = Math.random();
        selected = rand < 0.4 ? candidateNames[0] : candidateNames[Math.floor(Math.random() * (candidateNames.length - 1)) + 1];
      } else {
        selected = candidateNames[Math.floor(Math.random() * candidateNames.length)];
      }
      
      votes[selected]++;
    }
    
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const winner = sorted[0];
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    
    res.json({ votes, winner: winner[0], winner_votes: winner[1], total_votes: totalVotes });
  } catch (error) {
    console.error('Simulate voting error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/survey - Survey response simulation
router.post('/survey', async (req, res) => {
  try {
    const { options, respondents, distribution } = req.body;
    
    const surveyOptions = options || ['Option A', 'Option B', 'Option C', 'Option D'];
    const numRespondents = respondents || 100;
    const dist = distribution || 'uniform';
    
    const responses = {};
    for (const opt of surveyOptions) {
      responses[opt] = 0;
    }
    
    for (let i = 0; i < numRespondents; i++) {
      let selected;
      
      if (dist === 'uniform') {
        selected = surveyOptions[Math.floor(Math.random() * surveyOptions.length)];
      } else if (dist === 'normal') {
        // Approximate normal distribution for selection
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const index = Math.floor((z + 3) / 6 * surveyOptions.length);
        selected = surveyOptions[Math.max(0, Math.min(surveyOptions.length - 1, index))];
      } else {
        selected = surveyOptions[Math.floor(Math.random() * surveyOptions.length)];
      }
      
      responses[selected]++;
    }
    
    const percentages = {};
    for (const [opt, count] of Object.entries(responses)) {
      percentages[opt] = (count / numRespondents * 100).toFixed(2);
    }
    
    res.json({ responses, percentages, total_respondents: numRespondents });
  } catch (error) {
    console.error('Simulate survey error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/inventory - Inventory simulation
router.post('/inventory', async (req, res) => {
  try {
    const { initial_stock, demand_mean, demand_std, lead_time, reorder_point, order_quantity, days } = req.body;
    
    const stock = initial_stock || 100;
    const demandMean = demand_mean || 10;
    const demandStd = demand_std || 3;
    const leadTime = lead_time || 3;
    const reorderPoint = reorder_point || 30;
    const orderQuantity = order_quantity || 50;
    const numDays = days || 100;
    
    let currentStock = stock;
    let onOrder = 0;
    let orderArrivalDay = -1;
    let stockouts = 0;
    const stockHistory = [currentStock];
    
    for (let day = 1; day <= numDays; day++) {
      // Process order arrival
      if (day === orderArrivalDay) {
        currentStock += orderQuantity;
        onOrder = 0;
        orderArrivalDay = -1;
      }
      
      // Generate demand
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const demand = Math.max(0, Math.round(z * demandStd + demandMean));
      
      // Process demand
      if (demand > currentStock) {
        stockouts += demand - currentStock;
        currentStock = 0;
      } else {
        currentStock -= demand;
      }
      
      // Check reorder point
      if (currentStock <= reorderPoint && onOrder === 0) {
        onOrder = orderQuantity;
        orderArrivalDay = day + leadTime;
      }
      
      stockHistory.push(currentStock);
    }
    
    const avgStock = stockHistory.reduce((a, b) => a + b, 0) / stockHistory.length;
    
    res.json({ 
      final_stock: currentStock, 
      stockouts, 
      avg_stock: avgStock,
      orders_placed: stockHistory.length
    });
  } catch (error) {
    console.error('Simulate inventory error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/price - Price simulation (random walk with drift)
router.post('/price', async (req, res) => {
  try {
    const { initial, drift, volatility, time_units } = req.body;
    
    const S0 = initial || 100;
    const mu = drift || 0.05;
    const sigma = volatility || 0.2;
    const time = time_units || 100;
    
    const prices = [S0];
    let current = S0;
    
    for (let t = 1; t <= time; t++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      // Geometric Brownian Motion
      current = current * Math.exp((mu - 0.5 * sigma * sigma) + sigma * z);
      prices.push(current);
    }
    
    res.json({ prices, final: current });
  } catch (error) {
    console.error('Simulate price error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/demand - Demand simulation
router.post('/demand', async (req, res) => {
  try {
    const { base_demand, seasonality_amplitude, trend, noise_level, days } = req.body;
    
    const base = base_demand || 100;
    const amplitude = seasonality_amplitude || 20;
    const trendValue = trend || 0.1;
    const noise = noise_level || 10;
    const numDays = days || 365;
    
    const demands = [];
    
    for (let day = 0; day < numDays; day++) {
      const seasonal = amplitude * Math.sin(2 * Math.PI * day / 7); // Weekly seasonality
      const trendComponent = trendValue * day;
      const noiseComponent = (Math.random() - 0.5) * 2 * noise;
      
      const demand = Math.max(0, base + seasonal + trendComponent + noiseComponent);
      demands.push(demand);
    }
    
    const avgDemand = demands.reduce((a, b) => a + b, 0) / demands.length;
    
    res.json({ demands, average: avgDemand });
  } catch (error) {
    console.error('Simulate demand error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/wave - Wave simulation
router.post('/wave', async (req, res) => {
  try {
    const { amplitude, frequency, phase, damping, points } = req.body;
    
    const A = amplitude || 1;
    const f = frequency || 1;
    const phi = phase || 0;
    const dampingFactor = damping || 0;
    const numPoints = points || 100;
    
    const values = [];
    
    for (let t = 0; t < numPoints; t++) {
      const damping = dampingFactor > 0 ? Math.exp(-dampingFactor * t) : 1;
      const value = A * damping * Math.sin(2 * Math.PI * f * t + phi);
      values.push(value);
    }
    
    res.json({ values });
  } catch (error) {
    console.error('Simulate wave error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/signal - Signal generation
router.post('/signal', async (req, res) => {
  try {
    const { type, frequency, amplitude, sample_rate, duration } = req.body;
    
    const signalType = type || 'sine';
    const freq = frequency || 1;
    const amp = amplitude || 1;
    const sampleRate = sample_rate || 100;
    const dur = duration || 1;
    
    const numSamples = sampleRate * dur;
    const values = [];
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let value;
      
      switch (signalType) {
        case 'sine':
          value = amp * Math.sin(2 * Math.PI * freq * t);
          break;
        case 'square':
          value = amp * (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1);
          break;
        case 'sawtooth':
          value = amp * (2 * (t * freq - Math.floor(t * freq + 0.5)));
          break;
        case 'triangle':
          value = amp * (2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1);
          break;
        default:
          value = amp * Math.sin(2 * Math.PI * freq * t);
      }
      
      values.push(value);
    }
    
    res.json({ values, sample_rate: sampleRate, duration: dur });
  } catch (error) {
    console.error('Simulate signal error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/predator-prey - Predator-prey simulation (Lotka-Volterra)
router.post('/predator-prey', async (req, res) => {
  try {
    const { prey_initial, predator_initial, alpha, beta, gamma, delta, time_units, dt } = req.body;
    
    let x = prey_initial || 10;
    let y = predator_initial || 5;
    const a = alpha || 1.1;
    const b = beta || 0.4;
    const g = gamma || 0.4;
    const d = delta || 0.1;
    const time = time_units || 100;
    const deltaT = dt || 0.01;
    
    const preyHistory = [x];
    const predatorHistory = [y];
    
    for (let t = 0; t < time; t += deltaT) {
      const dx = (a * x - b * x * y) * deltaT;
      const dy = (d * x * y - g * y) * deltaT;
      
      x += dx;
      y += dy;
      
      preyHistory.push(x);
      predatorHistory.push(y);
    }
    
    res.json({ 
      prey: preyHistory, 
      predator: predatorHistory,
      final: { prey: x, predator: y }
    });
  } catch (error) {
    console.error('Simulate predator-prey error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/network - Network latency simulation
router.post('/network', async (req, res) => {
  try {
    const { base_latency, jitter, packet_loss, packets } = req.body;
    
    const baseLatency = base_latency || 50;
    const jitterValue = jitter || 10;
    const lossRate = packet_loss || 0.01;
    const numPackets = packets || 100;
    
    const results = [];
    let lost = 0;
    
    for (let i = 0; i < numPackets; i++) {
      if (Math.random() < lossRate) {
        lost++;
        results.push({ latency: null, lost: true });
      } else {
        const latency = baseLatency + (Math.random() - 0.5) * 2 * jitterValue;
        results.push({ latency: Math.max(0, latency), lost: false });
      }
    }
    
    const successful = results.filter(r => !r.lost);
    const avgLatency = successful.length > 0 
      ? successful.reduce((a, b) => a + b.latency, 0) / successful.length 
      : 0;
    
    res.json({ 
      results, 
      lost_packets: lost, 
      loss_rate: lost / numPackets,
      avg_latency: avgLatency
    });
  } catch (error) {
    console.error('Simulate network error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /simulate/poll - Poll simulation with margin of error
router.post('/poll', async (req, res) => {
  try {
    const { population_size, sample_size, true_proportion } = req.body;
    
    const N = population_size || 1000000;
    const n = sample_size || 1000;
    const p = true_proportion || 0.5;
    
    let successes = 0;
    
    for (let i = 0; i < n; i++) {
      if (Math.random() < p) successes++;
    }
    
    const sampleProportion = successes / n;
    const marginOfError = 1.96 * Math.sqrt((sampleProportion * (1 - sampleProportion)) / n);
    
    res.json({ 
      sample_proportion: sampleProportion,
      margin_of_error: marginOfError,
      confidence_interval: {
        lower: sampleProportion - marginOfError,
        upper: sampleProportion + marginOfError
      }
    });
  } catch (error) {
    console.error('Simulate poll error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
