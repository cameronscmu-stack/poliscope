CREATE TABLE IF NOT EXISTS grade_scores (
  id                        SERIAL      PRIMARY KEY,
  member_id                 VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE UNIQUE,
  attendance_score          DECIMAL(5,2),
  party_independence_score  DECIMAL(5,2),
  composite_score           DECIMAL(5,2),
  letter_grade              CHAR(1),
  data_sufficient           BOOLEAN     DEFAULT false,
  calculated_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
