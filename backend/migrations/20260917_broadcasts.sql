-- Add administrator broadcasts without changing existing queued messages.
CREATE TABLE IF NOT EXISTS email_broadcasts (
    broadcast_id BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS broadcast_id BIGINT
    REFERENCES email_broadcasts(broadcast_id) ON DELETE CASCADE;

ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check
    CHECK (kind IN ('WELCOME', 'CAMPAIGN', 'MONTHLY_REPORT', 'BROADCAST'));

DROP INDEX IF EXISTS email_outbox_once_per_user_event;
CREATE UNIQUE INDEX email_outbox_once_per_user_event
ON email_outbox (
    user_id, kind, COALESCE(campaign_id, -1),
    COALESCE(report_month, DATE '0001-01-01'),
    COALESCE(broadcast_id, -1)
);
