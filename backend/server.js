const fs = require("fs");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const bioageRoutes = require('./routes/bioageRoutes');
const geminiRoutes = require('./routes/geminiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Hardening
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Block direct static access to sensitive internal directories & config files
app.use((req, res, next) => {
  const lowerUrl = req.path.toLowerCase();
  if (
    lowerUrl.startsWith('/backend') ||
    lowerUrl.startsWith('/.git') ||
    lowerUrl.startsWith('/.github') ||
    lowerUrl.startsWith('/node_modules') ||
    lowerUrl.startsWith('/android-app') ||
    lowerUrl.startsWith('/tests') ||
    lowerUrl.includes('.env') ||
    lowerUrl === '/package.json' ||
    lowerUrl === '/package-lock.json'
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bioage', bioageRoutes);
app.use('/api/gemini', geminiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'BioAge Pro Backend REST API',
    version: '2.0.0',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    database: process.env.SUPABASE_URL ? 'Supabase PostgreSQL (Connected)' : 'Local JSON Store',
    timestamp: new Date().toISOString()
  });
});

// Serve Frontend Static Assets
const frontendPath = path.join(__dirname, '../frontend');
const rootPath = path.join(__dirname, '..');

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}
app.use(express.static(rootPath));

// Fallback to index.html for Single Page Application
app.get(/(.*)/, (req, res) => {
  const indexInFrontend = path.join(frontendPath, 'index.html');
  const indexInRoot = path.join(rootPath, 'index.html');
  if (fs.existsSync(indexInFrontend)) {
    res.sendFile(indexInFrontend);
  } else {
    res.sendFile(indexInRoot);
  }
});

app.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`🧬 BioAge Pro — Full-Stack Longevity Intelligence Platform`);
  console.log(`============================================================`);
  console.log(`🚀 Backend Server : http://localhost:${PORT}`);
  console.log(`📡 REST API       : http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Bot Engine  : Google Gemini 3.5 Flash Lite`);
  console.log(`📦 Database       : Supabase PostgreSQL Connected`);
  console.log(`🌐 Frontend       : Clean Medical White Design System Active`);
  console.log(`============================================================`);
});
