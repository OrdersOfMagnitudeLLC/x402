const express = require('express');
const dns = require('dns').promises;

const router = express.Router();

// POST /verify/email - Validate email format
router.post('/email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(email);
    
    res.json({ 
      valid, 
      reason: valid ? 'format_valid' : 'invalid_format' 
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/dns - Get DNS records for a domain (mock implementation)
router.post('/dns', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    // Mock DNS records - in production, use actual DNS lookup
    const records = {
      domain,
      a: ['93.184.216.34'],
      aaaa: ['2606:2800:220:1:248:1893:25c8:1946'],
      mx: ['10 mail.example.com'],
      txt: ['v=spf1 include:_spf.example.com ~all'],
      ns: ['ns1.example.com', 'ns2.example.com']
    };
    
    res.json({ records });
  } catch (error) {
    console.error('Verify dns error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/mx - Get MX records for a domain (mock implementation)
router.post('/mx', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    // Mock MX records - in production, use actual DNS lookup
    const mx = [
      { priority: 10, exchange: 'mail.example.com' },
      { priority: 20, exchange: 'mail2.example.com' }
    ];
    
    res.json({ domain, mx });
  } catch (error) {
    console.error('Verify mx error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/phone - Validate phone number format
router.post('/phone', async (req, res) => {
  try {
    const { phone, country_code } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }
    
    // Basic phone validation (digits only, with optional + prefix)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const valid = phoneRegex.test(phone.replace(/[\s-()]/g, ''));
    
    res.json({ 
      valid, 
      reason: valid ? 'format_valid' : 'invalid_format',
      country_code: country_code || null
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/url - Validate URL format
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    try {
      const urlObj = new URL(url);
      res.json({ 
        valid: true, 
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port
      });
    } catch (e) {
      res.json({ valid: false, reason: 'invalid_url' });
    }
  } catch (error) {
    console.error('Verify url error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/ipv4 - Validate IPv4 address
router.post('/ipv4', async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'ip is required' });
    }
    
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const valid = ipv4Regex.test(ip);
    
    res.json({ valid, type: 'ipv4' });
  } catch (error) {
    console.error('Verify ipv4 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/ipv6 - Validate IPv6 address
router.post('/ipv6', async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'ip is required' });
    }
    
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::$/;
    const valid = ipv6Regex.test(ip);
    
    res.json({ valid, type: 'ipv6' });
  } catch (error) {
    console.error('Verify ipv6 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/credit-card - Validate credit card number (Luhn algorithm)
router.post('/credit-card', async (req, res) => {
  try {
    const { number } = req.body;
    
    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    
    const digits = number.replace(/\D/g, '');
    
    if (digits.length < 13 || digits.length > 19) {
      return res.json({ valid: false, reason: 'invalid_length' });
    }
    
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    const valid = sum % 10 === 0;
    
    // Detect card type
    let cardType = 'unknown';
    if (/^4/.test(digits)) cardType = 'visa';
    else if (/^5[1-5]/.test(digits)) cardType = 'mastercard';
    else if (/^3[47]/.test(digits)) cardType = 'amex';
    else if (/^6(?:011|5)/.test(digits)) cardType = 'discover';
    
    res.json({ valid, card_type: cardType });
  } catch (error) {
    console.error('Verify credit-card error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/iban - Validate IBAN
router.post('/iban', async (req, res) => {
  try {
    const { iban } = req.body;
    
    if (!iban) {
      return res.status(400).json({ error: 'iban is required' });
    }
    
    // Remove spaces and convert to uppercase
    const normalized = iban.replace(/\s/g, '').toUpperCase();
    
    // Check basic format
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized)) {
      return res.json({ valid: false, reason: 'invalid_format' });
    }
    
    // Move first 4 characters to end
    const rearranged = normalized.substring(4) + normalized.substring(0, 4);
    
    // Replace letters with numbers
    const numeric = rearranged.replace(/[A-Z]/g, (char) => 
      (char.charCodeAt(0) - 55).toString()
    );
    
    // Mod 97 check
    let remainder = 0;
    for (let i = 0; i < numeric.length; i += 9) {
      const chunk = numeric.substring(i, i + 9);
      remainder = parseInt(remainder + chunk, 10) % 97;
    }
    
    const valid = remainder === 1;
    
    res.json({ valid, country: normalized.substring(0, 2) });
  } catch (error) {
    console.error('Verify iban error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/uuid - Validate UUID format
router.post('/uuid', async (req, res) => {
  try {
    const { uuid } = req.body;
    
    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required' });
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const valid = uuidRegex.test(uuid);
    
    res.json({ valid, version: valid ? uuid[14] : null });
  } catch (error) {
    console.error('Verify uuid error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/json - Validate JSON string
router.post('/json', async (req, res) => {
  try {
    const { json_string } = req.body;
    
    if (!json_string) {
      return res.status(400).json({ error: 'json_string is required' });
    }
    
    try {
      const parsed = JSON.parse(json_string);
      res.json({ valid: true, parsed });
    } catch (e) {
      res.json({ valid: false, reason: e.message });
    }
  } catch (error) {
    console.error('Verify json error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/base64 - Validate base64 string
router.post('/base64', async (req, res) => {
  try {
    const { string } = req.body;
    
    if (!string) {
      return res.status(400).json({ error: 'string is required' });
    }
    
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const valid = base64Regex.test(string) && string.length % 4 === 0;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify base64 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/hex - Validate hexadecimal string
router.post('/hex', async (req, res) => {
  try {
    const { string } = req.body;
    
    if (!string) {
      return res.status(400).json({ error: 'string is required' });
    }
    
    const hexRegex = /^[0-9a-fA-F]+$/;
    const valid = hexRegex.test(string);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify hex error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/alpha - Validate alphabetic string
router.post('/alpha', async (req, res) => {
  try {
    const { string, allow_spaces } = req.body;
    
    if (!string) {
      return res.status(400).json({ error: 'string is required' });
    }
    
    const regex = allow_spaces ? /^[a-zA-Z\s]+$/ : /^[a-zA-Z]+$/;
    const valid = regex.test(string);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify alpha error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/alphanumeric - Validate alphanumeric string
router.post('/alphanumeric', async (req, res) => {
  try {
    const { string, allow_spaces } = req.body;
    
    if (!string) {
      return res.status(400).json({ error: 'string is required' });
    }
    
    const regex = allow_spaces ? /^[a-zA-Z0-9\s]+$/ : /^[a-zA-Z0-9]+$/;
    const valid = regex.test(string);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify alphanumeric error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/numeric - Validate numeric string
router.post('/numeric', async (req, res) => {
  try {
    const { string, allow_decimal } = req.body;
    
    if (!string) {
      return res.status(400).json({ error: 'string is required' });
    }
    
    const regex = allow_decimal ? /^-?\d+\.?\d*$/ : /^-?\d+$/;
    const valid = regex.test(string);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify numeric error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/integer - Validate integer
router.post('/integer', async (req, res) => {
  try {
    const { value, min, max } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const isInt = Number.isInteger(value);
    
    if (!isInt) {
      return res.json({ valid: false, reason: 'not_integer' });
    }
    
    if (min !== undefined && value < min) {
      return res.json({ valid: false, reason: 'below_minimum' });
    }
    
    if (max !== undefined && value > max) {
      return res.json({ valid: false, reason: 'above_maximum' });
    }
    
    res.json({ valid: true });
  } catch (error) {
    console.error('Verify integer error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/float - Validate float
router.post('/float', async (req, res) => {
  try {
    const { value, min, max } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const isFloat = typeof value === 'number' && !isNaN(value) && isFinite(value);
    
    if (!isFloat) {
      return res.json({ valid: false, reason: 'not_float' });
    }
    
    if (min !== undefined && value < min) {
      return res.json({ valid: false, reason: 'below_minimum' });
    }
    
    if (max !== undefined && value > max) {
      return res.json({ valid: false, reason: 'above_maximum' });
    }
    
    res.json({ valid: true });
  } catch (error) {
    console.error('Verify float error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/date - Validate date string
router.post('/date', async (req, res) => {
  try {
    const { date, format } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const parsedDate = new Date(date);
    const valid = !isNaN(parsedDate.getTime());
    
    res.json({ 
      valid, 
      iso_string: valid ? parsedDate.toISOString() : null,
      timestamp: valid ? parsedDate.getTime() : null
    });
  } catch (error) {
    console.error('Verify date error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/zipcode - Validate postal code
router.post('/zipcode', async (req, res) => {
  try {
    const { zipcode, country } = req.body;
    
    if (!zipcode) {
      return res.status(400).json({ error: 'zipcode is required' });
    }
    
    let valid = false;
    const countryUpper = (country || 'US').toUpperCase();
    
    switch (countryUpper) {
      case 'US':
        valid = /^\d{5}(-\d{4})?$/.test(zipcode);
        break;
      case 'CA':
        valid = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(zipcode);
        break;
      case 'UK':
        valid = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(zipcode);
        break;
      case 'DE':
        valid = /^\d{5}$/.test(zipcode);
        break;
      default:
        valid = /^\d{3,10}$/.test(zipcode);
    }
    
    res.json({ valid, country: countryUpper });
  } catch (error) {
    console.error('Verify zipcode error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/ssn - Validate SSN (US Social Security Number)
router.post('/ssn', async (req, res) => {
  try {
    const { ssn } = req.body;
    
    if (!ssn) {
      return res.status(400).json({ error: 'ssn is required' });
    }
    
    // Remove dashes and spaces
    const normalized = ssn.replace(/[\s-]/g, '');
    
    // SSN format: 3 digits, 2 digits, 4 digits
    const ssnRegex = /^(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}$/;
    const valid = ssnRegex.test(normalized);
    
    res.json({ valid, masked: valid ? `***-**-${normalized.substring(5)}` : null });
  } catch (error) {
    console.error('Verify ssn error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/password-strength - Check password strength
router.post('/password-strength', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'password is required' });
    }
    
    let score = 0;
    const feedback = [];
    
    if (password.length >= 8) score++;
    else feedback.push('at_least_8_characters');
    
    if (password.length >= 12) score++;
    else feedback.push('at_least_12_characters');
    
    if (/[a-z]/.test(password)) score++;
    else feedback.push('lowercase_letter');
    
    if (/[A-Z]/.test(password)) score++;
    else feedback.push('uppercase_letter');
    
    if (/\d/.test(password)) score++;
    else feedback.push('number');
    
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push('special_character');
    
    const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
    
    res.json({ strength, score, feedback });
  } catch (error) {
    console.error('Verify password-strength error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/username - Validate username
router.post('/username', async (req, res) => {
  try {
    const { username, min_length, max_length } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }
    
    const min = min_length || 3;
    const max = max_length || 20;
    
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    const valid = usernameRegex.test(username) && username.length >= min && username.length <= max;
    
    res.json({ valid, reason: valid ? 'valid' : 'invalid_format_or_length' });
  } catch (error) {
    console.error('Verify username error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/slug - Validate URL slug
router.post('/slug', async (req, res) => {
  try {
    const { slug } = req.body;
    
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }
    
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const valid = slugRegex.test(slug);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify slug error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/color-hex - Validate hex color code
router.post('/color-hex', async (req, res) => {
  try {
    const { color } = req.body;
    
    if (!color) {
      return res.status(400).json({ error: 'color is required' });
    }
    
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const valid = hexRegex.test(color);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify color-hex error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/color-rgb - Validate RGB color
router.post('/color-rgb', async (req, res) => {
  try {
    const { r, g, b } = req.body;
    
    if (r === undefined || g === undefined || b === undefined) {
      return res.status(400).json({ error: 'r, g, and b are required' });
    }
    
    const valid = 
      Number.isInteger(r) && r >= 0 && r <= 255 &&
      Number.isInteger(g) && g >= 0 && g <= 255 &&
      Number.isInteger(b) && b >= 0 && b <= 255;
    
    res.json({ valid, hex: valid ? `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}` : null });
  } catch (error) {
    console.error('Verify color-rgb error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/latitude - Validate latitude
router.post('/latitude', async (req, res) => {
  try {
    const { latitude } = req.body;
    
    if (latitude === undefined) {
      return res.status(400).json({ error: 'latitude is required' });
    }
    
    const valid = typeof latitude === 'number' && latitude >= -90 && latitude <= 90;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify latitude error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/longitude - Validate longitude
router.post('/longitude', async (req, res) => {
  try {
    const { longitude } = req.body;
    
    if (longitude === undefined) {
      return res.status(400).json({ error: 'longitude is required' });
    }
    
    const valid = typeof longitude === 'number' && longitude >= -180 && longitude <= 180;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify longitude error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/coordinates - Validate latitude and longitude pair
router.post('/coordinates', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    
    const latValid = typeof latitude === 'number' && latitude >= -90 && latitude <= 90;
    const lonValid = typeof longitude === 'number' && longitude >= -180 && longitude <= 180;
    const valid = latValid && lonValid;
    
    res.json({ valid, latitude_valid: latValid, longitude_valid: lonValid });
  } catch (error) {
    console.error('Verify coordinates error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/mac-address - Validate MAC address
router.post('/mac-address', async (req, res) => {
  try {
    const { mac } = req.body;
    
    if (!mac) {
      return res.status(400).json({ error: 'mac is required' });
    }
    
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    const valid = macRegex.test(mac);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify mac-address error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/port - Validate port number
router.post('/port', async (req, res) => {
  try {
    const { port } = req.body;
    
    if (port === undefined) {
      return res.status(400).json({ error: 'port is required' });
    }
    
    const valid = Number.isInteger(port) && port >= 1 && port <= 65535;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify port error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/mime-type - Validate MIME type
router.post('/mime-type', async (req, res) => {
  try {
    const { mime_type } = req.body;
    
    if (!mime_type) {
      return res.status(400).json({ error: 'mime_type is required' });
    }
    
    const mimeRegex = /^[a-z]+\/[a-z0-9\.\-\+]+$/i;
    const valid = mimeRegex.test(mime_type);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify mime-type error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/file-extension - Validate file extension
router.post('/file-extension', async (req, res) => {
  try {
    const { extension } = req.body;
    
    if (!extension) {
      return res.status(400).json({ error: 'extension is required' });
    }
    
    const extRegex = /^[a-z0-9]{2,7}$/i;
    const valid = extRegex.test(extension.replace(/^\./, ''));
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify file-extension error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/currency-code - Validate ISO currency code
router.post('/currency-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }
    
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'NZD', 'ZAR', 'RUB', 'TRY'];
    const valid = validCurrencies.includes(code.toUpperCase());
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify currency-code error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/language-code - Validate ISO language code
router.post('/language-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }
    
    const langRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
    const valid = langRegex.test(code);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify language-code error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/timezone - Validate timezone
router.post('/timezone', async (req, res) => {
  try {
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'timezone is required' });
    }
    
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      res.json({ valid: true });
    } catch (e) {
      res.json({ valid: false, reason: 'invalid_timezone' });
    }
  } catch (error) {
    console.error('Verify timezone error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/regex - Test string against regex pattern
router.post('/regex', async (req, res) => {
  try {
    const { string, pattern, flags } = req.body;
    
    if (!string || !pattern) {
      return res.status(400).json({ error: 'string and pattern are required' });
    }
    
    try {
      const regex = new RegExp(pattern, flags || '');
      const valid = regex.test(string);
      
      const matches = string.match(regex);
      
      res.json({ valid, matches: matches || [] });
    } catch (e) {
      res.json({ valid: false, reason: 'invalid_regex', error: e.message });
    }
  } catch (error) {
    console.error('Verify regex error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/min-length - Validate minimum string length
router.post('/min-length', async (req, res) => {
  try {
    const { string, min } = req.body;
    
    if (string === undefined || min === undefined) {
      return res.status(400).json({ error: 'string and min are required' });
    }
    
    const valid = string.length >= min;
    
    res.json({ valid, length: string.length });
  } catch (error) {
    console.error('Verify min-length error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/max-length - Validate maximum string length
router.post('/max-length', async (req, res) => {
  try {
    const { string, max } = req.body;
    
    if (string === undefined || max === undefined) {
      return res.status(400).json({ error: 'string and max are required' });
    }
    
    const valid = string.length <= max;
    
    res.json({ valid, length: string.length });
  } catch (error) {
    console.error('Verify max-length error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/exact-length - Validate exact string length
router.post('/exact-length', async (req, res) => {
  try {
    const { string, length } = req.body;
    
    if (string === undefined || length === undefined) {
      return res.status(400).json({ error: 'string and length are required' });
    }
    
    const valid = string.length === length;
    
    res.json({ valid, actual_length: string.length });
  } catch (error) {
    console.error('Verify exact-length error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/contains - Check if string contains substring
router.post('/contains', async (req, res) => {
  try {
    const { string, substring, case_sensitive } = req.body;
    
    if (string === undefined || substring === undefined) {
      return res.status(400).json({ error: 'string and substring are required' });
    }
    
    const checkString = case_sensitive ? string : string.toLowerCase();
    const checkSubstring = case_sensitive ? substring : substring.toLowerCase();
    const valid = checkString.includes(checkSubstring);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify contains error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/starts-with - Check if string starts with prefix
router.post('/starts-with', async (req, res) => {
  try {
    const { string, prefix, case_sensitive } = req.body;
    
    if (string === undefined || prefix === undefined) {
      return res.status(400).json({ error: 'string and prefix are required' });
    }
    
    const checkString = case_sensitive ? string : string.toLowerCase();
    const checkPrefix = case_sensitive ? prefix : prefix.toLowerCase();
    const valid = checkString.startsWith(checkPrefix);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify starts-with error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/ends-with - Check if string ends with suffix
router.post('/ends-with', async (req, res) => {
  try {
    const { string, suffix, case_sensitive } = req.body;
    
    if (string === undefined || suffix === undefined) {
      return res.status(400).json({ error: 'string and suffix are required' });
    }
    
    const checkString = case_sensitive ? string : string.toLowerCase();
    const checkSuffix = case_sensitive ? suffix : suffix.toLowerCase();
    const valid = checkString.endsWith(checkSuffix);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify ends-with error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/equal - Check if two values are equal
router.post('/equal', async (req, res) => {
  try {
    const { value1, value2, strict } = req.body;
    
    if (value1 === undefined || value2 === undefined) {
      return res.status(400).json({ error: 'value1 and value2 are required' });
    }
    
    const valid = strict ? value1 === value2 : value1 == value2;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify equal error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/in-range - Check if number is in range
router.post('/in-range', async (req, res) => {
  try {
    const { value, min, max, inclusive } = req.body;
    
    if (value === undefined || min === undefined || max === undefined) {
      return res.status(400).json({ error: 'value, min, and max are required' });
    }
    
    let valid;
    if (inclusive) {
      valid = value >= min && value <= max;
    } else {
      valid = value > min && value < max;
    }
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify in-range error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/in-array - Check if value is in array
router.post('/in-array', async (req, res) => {
  try {
    const { value, array, case_sensitive } = req.body;
    
    if (value === undefined || !Array.isArray(array)) {
      return res.status(400).json({ error: 'value and array are required' });
    }
    
    let valid;
    if (case_sensitive) {
      valid = array.includes(value);
    } else {
      const lowerValue = String(value).toLowerCase();
      valid = array.some(item => String(item).toLowerCase() === lowerValue);
    }
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify in-array error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/is-empty - Check if value is empty
router.post('/is-empty', async (req, res) => {
  try {
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    let empty;
    if (value === null || value === undefined) {
      empty = true;
    } else if (typeof value === 'string') {
      empty = value.trim().length === 0;
    } else if (Array.isArray(value)) {
      empty = value.length === 0;
    } else if (typeof value === 'object') {
      empty = Object.keys(value).length === 0;
    } else {
      empty = false;
    }
    
    res.json({ empty });
  } catch (error) {
    console.error('Verify is-empty error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/is-unique - Check if value is unique in array
router.post('/is-unique', async (req, res) => {
  try {
    const { value, array } = req.body;
    
    if (value === undefined || !Array.isArray(array)) {
      return res.status(400).json({ error: 'value and array are required' });
    }
    
    const count = array.filter(item => item === value).length;
    const unique = count <= 1;
    
    res.json({ unique, count });
  } catch (error) {
    console.error('Verify is-unique error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/hash - Validate hash string (MD5, SHA1, SHA256, etc.)
router.post('/hash', async (req, res) => {
  try {
    const { hash, algorithm } = req.body;
    
    if (!hash) {
      return res.status(400).json({ error: 'hash is required' });
    }
    
    const algo = (algorithm || 'sha256').toLowerCase();
    let valid = false;
    let expectedLength;
    
    switch (algo) {
      case 'md5':
        expectedLength = 32;
        valid = /^[a-f0-9]{32}$/i.test(hash);
        break;
      case 'sha1':
        expectedLength = 40;
        valid = /^[a-f0-9]{40}$/i.test(hash);
        break;
      case 'sha256':
        expectedLength = 64;
        valid = /^[a-f0-9]{64}$/i.test(hash);
        break;
      case 'sha512':
        expectedLength = 128;
        valid = /^[a-f0-9]{128}$/i.test(hash);
        break;
      default:
        return res.json({ valid: false, reason: 'unsupported_algorithm' });
    }
    
    res.json({ valid, algorithm: algo, expected_length: expectedLength });
  } catch (error) {
    console.error('Verify hash error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/semver - Validate semantic version
router.post('/semver', async (req, res) => {
  try {
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: 'version is required' });
    }
    
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    const valid = semverRegex.test(version);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify semver error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/hostname - Validate hostname
router.post('/hostname', async (req, res) => {
  try {
    const { hostname } = req.body;
    
    if (!hostname) {
      return res.status(400).json({ error: 'hostname is required' });
    }
    
    const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
    const valid = hostnameRegex.test(hostname) && hostname.length <= 253;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify hostname error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/asn - Validate ASN (Autonomous System Number)
router.post('/asn', async (req, res) => {
  try {
    const { asn } = req.body;
    
    if (asn === undefined) {
      return res.status(400).json({ error: 'asn is required' });
    }
    
    const valid = Number.isInteger(asn) && asn >= 1 && asn <= 4294967295;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify asn error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/bic - Validate BIC (Bank Identifier Code)
router.post('/bic', async (req, res) => {
  try {
    const { bic } = req.body;
    
    if (!bic) {
      return res.status(400).json({ error: 'bic is required' });
    }
    
    const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    const valid = bicRegex.test(bic.toUpperCase());
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify bic error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/swift - Validate SWIFT code (same as BIC)
router.post('/swift', async (req, res) => {
  try {
    const { swift } = req.body;
    
    if (!swift) {
      return res.status(400).json({ error: 'swift is required' });
    }
    
    const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    const valid = swiftRegex.test(swift.toUpperCase());
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify swift error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/routing-number - Validate US routing number
router.post('/routing-number', async (req, res) => {
  try {
    const { routing_number } = req.body;
    
    if (!routing_number) {
      return res.status(400).json({ error: 'routing_number is required' });
    }
    
    const digits = routing_number.replace(/\D/g, '');
    
    if (digits.length !== 9) {
      return res.json({ valid: false, reason: 'invalid_length' });
    }
    
    // Checksum calculation
    const d = digits.split('').map(Number);
    const checksum = 
      3 * (d[0] + d[3] + d[6]) +
      7 * (d[1] + d[4] + d[7]) +
      (d[2] + d[5] + d[8]);
    
    const valid = checksum !== 0 && checksum % 10 === 0;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify routing-number error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/vat - Validate VAT number (basic format check)
router.post('/vat', async (req, res) => {
  try {
    const { vat, country } = req.body;
    
    if (!vat) {
      return res.status(400).json({ error: 'vat is required' });
    }
    
    const countryUpper = (country || 'GB').toUpperCase();
    const normalized = vat.replace(/[\s\-\.]/g, '').toUpperCase();
    
    let valid = false;
    
    switch (countryUpper) {
      case 'GB':
        valid = /^GB[0-9]{9}$/.test(normalized) || /^GB[0-9]{12}$/.test(normalized);
        break;
      case 'DE':
        valid = /^DE[0-9]{9}$/.test(normalized);
        break;
      case 'FR':
        valid = /^FR[0-9A-Z]{2}[0-9]{9}$/.test(normalized);
        break;
      case 'IT':
        valid = /^IT[0-9]{11}$/.test(normalized);
        break;
      case 'ES':
        valid = /^ES[0-9A-Z][0-9]{7}[0-9A-Z]$/.test(normalized);
        break;
      default:
        valid = /^[A-Z]{2}[0-9A-Z]{8,12}$/.test(normalized);
    }
    
    res.json({ valid, country: countryUpper });
  } catch (error) {
    console.error('Verify vat error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/ean - Validate EAN (European Article Number)
router.post('/ean', async (req, res) => {
  try {
    const { ean } = req.body;
    
    if (!ean) {
      return res.status(400).json({ error: 'ean is required' });
    }
    
    const digits = ean.replace(/\D/g, '');
    
    if (digits.length !== 13) {
      return res.json({ valid: false, reason: 'invalid_length' });
    }
    
    // Checksum calculation
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    
    const checksum = (10 - (sum % 10)) % 10;
    const valid = checksum === parseInt(digits[12], 10);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify ean error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/upc - Validate UPC (Universal Product Code)
router.post('/upc', async (req, res) => {
  try {
    const { upc } = req.body;
    
    if (!upc) {
      return res.status(400).json({ error: 'upc is required' });
    }
    
    const digits = upc.replace(/\D/g, '');
    
    if (digits.length !== 12) {
      return res.json({ valid: false, reason: 'invalid_length' });
    }
    
    // Checksum calculation
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 3 : 1);
    }
    
    const checksum = (10 - (sum % 10)) % 10;
    const valid = checksum === parseInt(digits[11], 10);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify upc error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/isbn - Validate ISBN (International Standard Book Number)
router.post('/isbn', async (req, res) => {
  try {
    const { isbn } = req.body;
    
    if (!isbn) {
      return res.status(400).json({ error: 'isbn is required' });
    }
    
    const normalized = isbn.replace(/[\s\-]/g, '');
    
    if (normalized.length === 10) {
      // ISBN-10
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(normalized[i], 10) * (10 - i);
      }
      const checksum = normalized[9] === 'X' ? 10 : parseInt(normalized[9], 10);
      const valid = (sum + checksum) % 11 === 0;
      return res.json({ valid, type: 'isbn-10' });
    } else if (normalized.length === 13) {
      // ISBN-13
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(normalized[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const checksum = (10 - (sum % 10)) % 10;
      const valid = checksum === parseInt(normalized[12], 10);
      return res.json({ valid, type: 'isbn-13' });
    }
    
    res.json({ valid: false, reason: 'invalid_length' });
  } catch (error) {
    console.error('Verify isbn error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/passport - Validate passport number (basic format)
router.post('/passport', async (req, res) => {
  try {
    const { passport, country } = req.body;
    
    if (!passport) {
      return res.status(400).json({ error: 'passport is required' });
    }
    
    const countryUpper = (country || 'US').toUpperCase();
    const normalized = passport.replace(/\s/g, '').toUpperCase();
    
    let valid = false;
    
    switch (countryUpper) {
      case 'US':
        valid = /^[A-Z0-9]{9}$/.test(normalized);
        break;
      case 'GB':
        valid = /^[0-9]{9}$/.test(normalized);
        break;
      case 'DE':
        valid = /^[A-Z0-9<]{9}$/.test(normalized);
        break;
      default:
        valid = /^[A-Z0-9]{6,12}$/.test(normalized);
    }
    
    res.json({ valid, country: countryUpper });
  } catch (error) {
    console.error('Verify passport error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/driver-license - Validate driver license number (basic format)
router.post('/driver-license', async (req, res) => {
  try {
    const { license, state } = req.body;
    
    if (!license) {
      return res.status(400).json({ error: 'license is required' });
    }
    
    const stateUpper = (state || 'CA').toUpperCase();
    const normalized = license.replace(/[\s\-]/g, '').toUpperCase();
    
    let valid = false;
    
    switch (stateUpper) {
      case 'CA':
        valid = /^[A-Z]{1}\d{7}$/.test(normalized);
        break;
      case 'TX':
        valid = /^\d{8}$/.test(normalized);
        break;
      case 'NY':
        valid = /^[A-Z]{1}\d{7}$/.test(normalized);
        break;
      case 'FL':
        valid = /^[A-Z]{1}\d{12}$/.test(normalized);
        break;
      default:
        valid = /^[A-Z0-9]{6,15}$/.test(normalized);
    }
    
    res.json({ valid, state: stateUpper });
  } catch (error) {
    console.error('Verify driver-license error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/doi - Validate DOI (Digital Object Identifier)
router.post('/doi', async (req, res) => {
  try {
    const { doi } = req.body;
    
    if (!doi) {
      return res.status(400).json({ error: 'doi is required' });
    }
    
    const doiRegex = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    const valid = doiRegex.test(doi);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify doi error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/orcid - Validate ORCID ID
router.post('/orcid', async (req, res) => {
  try {
    const { orcid } = req.body;
    
    if (!orcid) {
      return res.status(400).json({ error: 'orcid is required' });
    }
    
    const orcidRegex = /^https?:\/\/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])$|^(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])$/;
    const match = orcid.match(orcidRegex);
    
    if (!match) {
      return res.json({ valid: false });
    }
    
    const id = match[1] || match[2];
    
    // Checksum validation
    const digits = id.replace(/-/g, '');
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      sum = (sum + parseInt(digits[i], 10)) * 2;
    }
    
    const remainder = sum % 11;
    const result = (12 - remainder) % 11;
    const checksum = result === 10 ? 'X' : result.toString();
    
    const valid = checksum === digits[15];
    
    res.json({ valid, id });
  } catch (error) {
    console.error('Verify orcid error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/isbn-10 - Validate ISBN-10 specifically
router.post('/isbn-10', async (req, res) => {
  try {
    const { isbn } = req.body;
    
    if (!isbn) {
      return res.status(400).json({ error: 'isbn is required' });
    }
    
    const normalized = isbn.replace(/[\s\-]/g, '');
    
    if (normalized.length !== 10) {
      return res.json({ valid: false, reason: 'invalid_length' });
    }
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(normalized[i], 10) * (10 - i);
    }
    
    const checksum = normalized[9] === 'X' ? 10 : parseInt(normalized[9], 10);
    const valid = (sum + checksum) % 11 === 0;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify isbn-10 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/isbn-13 - Validate ISBN-13 specifically
router.post('/isbn-13', async (req, res) => {
  try {
    const { isbn } = req.body;
    
    if (!isbn) {
      return res.status(400).json({ error: 'isbn is required' });
    }
    
    const normalized = isbn.replace(/[\s\-]/g, '');
    
    if (normalized.length !== 13) {
      return res.json({ valid: false, reason: 'invalid_length' });
    }
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(normalized[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    
    const checksum = (10 - (sum % 10)) % 10;
    const valid = checksum === parseInt(normalized[12], 10);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify isbn-13 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/luhn - Validate using Luhn algorithm (generic)
router.post('/luhn', async (req, res) => {
  try {
    const { number } = req.body;
    
    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    
    const digits = number.replace(/\D/g, '');
    
    if (digits.length < 2) {
      return res.json({ valid: false, reason: 'too_short' });
    }
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    const valid = sum % 10 === 0;
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify luhn error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/modulus-10 - Validate using Modulus 10 algorithm
router.post('/modulus-10', async (req, res) => {
  try {
    const { number } = req.body;
    
    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    
    const digits = number.replace(/\D/g, '');
    
    if (digits.length < 2) {
      return res.json({ valid: false, reason: 'too_short' });
    }
    
    let sum = 0;
    for (let i = 0; i < digits.length - 1; i++) {
      let digit = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    
    const checksum = (10 - (sum % 10)) % 10;
    const valid = checksum === parseInt(digits[digits.length - 1], 10);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify modulus-10 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/modulus-11 - Validate using Modulus 11 algorithm
router.post('/modulus-11', async (req, res) => {
  try {
    const { number } = req.body;
    
    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    
    const digits = number.replace(/\D/g, '');
    
    if (digits.length < 2) {
      return res.json({ valid: false, reason: 'too_short' });
    }
    
    let sum = 0;
    const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3];
    
    for (let i = 0; i < digits.length - 1; i++) {
      const weight = weights[i % weights.length];
      sum += parseInt(digits[i], 10) * weight;
    }
    
    const remainder = sum % 11;
    const checksum = remainder === 0 ? 1 : 11 - remainder;
    const valid = checksum === parseInt(digits[digits.length - 1], 10);
    
    res.json({ valid });
  } catch (error) {
    console.error('Verify modulus-11 error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/mx-validate - Validate MX records for a domain using DNS lookup
router.post('/mx-validate', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    try {
      const mxRecords = await dns.resolveMx(domain);
      const valid = mxRecords && mxRecords.length > 0;
      
      res.json({ 
        valid, 
        mx_records: mxRecords.map(r => ({ exchange: r.exchange, priority: r.priority })),
        count: mxRecords.length
      });
    } catch (error) {
      res.json({ valid: false, reason: 'no_mx_records', error: error.code });
    }
  } catch (error) {
    console.error('Verify mx-validate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/phone-country - Detect country from phone number using patterns
router.post('/phone-country', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Simple country code detection (common prefixes)
    const countryCodes = {
      '1': 'US/CA',
      '44': 'UK',
      '33': 'FR',
      '49': 'DE',
      '39': 'IT',
      '34': 'ES',
      '86': 'CN',
      '81': 'JP',
      '91': 'IN',
      '61': 'AU',
      '55': 'BR',
      '7': 'RU/KZ',
      '82': 'KR',
      '52': 'MX',
      '27': 'ZA'
    };
    
    let detectedCountry = null;
    let matchedCode = null;
    
    // Check for country code matches (longest first)
    const sortedCodes = Object.keys(countryCodes).sort((a, b) => b.length - a.length);
    for (const code of sortedCodes) {
      if (digits.startsWith(code)) {
        detectedCountry = countryCodes[code];
        matchedCode = code;
        break;
      }
    }
    
    res.json({ 
      country: detectedCountry, 
      country_code: matchedCode,
      valid: detectedCountry !== null
    });
  } catch (error) {
    console.error('Verify phone-country error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/domain-reputation - Check domain reputation via WHOIS age and MX presence
router.post('/domain-reputation', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    // Check MX records
    let hasMX = false;
    let mxCount = 0;
    try {
      const mxRecords = await dns.resolveMx(domain);
      hasMX = mxRecords && mxRecords.length > 0;
      mxCount = mxRecords.length;
    } catch (error) {
      // No MX records
    }
    
    // Check A record (domain exists)
    let hasA = false;
    try {
      const aRecords = await dns.resolve4(domain);
      hasA = aRecords && aRecords.length > 0;
    } catch (error) {
      // No A records
    }
    
    // Domain age estimation (simplified - in production use actual WHOIS)
    // For now, we'll use domain creation date from DNS if available
    const domainAge = null; // Would require WHOIS lookup
    
    // Calculate reputation score
    let score = 0;
    if (hasMX) score += 30;
    if (hasA) score += 40;
    if (mxCount > 1) score += 20;
    if (domainAge && domainAge > 365) score += 10;
    
    const reputation = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
    
    res.json({ 
      reputation,
      score,
      has_mx: hasMX,
      mx_count: mxCount,
      has_a_record: hasA,
      domain_age_days: domainAge
    });
  } catch (error) {
    console.error('Verify domain-reputation error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /verify/disposable-domain - Check if domain is from disposable email provider
router.post('/disposable-domain', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    // Common disposable email domains
    const disposableDomains = new Set([
      'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
      'yopmail.com', 'sharklasers.com', 'throwawaymail.com', 'getairmail.com',
      'maildrop.cc', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
      'tempmail.de', 'mailtemp.com', 'mytempemail.com', 'incognitomail.com',
      'anonmail.net', 'dispostable.com', 'trashmail.com', 'tempmail.net',
      'spamgourmet.com', 'mailnull.com', 'jetable.org', 'yopmail.com'
    ]);
    
    const domainLower = domain.toLowerCase();
    const isDisposable = disposableDomains.has(domainLower);
    
    // Also check if domain contains common disposable patterns
    const disposablePatterns = ['temp', 'throw', 'fake', 'spam', 'trash', 'disposable', 'anon', 'temp'];
    const hasDisposablePattern = disposablePatterns.some(pattern => domainLower.includes(pattern));
    
    res.json({ 
      is_disposable: isDisposable,
      matches_pattern: hasDisposablePattern && !isDisposable,
      domain: domainLower
    });
  } catch (error) {
    console.error('Verify disposable-domain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
