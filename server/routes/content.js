const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to call Anthropic Haiku
async function callHaiku(systemPrompt, userMessage) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = message.content[0].text;
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
    const clean = content.replace(/```json|```/g, '').trim();

    return {
      result: clean,
      model: 'claude-haiku-4-5-20251001',
      tokens_used: tokensUsed,
    };
  } catch (error) {
    throw new Error(`Anthropic API error: ${error.message}`);
  }
}

// POST /content/headline/generate - Generate headline from topic
router.post('/headline/generate', async (req, res) => {
  try {
    const { topic, tone } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const systemPrompt = `You are a headline writer. Generate 3 compelling headlines for the given topic. Return only valid JSON with this structure:
{
  "headlines": ["headline 1", "headline 2", "headline 3"]
}`;

    const userMessage = `Topic: ${topic}\nTone: ${tone || 'professional'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/headline/generate-ab - Generate A/B test headline variants
router.post('/headline/generate-ab', async (req, res) => {
  try {
    const { topic, variants } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const count = variants || 5;
    const systemPrompt = `You are a headline writer for A/B testing. Generate ${count} distinct headline variants for the given topic. Return only valid JSON with this structure:
{
  "variants": ["variant 1", "variant 2", ...]
}`;

    const result = await callHaiku(systemPrompt, `Topic: ${topic}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/headline/optimize-seo - Optimize headline for SEO
router.post('/headline/optimize-seo', async (req, res) => {
  try {
    const { headline, keywords } = req.body;
    if (!headline) {
      return res.status(400).json({ error: 'headline is required' });
    }

    const systemPrompt = `You are an SEO expert. Optimize the given headline for search engines. Return only valid JSON with this structure:
{
  "optimized_headline": "SEO-optimized headline",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "keyword_placement": "analysis of keyword usage"
}`;

    const userMessage = `Headline: ${headline}\nKeywords: ${keywords || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/summarize - Summarize text to key points
router.post('/summarize', async (req, res) => {
  try {
    const { text, length } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text summarizer. Summarize the given text to key points. Return only valid JSON with this structure:
{
  "summary": "2-3 sentence summary",
  "key_points": ["point 1", "point 2", "point 3"],
  "word_count": original word count
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nTarget length: ${length || 'medium'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/summarize/bullet - Summarize text to bullet points
router.post('/summarize/bullet', async (req, res) => {
  try {
    const { text, max_bullets } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text summarizer. Summarize the given text to bullet points. Return only valid JSON with this structure:
{
  "bullets": ["bullet 1", "bullet 2", ...],
  "count": number of bullets
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nMax bullets: ${max_bullets || 5}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/summarize/paragraph - Summarize text to single paragraph
router.post('/summarize/paragraph', async (req, res) => {
  try {
    const { text, max_sentences } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text summarizer. Summarize the given text to a single paragraph. Return only valid JSON with this structure:
{
  "paragraph": "single paragraph summary",
  "sentence_count": number of sentences
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nMax sentences: ${max_sentences || 3}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/email/cold-draft - Draft cold email from prospect info
router.post('/email/cold-draft', async (req, res) => {
  try {
    const { prospect_name, company, value_prop, tone } = req.body;
    if (!prospect_name || !company) {
      return res.status(400).json({ error: 'prospect_name and company are required' });
    }

    const systemPrompt = `You are a cold email writer. Draft a personalized cold email. Return only valid JSON with this structure:
{
  "subject": "email subject line",
  "body": "email body content",
  "call_to_action": "specific CTA"
}`;

    const userMessage = `Prospect: ${prospect_name}\nCompany: ${company}\nValue proposition: ${value_prop || 'not specified'}\nTone: ${tone || 'professional'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/email/followup - Draft follow-up email
router.post('/email/followup', async (req, res) => {
  try {
    const { context, previous_email, tone } = req.body;
    if (!context) {
      return res.status(400).json({ error: 'context is required' });
    }

    const systemPrompt = `You are a follow-up email writer. Draft a follow-up email. Return only valid JSON with this structure:
{
  "subject": "follow-up subject line",
  "body": "follow-up email body",
  "timing_suggestion": "when to send"
}`;

    const userMessage = `Context: ${context}\nPrevious email: ${previous_email || 'not specified'}\nTone: ${tone || 'professional'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/email/subject - Generate cold email subject lines
router.post('/email/subject', async (req, res) => {
  try {
    const { context, count } = req.body;
    if (!context) {
      return res.status(400).json({ error: 'context is required' });
    }

    const systemPrompt = `You are an email subject line writer. Generate compelling subject lines. Return only valid JSON with this structure:
{
  "subjects": ["subject 1", "subject 2", ...]
}`;

    const result = await callHaiku(systemPrompt, `Context: ${context}\nCount: ${count || 5}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/seo/meta-title - Generate SEO meta title
router.post('/seo/meta-title', async (req, res) => {
  try {
    const { content, keywords } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are an SEO specialist. Generate an SEO-optimized meta title (50-60 characters). Return only valid JSON with this structure:
{
  "meta_title": "optimized meta title",
  "character_count": number,
  "includes_keywords": boolean
}`;

    const userMessage = `Content: ${content}\nKeywords: ${keywords || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/seo/meta-description - Generate SEO meta description
router.post('/seo/meta-description', async (req, res) => {
  try {
    const { content, keywords } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are an SEO specialist. Generate an SEO-optimized meta description (150-160 characters). Return only valid JSON with this structure:
{
  "meta_description": "optimized meta description",
  "character_count": number,
  "call_to_action": "included CTA or null"
}`;

    const userMessage = `Content: ${content}\nKeywords: ${keywords || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/seo/keywords - Extract SEO keywords from content
router.post('/seo/keywords', async (req, res) => {
  try {
    const { content, count } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are an SEO specialist. Extract relevant SEO keywords from content. Return only valid JSON with this structure:
{
  "primary_keywords": ["keyword 1", "keyword 2"],
  "secondary_keywords": ["keyword 1", "keyword 2"],
  "long_tail_keywords": ["phrase 1", "phrase 2"]
}`;

    const result = await callHaiku(systemPrompt, `Content: ${content}\nCount: ${count || 'auto'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/social/twitter - Generate Twitter/X post
router.post('/social/twitter', async (req, res) => {
  try {
    const { content, hashtags, tone } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are a social media writer for Twitter/X. Generate a tweet (280 chars max). Return only valid JSON with this structure:
{
  "tweet": "tweet content",
  "character_count": number,
  "hashtags": ["hashtag 1", "hashtag 2"]
}`;

    const userMessage = `Content: ${content}\nInclude hashtags: ${hashtags ? 'yes' : 'no'}\nTone: ${tone || 'engaging'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/social/linkedin - Generate LinkedIn post
router.post('/social/linkedin', async (req, res) => {
  try {
    const { content, tone } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are a social media writer for LinkedIn. Generate a professional LinkedIn post. Return only valid JSON with this structure:
{
  "post": "LinkedIn post content",
  "hashtags": ["hashtag 1", "hashtag 2"],
  "call_to_action": "CTA or null"
}`;

    const result = await callHaiku(systemPrompt, `Content: ${content}\nTone: ${tone || 'professional'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/social/facebook - Generate Facebook post
router.post('/social/facebook', async (req, res) => {
  try {
    const { content, tone } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are a social media writer for Facebook. Generate an engaging Facebook post. Return only valid JSON with this structure:
{
  "post": "Facebook post content",
  "hashtags": ["hashtag 1", "hashtag 2"],
  "emoji_suggestions": ["emoji 1", "emoji 2"]
}`;

    const result = await callHaiku(systemPrompt, `Content: ${content}\nTone: ${tone || 'engaging'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/social/instagram - Generate Instagram caption
router.post('/social/instagram', async (req, res) => {
  try {
    const { content, hashtags } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are a social media writer for Instagram. Generate an engaging Instagram caption. Return only valid JSON with this structure:
{
  "caption": "Instagram caption",
  "hashtags": ["hashtag 1", "hashtag 2", ...],
  "first_comment": "suggested first comment"
}`;

    const userMessage = `Content: ${content}\nInclude hashtags: ${hashtags ? 'yes' : 'no'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/social/tiktok - Generate TikTok caption
router.post('/social/tiktok', async (req, res) => {
  try {
    const { content, tone } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are a social media writer for TikTok. Generate a trending TikTok caption. Return only valid JSON with this structure:
{
  "caption": "TikTok caption",
  "hashtags": ["hashtag 1", "hashtag 2"],
  "trend_alert": "relevant trend or null"
}`;

    const result = await callHaiku(systemPrompt, `Content: ${content}\nTone: ${tone || 'trending'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/blog/outline - Generate blog post outline
router.post('/blog/outline', async (req, res) => {
  try {
    const { topic, sections } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const systemPrompt = `You are a blog content strategist. Generate a blog post outline. Return only valid JSON with this structure:
{
  "title": "blog post title",
  "introduction": "intro focus",
  "sections": [
    {"heading": "section 1", "points": ["point 1", "point 2"]},
    ...
  ],
  "conclusion": "conclusion focus"
}`;

    const result = await callHaiku(systemPrompt, `Topic: ${topic}\nSections: ${sections || 'auto'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/blog/section - Generate blog post section content
router.post('/blog/section', async (req, res) => {
  try {
    const { heading, context, word_count } = req.body;
    if (!heading) {
      return res.status(400).json({ error: 'heading is required' });
    }

    const systemPrompt = `You are a blog content writer. Write a blog post section. Return only valid JSON with this structure:
{
  "content": "section content",
  "word_count": number,
  "subheadings": ["subheading 1", "subheading 2"]
}`;

    const userMessage = `Heading: ${heading}\nContext: ${context || 'not specified'}\nTarget word count: ${word_count || 300}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/product/description - Generate product description
router.post('/product/description', async (req, res) => {
  try {
    const { product_name, features, target_audience } = req.body;
    if (!product_name) {
      return res.status(400).json({ error: 'product_name is required' });
    }

    const systemPrompt = `You are a product copywriter. Write a compelling product description. Return only valid JSON with this structure:
{
  "short_description": "1-2 sentence description",
  "long_description": "detailed description",
  "key_benefits": ["benefit 1", "benefit 2"],
  "call_to_action": "CTA suggestion"
}`;

    const userMessage = `Product: ${product_name}\nFeatures: ${features || 'not specified'}\nTarget audience: ${target_audience || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/ad/headline - Generate ad copy headline
router.post('/ad/headline', async (req, res) => {
  try {
    const { product, offer, tone } = req.body;
    if (!product) {
      return res.status(400).json({ error: 'product is required' });
    }

    const systemPrompt = `You are an ad copywriter. Generate compelling ad headlines. Return only valid JSON with this structure:
{
  "headlines": ["headline 1", "headline 2", "headline 3"],
  "best_performer": "recommended headline"
}`;

    const userMessage = `Product: ${product}\nOffer: ${offer || 'not specified'}\nTone: ${tone || 'persuasive'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/ad/body - Generate ad copy body text
router.post('/ad/body', async (req, res) => {
  try {
    const { headline, product, benefits } = req.body;
    if (!headline) {
      return res.status(400).json({ error: 'headline is required' });
    }

    const systemPrompt = `You are an ad copywriter. Write ad body copy. Return only valid JSON with this structure:
{
  "body": "ad body content",
  "call_to_action": "CTA",
  "urgency_element": "urgency or null"
}`;

    const userMessage = `Headline: ${headline}\nProduct: ${product || 'not specified'}\nBenefits: ${benefits || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/press-release - Generate press release
router.post('/press-release', async (req, res) => {
  try {
    const { company, news, date } = req.body;
    if (!company || !news) {
      return res.status(400).json({ error: 'company and news are required' });
    }

    const systemPrompt = `You are a PR professional. Write a press release. Return only valid JSON with this structure:
{
  "headline": "press release headline",
  "dateline": "location, date",
  "body": "press release body",
  "boilerplate": "company boilerplate",
  "media_contact": "contact info placeholder"
}`;

    const userMessage = `Company: ${company}\nNews: ${news}\nDate: ${date || 'immediate release'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/newsletter/subject - Generate newsletter subject line
router.post('/newsletter/subject', async (req, res) => {
  try {
    const { content, count } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const systemPrompt = `You are an email marketing writer. Generate newsletter subject lines. Return only valid JSON with this structure:
{
  "subjects": ["subject 1", "subject 2", ...],
  "highest_open_rate_prediction": "predicted best performer"
}`;

    const result = await callHaiku(systemPrompt, `Content: ${content}\nCount: ${count || 5}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/newsletter/body - Generate newsletter body content
router.post('/newsletter/body', async (req, res) => {
  try {
    const { topic, sections, tone } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const systemPrompt = `You are an email marketing writer. Write newsletter body content. Return only valid JSON with this structure:
{
  "preview_text": "preview text",
  "greeting": "greeting",
  "main_content": "main content",
  "sections": [{"title": "section title", "content": "section content"}],
  "sign_off": "sign off",
  "call_to_action": "CTA"
}`;

    const userMessage = `Topic: ${topic}\nSections: ${sections || 'auto'}\nTone: ${tone || 'engaging'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
