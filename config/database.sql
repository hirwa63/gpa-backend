-- ============================================================
-- GOD'S PLAN ACADEMY - DATABASE SETUP
-- Run this entire file in pgAdmin Query Tool
-- ============================================================

-- Create database (run this separately first if needed)
-- CREATE DATABASE gpa_school;

-- ============================================================
-- 1. USERS TABLE (all accounts - parents, teachers, admin, director)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'parent'
                CHECK (role IN ('parent','teacher','admin','director','student')),
  language      VARCHAR(5)  NOT NULL DEFAULT 'en'
                CHECK (language IN ('en','rw','fr','sw')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. STUDENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  reg_number    VARCHAR(50) UNIQUE NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  class         VARCHAR(50) NOT NULL,
  gender        VARCHAR(10) CHECK (gender IN ('Male','Female')),
  date_of_birth DATE,
  parent_name   VARCHAR(200),
  parent_phone  VARCHAR(20),
  parent_email  VARCHAR(255),
  parent_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  fee_status    VARCHAR(20) NOT NULL DEFAULT 'ok'
                CHECK (fee_status IN ('ok','credit')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  enrolled_at   TIMESTAMP DEFAULT NOW(),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 3. STAFF TABLE (teachers, admin, cooks, cleaners, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id          SERIAL PRIMARY KEY,
  staff_id    VARCHAR(50) UNIQUE NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  role        VARCHAR(100) NOT NULL,
  department  VARCHAR(100),
  phone       VARCHAR(20),
  email       VARCHAR(255),
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  joined_at   DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 4. MARKS TABLE (CAT + Exam marks per subject)
-- ============================================================
CREATE TABLE IF NOT EXISTS marks (
  id          SERIAL PRIMARY KEY,
  student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject     VARCHAR(100) NOT NULL,
  term        VARCHAR(20)  NOT NULL,
  academic_year VARCHAR(10) NOT NULL DEFAULT '2025-2026',
  cat_marks   NUMERIC(5,2) DEFAULT 0 CHECK (cat_marks  >= 0 AND cat_marks  <= 40),
  exam_marks  NUMERIC(5,2) DEFAULT 0 CHECK (exam_marks >= 0 AND exam_marks <= 60),
  total_marks NUMERIC(5,2) GENERATED ALWAYS AS (cat_marks + exam_marks) STORED,
  posted_by   INT REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, subject, term, academic_year)
);

-- ============================================================
-- 5. DISCIPLINE TABLE (conduct scores)
-- ============================================================
CREATE TABLE IF NOT EXISTS discipline (
  id            SERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term          VARCHAR(20) NOT NULL,
  academic_year VARCHAR(10) NOT NULL DEFAULT '2025-2026',
  attendance    INT DEFAULT 0 CHECK (attendance  >= 0 AND attendance  <= 10),
  punctuality   INT DEFAULT 0 CHECK (punctuality >= 0 AND punctuality <= 10),
  behaviour     INT DEFAULT 0 CHECK (behaviour   >= 0 AND behaviour   <= 10),
  neatness      INT DEFAULT 0 CHECK (neatness    >= 0 AND neatness    <= 10),
  teamwork      INT DEFAULT 0 CHECK (teamwork    >= 0 AND teamwork    <= 10),
  teacher_remark  TEXT,
  head_remark     TEXT,
  position_class  VARCHAR(50),
  posted_by     INT REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, term, academic_year)
);

-- ============================================================
-- 6. FEES TABLE (balance per student)
-- ============================================================
CREATE TABLE IF NOT EXISTS fees (
  id            SERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year VARCHAR(10) NOT NULL DEFAULT '2025-2026',
  term          VARCHAR(20) NOT NULL,
  tuition_fee   NUMERIC(10,2) DEFAULT 0,
  other_fees    NUMERIC(10,2) DEFAULT 0,
  total_due     NUMERIC(10,2) DEFAULT 0,
  total_paid    NUMERIC(10,2) DEFAULT 0,
  balance       NUMERIC(10,2) GENERATED ALWAYS AS (total_due - total_paid) STORED,
  status        VARCHAR(20) DEFAULT 'unpaid'
                CHECK (status IN ('paid','partial','unpaid')),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, academic_year, term)
);

