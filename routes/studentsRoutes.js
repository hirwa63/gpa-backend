const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect, adminOrDirector, staffOnly } = require('../middleware/auth');

// ── GET /api/students ────────────────────────────────────
// Admin + Director only — full list
router.get('/', protect, adminOrDirector, async (req, res) => {
  try {
    const { class: cls, fee_status, search } = req.query;
    let query = 'SELECT * FROM students WHERE is_active = true';
    const params = [];
    let i = 1;

    if (cls)        { query += ` AND class = $${i++}`;        params.push(cls); }
    if (fee_status) { query += ` AND fee_status = $${i++}`;   params.push(fee_status); }
    if (search)     {
      query += ` AND (first_name ILIKE $${i} OR last_name ILIKE $${i} OR reg_number ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }

    query += ' ORDER BY class, last_name, first_name';

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, students: result.rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/students/:reg ───────────────────────────────
router.get('/:reg', protect, staffOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE reg_number = $1 AND is_active = true',
      [req.params.reg.toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, student: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/students ───────────────────────────────────
router.post('/', protect, adminOrDirector, async (req, res) => {
  try {
    const { reg_number, first_name, last_name, class: cls, gender,
            date_of_birth, parent_name, parent_phone, parent_email, fee_status } = req.body;

    if (!reg_number || !first_name || !last_name || !cls) {
      return res.status(400).json({ success: false, message: 'reg_number, first_name, last_name and class are required.' });
    }

    const result = await pool.query(
      `INSERT INTO students (reg_number, first_name, last_name, class, gender,
        date_of_birth, parent_name, parent_phone, parent_email, fee_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [reg_number.toUpperCase(), first_name, last_name, cls, gender || null,
       date_of_birth || null, parent_name || null, parent_phone || null,
       parent_email || null, fee_status || 'ok']
    );

    res.status(201).json({ success: true, message: 'Student added!', student: result.rows[0] });

  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Registration number already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/students/:id ────────────────────────────────
router.put('/:id', protect, adminOrDirector, async (req, res) => {
  try {
    const { first_name, last_name, class: cls, gender, date_of_birth,
            parent_name, parent_phone, parent_email, fee_status } = req.body;

    const result = await pool.query(
      `UPDATE students SET
        first_name = COALESCE($1, first_name),
        last_name  = COALESCE($2, last_name),
        class      = COALESCE($3, class),
        gender     = COALESCE($4, gender),
        date_of_birth = COALESCE($5, date_of_birth),
        parent_name   = COALESCE($6, parent_name),
        parent_phone  = COALESCE($7, parent_phone),
        parent_email  = COALESCE($8, parent_email),
        fee_status    = COALESCE($9, fee_status),
        updated_at    = NOW()
       WHERE id = $10 RETURNING *`,
      [first_name, last_name, cls, gender, date_of_birth,
       parent_name, parent_phone, parent_email, fee_status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, message: 'Student updated!', student: result.rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/students/:id (soft delete) ───────────────
router.delete('/:id', protect, adminOrDirector, async (req, res) => {
  try {
    await pool.query('UPDATE students SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Student removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/students/:id/fee-status ───────────────────
router.patch('/:id/fee-status', protect, adminOrDirector, async (req, res) => {
  try {
    const { fee_status } = req.body;
    if (!['ok', 'credit'].includes(fee_status)) {
      return res.status(400).json({ success: false, message: 'fee_status must be ok or credit.' });
    }
    const result = await pool.query(
      'UPDATE students SET fee_status = $1, updated_at = NOW() WHERE id = $2 RETURNING reg_number, first_name, last_name, fee_status',
      [fee_status, req.params.id]
    );
    res.json({ success: true, message: 'Fee status updated!', student: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;