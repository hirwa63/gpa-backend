require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');

const { errorHandler, notFound } = require('./middleware/error');

// ── Import all routes ─────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const studentRoutes  = require('./routes/studentsRoutes');
const marksRoutes    = require('./routes/marksRoutes');
const feesRoutes     = require('./routes/feesRoutes');
const newsRoutes     = require('./routes/newsRoutes');
const staffRoutes    = require('./routes/staffRoutes');
const commentsRoutes = require('./routes/commentsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// ── Create uploads folders if they don't exist ────────────
['uploads', 'uploads/news', 'uploads/staff', 'uploads/gallery'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Security Middleware ───────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Try again in 15 minutes.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Wait 15 minutes.' }
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Body Parser ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve uploaded files ──────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/students',  studentRoutes);
app.use('/api/marks',     marksRoutes);
app.use('/api/fees',      feesRoutes);
app.use('/api/news',      newsRoutes);
app.use('/api/staff',     staffRoutes);
app.use('/api/comments',  commentsRoutes);
app.use('/api/settings',  settingsRoutes);

// ── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: "God's Plan Academy API is running!",
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ── 404 & Error Handlers ──────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log("║   God's Plan Academy Backend Server        ║");
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  ✅ Server running on port ${PORT}             ║`);
  console.log(`║  🌍 Environment: ${process.env.NODE_ENV || 'development'}              ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;