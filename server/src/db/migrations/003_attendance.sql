CREATE TABLE IF NOT EXISTS attendance_records (
  id              SERIAL      PRIMARY KEY,
  member_id       VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE UNIQUE,
  congress        SMALLINT,
  total_votes     INTEGER     DEFAULT 0,
  votes_cast      INTEGER     DEFAULT 0,
  missed_votes    INTEGER     DEFAULT 0,
  attendance_pct  DECIMAL(5,2),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
