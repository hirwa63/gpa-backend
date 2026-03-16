const { Pool } = require('pg');
require('dotenv').config();

let pool;

// Railway provides DATABASE_URL automatically
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Local development
  pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 5432,
    database: process.env.DB_NAME     || 'gpa_school',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'gpa2026',
  });
}

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

module.exports = pool;