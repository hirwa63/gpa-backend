const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect, staffOnly, adminOrDirector } = require('../middleware/auth');

// ── POST /api/marks/access ──────────────────────────────
// Parent pays 100 RWF to access results
router.post('/access', async (req, res) => {
  try {
    const { reg_number, parent_name, transaction_code } = req.body;

    if (!reg_number || !parent_name || !transaction_code) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Check student exists
    const student = await pool.query(
      'SELECT id, reg_number, first_name, last_name, class, fee_status FROM students WHERE reg_number = $1 AND is_active = true',
      [reg_number.toUpperCase()]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: `No student found with registration number "${reg_number}".` });
    }

    // Check if student is on credit
    if (student.rows[0].fee_status === 'credit') {
      return res.status(403).json({
        success: false,
        message: '🚫 Results locked. This student has outstanding fees. Please pay school fees first.',
        credit: true
      });
    }

    // Check transaction code not already used
    const existing = await pool.query(
      'SELECT id FROM results_access WHERE transaction_code = $1',
      [transaction_code.toUpperCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'This transaction code has already been used.' });
    }

    // Record access payment
    await pool.query(
      `INSERT INTO results_access (student_id, parent_name, transaction_code, status)
       VALUES ($1, $2, $3, 'pending')`,
      [student.rows[0].id, parent_name, transaction_code.toUpperCase()]
    );

    // Return results
    const s = student.rows[0];
    const marksResult = await pool.query(
      `SELECT m.subject, m.term, m.academic_year, m.cat_marks, m.exam_marks, m.total_marks
       FROM marks m WHERE m.student_id = $1 ORDER BY m.term, m.subject`,
      [s.id]
    );

    const discResult = await pool.query(
      'SELECT * FROM discipline WHERE student_id = $1 ORDER BY term',
      [s.id]
    );

    res.json({
      success: true,
      message: 'Access granted! Payment recorded.',
      student: { reg_number: s.reg_number, name: `${s.first_name} ${s.last_name}`, class: s.class },
      marks: marksResult.rows,
      discipline: discResult.rows
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/marks ─────────────────────────────────────
// Teacher posts marks for a student
router.post('/', protect, staffOnly, async (req, res) => {
  try {
    const { reg_number, subject, term, academic_year, cat_marks, exam_marks } = req.body;

    if (!reg_number || !subject || !term || cat_marks === undefined || exam_marks === undefined) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Get student
    const student = await pool.query(
      'SELECT id, fee_status FROM students WHERE reg_number = $1 AND is_active = true',
      [reg_number.toUpperCase()]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Block posting if student on credit
    if (student.rows[0].fee_status === 'credit') {
      return res.status(403).json({
        success: false,
        message: '🚫 Cannot post marks. Student has outstanding fees.'
      });
    }

    // Validate marks ranges
    if (cat_marks < 0 || cat_marks > 40) {
      return res.status(400).json({ success: false, message: 'CAT marks must be between 0 and 40.' });
    }
    if (exam_marks < 0 || exam_marks > 60) {
      return res.status(400).json({ success: false, message: 'Exam marks must be between 0 and 60.' });
    }

    const result = await pool.query(
      `INSERT INTO marks (student_id, subject, term, academic_year, cat_marks, exam_marks, posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (student_id, subject, term, academic_year)
       DO UPDATE SET cat_marks=$5, exam_marks=$6, posted_by=$7, updated_at=NOW()
       RETURNING *`,
      [student.rows[0].id, subject, term, academic_year || '2025-2026',
       cat_marks, exam_marks, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Marks saved!', marks: result.rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/marks/discipline ───────────────────────────
router.post('/discipline', protect, staffOnly, async (req, res) => {
  try {
    const { reg_number, term, academic_year, attendance, punctuality,
            behaviour, neatness, teamwork, teacher_remark, head_remark, position_class } = req.body;

    const student = await pool.query(
      'SELECT id, fee_status FROM students WHERE reg_number = $1 AND is_active = true',
      [reg_number.toUpperCase()]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (student.rows[0].fee_status === 'credit') {
      return res.status(403).json({ success: false, message: '🚫 Cannot post marks. Student has outstanding fees.' });
    }

    const result = await pool.query(
      `INSERT INTO discipline (student_id, term, academic_year, attendance, punctuality,
        behaviour, neatness, teamwork, teacher_remark, head_remark, position_class, posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (student_id, term, academic_year)
       DO UPDATE SET attendance=$4, punctuality=$5, behaviour=$6, neatness=$7,
         teamwork=$8, teacher_remark=$9, head_remark=$10, position_class=$11,
         posted_by=$12, updated_at=NOW()
       RETURNING *`,
      [student.rows[0].id, term, academic_year || '2025-2026',
       attendance || 0, punctuality || 0, behaviour || 0,
       neatness || 0, teamwork || 0, teacher_remark || null,
       head_remark || null, position_class || null, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Discipline marks saved!', discipline: result.rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/marks/student/:reg ──────────────────────────
router.get('/student/:reg', protect, staffOnly, async (req, res) => {
  try {
    const student = await pool.query(
      'SELECT id, reg_number, first_name, last_name, class FROM students WHERE reg_number = $1',
      [req.params.reg.toUpperCase()]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const marks = await pool.query(
      'SELECT * FROM marks WHERE student_id = $1 ORDER BY term, subject',
      [student.rows[0].id]
    );

    const discipline = await pool.query(
      'SELECT * FROM discipline WHERE student_id = $1 ORDER BY term',
      [student.rows[0].id]
    );

    res.json({
      success: true,
      student: student.rows[0],
      marks: marks.rows,
      discipline: discipline.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;