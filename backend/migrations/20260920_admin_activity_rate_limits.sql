-- Admin audit history and privacy-preserving password-reset throttling.
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    activity_id BIGSERIAL PRIMARY KEY,
    admin_user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx
ON admin_activity_logs (created_at DESC, activity_id DESC);

CREATE TABLE IF NOT EXISTS password_reset_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    email_hash CHAR(64) NOT NULL,
    ip_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS password_reset_attempts_email_idx
ON password_reset_attempts (email_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_attempts_ip_idx
ON password_reset_attempts (ip_hash, created_at DESC);
