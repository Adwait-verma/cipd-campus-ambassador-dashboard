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
-- Rebuild live scores once under the Instagram-only scope.
UPDATE campaigns SET last_calculated_at=NULL WHERE finalized_at IS NULL;
UPDATE campaigns SET is_active=FALSE WHERE finalized_at IS NOT NULL;
