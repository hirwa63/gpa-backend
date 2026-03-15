const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool    = require('../config/db');
const { protect } = require('../middleware/auth');

// Helper: generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// ── POST /api/auth/register ──────────────────────────────
router.post('/register', [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['parent','teacher','admin','director','student']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { first_name, last_name, email, phone, username, password, role, language } = req.body;

    // Check if email or username already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email or username already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Save user
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, username, password_hash, role, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, first_name, last_name, email, role, language`,
      [first_name, last_name, email, phone || null, username, password_hash, role || 'parent', language || 'en']
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, language: user.language }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────
router.post('/login', [
  body('login').trim().notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { login, password } = req.body;

    // Find user by email or username
    const result = await pool.query(
      'SELECT * FROM users WHERE (email = $1 OR username = $1) AND is_active = true',
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        language: user.language
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── POST /api/auth/forgot-password ──────────────────────
router.post('/forgot-password', [
  body('login').trim().notEmpty().withMessage('Email or phone is required')
], async (req, res) => {
  try {
    const { login } = req.body;

    const result = await pool.query(
      'SELECT id, email, first_name FROM users WHERE email = $1 OR phone = $1',
      [login]
    );

    // Always return success (security best practice - don't reveal if email exists)
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }

    const user = result.rows[0];
    // Generate a simple reset code (in production, email this)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store reset code (expires in 15 minutes)
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [await bcrypt.hash(resetCode, 10), user.id]
    );

    // In production: send email with resetCode
    console.log(`🔑 Reset code for ${user.email}: ${resetCode}`);

    res.json({
      success: true,
      message: 'Reset code sent to your email.',
      // Remove this in production:
      debug_code: process.env.NODE_ENV === 'development' ? resetCode : undefined
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/auth/change-password ────────────────────────
router.put('/change-password', protect, [
  body('old_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { old_password, new_password } = req.body;

    // Get current password
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    // Verify old password
    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully!' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;