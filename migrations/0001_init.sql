CREATE TABLE players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL
);
CREATE UNIQUE INDEX players_name_unique ON players (lower(trim(name)));

CREATE TABLE matches (
  id          TEXT    PRIMARY KEY,
  format      INTEGER NOT NULL CHECK (format IN (5, 7)),
  pitch       TEXT    NOT NULL,
  kickoff_at  TEXT    NOT NULL,
  result      TEXT    CHECK (result IN ('win', 'loss')),
  our_score   INTEGER,
  their_score INTEGER,
  note        TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT,
  deleted_at  TEXT,
  CHECK ((our_score IS NULL) = (their_score IS NULL)),
  CHECK ((our_score IS NULL) OR (our_score >= 0 AND their_score >= 0))
);

CREATE INDEX matches_kickoff ON matches (kickoff_at ASC);

CREATE TABLE signups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    TEXT    NOT NULL REFERENCES matches(id),
  player_id   INTEGER REFERENCES players(id),
  guest_name  TEXT,
  is_late     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  UNIQUE (match_id, player_id),
  CHECK (player_id IS NOT NULL OR guest_name IS NOT NULL)
);