-- ============================================================
-- 7. FEE TRANSACTIONS TABLE (every payment recorded)
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_transactions (
  id            SERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_id        INT REFERENCES fees(id),
  amount        NUMERIC(10,2) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  payment_method VARCHAR(50) NOT NULL
                 CHECK (payment_method IN ('MTN MoMo','Airtel Money','Bank Transfer','Cash')),
  transaction_code VARCHAR(100),
  payer_phone   VARCHAR(20),
  term          VARCHAR(20),
  academic_year VARCHAR(10) DEFAULT '2025-2026',
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','verified','rejected')),
  verified_by   INT REFERENCES users(id),
  verified_at   TIMESTAMP,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 8. RESULTS ACCESS PAYMENTS (100 RWF to view results)
-- ============================================================
CREATE TABLE IF NOT EXISTS results_access (
  id              SERIAL PRIMARY KEY,
  student_id      INT NOT NULL REFERENCES students(id),
  parent_name     VARCHAR(200),
  parent_phone    VARCHAR(20),
  transaction_code VARCHAR(100) NOT NULL,
  amount          NUMERIC(10,2) DEFAULT 100,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','verified','rejected')),
  verified_by     INT REFERENCES users(id),
  expires_at      TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 9. NEWS & GALLERY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS news (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  category    VARCHAR(50) NOT NULL
              CHECK (category IN ('trip','sports','debate','visitor','funny','achievement','event')),
  emoji       VARCHAR(10),
  image_url   VARCHAR(500),
  published_by INT REFERENCES users(id),
  is_published BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 10. COMMENTS TABLE (messages to director)
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  sender_name VARCHAR(200) NOT NULL,
  sender_role VARCHAR(50) DEFAULT 'parent',
  subject     VARCHAR(255),
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  replied_at  TIMESTAMP,
  reply_text  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 11. ADMISSIONS TABLE (enrollment applications)
-- ============================================================
CREATE TABLE IF NOT EXISTS admissions (
  id            SERIAL PRIMARY KEY,
  parent_name   VARCHAR(200) NOT NULL,
  parent_phone  VARCHAR(20)  NOT NULL,
  parent_email  VARCHAR(255),
  child_name    VARCHAR(200) NOT NULL,
  child_age     INT,
  class_applying VARCHAR(50) NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','waitlisted')),
  notes         TEXT,
  processed_by  INT REFERENCES users(id),
  processed_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 12. SETTINGS TABLE (school configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id            SERIAL PRIMARY KEY,
  setting_key   VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_by    INT REFERENCES users(id),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- DEFAULT SETTINGS
-- ============================================================
INSERT INTO settings (setting_key, setting_value) VALUES
  ('school_name',        'God''s Plan Academy'),
  ('school_phone',       '+250 788 000 000'),
  ('school_whatsapp',    '+250 788 000 001'),
  ('school_email',       'info@godsplanacademy.rw'),
  ('school_admin_email', 'admin@godsplanacademy.rw'),
  ('school_address',     'Musanze, Northern Province, Rwanda'),
  ('school_hours',       'Monday - Friday: 7:00am - 5:00pm'),
  ('director_name',      'Sr. Josephine Uwera'),
  ('head_teacher',       'Mr. Patrick Habimana'),
  ('bank_name',          'God''s Plan Academy Ltd'),
  ('bank_account',       '00012-345678-01'),
  ('bank_branch',        'Musanze Branch'),
  ('bank_swift',         'BKIGRWRW'),
  ('current_term',       'Term 2'),
  ('academic_year',      '2025-2026'),
  ('results_fee',        '100'),
  ('notice_text',        '📢 Term 2 2026 — School fees are due by April 28, 2026.')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- DEFAULT ADMIN USER (password: gpa2026)
-- ============================================================
INSERT INTO users (first_name, last_name, email, phone, username, password_hash, role, language)
VALUES (
  'Admin', 'GPA',
  'admin@godsplanacademy.rw',
  '+250788000000',
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  'en'
) ON CONFLICT (username) DO NOTHING;

-- Default director user (password: gpa999)
INSERT INTO users (first_name, last_name, email, phone, username, password_hash, role, language)
VALUES (
  'Josephine', 'Uwera',
  'director@godsplanacademy.rw',
  '+250788000002',
  'director',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'director',
  'en'
) ON CONFLICT (username) DO NOTHING;

-- Default teacher user (password: gpa123)
INSERT INTO users (first_name, last_name, email, phone, username, password_hash, role, language)
VALUES (
  'Patrick', 'Habimana',
  'teacher@godsplanacademy.rw',
  '+250788000003',
  'teacher',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'teacher',
  'en'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- INDEXES (for fast queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_reg    ON students(reg_number);
CREATE INDEX IF NOT EXISTS idx_students_class  ON students(class);
CREATE INDEX IF NOT EXISTS idx_marks_student   ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_term      ON marks(term, academic_year);
CREATE INDEX IF NOT EXISTS idx_fees_student    ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions    ON fee_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_news_category   ON news(category);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);

-- Done!
SELECT 'Database setup complete! All tables created.' AS status;