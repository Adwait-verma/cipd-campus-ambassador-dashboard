-- Apply once to an existing database; safe to rerun. No existing rows are removed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(16);
UPDATE users SET phone_number = NULL WHERE role = 'ADMIN';

CREATE TABLE IF NOT EXISTS portal_settings (
    settings_id INT PRIMARY KEY CHECK (settings_id = 1),
    whatsapp_group_invite_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
    message_id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL CHECK (kind IN ('WELCOME', 'CAMPAIGN', 'MONTHLY_REPORT', 'BROADCAST')),
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    report_month DATE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check
CHECK (kind IN ('WELCOME', 'CAMPAIGN', 'MONTHLY_REPORT', 'BROADCAST'));

CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_once_per_user_event
ON email_outbox (user_id, kind, COALESCE(campaign_id, -1), COALESCE(report_month, DATE '0001-01-01'));
