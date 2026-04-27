CREATE TABLE IF NOT EXISTS legislation (
  id                  TEXT PRIMARY KEY,  -- "{congress}-{type}-{number}"
  congress            INT NOT NULL,
  bill_type           TEXT NOT NULL,
  bill_number         INT NOT NULL,
  title               TEXT,
  summary             TEXT,
  policy_area         TEXT,
  origin_chamber      TEXT,             -- 'house' | 'senate'
  latest_action_date  DATE,
  latest_action_text  TEXT,
  action_stage        TEXT,             -- introduced|committee|reported|floor|passed|signed|vetoed
  update_date         DATE,
  introduced_date     DATE,
  sponsors            JSONB,            -- [{id, name, party, state}]
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legislation_update_idx  ON legislation(update_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS legislation_stage_idx   ON legislation(action_stage);
CREATE INDEX IF NOT EXISTS legislation_chamber_idx ON legislation(origin_chamber);
CREATE INDEX IF NOT EXISTS legislation_area_idx    ON legislation(policy_area);
