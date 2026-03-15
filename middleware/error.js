// Global error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Server Error';

  // PostgreSQL duplicate key error
  if (err.code === '23505') {
    statusCode = 400;
    message = 'This record already exists.';
  }

  // PostgreSQL foreign key error
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Related record not found.';
  }

  // PostgreSQL not null violation
  if (err.code === '23502') {
    statusCode = 400;
    message = `Field "${err.column}" is required.`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please login again.';
  }

  console.error(`❌ Error ${statusCode}: ${message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = { errorHandler, notFound };