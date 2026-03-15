const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect, adminOrDirector } = require('../middleware/auth');

// ── GET /api/settings ── Public school info ──────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT setting_key, setting_value FROM settings ORDER BY setting_key');
    // Convert array to key-value object
    const settings = {};
    result.rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/settings ── Admin/Director updates settings ──
router.put('/', protect, adminOrDirector, async (req, res) => {
  try {
    const updates = req.body; // { key: value, key: value, ... }
    const keys = Object.keys(updates);

    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: 'No settings provided.' });
    }

    // Update each setting
    for (const key of keys) {
      await pool.query(
        `INSERT INTO settings (setting_key, setting_value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (setting_key) DO UPDATE
         SET setting_value=$2, updated_by=$3, updated_at=NOW()`,
        [key, updates[key], req.user.id]
      );
    }

    res.json({ success: true, message: `${keys.length} setting(s) updated successfully!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/settings/admissions ── All applications ─────
router.get('/admissions', protect, adminOrDirector, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admissions ORDER BY created_at DESC');
    res.json({ success: true, count: result.rows.length, admissions: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/settings/admissions ── Public admission form
router.post('/admissions', async (req, res) => {
  try {
    const { parent_name, parent_phone, parent_email, child_name, child_age, class_applying } = req.body;
    if (!parent_name || !parent_phone || !child_name || !class_applying) {
      return res.status(400).json({ success: false, message: 'Parent name, phone, child name and class are required.' });
    }
    const result = await pool.query(
      `INSERT INTO admissions (parent_name, parent_phone, parent_email, child_name, child_age, class_applying)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [parent_name, parent_phone, parent_email || null, child_name, child_age || null, class_applying]
    );
    res.status(201).json({
      success: true,
      message: `Thank you ${parent_name}! Your application for ${child_name} has been received. We will contact you at ${parent_phone} within 24 hours.`,
      admission: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;