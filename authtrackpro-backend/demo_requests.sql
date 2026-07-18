CREATE TABLE IF NOT EXISTS demo_requests (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  company VARCHAR(200) NOT NULL,
  job_title VARCHAR(150),
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  providers INTEGER,
  facilities INTEGER,
  current_ehr VARCHAR(100),
  biggest_challenge TEXT,
  preferred_date DATE,
  preferred_time TIME,
  additional_comments TEXT,
  status VARCHAR(50) DEFAULT 'New',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);