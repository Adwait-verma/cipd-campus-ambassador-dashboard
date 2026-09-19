-- Global programme contact details and secure, single-use password reset links.
ALTER TABLE portal_settings
    ALTER COLUMN whatsapp_group_invite_url DROP NOT NULL;

ALTER TABLE portal_settings
    ADD COLUMN IF NOT EXISTS support_contact_email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS support_phone_number VARCHAR(16);

CREATE TABLE IF NOT EXISTS password_reset_requests (
    reset_request_id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE email_outbox
    ADD COLUMN IF NOT EXISTS reset_request_id BIGINT
    REFERENCES password_reset_requests(reset_request_id) ON DELETE CASCADE;

ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check
    CHECK (kind IN (
        'WELCOME', 'CAMPAIGN', 'MONTHLY_REPORT', 'BROADCAST',
        'PASSWORD_RESET', 'PASSWORD_CHANGED'
    ));

DROP INDEX IF EXISTS email_outbox_once_per_user_event;
CREATE UNIQUE INDEX email_outbox_once_per_user_event
ON email_outbox (
    user_id, kind, COALESCE(campaign_id, -1),
    COALESCE(report_month, DATE '0001-01-01'),
    COALESCE(broadcast_id, -1), COALESCE(reset_request_id, -1)
);
