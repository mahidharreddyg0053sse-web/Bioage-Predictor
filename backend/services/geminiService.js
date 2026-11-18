/**
 * BioAge Pro — Server-Side Gemini AI Service
 * Calls Google Generative Language API securely from the backend server
 * with multi-turn conversation support and automated model fallbacks.
 */

const API_KEY = process.env.GEMINI_API_KEY || '';
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Candidate models for automatic failover
const CANDIDATE_MODELS = Array.from(new Set([
  PRIMARY_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
])).filter(Boolean);

/**
 * Execute an API call to a specific Gemini model with timeout
 */
async function callGemini(payload, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error ? err.error.message : `HTTP ${res.status}`;
      const status = res.status;
      const error = new Error(`Model ${modelName} failed: ${msg}`);
      error.status = status;
      throw error;
    }

    const data = await res.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error(`Model ${modelName} returned an empty response.`);
    }

    const textPart = data.candidates[0].content.parts.find(p => typeof p.text === 'string');
    if (!textPart || !textPart.text) {
      throw new Error(`Model ${modelName} response did not contain text.`);
    }

    return textPart.text;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Execute Gemini call with automatic fallback across models
 */
async function executeWithModelFallback(payload) {
  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await callGemini(payload, model);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[GeminiService] ${model} attempt failed (${err.message}). Trying fallback...`);
    }
  }

  throw lastError || new Error('All candidate Gemini models failed.');
}

/**
 * Single-prompt content generation (e.g. for structured diagnosis JSON)
 */
async function generateContent(systemPrompt, userPrompt, jsonMode = false) {
  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: userPrompt }]
    }]
  };

  if (jsonMode) {
    payload.generationConfig = { responseMimeType: 'application/json' };
  }

  return await executeWithModelFallback(payload);
}

/**
 * Multi-turn conversational chat with history
 * @param {Object} options
 * @param {string} options.systemPrompt - Instructions and personality
 * @param {Array} options.history - Prior messages [{ role: 'user'|'model', text: string }]
 * @param {string} options.userMessage - Latest message from user
 * @param {boolean} [options.jsonMode=false]
 */
async function generateChat({ systemPrompt, history = [], userMessage, jsonMode = false }) {
  const contents = [];

  // Format valid history turns (user -> model)
  if (Array.isArray(history)) {
    // Keep max 12 turns to stay well within token limits and maintain latency
    const recentHistory = history.slice(-12);
    for (const msg of recentHistory) {
      if (!msg || !msg.text) continue;
      const role = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: String(msg.text).trim() }]
      });
    }
  }

  // Ensure conversation alternates correctly or begins with user
  // If contents has items and last item is user, do not add adjacent user without separating
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents.pop(); // remove dangling previous user prompt if any
  }

  // Append latest user message
  contents.push({
    role: 'user',
    parts: [{ text: String(userMessage).trim() }]
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 1000
    }
  };

  if (jsonMode) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  return await executeWithModelFallback(payload);
}

module.exports = {
  generateContent,
  generateChat
};
