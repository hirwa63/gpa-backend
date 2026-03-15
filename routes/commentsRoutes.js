const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect, adminOrDirector } = require('../middleware/auth');

// ── POST /api/comments ── Anyone can send a message ──────
router.post('/', async (req, res) => {
  try {
    const { sender_name, sender_role, subject, message } = req.body;
    if (!sender_name || !message) {
      return res.status(400).json({ success: false, message: 'Name and message are required.' });
    }
    const result = await pool.query(
      `INSERT INTO comments (sender_name, sender_role, subject, message)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [sender_name, sender_role || 'parent', subject || null, message]
    );
    res.status(201).json({ success: true, message: 'Message sent to director!', comment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/comments ── Director/Admin only ─────────────
router.get('/', protect, adminOrDirector, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM comments ORDER BY created_at DESC');
    res.json({ success: true, count: result.rows.length, comments: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/comments/public ── Recent public messages ───
router.get('/public', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sender_name, sender_role, subject, message, created_at
       FROM comments ORDER BY created_at DESC LIMIT 10`
    );
    res.json({ success: true, comments: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/comments/:id/read ─────────────────────────
router.patch('/:id/read', protect, adminOrDirector, async (req, res) => {
  try {
    await pool.query('UPDATE comments SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;