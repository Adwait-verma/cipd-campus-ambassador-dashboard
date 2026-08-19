-- CiPD Ambassador Rating System — PostgreSQL Schema
-- Run this after: CREATE DATABASE cipd_ambassadors; \c cipd_ambassadors

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('ADMIN', 'AMBASSADOR')),
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- Quick sanity-check seed data so you can verify the connection tonight
INSERT INTO users (full_name, email, role) VALUES
    ('Test Ambassador One', 'amb1@test.com', 'AMBASSADOR'),
    ('Test Ambassador Two', 'amb2@test.com', 'AMBASSADOR'),
    ('CiPD Admin', 'admin@cipd.iiitd.edu.in', 'ADMIN');
