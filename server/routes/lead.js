const express = require('express');
const dns = require('dns').promises;

const router = express.Router();

// POST /lead/email-pattern/first-last - Generate email pattern from first name and last name
router.post('/email-pattern/first-last', async (req, res) => {
  try {
    const { first_name, last_name } = req.body;
    
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'first_name and last_name are required' });
    }
    
    const first = first_name.toLowerCase().replace(/[^a-z]/g, '');
    const last = last_name.toLowerCase().replace(/[^a-z]/g, '');
    
    const patterns = [
      `${first}.${last}`,
      `${first}${last}`,
      `${first}_${last}`,
      `${first}-${last}`,
      `${last}.${first}`,
      `${last}${first}`,
      `${first[0]}${last}`,
      `${first}.${last[0]}`
    ];
    
    res.json({ patterns, first_name: first, last_name: last });
  } catch (error) {
    console.error('Lead email-pattern error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/email-pattern/first-last-domain - Generate email from first, last, and domain
router.post('/email-pattern/first-last-domain', async (req, res) => {
  try {
    const { first_name, last_name, domain } = req.body;
    
    if (!first_name || !last_name || !domain) {
      return res.status(400).json({ error: 'first_name, last_name, and domain are required' });
    }
    
    const first = first_name.toLowerCase().replace(/[^a-z]/g, '');
    const last = last_name.toLowerCase().replace(/[^a-z]/g, '');
    const domainClean = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    
    const emails = [
      `${first}.${last}@${domainClean}`,
      `${first}${last}@${domainClean}`,
      `${first}_${last}@${domainClean}`,
      `${first}-${last}@${domainClean}`,
      `${last}.${first}@${domainClean}`,
      `${first[0]}${last}@${domainClean}`
    ];
    
    res.json({ emails, domain: domainClean });
  } catch (error) {
    console.error('Lead email-pattern domain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/company/domain - Get company metadata from domain using DNS/WHOIS
router.post('/company/domain', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const domainClean = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    
    // Extract company name from domain
    const parts = domainClean.split('.');
    const companyName = parts.length >= 2 ? parts[0] : domainClean;
    
    // Check DNS records
    let hasMX = false;
    let hasA = false;
    try {
      await dns.resolveMx(domainClean);
      hasMX = true;
    } catch (e) {}
    
    try {
      await dns.resolve4(domainClean);
      hasA = true;
    } catch (e) {}
    
    res.json({
      domain: domainClean,
      company_name: companyName,
      has_mx: hasMX,
      has_a_record: hasA,
      likely_email_domain: hasMX
    });
  } catch (error) {
    console.error('Lead company domain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/company/website - Extract company info from website URL
router.post('/company/website', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    let domain;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch (e) {
      return res.status(400).json({ error: 'invalid_url' });
    }
    
    const parts = domain.split('.');
    const companyName = parts.length >= 2 ? parts[0] : domain;
    
    res.json({
      url,
      domain,
      company_name: companyName,
      tld: parts.length >= 2 ? parts[parts.length - 1] : null
    });
  } catch (error) {
    console.error('Lead company website error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/email/validate/format - Validate email format for bulk list
router.post('/email/validate/format', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: 'emails must be an array' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const results = emails.map(email => ({
      email,
      valid: emailRegex.test(email)
    }));
    
    const validCount = results.filter(r => r.valid).length;
    
    res.json({ results, total: emails.length, valid: validCount, invalid: emails.length - validCount });
  } catch (error) {
    console.error('Lead email validate format error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/email/validate/domain - Validate domain existence for bulk emails
router.post('/email/validate/domain', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: 'emails must be an array' });
    }
    
    const results = await Promise.all(emails.map(async (email) => {
      const domain = email.split('@')[1];
      if (!domain) {
        return { email, valid: false, reason: 'no_domain' };
      }
      
      try {
        await dns.resolve4(domain);
        return { email, valid: true, domain };
      } catch (e) {
        return { email, valid: false, reason: 'domain_not_found', domain };
      }
    }));
    
    const validCount = results.filter(r => r.valid).length;
    
    res.json({ results, total: emails.length, valid: validCount, invalid: emails.length - validCount });
  } catch (error) {
    console.error('Lead email validate domain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/email/validate/mx - Validate MX records for bulk emails
router.post('/email/validate/mx', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: 'emails must be an array' });
    }
    
    const results = await Promise.all(emails.map(async (email) => {
      const domain = email.split('@')[1];
      if (!domain) {
        return { email, valid: false, reason: 'no_domain' };
      }
      
      try {
        const mxRecords = await dns.resolveMx(domain);
        return { email, valid: true, domain, mx_count: mxRecords.length };
      } catch (e) {
        return { email, valid: false, reason: 'no_mx_records', domain };
      }
    }));
    
    const validCount = results.filter(r => r.valid).length;
    
    res.json({ results, total: emails.length, valid: validCount, invalid: emails.length - validCount });
  } catch (error) {
    console.error('Lead email validate mx error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/domain/company-name - Extract company name from domain
router.post('/domain/company-name', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const domainClean = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    const parts = domainClean.split('.');
    
    // Remove common TLDs and get company name
    const commonTLDs = ['com', 'org', 'net', 'io', 'co', 'app', 'dev'];
    let companyName = parts[0];
    
    if (parts.length > 2 && !commonTLDs.includes(parts[1])) {
      companyName = parts[0] + ' ' + parts[1];
    }
    
    // Capitalize
    const formattedName = companyName.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    res.json({ domain: domainClean, company_name: formattedName });
  } catch (error) {
    console.error('Lead domain company-name error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/domain/industry - Infer industry from domain patterns
router.post('/domain/industry', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const domainLower = domain.toLowerCase();
    
    // Industry patterns
    const industryPatterns = {
      'Technology': ['tech', 'software', 'dev', 'code', 'app', 'digital', 'cloud', 'data', 'ai', 'ml'],
      'Finance': ['bank', 'finance', 'invest', 'capital', 'fund', 'money', 'pay', 'trading', 'crypto'],
      'Healthcare': ['health', 'medical', 'pharma', 'clinic', 'care', 'wellness', 'bio', 'med'],
      'E-commerce': ['shop', 'store', 'market', 'retail', 'commerce', 'sell', 'buy', 'mall'],
      'Education': ['edu', 'learn', 'school', 'university', 'college', 'course', 'train', 'academy'],
      'Marketing': ['marketing', 'ad', 'agency', 'media', 'brand', 'promo', 'creative'],
      'Consulting': ['consult', 'advisory', 'strategy', 'solutions', 'group', 'partners'],
      'Manufacturing': ['manufacture', 'factory', 'industrial', 'production', 'mfg', 'maker']
    };
    
    let detectedIndustry = 'Unknown';
    let matchedPattern = null;
    
    for (const [industry, patterns] of Object.entries(industryPatterns)) {
      for (const pattern of patterns) {
        if (domainLower.includes(pattern)) {
          detectedIndustry = industry;
          matchedPattern = pattern;
          break;
        }
      }
      if (matchedPattern) break;
    }
    
    res.json({ domain, industry: detectedIndustry, matched_pattern: matchedPattern });
  } catch (error) {
    console.error('Lead domain industry error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/domain/size-estimate - Estimate company size from domain signals
router.post('/domain/size-estimate', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const domainLower = domain.toLowerCase();
    
    // Size indicators
    const enterpriseIndicators = ['corp', 'enterprise', 'global', 'international', 'group', 'holdings', 'inc', 'llc'];
    const startupIndicators = ['startup', 'labs', 'io', 'app', 'tech', 'co', 'studio'];
    const smbIndicators = ['local', 'small', 'biz', 'services', 'solutions'];
    
    let size = 'Unknown';
    let confidence = 'low';
    
    if (enterpriseIndicators.some(ind => domainLower.includes(ind))) {
      size = 'Enterprise (500+ employees)';
      confidence = 'medium';
    } else if (startupIndicators.some(ind => domainLower.includes(ind))) {
      size = 'Startup (1-50 employees)';
      confidence = 'medium';
    } else if (smbIndicators.some(ind => domainLower.includes(ind))) {
      size = 'SMB (50-500 employees)';
      confidence = 'medium';
    }
    
    res.json({ domain, size_estimate: size, confidence });
  } catch (error) {
    console.error('Lead domain size-estimate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/email/to-domain - Extract domain from email address
router.post('/email/to-domain', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const parts = email.split('@');
    const domain = parts.length > 1 ? parts[1] : null;
    
    if (!domain) {
      return res.status(400).json({ error: 'invalid_email_format' });
    }
    
    res.json({ email, domain });
  } catch (error) {
    console.error('Lead email to-domain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/email/to-company - Infer company from email domain
router.post('/email/to-company', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const parts = email.split('@');
    const domain = parts.length > 1 ? parts[1] : null;
    
    if (!domain) {
      return res.status(400).json({ error: 'invalid_email_format' });
    }
    
    const domainParts = domain.split('.');
    const companyName = domainParts.length >= 2 ? domainParts[0] : domain;
    
    // Capitalize
    const formattedName = companyName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    res.json({ email, domain, company_name: formattedName });
  } catch (error) {
    console.error('Lead email to-company error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/linkedin/parse - Parse LinkedIn profile URL to extract components
router.post('/linkedin/parse', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    const linkedinRegex = /linkedin\.com\/in\/([^\/]+)/;
    const match = url.match(linkedinRegex);
    
    if (!match) {
      return res.json({ valid: false, reason: 'not_a_linkedin_profile_url' });
    }
    
    const profileId = match[1];
    const parts = profileId.split('-');
    
    res.json({
      valid: true,
      url,
      profile_id: profileId,
      likely_first_name: parts[0] || null,
      likely_last_name: parts.length > 1 ? parts[parts.length - 1] : null
    });
  } catch (error) {
    console.error('Lead linkedin parse error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/company/logo - Find company logo from domain
router.post('/company/logo', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const domainClean = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    
    // Common logo locations
    const logoUrls = [
      `https://${domainClean}/favicon.ico`,
      `https://${domainClean}/logo.png`,
      `https://${domainClean}/logo.svg`,
      `https://logo.clearbit.com/${domainClean}`,
      `https://www.google.com/s2/favicons?domain=${domainClean}`
    ];
    
    res.json({ domain: domainClean, logo_urls: logoUrls, primary: logoUrls[0] });
  } catch (error) {
    console.error('Lead company logo error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /lead/company/social - Find social media links from domain
router.post('/company/social', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const domainClean = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    const companyName = domainClean.split('.')[0];
    
    // Common social media URL patterns
    const socialUrls = [
      `https://twitter.com/${companyName}`,
      `https://facebook.com/${companyName}`,
      `https://linkedin.com/company/${companyName}`,
      `https://instagram.com/${companyName}`,
      `https://youtube.com/@${companyName}`
    ];
    
    res.json({ domain: domainClean, company_name: companyName, social_urls: socialUrls });
  } catch (error) {
    console.error('Lead company social error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
