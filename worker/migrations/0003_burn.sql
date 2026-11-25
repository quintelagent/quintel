-- Burn-to-run: verified burns with their scenario, and the custom runs made from them.
-- Kept apart from runs and fingerprints. Run ids here are request ids.
CREATE TABLE IF NOT EXISTS burn_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx TEXT NOT NULL, log_index INTEGER NOT NULL, block INTEGER NOT NULL,
  burner TEXT NOT NULL, amount TEXT NOT NULL, tokens REAL NOT NULL,
  price REAL NOT NULL, horizon INTEGER NOT NULL, shock TEXT, anonymous INTEGER NOT NULL DEFAULT 0,
  request_hash TEXT NOT NULL UNIQUE, signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0, error TEXT,
  created_at TEXT NOT NULL, queued_at TEXT NOT NULL, started_at TEXT,
  UNIQUE (tx, log_index)
);
CREATE INDEX IF NOT EXISTS burn_requests_status ON burn_requests(status, queued_at);
CREATE TABLE IF NOT EXISTS burn_runs (
  id INTEGER PRIMARY KEY REFERENCES burn_requests(id),
  ts TEXT NOT NULL, base_run_id INTEGER NOT NULL, seed TEXT NOT NULL,
  input_hash TEXT NOT NULL, output_hash TEXT NOT NULL, paths_per_model INTEGER NOT NULL,
  inputs TEXT NOT NULL, result TEXT NOT NULL, distance REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS burn_runs_distance ON burn_runs(distance);
