-- CiPD Ambassador Rating System — PostgreSQL Schema
-- Run this after: CREATE DATABASE cipd_ambassadors; \c cipd_ambassadors

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('ADMIN', 'AMBASSADOR')),
    password_hash TEXT,
    phone_number VARCHAR(16),
    contact_email VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ambassadors (
    ambassador_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    college_name VARCHAR(150) NOT NULL,
    graduation_year INT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    left_at TIMESTAMPTZ
);

CREATE TABLE social_accounts (
    account_id SERIAL PRIMARY KEY,
    ambassador_id INT REFERENCES ambassadors(ambassador_id) ON DELETE CASCADE,
    platform VARCHAR(20) CHECK (platform IN ('INSTAGRAM', 'LINKEDIN', 'TWITTER')),
    platform_user_id VARCHAR(100) NOT NULL,
    profile_handle VARCHAR(100) NOT NULL,
    access_token TEXT,              -- store encrypted, never plaintext
    token_expires_at TIMESTAMP WITH TIME ZONE,
    follower_count INT DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ambassador_id, platform)
);

CREATE TABLE campaigns (
    campaign_id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    mandatory_hashtag VARCHAR(50),
    target_url TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    last_calculated_at TIMESTAMPTZ
);

CREATE TABLE campaign_posts (
    post_id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    ambassador_id INT REFERENCES ambassadors(ambassador_id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    post_url TEXT NOT NULL,
    platform_post_id VARCHAR(100) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX campaign_posts_unique_platform_post
    ON campaign_posts (
        campaign_id,
        ambassador_id,
        platform,
        platform_post_id
    );

CREATE UNIQUE INDEX campaign_posts_unique_post_url
    ON campaign_posts (
        campaign_id,
        ambassador_id,
        platform,
        (RTRIM(post_url, '/'))
    );

CREATE TABLE metric_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    post_id INT REFERENCES campaign_posts(post_id) ON DELETE CASCADE,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    views_impressions INT DEFAULT 0,
    reach_count INT DEFAULT 0,
    saves_count INT DEFAULT 0
);

CREATE TABLE ambassador_ratings (
    rating_id SERIAL PRIMARY KEY,
    ambassador_id INT REFERENCES ambassadors(ambassador_id) ON DELETE CASCADE,
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    normalized_score NUMERIC(5,2) NOT NULL,
    percentile_rank NUMERIC(5,2) NOT NULL,
    star_rating INT CHECK (star_rating IN (3, 4, 5)),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE portal_settings (
    settings_id INT PRIMARY KEY CHECK (settings_id = 1),
    whatsapp_group_invite_url TEXT,
    support_contact_email VARCHAR(150),
    support_phone_number VARCHAR(16)
);

CREATE TABLE admin_activity_logs (
    activity_id BIGSERIAL PRIMARY KEY,
    admin_user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX admin_activity_logs_created_at_idx
ON admin_activity_logs (created_at DESC, activity_id DESC);

CREATE TABLE email_broadcasts (
    broadcast_id BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_requests (
    reset_request_id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    email_hash CHAR(64) NOT NULL,
    ip_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX password_reset_attempts_email_idx
ON password_reset_attempts (email_hash, created_at DESC);

CREATE INDEX password_reset_attempts_ip_idx
ON password_reset_attempts (ip_hash, created_at DESC);

CREATE TABLE email_outbox (
    message_id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL CHECK (kind IN ('WELCOME', 'CAMPAIGN', 'MONTHLY_REPORT', 'BROADCAST', 'PASSWORD_RESET', 'PASSWORD_CHANGED')),
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    report_month DATE,
    broadcast_id BIGINT REFERENCES email_broadcasts(broadcast_id) ON DELETE CASCADE,
    reset_request_id BIGINT REFERENCES password_reset_requests(reset_request_id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX email_outbox_once_per_user_event
ON email_outbox (
    user_id, kind, COALESCE(campaign_id, -1),
    COALESCE(report_month, DATE '0001-01-01'),
    COALESCE(broadcast_id, -1), COALESCE(reset_request_id, -1)
);

-- Quick sanity-check seed data so you can verify the connection tonight
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

-- Keep legacy platform records intact while limiting the running portal to Instagram.
CREATE OR REPLACE VIEW instagram_social_accounts AS SELECT * FROM social_accounts WHERE platform='INSTAGRAM';
CREATE OR REPLACE VIEW instagram_campaign_posts AS SELECT * FROM campaign_posts WHERE platform='INSTAGRAM';
CREATE OR REPLACE VIEW instagram_metric_snapshots AS
    SELECT ms.* FROM metric_snapshots ms JOIN instagram_campaign_posts cp USING(post_id)
    JOIN campaigns c USING(campaign_id)
    WHERE ms.fetched_at<((c.end_date+1)::TIMESTAMP AT TIME ZONE 'Asia/Kolkata');
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS campaign_ranking_snapshots (
    campaign_id INT NOT NULL REFERENCES campaigns(campaign_id),
    ambassador_id INT NOT NULL REFERENCES ambassadors(ambassador_id),
    rank INT NOT NULL,
    normalized_score NUMERIC(5,2) NOT NULL,
    percentile_rank NUMERIC(5,2) NOT NULL,
    star_rating INT NOT NULL,
    total_reach BIGINT NOT NULL,
    total_engagements BIGINT NOT NULL,
    published_posts INT NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(campaign_id,ambassador_id)
);
CREATE INDEX IF NOT EXISTS ambassador_ratings_campaign_latest_idx
    ON ambassador_ratings(campaign_id,ambassador_id,calculated_at DESC,rating_id DESC);
UPDATE ambassadors a SET status=CASE WHEN EXISTS(
    SELECT 1 FROM instagram_social_accounts s WHERE s.ambassador_id=a.ambassador_id AND s.verified)
    THEN 'ACTIVE' ELSE 'PENDING' END WHERE a.left_at IS NULL AND a.status<>'LEFT';

CREATE TABLE group_notice_dispatches (
    request_id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (full_name, email, role) VALUES
    ('Test Ambassador One', 'amb1@test.com', 'AMBASSADOR'),
    ('Test Ambassador Two', 'amb2@test.com', 'AMBASSADOR'),
    ('CiPD Admin', 'admin@cipd.iiitd.edu.in', 'ADMIN');
