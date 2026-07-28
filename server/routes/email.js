const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { Resend } = require('resend');
const { simpleParser } = require('mailparser');

const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = 'orders@ofmagnitude.com';

// Redis client (imported from index.js, but we need to access it)
// For now, we'll create a new connection or pass it in
const Redis = require('ioredis');
const redisClient = new Redis(process.env.REDIS_URL);
redisClient.on('error', (err) => console.error('Redis error:', err.message));

// POST /email/send/transactional - Send transactional email via Resend
router.post('/send/transactional', async (req, res) => {
  try {
    const { to, from, subject, body, html } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }
    
    const fromAddress = from || DEFAULT_FROM;
    
    const emailData = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      ...(html ? { html } : { text: body })
    };
    
    const result = await resend.emails.send(emailData);
    
    res.json({
      success: true,
      message_id: result.id,
      provider: 'resend',
      to,
      from: fromAddress,
      subject,
      status: result.error ? 'failed' : 'queued',
      error: result.error || null
    });
  } catch (error) {
    console.error('Email send transactional error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/send/bulk - Send bulk email campaign via Resend
router.post('/send/bulk', async (req, res) => {
  try {
    const { recipients, from, subject, body, html, campaign_id } = req.body;
    
    if (!Array.isArray(recipients) || !subject || !body) {
      return res.status(400).json({ error: 'recipients (array), subject, and body are required' });
    }
    
    const fromAddress = from || DEFAULT_FROM;
    const campId = campaign_id || `camp_${Date.now()}`;
    
    // Resend doesn't have a true bulk API, so we send individual emails
    const results = [];
    const errors = [];
    
    for (const recipient of recipients) {
      try {
        const emailData = {
          from: fromAddress,
          to: Array.isArray(recipient) ? recipient : [recipient],
          subject,
          ...(html ? { html } : { text: body })
        };
        
        const result = await resend.emails.send(emailData);
        results.push({
          recipient,
          message_id: result.id,
          status: result.error ? 'failed' : 'queued',
          error: result.error || null
        });
        
        if (result.error) {
          errors.push({ recipient, error: result.error });
        }
      } catch (err) {
        errors.push({ recipient, error: err.message });
        results.push({
          recipient,
          status: 'failed',
          error: err.message
        });
      }
    }
    
    res.json({
      success: errors.length === 0,
      campaign_id: campId,
      total_recipients: recipients.length,
      queued: results.filter(r => r.status === 'queued').length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Email send bulk error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/template/render - Render email template with variables
router.post('/template/render', async (req, res) => {
  try {
    const { template, variables } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'template is required' });
    }
    
    const vars = variables || {};
    let rendered = template;
    
    // Simple variable substitution {{variable}}
    for (const [key, value] of Object.entries(vars)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    res.json({
      template,
      variables: vars,
      rendered
    });
  } catch (error) {
    console.error('Email template render error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/template/validate - Validate email template syntax
router.post('/template/validate', async (req, res) => {
  try {
    const { template } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'template is required' });
    }
    
    // Check for unclosed variables
    const openVars = (template.match(/{{/g) || []).length;
    const closeVars = (template.match(/}}/g) || []).length;
    
    const issues = [];
    if (openVars !== closeVars) {
      issues.push('Mismatched variable delimiters');
    }
    
    // Extract variable names
    const varMatches = template.match(/{{([^}]+)}}/g) || [];
    const variables = varMatches.map(v => v.replace(/[{}]/g, ''));
    
    res.json({
      valid: issues.length === 0,
      issues,
      variables_found: variables,
      variable_count: variables.length
    });
  } catch (error) {
    console.error('Email template validate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/bounce/check - Check if email is on bounce list (MX + SMTP probe)
router.post('/bounce/check', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1];
    if (!domain) {
      return res.json({ email, is_bounced: true, bounce_reason: 'invalid_email_format' });
    }
    
    // Check MX records
    let mxRecords = [];
    try {
      mxRecords = await dns.resolveMx(domain);
    } catch (e) {
      return res.json({ email, is_bounced: true, bounce_reason: 'no_mx_records', mx_exists: false });
    }
    
    if (mxRecords.length === 0) {
      return res.json({ email, is_bounced: true, bounce_reason: 'no_mx_records', mx_exists: false });
    }
    
    // SMTP probe - try to connect to MX server on port 25
    const smtpProbe = async (mxHost) => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        let connected = false;
        
        socket.setTimeout(5000); // 5 second timeout
        
        socket.on('connect', () => {
          connected = true;
          socket.destroy();
          resolve(true);
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.connect(25, mxHost);
      });
    };
    
    // Try MX servers in priority order
    let smtpReachable = false;
    for (const mx of mxRecords.sort((a, b) => a.priority - b.priority)) {
      if (await smtpProbe(mx.exchange)) {
        smtpReachable = true;
        break;
      }
    }
    
    res.json({
      email,
      domain,
      is_bounced: !smtpReachable,
      bounce_reason: smtpReachable ? null : 'smtp_unreachable',
      mx_exists: true,
      mx_count: mxRecords.length,
      smtp_reachable: smtpReachable
    });
  } catch (error) {
    console.error('Email bounce check error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/bounce/analyze - Analyze bounce reason
router.post('/bounce/analyze', async (req, res) => {
  try {
    const { bounce_code, bounce_message } = req.body;
    
    if (!bounce_code) {
      return res.status(400).json({ error: 'bounce_code is required' });
    }
    
    // Common bounce codes
    const bounceReasons = {
      '550': 'Mailbox unavailable',
      '552': 'Mailbox full',
      '553': 'Invalid recipient',
      '554': 'Message rejected',
      '421': 'Service not available'
    };
    
    res.json({
      bounce_code,
      bounce_message,
      reason: bounceReasons[bounce_code] || 'Unknown bounce reason',
      category: bounce_code.startsWith('5') ? 'permanent' : 'temporary',
      actionable: bounce_code.startsWith('4')
    });
  } catch (error) {
    console.error('Email bounce analyze error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/deliverability/check - Check email deliverability score
router.post('/deliverability/check', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1];
    
    // Check DNS records
    let hasMX = false;
    let hasSPF = false;
    let hasDKIM = false;
    
    try {
      await dns.resolveMx(domain);
      hasMX = true;
    } catch (e) {}
    
    // Calculate score (simplified)
    let score = 0;
    if (hasMX) score += 30;
    if (hasSPF) score += 30;
    if (hasDKIM) score += 40;
    
    res.json({
      email,
      domain,
      score,
      has_mx: hasMX,
      has_spf: hasSPF,
      has_dkim: hasDKIM,
      rating: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
    });
  } catch (error) {
    console.error('Email deliverability check error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/deliverability/dns - Check DNS records for deliverability
router.post('/deliverability/dns', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    
    const records = {};
    
    // Check MX
    try {
      const mx = await dns.resolveMx(domain);
      records.mx = mx.map(r => ({ exchange: r.exchange, priority: r.priority }));
    } catch (e) {
      records.mx = null;
    }
    
    // Check A
    try {
      const a = await dns.resolve4(domain);
      records.a = a;
    } catch (e) {
      records.a = null;
    }
    
    // Check TXT (SPF)
    try {
      const txt = await dns.resolveTxt(domain);
      records.txt = txt;
      records.has_spf = txt.some(record => record.some(r => r.includes('v=spf1')));
    } catch (e) {
      records.txt = null;
      records.has_spf = false;
    }
    
    res.json({ domain, records });
  } catch (error) {
    console.error('Email deliverability DNS error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/unsubscribe/add - Add email to unsubscribe list (Redis)
router.post('/unsubscribe/add', async (req, res) => {
  try {
    const { email, campaign_id, reason } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1] || 'unknown';
    const key = `unsub:${domain}:${email}`;
    const value = JSON.stringify({
      email,
      campaign_id,
      reason,
      unsubscribed_at: new Date().toISOString()
    });
    
    await redisClient.set(key, value);
    await redisClient.expire(key, 86400 * 365); // 1 year expiry
    
    res.json({
      success: true,
      email,
      domain,
      campaign_id,
      reason,
      unsubscribed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email unsubscribe add error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/unsubscribe/check - Check if email is unsubscribed (Redis)
router.post('/unsubscribe/check', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1] || 'unknown';
    const key = `unsub:${domain}:${email}`;
    
    const value = await redisClient.get(key);
    
    if (value) {
      const data = JSON.parse(value);
      res.json({
        email,
        is_unsubscribed: true,
        unsubscribed_at: data.unsubscribed_at,
        campaign_id: data.campaign_id,
        reason: data.reason
      });
    } else {
      res.json({
        email,
        is_unsubscribed: false,
        unsubscribed_at: null
      });
    }
  } catch (error) {
    console.error('Email unsubscribe check error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/unsubscribe/remove - Remove email from unsubscribe list (Redis)
router.post('/unsubscribe/remove', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1] || 'unknown';
    const key = `unsub:${domain}:${email}`;
    
    await redisClient.del(key);
    
    res.json({
      success: true,
      email,
      domain,
      removed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email unsubscribe remove error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/validate/format - Validate email format
router.post('/validate/format', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(email);
    
    res.json({
      email,
      valid,
      reason: valid ? 'format_valid' : 'invalid_format'
    });
  } catch (error) {
    console.error('Email validate format error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/validate/domain - Validate email domain exists
router.post('/validate/domain', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1];
    if (!domain) {
      return res.json({ email, valid: false, reason: 'no_domain' });
    }
    
    try {
      await dns.resolve4(domain);
      res.json({ email, domain, valid: true });
    } catch (e) {
      res.json({ email, domain, valid: false, reason: 'domain_not_found' });
    }
  } catch (error) {
    console.error('Email validate domain error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/validate/mx - Validate email MX records
router.post('/validate/mx', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1];
    if (!domain) {
      return res.json({ email, valid: false, reason: 'no_domain' });
    }
    
    try {
      const mxRecords = await dns.resolveMx(domain);
      res.json({ email, domain, valid: true, mx_count: mxRecords.length });
    } catch (e) {
      res.json({ email, domain, valid: false, reason: 'no_mx_records' });
    }
  } catch (error) {
    console.error('Email validate MX error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/normalize - Normalize email address format
router.post('/normalize', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Lowercase and trim
    const normalized = email.toLowerCase().trim();
    
    // Remove dots for Gmail (if enabled)
    const domain = normalized.split('@')[1];
    let localPart = normalized.split('@')[0];
    
    if (domain === 'gmail.com') {
      localPart = localPart.replace(/\./g, '');
    }
    
    const finalEmail = `${localPart}@${domain}`;
    
    res.json({
      original: email,
      normalized: finalEmail,
      domain
    });
  } catch (error) {
    console.error('Email normalize error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/extract - Extract emails from text
router.post('/extract', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    
    // Deduplicate
    const uniqueEmails = [...new Set(emails)];
    
    res.json({
      text,
      emails: uniqueEmails,
      count: uniqueEmails.length
    });
  } catch (error) {
    console.error('Email extract error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/mask - Mask email for privacy
router.post('/mask', async (req, res) => {
  try {
    const { email, mask_char } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const char = mask_char || '*';
    const parts = email.split('@');
    const local = parts[0];
    const domain = parts[1];
    
    // Mask all but first 2 chars of local part
    const maskedLocal = local.substring(0, 2) + char.repeat(local.length - 2);
    
    res.json({
      original: email,
      masked: `${maskedLocal}@${domain}`
    });
  } catch (error) {
    console.error('Email mask error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/domain/extract - Extract domain from email
router.post('/domain/extract', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const domain = email.split('@')[1];
    
    if (!domain) {
      return res.status(400).json({ error: 'invalid_email_format' });
    }
    
    res.json({ email, domain });
  } catch (error) {
    console.error('Email domain extract error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/parse - Parse email components (MIME parser)
router.post('/parse', async (req, res) => {
  try {
    const { raw_mime } = req.body;
    
    if (!raw_mime) {
      return res.status(400).json({ error: 'raw_mime is required' });
    }
    
    // Parse MIME using mailparser
    const parsed = await simpleParser(raw_mime);
    
    res.json({
      headers: parsed.headers,
      subject: parsed.subject,
      from: parsed.from?.value,
      to: parsed.to?.value,
      cc: parsed.cc?.value,
      bcc: parsed.bcc?.value,
      text: parsed.text,
      html: parsed.html,
      attachments: parsed.attachments.map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size
      })),
      date: parsed.date,
      messageId: parsed.messageId
    });
  } catch (error) {
    console.error('Email parse error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/merge/variables - Extract merge variables from template
router.post('/merge/variables', async (req, res) => {
  try {
    const { template } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'template is required' });
    }
    
    // Extract {{variable}} patterns
    const varMatches = template.match(/{{([^}]+)}}/g) || [];
    const variables = varMatches.map(v => v.replace(/[{}]/g, ''));
    const uniqueVars = [...new Set(variables)];
    
    res.json({
      template,
      variables: uniqueVars,
      count: uniqueVars.length
    });
  } catch (error) {
    console.error('Email merge variables error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/preview - Preview email rendering
router.post('/preview', async (req, res) => {
  try {
    const { subject, body, html, variables } = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }
    
    const vars = variables || {};
    let renderedBody = body;
    let renderedSubject = subject || '';
    
    for (const [key, value] of Object.entries(vars)) {
      renderedBody = renderedBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
      renderedSubject = renderedSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    res.json({
      subject: renderedSubject,
      body: renderedBody,
      html: html || null,
      variables_used: vars
    });
  } catch (error) {
    console.error('Email preview error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/spam/score - Calculate spam score (rule-based)
router.post('/spam/score', async (req, res) => {
  try {
    const { subject, body, from_email, headers } = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }
    
    let score = 0;
    const issues = [];
    const checks = {};
    
    // Check 1: Spam trigger words
    const spamWords = ['free', 'winner', 'urgent', 'act now', 'limited time', 'click here', 'buy now', 'congratulations', 'you have won', 'million dollars'];
    const lowerBody = body.toLowerCase();
    const lowerSubject = (subject || '').toLowerCase();
    
    let spamWordCount = 0;
    spamWords.forEach(word => {
      if (lowerBody.includes(word) || lowerSubject.includes(word)) {
        spamWordCount++;
        score += 8;
        issues.push(`Contains spam word: ${word}`);
      }
    });
    checks.spam_words = spamWordCount;
    
    // Check 2: SPF header
    if (headers) {
      const spfHeader = headers['received-spf'] || headers['authentication-results'] || '';
      const hasSPF = spfHeader.toLowerCase().includes('pass');
      if (!hasSPF) {
        score += 15;
        issues.push('Missing or failed SPF');
      }
      checks.spf = hasSPF ? 'pass' : 'missing/fail';
    } else {
      checks.spf = 'not_checked';
    }
    
    // Check 3: DKIM header
    if (headers) {
      const dkimHeader = headers['dkim-signature'] || headers['authentication-results'] || '';
      const hasDKIM = dkimHeader.toLowerCase().includes('pass');
      if (!hasDKIM) {
        score += 10;
        issues.push('Missing or failed DKIM');
      }
      checks.dkim = hasDKIM ? 'pass' : 'missing/fail';
    } else {
      checks.dkim = 'not_checked';
    }
    
    // Check 4: Link density
    const urlRegex = /https?:\/\/[^\s<>"]+/g;
    const links = body.match(urlRegex) || [];
    const linkCount = links.length;
    const wordCount = body.split(/\s+/).length;
    const linkDensity = wordCount > 0 ? linkCount / wordCount : 0;
    if (linkDensity > 0.1) {
      score += 20;
      issues.push('High link density');
    }
    checks.link_density = linkDensity.toFixed(3);
    checks.link_count = linkCount;
    
    // Check 5: Caps ratio
    const capsRatio = (body.match(/[A-Z]/g) || []).length / body.length;
    if (capsRatio > 0.3) {
      score += 15;
      issues.push('Excessive capitalization');
    }
    checks.caps_ratio = capsRatio.toFixed(3);
    
    // Check 6: Excessive exclamation marks
    const exclamationCount = (body.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      score += 10;
      issues.push('Excessive exclamation marks');
    }
    checks.exclamation_count = exclamationCount;
    
    // Check 7: Missing unsubscribe link
    const hasUnsubscribe = body.toLowerCase().includes('unsubscribe') || 
                        body.toLowerCase().includes('opt-out') ||
                        (headers && headers['list-unsubscribe']);
    if (!hasUnsubscribe) {
      score += 10;
      issues.push('Missing unsubscribe link');
    }
    checks.has_unsubscribe = hasUnsubscribe;
    
    // Check 8: Subject length
    if (subject && subject.length > 50) {
      score += 5;
      issues.push('Subject line too long');
    }
    checks.subject_length = subject ? subject.length : 0;
    
    res.json({
      score: Math.min(score, 100),
      rating: score < 20 ? 'low' : score < 50 ? 'medium' : 'high',
      likely_spam: score > 50,
      issues,
      checks
    });
  } catch (error) {
    console.error('Email spam score error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /email/headers/validate - Validate email headers
router.post('/headers/validate', async (req, res) => {
  try {
    const { headers } = req.body;
    
    if (!headers) {
      return res.status(400).json({ error: 'headers is required' });
    }
    
    const issues = [];
    
    // Check required headers
    if (!headers['From']) {
      issues.push('Missing From header');
    }
    if (!headers['To'] && !headers['Cc'] && !headers['Bcc']) {
      issues.push('Missing recipient header (To, Cc, or Bcc)');
    }
    if (!headers['Subject']) {
      issues.push('Missing Subject header');
    }
    
    // Check header format
    if (headers['From'] && !headers['From'].includes('@')) {
      issues.push('Invalid From header format');
    }
    
    res.json({
      valid: issues.length === 0,
      issues,
      header_count: Object.keys(headers).length
    });
  } catch (error) {
    console.error('Email headers validate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/attachments/validate - Validate email attachments
router.post('/attachments/validate', async (req, res) => {
  try {
    const { attachments } = req.body;
    
    if (!Array.isArray(attachments)) {
      return res.status(400).json({ error: 'attachments must be an array' });
    }
    
    const issues = [];
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.js'];
    const maxSize = 25 * 1024 * 1024; // 25MB
    
    attachments.forEach((att, index) => {
      const ext = att.name.substring(att.name.lastIndexOf('.')).toLowerCase();
      
      if (dangerousExtensions.includes(ext)) {
        issues.push(`Attachment ${index + 1}: Dangerous file type ${ext}`);
      }
      
      if (att.size > maxSize) {
        issues.push(`Attachment ${index + 1}: Exceeds max size`);
      }
    });
    
    res.json({
      valid: issues.length === 0,
      issues,
      attachment_count: attachments.length,
      total_size: attachments.reduce((sum, att) => sum + (att.size || 0), 0)
    });
  } catch (error) {
    console.error('Email attachments validate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/reply-to/parse - Parse reply-to address
router.post('/reply-to/parse', async (req, res) => {
  try {
    const { header } = req.body;
    
    if (!header) {
      return res.status(400).json({ error: 'header is required' });
    }
    
    // Parse Reply-To header (format: "Name <email>" or just email)
    const emailMatch = header.match(/<([^>]+)>/) || header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : null;
    
    const nameMatch = header.match(/^"?(.+?)"?\s*</);
    const name = nameMatch ? nameMatch[1].replace(/"/g, '') : null;
    
    res.json({
      header,
      email,
      name,
      valid: email !== null
    });
  } catch (error) {
    console.error('Email reply-to parse error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/thread/detect - Detect email thread relationships
router.post('/thread/detect', async (req, res) => {
  try {
    const { subject, message_id, in_reply_to, references } = req.body;
    
    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }
    
    // Check for thread indicators
    const isReply = in_reply_to !== null && in_reply_to !== undefined;
    const hasReferences = Array.isArray(references) && references.length > 0;
    const subjectHasPrefix = /^(Re|Fwd|FW):\s*/i.test(subject);
    
    res.json({
      subject,
      is_thread: isReply || hasReferences || subjectHasPrefix,
      is_reply: isReply,
      is_forward: /^Fwd|FW:/i.test(subject),
      thread_depth: hasReferences ? references.length : 0,
      message_id,
      in_reply_to,
      references
    });
  } catch (error) {
    console.error('Email thread detect error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/signature/detect - Detect email signature block
router.post('/signature/detect', async (req, res) => {
  try {
    const { body } = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }
    
    const lines = body.split('\n');
    let signatureStart = -1;
    
    // Common signature indicators
    const signaturePatterns = [
      /^--$/,
      /^Best$/,
      /^Regards$/,
      /^Thanks$/,
      /^Sincerely$/,
      /^Sent from my/,
      /^Get Outlook/
    ];
    
    for (let i = 0; i < lines.length; i++) {
      if (signaturePatterns.some(pattern => pattern.test(lines[i]))) {
        signatureStart = i;
        break;
      }
    }
    
    const signature = signatureStart >= 0 ? lines.slice(signatureStart).join('\n') : null;
    
    res.json({
      has_signature: signature !== null,
      signature,
      signature_start_line: signatureStart >= 0 ? signatureStart : null
    });
  } catch (error) {
    console.error('Email signature detect error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/quoted-reply/detect - Detect quoted reply text
router.post('/quoted-reply/detect', async (req, res) => {
  try {
    const { body } = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }
    
    const lines = body.split('\n');
    let quotedStart = -1;
    
    // Common quoted reply patterns
    const quotedPatterns = [
      /^On .+ wrote:$/,
      /^-----Original Message-----$/,
      /^>/
    ];
    
    for (let i = 0; i < lines.length; i++) {
      if (quotedPatterns.some(pattern => pattern.test(lines[i]))) {
        quotedStart = i;
        break;
      }
    }
    
    const quotedText = quotedStart >= 0 ? lines.slice(quotedStart).join('\n') : null;
    
    res.json({
      has_quoted_reply: quotedText !== null,
      quoted_text: quotedText,
      quoted_start_line: quotedStart >= 0 ? quotedStart : null
    });
  } catch (error) {
    console.error('Email quoted reply detect error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/html/strip - Strip HTML from email body
router.post('/html/strip', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'html is required' });
    }
    
    // Simple HTML strip (in production, use a proper library)
    let text = html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    
    res.json({
      original_length: html.length,
      stripped_length: text.length,
      text
    });
  } catch (error) {
    console.error('Email HTML strip error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/plain-text/convert - Convert HTML to plain text
router.post('/plain-text/convert', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'html is required' });
    }
    
    // Simple HTML to text conversion (in production, use a proper library)
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    res.json({
      original_length: html.length,
      converted_length: text.length,
      text
    });
  } catch (error) {
    console.error('Email plain text convert error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /email/links/extract - Extract links from email body
router.post('/links/extract', async (req, res) => {
  try {
    const { body } = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }
    
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const links = body.match(urlRegex) || [];
    
    // Deduplicate
    const uniqueLinks = [...new Set(links)];
    
    // Categorize links
    const trackingDomains = ['click.', 'track.', 'open.', 'link.', 'utm_'];
    const trackingLinks = uniqueLinks.filter(link => 
      trackingDomains.some(domain => link.includes(domain))
    );
    
    res.json({
      links: uniqueLinks,
      count: uniqueLinks.length,
      tracking_links: trackingLinks,
      tracking_count: trackingLinks.length
    });
  } catch (error) {
    console.error('Email links extract error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
