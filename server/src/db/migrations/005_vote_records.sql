-- Raw vote records: source of truth for attendance + party independence scoring
CREATE TABLE IF NOT EXISTS vote_records (
  id            SERIAL PRIMARY KEY,
  member_id     VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE,
  vote_date     DATE NOT NULL,
  chamber       TEXT NOT NULL CHECK (chamber IN ('senate', 'house')),
  congress      INT NOT NULL,
  session_num   INT NOT NULL,
  vote_number   INT NOT NULL,
  vote_cast     TEXT NOT NULL,   -- 'Yea' | 'Nay' | 'Present' | 'Not Voting'
  party_vote    TEXT,            -- majority party position: 'Yea' | 'Nay'
  vote_category TEXT,            -- 'passage' | 'procedural' | 'amendment' | etc.
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, congress, session_num, vote_number)
);

CREATE INDEX IF NOT EXISTS idx_vote_records_member_id ON vote_records(member_id);
CREATE INDEX IF NOT EXISTS idx_vote_records_congress ON vote_records(congress, session_num);

-- FEC candidate ID for campaign finance lookup
ALTER TABLE members ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT;

-- Additional scoring columns on grade_scores
ALTER TABLE grade_scores
  ADD COLUMN IF NOT EXISTS legislative_score      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS campaign_finance_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bipartisan_score       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS total_votes_eligible   INT,
  ADD COLUMN IF NOT EXISTS votes_cast             INT,
  ADD COLUMN IF NOT EXISTS score_window_start     DATE,
  ADD COLUMN IF NOT EXISTS score_window_end       DATE;
