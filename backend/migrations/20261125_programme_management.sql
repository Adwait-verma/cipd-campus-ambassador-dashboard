ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ;
ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check
    CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'));
CREATE INDEX IF NOT EXISTS admin_activity_filter_idx
    ON admin_activity_logs (admin_user_id, action, created_at DESC, activity_id DESC);
CREATE TABLE IF NOT EXISTS group_notice_dispatches (
    request_id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
