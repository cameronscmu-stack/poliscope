CREATE TABLE IF NOT EXISTS members (
  id          VARCHAR(10)  PRIMARY KEY,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  party       CHAR(1)      NOT NULL,
  state       CHAR(2)      NOT NULL,
  chamber     VARCHAR(6)   NOT NULL CHECK (chamber IN ('senate', 'house')),
  district    SMALLINT,
  in_office   BOOLEAN      DEFAULT true,
  photo_url   TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
