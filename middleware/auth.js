const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ── Verify JWT token ──────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please login.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (!result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Your account has been deactivated.' });
    }

    req.user = result.rows[0];
    next();

  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token. Please login again.' });
  }
};

// ── Role-based access ──────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

// ── Director only ──────────────────────────────────────────
const directorOnly = (req, res, next) => {
  if (req.user.role !== 'director') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Director only.'
    });
  }
  next();
};

// ── Admin or Director ──────────────────────────────────────
const adminOrDirector = (req, res, next) => {
  if (!['admin', 'director'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Director only.'
    });
  }
  next();
};

// ── Teacher, Admin or Director ────────────────────────────
const staffOnly = (req, res, next) => {
  if (!['teacher', 'admin', 'director'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff only.'
    });
  }
  next();
};

module.exports = { protect, authorize, directorOnly, adminOrDirector, staffOnly };