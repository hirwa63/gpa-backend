const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect, adminOrDirector } = require('../middleware/auth');

// ── POST /api/fees/pay ───────────────────────────────────
// Parent submits a fee payment
router.post('/pay', async (req, res) => {
  try {
    const { reg_number, category, term, academic_year,
            payment_method, transaction_code, payer_phone } = req.body;

    if (!reg_number || !category || !payment_method || !transaction_code) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Get student
    const student = await pool.query(
      'SELECT id, first_name, last_name, class, fee_status FROM students WHERE reg_number = $1 AND is_active = true',
      [reg_number.toUpperCase()]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Student "${reg_number}" not found.` });
    }

    // Check transaction code not reused
    const existing = await pool.query(
      'SELECT id FROM fee_transactions WHERE transaction_code = $1',
      [transaction_code.toUpperCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'This transaction code has already been submitted.' });
    }

    // Fee amounts by class
    const s = student.rows[0];
    const tierMap = {
      'Baby Nursery': 'nursery', 'Pre-School': 'preschool',
      'Primary 1': 'lower', 'Primary 2': 'lower', 'Primary 3': 'lower',
      'Primary 4': 'upper', 'Primary 5': 'upper', 'Primary 6': 'upper'
    };
    const feeTable = {
      nursery:   { tuition: 45000, registration: 10000 },
      preschool: { tuition: 50000, registration: 10000 },
      lower:     { tuition: 60000, registration: 12000 },
      upper:     { tuition: 70000, registration: 12000 }
    };
    const tier = tierMap[s.class] || 'lower';
    const fees = feeTable[tier];
    const amounts = {
      tuition:      fees.tuition,
      registration: fees.registration,
      activity:     5000,
      uniform:      15000,
      transport:    20000,
      lunch:        18000,
      all:          fees.tuition + fees.registration + 5000
    };

    const amount = amounts[category] || 0;
    if (amount === 0) {
      return res.status(400).json({ success: false, message: 'Invalid fee category.' });
    }

    // Record transaction
    const txn = await pool.query(
      `INSERT INTO fee_transactions
        (student_id, amount, category, payment_method, transaction_code, payer_phone, term, academic_year, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       RETURNING *`,
      [s.id, amount, category, payment_method, transaction_code.toUpperCase(),
       payer_phone || null, term || 'Term 2', academic_year || '2025-2026']
    );

    // If full payment, update student fee_status
    if (category === 'all' || category === 'tuition') {
      await pool.query('UPDATE students SET fee_status = $1, updated_at = NOW() WHERE id = $2', ['ok', s.id]);
    }

    res.status(201).json({
      success: true,
      message: `Payment of ${amount.toLocaleString()} RWF submitted for ${s.first_name} ${s.last_name}. The school will verify within 24 hours.`,
      transaction: txn.rows[0]
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/fees/balance/:reg ───────────────────────────
router.get('/balance/:reg', async (req, res) => {
  try {
    const student = await pool.query(
      'SELECT id, reg_number, first_name, last_name, class, fee_status FROM students WHERE reg_number = $1 AND is_active = true',
      [req.params.reg.toUpperCase()]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const s = student.rows[0];
    const transactions = await pool.query(
      'SELECT * FROM fee_transactions WHERE student_id = $1 ORDER BY created_at DESC',
      [s.id]
    );

    res.json({
      success: true,
      student: { reg_number: s.reg_number, name: `${s.first_name} ${s.last_name}`, class: s.class, fee_status: s.fee_status },
      transactions: transactions.rows,
      total_paid: transactions.rows.filter(t => t.status === 'verified').reduce((sum, t) => sum + parseFloat(t.amount), 0)
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/fees/transactions ───────────────────────────
// Admin/Director — all transactions
router.get('/transactions', protect, adminOrDirector, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ft.*, s.reg_number, s.first_name, s.last_name, s.class
       FROM fee_transactions ft
       JOIN students s ON ft.student_id = s.id
       ORDER BY ft.created_at DESC`
    );
    res.json({ success: true, count: result.rows.length, transactions: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/fees/transactions/:id/verify ──────────────
// Admin/Director verifies a payment
router.patch('/transactions/:id/verify', protect, adminOrDirector, async (req, res) => {
  try {
    const { status } = req.body; // 'verified' or 'rejected'
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected.' });
    }

    const result = await pool.query(
      `UPDATE fee_transactions SET status=$1, verified_by=$2, verified_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.json({ success: true, message: `Payment ${status}!`, transaction: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;