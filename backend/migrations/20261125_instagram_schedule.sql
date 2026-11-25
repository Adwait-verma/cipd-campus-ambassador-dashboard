ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS sync_day DATE;
CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_api_day_idx ON metric_snapshots(post_id,sync_day);
CREATE INDEX IF NOT EXISTS metric_snapshots_latest_idx ON metric_snapshots(post_id,fetched_at DESC,snapshot_id DESC);
CREATE TABLE IF NOT EXISTS instagram_sync_state (
    post_id INT PRIMARY KEY REFERENCES campaign_posts(post_id) ON DELETE CASCADE,
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    failure_count INT NOT NULL DEFAULT 0,
    last_error TEXT
);
CREATE TABLE IF NOT EXISTS instagram_api_calls (
    call_id BIGSERIAL PRIMARY KEY,
    ambassador_id INT NOT NULL,
    called_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS instagram_api_calls_time_idx ON instagram_api_calls(called_at,ambassador_id);
CREATE TABLE IF NOT EXISTS instagram_api_cooldowns (
    scope TEXT PRIMARY KEY,
    paused_until TIMESTAMPTZ,
    usage_percent NUMERIC,
    reason TEXT
);
CREATE TABLE IF NOT EXISTS monthly_sync_runs (
    report_month DATE PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    last_error TEXT
);
