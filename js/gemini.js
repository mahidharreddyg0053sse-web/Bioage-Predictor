/**
 * BioAge Pro — Biopro AI Assistant & Clinical Engine Client
 * Bridges Frontend UI with Node.js Express Backend REST API and Google Gemini API.
 * Features multi-turn conversational memory and intelligent health heuristics.
 */

import { evaluateBiologicalAge } from './calculator.js';

const STORAGE_KEY_API_KEY = 'bioage_gemini_api_key';
const DEFAULT_API_KEY = '';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const BACKEND_BASE = typeof window !== 'undefined' ? window.location.origin : '';

class GeminiService {
  constructor() {
    this._apiKey = DEFAULT_API_KEY;
    this.chatHistory = [];
    this.initKey();
  }

  initKey() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_API_KEY);
      if (saved) {
        this._apiKey = saved;
      }
    } catch (e) {}
  }

  get apiKey() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_API_KEY);
      if (saved) return saved;
    } catch (e) {}
    return this._apiKey || DEFAULT_API_KEY;
  }

  setApiKey(key) {
    if (!key) return;
    this._apiKey = key.trim();
    try {
      localStorage.setItem(STORAGE_KEY_API_KEY, this._apiKey);
    } catch (e) {}
  }

  /**
   * Reset conversation memory
   */
  clearChatHistory() {
    this.chatHistory = [];
  }

  /**
   * Get active conversation memory
   */
  getChatHistory() {
    return [...this.chatHistory];
  }

  /**
   * Record a turn into memory (keeps last 16 messages / 8 turns)
   */
  _recordTurn(userText, modelText) {
    if (userText) {
      this.chatHistory.push({ role: 'user', text: userText });
    }
    if (modelText) {
      this.chatHistory.push({ role: 'model', text: modelText });
    }
    if (this.chatHistory.length > 16) {
      this.chatHistory = this.chatHistory.slice(-16);
    }
  }

  /**
   * Ask Biopro AI Consultant with multi-turn context
   */
  async askConsultant(question, assessmentData = {}, currentEvaluation = null) {
    const q = (question || '').trim();
    if (!q) return "Please ask a question to get started!";

    // 1. Try Backend REST API first (supports multi-turn history)
    try {
      const res = await fetch(`${BACKEND_BASE}/api/gemini/biopro-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          history: this.chatHistory,
          patientContext: { ...(assessmentData || {}), ...(currentEvaluation || {}) },
          userId: (window.auth && window.auth.getCurrentSession()) ? window.auth.getCurrentSession().id : null
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.answer) {
          this._recordTurn(q, data.answer);
          return data.answer;
        }
      }
    } catch (err) {
      console.warn('Backend Biopro API failed, attempting direct Gemini client...', err);
    }

    // 2. Direct client-side Gemini fallback
    try {
      const direct = await this.directGeminiChat(q, assessmentData, currentEvaluation);
      if (direct) {
        this._recordTurn(q, direct);
        return direct;
      }
    } catch (err) {
      console.warn('Direct Gemini API failed, using clinical heuristic assistant...', err);
    }

    // 3. Smart Clinical Heuristic Fallback
    const heuristic = this.generateHeuristicAnswer(q, assessmentData, currentEvaluation, this.chatHistory);
    this._recordTurn(q, heuristic);
    return heuristic;
  }

  /**
   * Run full Gemini longevity diagnosis
   */
  async analyzeLongevity(assessmentData = {}) {
    // 1. Try Backend REST API first
    try {
      const res = await fetch(`${BACKEND_BASE}/api/gemini/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentData)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.analysis) {
          return data.analysis;
        }
      }
    } catch (err) {
      console.warn('Backend diagnose failed, attempting direct Gemini client...', err);
    }

    // 2. Direct Gemini fallback
    try {
      const directAnalysis = await this.directGeminiDiagnose(assessmentData);
      if (directAnalysis) return directAnalysis;
    } catch (err) {
      console.warn('Direct Gemini diagnosis failed, falling back to geroscience calculator...', err);
    }

    // 3. Fallback to algorithmic clinical calculation
    return this.generateAlgorithmicAnalysis(assessmentData);
  }

  /**
   * Direct client-side Gemini call with multi-turn support
   */
  async directGeminiChat(question, assessmentData, currentEvaluation) {
    const key = this.apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${key}`;

    const systemPrompt = `You are "BioAge AI", an elite AI Longevity Geroscientist and Health Assistant built into the BioAge Pro platform.
PATIENT CONTEXT: ${JSON.stringify({ ...(assessmentData || {}), ...(currentEvaluation || {}) })}

RULES:
1. GREETINGS: If user says hi, hello, hey, etc., greet them warmly and ask how you can help their health journey today without giving a long lecture.
2. CONTEXT: Answer user questions directly, intelligently, and conversationally based on previous messages.
3. ADVICE: Provide evidence-based longevity, sleep, diet, and exercise guidance with clean markdown bullets and bold text.`;

    const contents = [];
    if (Array.isArray(this.chatHistory)) {
      for (const m of this.chatHistory.slice(-10)) {
        contents.push({
          role: (m.role === 'model' || m.role === 'assistant') ? 'model' : 'user',
          parts: [{ text: m.text }]
        });
      }
    }
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents.pop();
    }
    contents.push({
      role: 'user',
      parts: [{ text: question }]
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 900
        }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  async directGeminiDiagnose(assessmentData) {
    const key = this.apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${key}`;

    const systemPrompt = `You are an elite clinical geroscientist, physician, and longevity researcher.
Analyze the patient's lifestyle, sleep, vitals, and nutrition telemetry.
Calculate biological age, life expectancy, organ-specific ages, and actionable medical interventions.
Respond STRICTLY with valid JSON following this schema:
{
  "biologicalAge": number,
  "projectedLifeExpectancy": number,
  "remainingYears": number,
  "paceOfAging": number,
  "paceCategory": string,
  "organAges": {
    "cardiovascular": number,
    "metabolic": number,
    "cellular": number,
    "cognitive": number
  },
  "domainScores": {
    "cardiovascular": number,
    "nutrition": number,
    "sleep": number,
    "physicalFitness": number,
    "mentalResilience": number
  },
  "aiClinicalSummary": string,
  "aiLongevityRisks": string[],
  "aiTopInterventions": [
    {
      "title": string,
      "category": string,
      "priority": "CRITICAL" | "HIGH" | "MEDIUM",
      "difficulty": "Easy" | "Medium" | "High",
      "lifeGainYears": number,
      "bioAgeReductionYears": number,
      "description": string,
      "mechanism": string
    }
  ]
}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(assessmentData) }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = data.candidates[0].content.parts[0].text;
    return JSON.parse(raw);
  }

  generateAlgorithmicAnalysis(assessmentData) {
    const calc = evaluateBiologicalAge(assessmentData);
    const risks = [];
    if (calc.bmi >= 28) risks.push(`Elevated BMI (${calc.bmi}) contributing to systemic metabolic strain`);
    if (calc.ageDifference > 0) risks.push(`Biological age accelerated by +${calc.ageDifference} years over calendar baseline`);
    if (assessmentData.smokingStatus && assessmentData.smokingStatus !== 'never') risks.push('Active pulmonary oxidative and endothelial microvascular degradation');
    if (assessmentData.sleepDuration === 'severe_deficit' || assessmentData.sleepDuration === 'mild_deficit') risks.push('Suboptimal slow-wave glymphatic cellular repair window');
    if (risks.length === 0) risks.push('Maintaining steady metabolic baseline; focus on VO2 max longevity targets');

    return {
      biologicalAge: calc.biologicalAge,
      projectedLifeExpectancy: calc.projectedLifeExpectancy,
      remainingYears: calc.remainingYears,
      paceOfAging: calc.paceOfAging,
      paceCategory: calc.paceCategory,
      organAges: calc.organAges,
      domainScores: calc.domainScores,
      aiClinicalSummary: `Comprehensive phenotypic evaluation indicates a baseline biological age of ${calc.biologicalAge} years against a calendar age of ${calc.chronologicalAge}. Your cardiovascular markers and metabolic rate show a pace of aging of ${calc.paceOfAging}x/year. Target interventions can yield up to +${calc.maxReversibleYears} years in reversible biological vitality.`,
      aiLongevityRisks: risks,
      aiTopInterventions: (calc.improvements || []).map(imp => ({
        title: imp.title,
        category: imp.category,
        priority: imp.priority || 'HIGH',
        difficulty: imp.difficulty || 'Medium',
        lifeGainYears: Math.abs(imp.lifeGain || 2.0),
        bioAgeReductionYears: Math.abs(imp.bioAgeGain || 1.5),
        description: imp.description,
        mechanism: imp.mechanism
      }))
    };
  }

  /**
   * Conversational & intelligent fallback responses
   */
  generateHeuristicAnswer(question, assessmentData = {}, currentEvaluation = null, history = []) {
    const raw = (question || '').trim();
    const q = raw.toLowerCase();
    const age = assessmentData.chronologicalAge || 35;
    const bioAge = (currentEvaluation && currentEvaluation.biologicalAge) || age;

    // 1. Natural Greetings (e.g. "hi", "hello", "hey", "good morning")
    if (/^(hi|hello|hey|heya|howdy|sup|yo|good morning|good afternoon|good evening|greetings)\b/i.test(q)) {
      return `Hello! 👋 I'm your **BioAge AI Assistant**.\n\nHow can I help you today? You can ask me anything about:\n• Your **biological age** vs. calendar age\n• How to optimize your **sleep & deep recovery**\n• Best **nutrition & intermittent fasting** protocols\n• **Zone 2 cardio & strength workouts** for longevity\n• Daily habits to add vibrant, healthy years to your life!\n\nWhat would you like to explore?`;
    }

    // 2. Gratitude & Closing
    if (/\b(thank you|thanks|thx|appreciate it|bye|goodbye|cya)\b/i.test(q)) {
      return `You're very welcome! 😊 Whenever you have questions about your health, biological markers, or longevity habits, I'm here to help. Wishing you great energy and vibrant health! 🌟`;
    }

    // 3. Identity / Capabilities
    if (/\b(who are you|what are you|what can you do|help me with)\b/i.test(q)) {
      return `I am **BioAge AI (Biopro)**, your clinical gerontology and healthspan assistant.\n\nI combine scientific geroscience research (cellular autophagy, mitochondrial biogenesis, telomere integrity, and vascular health) with your biological telemetry to provide actionable advice on reversing biological aging and maximizing your healthspan.`;
    }

    // 4. Biological Age Concepts
    if (/\b(what is biological age|how does biological age work|difference between|bio age vs)\b/i.test(q)) {
      return `**Biological age** reflects the true functional condition of your cells, tissues, and cardiovascular system, whereas **chronological age** is simply how many birthdays you've celebrated.\n\nWhen you improve your sleep, nutrition, and exercise, your pace of aging slows down, allowing your biological age to evaluate significantly younger than your calendar age!`;
    }

    // 5. How to lower/reduce biological age
    if (/\b(lower|reduce|drop|decrease|improve|reverse)\b.*\b(age|biological|years)\b/i.test(q) || /\bhow to (live longer|extend lifespan|anti-aging)\b/i.test(q)) {
      return `To measurably reduce biological age and add active healthspan:\n\n1. **Zone 2 Aerobic Conditioning:** 150 minutes weekly at conversational pace builds mitochondrial density and elevates VO2 max (+3.5 yrs projected lifespan).\n2. **Consistent Circadian Sleep Hygiene:** 7.5–8 hours nightly ensures glymphatic brain detox and DNA repair (+2.2 yrs).\n3. **Whole-Food Polyphenol Nutrition:** Eliminate ultra-processed foods and refined sugars to stop cellular glycation and systemic inflammation (+2.8 yrs).\n4. **Progressive Strength Training:** 2–3 sessions weekly preserves lean muscle and maintains insulin sensitivity (+2.0 yrs).`;
    }

    // 6. Sleep questions
    if (/\b(sleep|insomnia|bedtime|deep sleep|rem|circadian|tired|fatigue|5 hours|6 hours)\b/i.test(q)) {
      return `Sleep is your body's primary cellular maintenance window:\n\n• **Glymphatic Waste Clearance:** Deep slow-wave sleep flushes out neurotoxic waste and metabolic byproducts from brain tissue.\n• **Cortisol & Insulin Reset:** Short sleep (<6 hours) spikes cortisol, accelerates vascular stiffness, and increases hunger hormones.\n• **Clinical Optimization Tip:** Aim for 7–8 hours in a cool (65–68°F), pitch-black room. Stop screen use 45 minutes before sleep to stimulate natural melatonin secretion.`;
    }

    // 7. Diet, Nutrition & Fasting
    if (/\b(diet|food|eat|fasting|nutrition|sugar|protein|keto|mediterranean|calories)\b/i.test(q)) {
      return `Nutrition directly drives cellular longevity pathways:\n\n• **Polyphenols & Fiber:** Dark leafy greens, wild berries, extra virgin olive oil, and nuts feed beneficial gut microbes and activate SIRT1 longevity genes.\n• **Avoid Sugar & Ultra-Processed Items:** High glycemic foods generate Advanced Glycation End-products (AGEs) that stiffen blood vessels.\n• **Time-Restricted Eating:** An overnight 12-to-16 hour fasting window triggers **autophagy**, where cells recycle damaged proteins.`;
    }

    // 8. Exercise, Workouts & Fitness
    if (/\b(exercise|workout|gym|running|cardio|lift|weights|zone 2|vo2|fitness)\b/i.test(q)) {
      return `The gold-standard longevity exercise prescription combines:\n\n1. **Zone 2 Cardio (75% of cardio volume):** Brisk walking, cycling, or jogging at a pace where you can still speak in full sentences. Drives cellular mitochondrial efficiency.\n2. **Resistance / Hypertrophy Training (2-3x/week):** Compound lifts (squats, rows, lunges) prevent age-related sarcopenia and bone density loss.\n3. **High-Intensity Interval Training (HIIT 1x/week):** 4-6 minutes of peak exertion raises VO2 max, one of the single greatest biomarkers of long life.`;
    }

    // 9. Blood Pressure & Heart Health
    if (/\b(blood pressure|heart|cardio|hypertension|pulse|bpm|cholesterol|artery)\b/i.test(q)) {
      return `Cardiovascular elasticity is a fundamental marker of biological youth:\n\n• **Optimal Blood Pressure Target:** Aim for ~115–120 / 75–80 mmHg. Lowering elevated systolic pressure by 10 mmHg dramatically reduces microvascular wear and dementia risk.\n• **Endothelial Health:** Daily physical movement, dietary nitrates (spinach, beets), and managing stress boost nitric oxide, keeping arteries supple.`;
    }

    // 10. Default contextual response
    return `Based on your profile (Calendar Age: ${age}, Biological Assessment: ~${bioAge} yrs), focusing on **daily Zone 2 aerobic activity**, **7.5–8 hours of quality sleep**, and a **nutrient-dense whole food diet** will yield the highest return in reversing biological aging.\n\nFeel free to ask a specific question about your sleep, diet, workouts, or how to tackle any specific biomarker!`;
  }
}

export const geminiService = new GeminiService();
export default geminiService;

if (typeof window !== 'undefined') {
  window.geminiService = geminiService;
  window.BioAgeAI = geminiService;
}
