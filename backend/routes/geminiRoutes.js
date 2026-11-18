const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const db = require('../database/db');

// POST /api/gemini/diagnose
router.post('/diagnose', async (req, res) => {
  try {
    const patientData = req.body;
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

    const raw = await geminiService.generateContent(systemPrompt, 'Patient Data: ' + JSON.stringify(patientData), true);
    const parsed = JSON.parse(raw);
    return res.json({ success: true, analysis: parsed });
  } catch (err) {
    console.error('Gemini diagnose error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/gemini/biopro-chat
router.post('/biopro-chat', async (req, res) => {
  try {
    const { question, history = [], patientContext = {}, userId } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question cannot be empty.' });
    }

    // Prepare patient telemetry overview for the model
    let patientTelemetrySnippet = 'None recorded yet (General user).';
    if (patientContext && Object.keys(patientContext).length > 0) {
      const parts = [];
      if (patientContext.chronologicalAge) parts.push(`Calendar Age: ${patientContext.chronologicalAge}`);
      if (patientContext.biologicalAge) parts.push(`Biological Age: ${patientContext.biologicalAge}`);
      if (patientContext.bmi) parts.push(`BMI: ${patientContext.bmi}`);
      if (patientContext.bloodPressureSystolic) parts.push(`Blood Pressure: ${patientContext.bloodPressureSystolic}/${patientContext.bloodPressureDiastolic || 80} mmHg`);
      if (patientContext.restingHeartRate) parts.push(`Resting HR: ${patientContext.restingHeartRate} bpm`);
      if (patientContext.sleepDuration) parts.push(`Sleep Category: ${patientContext.sleepDuration}`);
      if (patientContext.exerciseFrequency) parts.push(`Exercise: ${patientContext.exerciseFrequency}`);
      if (patientContext.smokingStatus) parts.push(`Smoking: ${patientContext.smokingStatus}`);
      if (patientContext.dietType) parts.push(`Diet: ${patientContext.dietType}`);

      if (parts.length > 0) {
        patientTelemetrySnippet = parts.join(', ');
      }
    }

    const systemPrompt = `You are "BioAge AI" (also known as Biopro), an intelligent, friendly, and knowledgeable AI Longevity Geroscientist and Health Assistant built into the BioAge Pro platform.

PATIENT TELEMETRY CONTEXT:
${patientTelemetrySnippet}

YOUR CONVERSATIONAL INSTRUCTIONS:
1. GREETINGS & CASUAL INTERACTION:
   - When the user sends a greeting (such as "hi", "hello", "hey", "good morning", "yo", etc.), respond warmly, concisely, and naturally (e.g. "Hello! 👋 I'm your BioAge AI Assistant. How can I help you today? You can ask me anything about your biological age, sleep, diet, heart health, or longevity!").
   - DO NOT dump unrequested multi-paragraph clinical lectures when the user is just saying hello.

2. ANSWERING QUESTIONS & CONTINUING DIALOGUE:
   - When the user asks a question, answer that exact question directly, clearly, and thoughtfully.
   - Maintain multi-turn context: If the user asks follow-up questions (such as "how do I improve that?", "why is that bad?", "what should I eat instead?"), seamlessly connect your answer to the previous dialogue.
   - If the user asks about biological age, longevity, biomarkers, sleep, nutrition, exercise, or health risks, provide doctor-level, evidence-based insights with practical, actionable steps.
   - If the patient has recorded telemetry above, reference it naturally to personalize the advice. If telemetry is not yet entered, provide general best-practice science and invite them to test their biological age with the app's assessment.

3. TONE & FORMATTING:
   - Warm, encouraging, empathetic, and scientifically authoritative.
   - Use clean markdown formatting (bolding key terms, bullet points for lists, short digestible paragraphs) so it's easy and engaging to read on screen.`;

    const response = await geminiService.generateChat({
      systemPrompt,
      history,
      userMessage: question
    });

    if (userId) {
      try {
        db.logChat(userId, question, response);
      } catch (logErr) {
        console.warn('Chat logging error:', logErr.message);
      }
    }

    return res.json({ success: true, answer: response });
  } catch (err) {
    console.error('Biopro chat error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
