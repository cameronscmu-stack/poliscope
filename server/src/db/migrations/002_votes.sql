CREATE TABLE IF NOT EXISTS votes (
  id              SERIAL      PRIMARY KEY,
  member_id       VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE,
  bill_id         VARCHAR(50),
  roll_call_number INTEGER,
  congress        SMALLINT,
  session         SMALLINT,
  chamber         VARCHAR(6),
  vote_date       DATE,
  vote_position   VARCHAR(20),
  party_position  VARCHAR(20),
  bill_title      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_member_id ON votes(member_id);
CREATE INDEX IF NOT EXISTS idx_votes_vote_date ON votes(vote_date);
