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
    status VARCHAR(20) DEFAULT 'ACTIVE'
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
    is_active BOOLEAN DEFAULT TRUE
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
    whatsapp_group_invite_url TEXT NOT NULL
);

CREATE TABLE email_broadcasts (
    broadcast_id BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_outbox (
    message_id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL CHECK (kind IN ('WELCOME', 'CAMPAIGN', 'MONTHLY_REPORT', 'BROADCAST')),
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    report_month DATE,
    broadcast_id BIGINT REFERENCES email_broadcasts(broadcast_id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX email_outbox_once_per_user_event
ON email_outbox (user_id, kind, COALESCE(campaign_id, -1), COALESCE(report_month, DATE '0001-01-01'), COALESCE(broadcast_id, -1));

-- Quick sanity-check seed data so you can verify the connection tonight
INSERT INTO users (full_name, email, role) VALUES
    ('Test Ambassador One', 'amb1@test.com', 'AMBASSADOR'),
    ('Test Ambassador Two', 'amb2@test.com', 'AMBASSADOR'),
    ('CiPD Admin', 'admin@cipd.iiitd.edu.in', 'ADMIN');
