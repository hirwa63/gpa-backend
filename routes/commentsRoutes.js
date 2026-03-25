const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect, adminOrDirector } = require('../middleware/auth');
const sendEmail = require('../config/mailer'); // Import the mailer utility

// ── POST /api/comments ── Anyone can send a message ──────
router.post('/', async (req, res) => {
    try {
        const { sender_name, sender_email, sender_role, subject, message } = req.body;

        // Validation
        if (!sender_name || !sender_email || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, Email, and Message are required.' 
            });
        }

        // 1. Save to Database
        const result = await pool.query(
            `INSERT INTO comments (sender_name, sender_email, sender_role, subject, message)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [sender_name, sender_email, sender_role || 'parent', subject || 'No Subject', message]
        );

        // 2. Notify Admin via Email (The "Web Email" feature)
        const emailHtml = `
            <h2>New Website Message</h2>
            <p><strong>From:</strong> ${sender_name} (${sender_email})</p>
            <p><strong>Role:</strong> ${sender_role || 'User'}</p>
            <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
            <hr>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
        `;

        await sendEmail(
            process.env.EMAIL_USER, // Sends to your own admin email defined in .env
            `New Comment: ${subject || 'Website Inquiry'}`,
            `New message from ${sender_name}`,
            emailHtml
        );

        res.status(201).json({ 
            success: true, 
            message: 'Message sent and Admin notified!', 
            comment: result.rows[0] 
        });

    } catch (error) {
        console.error("Comment Error:", error);
        res.status(500).json({ success: false, message: "Server error while sending message." });
    }
});

// ── POST /api/comments/:id/reply ── Admin/Director only ──
router.post('/:id/reply', protect, adminOrDirector, async (req, res) => {
    try {
        const { replyMessage } = req.body;
        const commentId = req.params.id;

        // 1. Get the original user's email
        const userQuery = await pool.query('SELECT sender_email, subject FROM comments WHERE id = $1', [commentId]);
        
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Original comment not found.' });
        }

        const { sender_email, subject } = userQuery.rows[0];

        // 2. Send the reply to the user
        await sendEmail(
            sender_email,
            `Re: ${subject}`,
            replyMessage,
            `<h3>Response from Admin</h3><p>${replyMessage}</p><p>Regards,<br>School Management</p>`
        );

        res.json({ success: true, message: 'Reply sent to user email!' });
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

// ── PATCH /api/comments/:id/read ─────────────────────────
router.patch('/:id/read', protect, adminOrDirector, async (req, res) => {
    try {
        await pool.query('UPDATE comments SET is_read = true WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Marked as read.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── POST /api/comments/:id/reply ── Admin only ──────
router.post('/:id/reply', protect, adminOrDirector, async (req, res) => {
  try {
    const { replyMessage } = req.body;
    const commentId = req.params.id;

    // 1. Fetch the user's email from the database using the ID
    const commentData = await pool.query('SELECT sender_email, subject FROM comments WHERE id = $1', [commentId]);
    
    if (commentData.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const { sender_email, subject } = commentData.rows[0];

    // 2. Send the reply email
    await sendEmail(
      sender_email,
      `Re: ${subject || 'Your Message'}`,
      replyMessage,
      `<p>Hello,</p><p>${replyMessage}</p><p>Best regards,<br>Admin Team</p>`
    );

    // 3. Optional: Update DB to show this message was replied to
    await pool.query('UPDATE comments SET is_replied = true WHERE id = $1', [commentId]);

    res.json({ success: true, message: 'Reply sent successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;