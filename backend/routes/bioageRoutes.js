const express = require('express');
const router = express.Router();
const calcService = require('../services/calculatorService');
const db = require('../database/db');

// POST /api/bioage/calculate
router.post('/calculate', (req, res) => {
  try {
    const formData = req.body;
    const result = calcService.evaluateBiologicalAge(formData);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/bioage/history
router.post('/history', async (req, res) => {
  try {
    const record = await db.saveAssessment(req.body);
    return res.json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/bioage/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const history = await db.getAssessmentsByUserId(req.params.userId);
    return res.json({ success: true, history });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
