const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const multer  = require('multer');
const path    = require('path');
const { protect, adminOrDirector } = require('../middleware/auth');

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/news/'),
  filename:    (req, file, cb) => cb(null, `news_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed!'), false);
  }
});

// ── GET /api/news ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, limit } = req.query;
    let query = `SELECT n.*, u.first_name || ' ' || u.last_name AS posted_by_name
                 FROM news n LEFT JOIN users u ON n.published_by = u.id
                 WHERE n.is_published = true`;
    const params = [];
    let i = 1;

    if (category) { query += ` AND n.category = $${i++}`; params.push(category); }
    query += ' ORDER BY n.created_at DESC';
    if (limit)    { query += ` LIMIT $${i++}`;             params.push(parseInt(limit)); }

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, news: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/news ───────────────────────────────────────
router.post('/', protect, adminOrDirector, upload.single('image'), async (req, res) => {
  try {
    const { title, body, category, emoji } = req.body;

    if (!title || !body || !category) {
      return res.status(400).json({ success: false, message: 'Title, body and category are required.' });
    }

    const image_url = req.file ? `/uploads/news/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO news (title, body, category, emoji, image_url, published_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, body, category, emoji || null, image_url, req.user.id]
    );

    res.status(201).json({ success: true, message: 'News published!', news: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/news/:id ────────────────────────────────────
router.put('/:id', protect, adminOrDirector, async (req, res) => {
  try {
    const { title, body, category, emoji, is_published } = req.body;
    const result = await pool.query(
      `UPDATE news SET
        title=$1, body=$2, category=$3, emoji=$4,
        is_published=COALESCE($5, is_published), updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [title, body, category, emoji, is_published, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'News not found.' });
    res.json({ success: true, message: 'News updated!', news: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/news/:id ─────────────────────────────────
router.delete('/:id', protect, adminOrDirector, async (req, res) => {
  try {
    await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'News deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;