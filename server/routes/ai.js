const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to call Anthropic API
async function callAnthropic(model, systemPrompt, userMessage) {
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = message.content[0].text;
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
    const clean = content.replace(/```json|```/g, '').trim();

    return {
      result: JSON.parse(clean),
      model,
      tokens_used: tokensUsed,
    };
  } catch (error) {
    throw new Error(`Anthropic API error: ${error.message}`);
  }
}

// Cat 5 Routes (AI lite - claude-haiku-4-5-20251001)

// cat5_001: News synthesis
router.post('/news-synthesis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a news synthesizer. Return only valid JSON with this structure:
{
  "summary": "2-3 sentence summary",
  "key_points": ["point 1", "point 2", "point 3"],
  "sentiment": "positive/negative/neutral",
  "topics": ["topic 1", "topic 2"]
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_002: Sentiment analysis
router.post('/sentiment-analysis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a sentiment analyzer. Return only valid JSON with this structure:
{
  "score": -1 to 1,
  "label": "positive/negative/neutral",
  "reasoning": "one sentence",
  "confidence": 0 to 1
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_003: Financial ratio interpretation
router.post('/financial-ratio-interpretation', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a financial analyst. Return only valid JSON with this structure:
{
  "interpretation": "plain English explanation",
  "context": "industry context",
  "comparison": "benchmark comparison",
  "trend": "trend analysis"
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_004: Job description analysis
router.post('/job-description-analysis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a job description analyzer. Return only valid JSON with this structure:
{
  "skills": ["skill 1", "skill 2"],
  "salary_range": "estimated range",
  "experience_level": "entry/mid/senior",
  "role_type": "full-time/contract/etc"
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_005: Product review synthesis
router.post('/product-review-synthesis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a product review synthesizer. Return only valid JSON with this structure:
{
  "verdict": "overall verdict",
  "pros": ["pro 1", "pro 2"],
  "cons": ["con 1", "con 2"],
  "key_themes": ["theme 1", "theme 2"]
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_006: Regulatory filing summary
router.post('/regulatory-filing-summary', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a regulatory filing summarizer. Return only valid JSON with this structure:
{
  "summary": "2-3 sentence summary",
  "key_disclosures": ["disclosure 1", "disclosure 2"],
  "material_events": ["event 1", "event 2"],
  "impact": "impact assessment"
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_007: Clinical abstract summary
router.post('/clinical-abstract-summary', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a clinical abstract summarizer. Return only valid JSON with this structure:
{
  "key_findings": "main findings",
  "methodology": "study methodology",
  "conclusions": "study conclusions",
  "significance": "clinical significance"
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_008: Email tone analysis
router.post('/email-tone-analysis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are an email tone analyzer. Return only valid JSON with this structure:
{
  "tone": "formal/casual/urgent/etc",
  "formality": "high/medium/low",
  "emotion": "emotion detected",
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_009: Social post sentiment batch
router.post('/social-post-sentiment-batch', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a social media sentiment analyzer. Return only valid JSON with this structure:
{
  "posts": [{"text": "post text", "sentiment": "pos/neg/neu", "score": -1 to 1}],
  "overall_sentiment": "positive/negative/neutral",
  "trends": ["trend 1", "trend 2"]
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat5_010: Company description standardizer
router.post('/company-description-standardizer', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a company description standardizer. Return only valid JSON with this structure:
{
  "standardized_description": "standardized description",
  "industry": "industry name",
  "size": "startup/sme/enterprise",
  "focus_areas": ["area 1", "area 2"]
}`;

    const result = await callAnthropic('claude-haiku-4-5-20251001', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cat 4 Routes (AI premium - claude-sonnet-4-6)

// cat4_001: Contract risk analysis
router.post('/contract-risk-analysis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a contract risk analyzer. Return only valid JSON with this structure:
{
  "risk_score": 0 to 100,
  "risk_flags": ["flag 1", "flag 2"],
  "key_clauses": ["clause 1", "clause 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_002: Earnings call intelligence
router.post('/earnings-call-intelligence', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are an earnings call analyzer. Return only valid JSON with this structure:
{
  "sentiment": "positive/negative/neutral",
  "key_topics": ["topic 1", "topic 2"],
  "financial_signals": ["signal 1", "signal 2"],
  "outlook": "forward outlook"
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_003: Market pattern analysis
router.post('/market-pattern-analysis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a market pattern analyzer. Return only valid JSON with this structure:
{
  "regime": "bull/bear/sideways",
  "signals": ["signal 1", "signal 2"],
  "confidence": 0 to 1,
  "pattern_type": "pattern description"
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_004: Company research brief
router.post('/company-research-brief', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a company research analyst. Return only valid JSON with this structure:
{
  "overview": "company overview",
  "financials": "financial summary",
  "competitive_position": "market position",
  "risks": ["risk 1", "risk 2"]
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_005: Regulatory risk score
router.post('/regulatory-risk-score', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a regulatory risk analyzer. Return only valid JSON with this structure:
{
  "risk_score": 0 to 100,
  "regulatory_areas": ["area 1", "area 2"],
  "compliance_status": "compliant/non-compliant/partial",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_006: Competitive intelligence synthesis
router.post('/competitive-intelligence-synthesis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a competitive intelligence analyst. Return only valid JSON with this structure:
{
  "competitors": ["competitor 1", "competitor 2"],
  "market_position": "position description",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"]
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_007: Due diligence summary
router.post('/due-diligence-summary', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a due diligence analyst. Return only valid JSON with this structure:
{
  "summary": "overall summary",
  "red_flags": ["flag 1", "flag 2"],
  "key_findings": ["finding 1", "finding 2"],
  "recommendation": "go/no-go/caution"
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_008: Supply chain risk assessment
router.post('/supply-chain-risk-assessment', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a supply chain risk analyst. Return only valid JSON with this structure:
{
  "risk_score": 0 to 100,
  "risk_factors": ["factor 1", "factor 2"],
  "geographic_risks": ["risk 1", "risk 2"],
  "mitigation_strategies": ["strategy 1", "strategy 2"]
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_009: Patent claim analysis
router.post('/patent-claim-analysis', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are a patent claim analyzer. Return only valid JSON with this structure:
{
  "patentability": "high/medium/low",
  "prior_art_flags": ["flag 1", "flag 2"],
  "claim_strength": "strong/medium/weak",
  "infringement_risk": "high/medium/low"
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// cat4_010: M&A signal detection
router.post('/ma-signal-detection', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const systemPrompt = `You are an M&A signal detector. Return only valid JSON with this structure:
{
  "signals": ["signal 1", "signal 2"],
  "probability": 0 to 1,
  "target_companies": ["company 1", "company 2"],
  "rationale": "explanation"
}`;

    const result = await callAnthropic('claude-sonnet-4-6', systemPrompt, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
