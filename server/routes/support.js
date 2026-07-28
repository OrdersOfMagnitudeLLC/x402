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

// POST /support/ticket/classify - Classify support ticket by category
router.post('/ticket/classify', async (req, res) => {
  try {
    const { ticket_content, categories } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are a support ticket classifier. Classify the ticket into the most appropriate category. Return only valid JSON with this structure:
{
  "category": "primary category",
  "confidence": 0 to 1,
  "alternative_categories": ["category 1", "category 2"]
}`;

    const userMessage = `Ticket content: ${ticket_content}\nAvailable categories: ${categories || 'billing, technical, account, feature request, bug report'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/ticket/priority - Score ticket priority level
router.post('/ticket/priority', async (req, res) => {
  try {
    const { ticket_content, severity_indicators } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are a support priority scorer. Score the ticket priority based on urgency and impact. Return only valid JSON with this structure:
{
  "priority": "critical/high/medium/low",
  "score": 1 to 10,
  "reasoning": "brief explanation",
  "suggested_sla": "hours or null"
}`;

    const userMessage = `Ticket content: ${ticket_content}\nSeverity indicators: ${severity_indicators || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/response/draft - Draft suggested response
router.post('/response/draft', async (req, res) => {
  try {
    const { ticket_content, customer_tone, context } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are a customer support agent. Draft a helpful, professional response to the customer. Return only valid JSON with this structure:
{
  "response": "drafted response",
  "tone": "detected tone",
  "call_to_action": "next step or null",
  "needs_escalation": boolean
}`;

    const userMessage = `Ticket content: ${ticket_content}\nCustomer tone: ${customer_tone || 'neutral'}\nContext: ${context || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/response/refine - Refine response for tone
router.post('/response/refine', async (req, res) => {
  try {
    const { response, target_tone } = req.body;
    if (!response) {
      return res.status(400).json({ error: 'response is required' });
    }

    const systemPrompt = `You are a communication expert. Refine the response to match the target tone. Return only valid JSON with this structure:
{
  "refined_response": "refined response",
  "tone_match": "how well it matches",
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

    const userMessage = `Original response: ${response}\nTarget tone: ${target_tone || 'professional'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/faq/match - Match ticket to FAQ
router.post('/faq/match', async (req, res) => {
  try {
    const { ticket_content, faq_database } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are a FAQ matcher. Find the most relevant FAQ entry for the ticket. Return only valid JSON with this structure:
{
  "matched_faq": "FAQ content or null",
  "confidence": 0 to 1,
  "alternative_matches": ["FAQ 1", "FAQ 2"],
  "suggestion": "how to use the FAQ"
}`;

    const userMessage = `Ticket content: ${ticket_content}\nFAQ database: ${faq_database || 'not provided'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/faq/generate - Generate FAQ from knowledge
router.post('/faq/generate', async (req, res) => {
  try {
    const { knowledge_base, topic } = req.body;
    if (!knowledge_base) {
      return res.status(400).json({ error: 'knowledge_base is required' });
    }

    const systemPrompt = `You are a knowledge base expert. Generate FAQ entries from the provided knowledge. Return only valid JSON with this structure:
{
  "faqs": [
    {"question": "question 1", "answer": "answer 1"},
    {"question": "question 2", "answer": "answer 2"}
  ]
}`;

    const userMessage = `Knowledge base: ${knowledge_base}\nTopic focus: ${topic || 'general'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/escalation/recommend - Recommend escalation path
router.post('/escalation/recommend', async (req, res) => {
  try {
    const { ticket_content, current_level, available_levels } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are an escalation specialist. Recommend whether and how to escalate the ticket. Return only valid JSON with this structure:
{
  "should_escalate": boolean,
  "recommended_level": "level or null",
  "reasoning": "explanation",
  "urgency": "immediate/soon/scheduled"
}`;

    const userMessage = `Ticket content: ${ticket_content}\nCurrent level: ${current_level || 'tier 1'}\nAvailable levels: ${available_levels || 'tier 2, tier 3, management'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/sentiment/detect - Detect customer sentiment
router.post('/sentiment/detect', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const systemPrompt = `You are a sentiment analyzer. Detect the customer's sentiment from their message. Return only valid JSON with this structure:
{
  "sentiment": "positive/neutral/negative/angry/frustrated",
  "confidence": 0 to 1,
  "emotional_indicators": ["indicator 1", "indicator 2"],
  "recommended_approach": "how to respond"
}`;

    const userMessage = `Message: ${message}\nContext: ${context || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/intent/detect - Detect customer intent
router.post('/intent/detect', async (req, res) => {
  try {
    const { message, possible_intents } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const systemPrompt = `You are an intent classifier. Detect the customer's primary intent. Return only valid JSON with this structure:
{
  "primary_intent": "main intent",
  "confidence": 0 to 1,
  "secondary_intents": ["intent 1", "intent 2"],
  "entities": {"entity_type": "value"}
}`;

    const userMessage = `Message: ${message}\nPossible intents: ${possible_intents || 'inquiry, complaint, request, cancellation'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/solution/suggest - Suggest solution based on issue
router.post('/solution/suggest', async (req, res) => {
  try {
    const { issue_description, product_context } = req.body;
    if (!issue_description) {
      return res.status(400).json({ error: 'issue_description is required' });
    }

    const systemPrompt = `You are a technical support specialist. Suggest solutions for the reported issue. Return only valid JSON with this structure:
{
  "solutions": [
    {"step": "step 1", "description": "description"},
    {"step": "step 2", "description": "description"}
  ],
  "likely_root_cause": "root cause analysis",
  "estimated_complexity": "low/medium/high"
}`;

    const userMessage = `Issue: ${issue_description}\nProduct context: ${product_context || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/knowledge/extract - Extract knowledge from ticket
router.post('/knowledge/extract', async (req, res) => {
  try {
    const { ticket_content, resolution } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are a knowledge extractor. Extract reusable knowledge from the ticket and resolution. Return only valid JSON with this structure:
{
  "problem": "summarized problem",
  "solution": "summarized solution",
  "keywords": ["keyword 1", "keyword 2"],
  "applicable_scenarios": ["scenario 1", "scenario 2"]
}`;

    const userMessage = `Ticket content: ${ticket_content}\nResolution: ${resolution || 'not provided'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/ticket/summarize - Summarize ticket thread
router.post('/ticket/summarize', async (req, res) => {
  try {
    const { thread_content, max_length } = req.body;
    if (!thread_content) {
      return res.status(400).json({ error: 'thread_content is required' });
    }

    const systemPrompt = `You are a ticket summarizer. Summarize the support ticket thread. Return only valid JSON with this structure:
{
  "summary": "concise summary",
  "key_issues": ["issue 1", "issue 2"],
  "current_status": "status",
  "next_steps": ["step 1", "step 2"],
  "original_request": "customer's original request"
}`;

    const result = await callHaiku(systemPrompt, `Thread: ${thread_content}\nMax length: ${max_length || 'medium'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/agent/assist - Provide real-time agent assistance
router.post('/agent/assist', async (req, res) => {
  try {
    const { current_conversation, agent_question } = req.body;
    if (!current_conversation) {
      return res.status(400).json({ error: 'current_conversation is required' });
    }

    const systemPrompt = `You are an AI assistant for support agents. Provide helpful guidance. Return only valid JSON with this structure:
{
  "suggestion": "helpful suggestion",
  "relevant_resources": ["resource 1", "resource 2"],
  "potential_responses": ["response 1", "response 2"],
  "warning": "potential issue or null"
}`;

    const userMessage = `Conversation: ${current_conversation}\nAgent question: ${agent_question || 'general assistance'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/resolution/predict - Predict resolution time
router.post('/resolution/predict', async (req, res) => {
  try {
    const { ticket_content, category, priority } = req.body;
    if (!ticket_content) {
      return res.status(400).json({ error: 'ticket_content is required' });
    }

    const systemPrompt = `You are a resolution time predictor. Estimate how long the ticket will take to resolve. Return only valid JSON with this structure:
{
  "estimated_hours": number,
  "confidence": 0 to 1,
  "factors": ["factor 1", "factor 2"],
  "complexity_level": "low/medium/high"
}`;

    const userMessage = `Ticket: ${ticket_content}\nCategory: ${category || 'not specified'}\nPriority: ${priority || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /support/customer/profile - Generate customer profile from history
router.post('/customer/profile', async (req, res) => {
  try {
    const { interaction_history, account_info } = req.body;
    if (!interaction_history) {
      return res.status(400).json({ error: 'interaction_history is required' });
    }

    const systemPrompt = `You are a customer profiling expert. Generate a customer profile from interaction history. Return only valid JSON with this structure:
{
  "customer_tier": "bronze/silver/gold/platinum",
  "communication_preference": "email/chat/phone",
  "common_issues": ["issue 1", "issue 2"],
  "satisfaction_trend": "improving/stable/declining",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    const userMessage = `Interaction history: ${interaction_history}\nAccount info: ${account_info || 'not specified'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
