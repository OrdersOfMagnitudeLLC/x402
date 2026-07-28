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

// POST /nlp/text/classify - Classify text into categories
router.post('/text/classify', async (req, res) => {
  try {
    const { text, categories } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text classifier. Classify the text into the most appropriate category. Return only valid JSON with this structure:
{
  "category": "primary category",
  "confidence": 0 to 1,
  "alternative_categories": ["category 1", "category 2"]
}`;

    const userMessage = `Text: ${text}\nAvailable categories: ${categories || 'news, opinion, technical, casual, formal'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/entities - Extract named entities from text
router.post('/text/entities', async (req, res) => {
  try {
    const { text, entity_types } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a named entity recognizer. Extract entities from the text. Return only valid JSON with this structure:
{
  "entities": [
    {"text": "entity text", "type": "PERSON|ORG|LOC|DATE|NUMBER", "start": position, "end": position}
  ]
}`;

    const userMessage = `Text: ${text}\nEntity types: ${entity_types || 'all'}`;
    const result = await callHaiku(systemPrompt, userMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/keywords - Extract keywords from text
router.post('/text/keywords', async (req, res) => {
  try {
    const { text, count } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a keyword extractor. Extract the most important keywords from the text. Return only valid JSON with this structure:
{
  "keywords": ["keyword 1", "keyword 2", ...],
  "phrases": ["phrase 1", "phrase 2"]
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nCount: ${count || 10}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/summarize - Summarize text
router.post('/text/summarize', async (req, res) => {
  try {
    const { text, length } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text summarizer. Summarize the text. Return only valid JSON with this structure:
{
  "summary": "summarized text",
  "key_points": ["point 1", "point 2"],
  "original_length": original word count,
  "summary_length": summary word count
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nLength: ${length || 'medium'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/sentiment/analyze - Analyze sentiment of text
router.post('/sentiment/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a sentiment analyzer. Analyze the sentiment of the text. Return only valid JSON with this structure:
{
  "sentiment": "positive/negative/neutral",
  "score": -1 to 1,
  "confidence": 0 to 1,
  "reasoning": "brief explanation"
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/sentiment/emotion - Detect emotions in text
router.post('/sentiment/emotion', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are an emotion detector. Detect emotions in the text. Return only valid JSON with this structure:
{
  "primary_emotion": "joy/sadness/anger/fear/surprise/disgust/neutral",
  "emotions": [{"emotion": "type", "intensity": 0 to 1}],
  "confidence": 0 to 1
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/language/detect - Detect language of text
router.post('/language/detect', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a language detector. Detect the language of the text. Return only valid JSON with this structure:
{
  "language": "language name",
  "language_code": "ISO code",
  "confidence": 0 to 1
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/translate - Translate text
router.post('/text/translate', async (req, res) => {
  try {
    const { text, target_language } = req.body;
    if (!text || !target_language) {
      return res.status(400).json({ error: 'text and target_language are required' });
    }

    const systemPrompt = `You are a translator. Translate the text to the target language. Return only valid JSON with this structure:
{
  "original": "original text",
  "translated": "translated text",
  "target_language": "language name",
  "confidence": 0 to 1
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nTarget language: ${target_language}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/paraphrase - Paraphrase text
router.post('/text/paraphrase', async (req, res) => {
  try {
    const { text, style } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a paraphraser. Paraphrase the text while maintaining meaning. Return only valid JSON with this structure:
{
  "original": "original text",
  "paraphrased": "paraphrased text",
  "style": "detected style",
  "variations": ["variation 1", "variation 2"]
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nStyle: ${style || 'neutral'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/expand - Expand text with more detail
router.post('/text/expand', async (req, res) => {
  try {
    const { text, detail_level } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text expander. Expand the text with more detail. Return only valid JSON with this structure:
{
  "original": "original text",
  "expanded": "expanded text",
  "added_points": ["point 1", "point 2"],
  "expansion_ratio": "ratio"
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nDetail level: ${detail_level || 'medium'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/simplify - Simplify complex text
router.post('/text/simplify', async (req, res) => {
  try {
    const { text, target_audience } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a text simplifier. Simplify complex text. Return only valid JSON with this structure:
{
  "original": "original text",
  "simplified": "simplified text",
  "complexity_reduction": "percentage",
  "target_audience": "audience level"
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nTarget audience: ${target_audience || 'general'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/rewrite-tone - Rewrite text with different tone
router.post('/text/rewrite-tone', async (req, res) => {
  try {
    const { text, target_tone } = req.body;
    if (!text || !target_tone) {
      return res.status(400).json({ error: 'text and target_tone are required' });
    }

    const systemPrompt = `You are a tone rewriter. Rewrite the text with the target tone. Return only valid JSON with this structure:
{
  "original": "original text",
  "rewritten": "rewritten text",
  "target_tone": "target tone",
  "tone_match": "how well it matches"
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nTarget tone: ${target_tone}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/quotes - Extract quotes from text
router.post('/text/quotes', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a quote extractor. Extract quotes from the text. Return only valid JSON with this structure:
{
  "quotes": [
    {"quote": "quote text", "speaker": "speaker or null", "context": "context"}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/numbers - Extract numbers from text
router.post('/text/numbers', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a number extractor. Extract numbers from the text. Return only valid JSON with this structure:
{
  "numbers": [
    {"value": number, "text": "original text", "type": "integer/float/percentage/currency"}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/dates - Extract dates from text
router.post('/text/dates', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a date extractor. Extract dates from the text. Return only valid JSON with this structure:
{
  "dates": [
    {"text": "original text", "iso_format": "ISO date", "format": "date format"}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/emails - Extract emails from text
router.post('/text/emails', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are an email extractor. Extract email addresses from the text. Return only valid JSON with this structure:
{
  "emails": ["email1@example.com", "email2@example.com"],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/urls - Extract URLs from text
router.post('/text/urls', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a URL extractor. Extract URLs from the text. Return only valid JSON with this structure:
{
  "urls": ["https://example.com", "https://example.org"],
  "count": number,
  "domains": ["example.com", "example.org"]
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/phone - Extract phone numbers from text
router.post('/text/phone', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a phone number extractor. Extract phone numbers from the text. Return only valid JSON with this structure:
{
  "phone_numbers": [
    {"original": "original text", "normalized": "normalized format", "country": "country code or null"}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/addresses - Extract addresses from text
router.post('/text/addresses', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are an address extractor. Extract addresses from the text. Return only valid JSON with this structure:
{
  "addresses": [
    {"original": "original text", "street": "street", "city": "city", "state": "state", "zip": "zip", "country": "country"}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/pii-detect - Detect PII in text
router.post('/text/pii-detect', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a PII detector. Detect personally identifiable information in the text. Return only valid JSON with this structure:
{
  "has_pii": boolean,
  "pii_types": ["SSN", "email", "phone", "address", "credit_card"],
  "locations": [{"type": "type", "text": "text", "start": position, "end": position}],
  "risk_level": "low/medium/high"
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/pii-mask - Mask PII in text
router.post('/text/pii-mask', async (req, res) => {
  try {
    const { text, mask_char } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a PII masker. Mask personally identifiable information in the text. Return only valid JSON with this structure:
{
  "original": "original text",
  "masked": "masked text",
  "mask_char": "character used",
  "masked_count": number,
  "pii_types_masked": ["type 1", "type 2"]
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nMask character: ${mask_char || '*'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/similarity - Compare text similarity
router.post('/text/similarity', async (req, res) => {
  try {
    const { text1, text2 } = req.body;
    if (!text1 || !text2) {
      return res.status(400).json({ error: 'text1 and text2 are required' });
    }

    const systemPrompt = `You are a text similarity analyzer. Compare the similarity of two texts. Return only valid JSON with this structure:
{
  "similarity_score": 0 to 1,
  "similarity_level": "low/medium/high",
  "shared_keywords": ["keyword 1", "keyword 2"],
  "differences": ["difference 1", "difference 2"]
}`;

    const result = await callHaiku(systemPrompt, `Text 1: ${text1}\nText 2: ${text2}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/duplicate - Detect duplicate content
router.post('/text/duplicate', async (req, res) => {
  try {
    const { texts } = req.body;
    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts must be an array' });
    }

    const systemPrompt = `You are a duplicate content detector. Detect duplicate content in the provided texts. Return only valid JSON with this structure:
{
  "duplicates": [
    {"index1": number, "index2": number, "similarity": 0 to 1}
  ],
  "unique_count": number,
  "duplicate_count": number
}`;

    const result = await callHaiku(systemPrompt, `Texts:\n${texts.map((t, i) => `${i}: ${t}`).join('\n')}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/generate-questions - Generate questions from text
router.post('/text/generate-questions', async (req, res) => {
  try {
    const { text, count } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a question generator. Generate questions from the text. Return only valid JSON with this structure:
{
  "questions": [
    {"question": "question text", "answer": "answer from text", "type": "factual/inference"}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nCount: ${count || 5}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/answer-question - Answer question from context
router.post('/text/answer-question', async (req, res) => {
  try {
    const { context, question } = req.body;
    if (!context || !question) {
      return res.status(400).json({ error: 'context and question are required' });
    }

    const systemPrompt = `You are a QA system. Answer the question based on the context. Return only valid JSON with this structure:
{
  "question": "question",
  "answer": "answer",
  "confidence": 0 to 1,
  "source_text": "relevant excerpt from context"
}`;

    const result = await callHaiku(systemPrompt, `Context: ${context}\nQuestion: ${question}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/topics - Extract topics from text
router.post('/text/topics', async (req, res) => {
  try {
    const { text, count } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a topic extractor. Extract topics from the text. Return only valid JSON with this structure:
{
  "topics": [
    {"topic": "topic name", "relevance": 0 to 1, "keywords": ["keyword 1", "keyword 2"]}
  ],
  "primary_topic": "main topic"
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nCount: ${count || 5}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/cluster - Cluster similar texts
router.post('/text/cluster', async (req, res) => {
  try {
    const { texts, cluster_count } = req.body;
    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts must be an array' });
    }

    const systemPrompt = `You are a text clustering system. Cluster similar texts together. Return only valid JSON with this structure:
{
  "clusters": [
    {"cluster_id": number, "texts": [index1, index2, ...], "theme": "cluster theme"}
  ],
  "cluster_count": number
}`;

    const result = await callHaiku(systemPrompt, `Texts:\n${texts.map((t, i) => `${i}: ${t}`).join('\n')}\nCluster count: ${cluster_count || 3}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/tokenize - Tokenize text into words/sentences
router.post('/text/tokenize', async (req, res) => {
  try {
    const { text, level } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a tokenizer. Tokenize the text. Return only valid JSON with this structure:
{
  "tokens": ["token1", "token2", ...],
  "level": "word/sentence",
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}\nLevel: ${level || 'word'}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/pos-tag - Part-of-speech tagging
router.post('/text/pos-tag', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a POS tagger. Tag parts of speech in the text. Return only valid JSON with this structure:
{
  "tags": [
    {"word": "word", "pos": "NOUN/VERB/ADJ/ADV/etc", "position": number}
  ],
  "count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/dependency - Dependency parsing
router.post('/text/dependency', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a dependency parser. Parse grammatical dependencies in the text. Return only valid JSON with this structure:
{
  "dependencies": [
    {"word": "word", "head": "head word", "relation": "dependency relation"}
  ],
  "sentence_count": number
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nlp/text/coreference - Resolve coreferences
router.post('/text/coreference', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const systemPrompt = `You are a coreference resolver. Resolve pronouns and references to their entities. Return only valid JSON with this structure:
{
  "resolutions": [
    {"pronoun": "pronoun", "entity": "referred entity", "position": number}
  ],
  "entities": ["entity 1", "entity 2"]
}`;

    const result = await callHaiku(systemPrompt, `Text: ${text}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
