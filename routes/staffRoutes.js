const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect, adminOrDirector, directorOnly } = require('../middleware/auth');

// ── GET /api/staff ── Director only sees full list ───────
router.get('/', protect, directorOnly, async (req, res) => {
  try {
    const { department, search } = req.query;
    let query = 'SELECT * FROM staff WHERE is_active = true';
    const params = [];
    let i = 1;

    if (department) { query += ` AND department = $${i++}`; params.push(department); }
    if (search) {
      query += ` AND (first_name ILIKE $${i} OR last_name ILIKE $${i} OR staff_id ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }
    query += ' ORDER BY role, last_name';

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, staff: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/staff ──────────────────────────────────────
router.post('/', protect, directorOnly, async (req, res) => {
  try {
    const { staff_id, first_name, last_name, role, department, phone, email } = req.body;

    if (!staff_id || !first_name || !last_name || !role) {
      return res.status(400).json({ success: false, message: 'staff_id, first_name, last_name and role are required.' });
    }

    const result = await pool.query(
      `INSERT INTO staff (staff_id, first_name, last_name, role, department, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [staff_id.toUpperCase(), first_name, last_name, role, department || null, phone || null, email || null]
    );

    res.status(201).json({ success: true, message: 'Staff member added!', staff: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Staff ID already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/staff/:id ───────────────────────────────────
router.put('/:id', protect, directorOnly, async (req, res) => {
  try {
    const { first_name, last_name, role, department, phone, email } = req.body;
    const result = await pool.query(
      `UPDATE staff SET
        first_name = COALESCE($1, first_name),
        last_name  = COALESCE($2, last_name),
        role       = COALESCE($3, role),
        department = COALESCE($4, department),
        phone      = COALESCE($5, phone),
        email      = COALESCE($6, email),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [first_name, last_name, role, department, phone, email, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Staff not found.' });
    res.json({ success: true, message: 'Staff updated!', staff: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/staff/:id ────────────────────────────────
router.delete('/:id', protect, directorOnly, async (req, res) => {
  try {
    await pool.query('UPDATE staff SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Staff member removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;