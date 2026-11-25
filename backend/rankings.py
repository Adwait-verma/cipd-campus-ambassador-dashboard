"""Instagram campaign results and an overall average of stored campaign scores."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import os
from fastapi import Depends, HTTPException
from sqlalchemy import text

INDIA = ZoneInfo('Asia/Kolkata')


def campaign_cutoff(campaign):
    return datetime.combine(campaign.end_date + timedelta(days=1), datetime.min.time(), INDIA)


def freeze_campaign(conn, campaign, calculated):
    cutoff = campaign_cutoff(campaign)
    metrics = {row['ambassador_id']: row for row in conn.execute(text("""
        WITH latest AS (SELECT DISTINCT ON (ms.post_id) ms.* FROM instagram_metric_snapshots ms
            JOIN instagram_campaign_posts cp USING(post_id) WHERE cp.campaign_id=:id AND ms.fetched_at<:cutoff
            ORDER BY ms.post_id,ms.fetched_at DESC,ms.snapshot_id DESC)
        SELECT cp.ambassador_id,SUM(ls.reach_count)::BIGINT AS reach,
            SUM(ls.likes_count+ls.comments_count+ls.shares_count+ls.saves_count)::BIGINT AS engagements,
            COUNT(*)::INT AS posts FROM instagram_campaign_posts cp JOIN latest ls USING(post_id)
        WHERE cp.campaign_id=:id AND cp.is_verified AND cp.published_at<:cutoff GROUP BY cp.ambassador_id
        """), {'id':campaign.campaign_id, 'cutoff':cutoff}).mappings()}
    for row in calculated:
        values = metrics[row['ambassador_id']]
        conn.execute(text("""INSERT INTO campaign_ranking_snapshots(campaign_id,ambassador_id,rank,
            normalized_score,percentile_rank,star_rating,total_reach,total_engagements,published_posts)
            VALUES(:campaign,:ambassador_id,:rank,:normalized_score,:percentile_rank,:star_rating,:reach,:engagements,:posts)
            ON CONFLICT DO NOTHING"""), dict(row, campaign=campaign.campaign_id,
                                             reach=values['reach'],engagements=values['engagements'],posts=values['posts']))
    conn.execute(text('UPDATE campaigns SET finalized_at=CURRENT_TIMESTAMP,is_active=FALSE WHERE campaign_id=:id AND finalized_at IS NULL'), {'id':campaign.campaign_id})


RESULTS = """WITH latest_metrics AS (
    SELECT DISTINCT ON (ms.post_id) ms.* FROM instagram_metric_snapshots ms
    JOIN instagram_campaign_posts cp USING(post_id) JOIN campaigns c USING(campaign_id)
    WHERE c.finalized_at IS NULL AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
    ORDER BY ms.post_id,ms.fetched_at DESC,ms.snapshot_id DESC
), metrics AS (
    SELECT cp.campaign_id,cp.ambassador_id,SUM(ms.reach_count)::BIGINT AS total_reach,
        SUM(ms.likes_count+ms.comments_count+ms.shares_count+ms.saves_count)::BIGINT AS total_engagements,
        COUNT(*)::INT AS published_posts FROM instagram_campaign_posts cp JOIN latest_metrics ms USING(post_id)
    WHERE cp.is_verified GROUP BY cp.campaign_id,cp.ambassador_id
), latest_ratings AS (
    SELECT DISTINCT ON (ar.campaign_id,ar.ambassador_id) ar.* FROM ambassador_ratings ar
    ORDER BY ar.campaign_id,ar.ambassador_id,ar.calculated_at DESC,ar.rating_id DESC
), campaign_results AS (
    SELECT r.campaign_id,r.ambassador_id,r.normalized_score,r.percentile_rank,r.star_rating,
        r.calculated_at,ROW_NUMBER() OVER(PARTITION BY r.campaign_id ORDER BY r.normalized_score DESC,r.ambassador_id)::INT AS rank,
        m.total_reach,m.total_engagements,m.published_posts
    FROM latest_ratings r JOIN campaigns c USING(campaign_id)
    JOIN ambassadors a USING(ambassador_id) JOIN metrics m USING(campaign_id,ambassador_id)
    WHERE c.finalized_at IS NULL AND a.status='ACTIVE' AND a.left_at IS NULL
    UNION ALL
    SELECT campaign_id,ambassador_id,normalized_score,percentile_rank,star_rating,calculated_at,
        rank,total_reach,total_engagements,published_posts FROM campaign_ranking_snapshots
), overall_scores AS (
    SELECT cr.ambassador_id,ROUND(AVG(cr.normalized_score),2) AS normalized_score,
        COUNT(*)::INT AS campaigns_scored,SUM(cr.total_reach)::BIGINT AS total_reach,
        SUM(cr.total_engagements)::BIGINT AS total_engagements,SUM(cr.published_posts)::INT AS published_posts,
        MAX(cr.calculated_at) AS calculated_at FROM campaign_results cr JOIN ambassadors a USING(ambassador_id)
    WHERE a.status='ACTIVE' AND a.left_at IS NULL GROUP BY cr.ambassador_id
), overall_ranks AS (
    SELECT *,RANK() OVER(ORDER BY normalized_score DESC)::INT AS rank,COUNT(*) OVER() AS total
    FROM overall_scores
), overall_results AS (
    SELECT *,ROUND(CASE WHEN total=1 THEN 100.0 ELSE (total-rank)*100.0/(total-1) END,2) AS percentile_rank
    FROM overall_ranks
)
"""


def overall_rows(conn):
    return conn.execute(text(RESULTS+"""SELECT r.*,u.user_id,u.full_name,a.college_name,
        CASE WHEN percentile_rank>=90 THEN 5 WHEN percentile_rank>=70 THEN 4 ELSE 3 END AS star_rating
        FROM overall_results r JOIN ambassadors a USING(ambassador_id) JOIN users u USING(user_id)
        ORDER BY r.rank,r.ambassador_id""")).mappings().all()


def ranking_page(engine, campaign_id=None, page=1, user_id=None):
    if page<1:
        raise HTTPException(400,'Invalid page.')
    with engine.connect() as conn:
        campaigns = conn.execute(text('SELECT campaign_id,title,start_date,end_date,finalized_at,last_calculated_at FROM campaigns ORDER BY start_date DESC,campaign_id DESC')).mappings().all()
        selected = next((dict(c) for c in campaigns if c['campaign_id']==campaign_id),None)
        if campaign_id is not None and not selected:
            raise HTTPException(404,'Campaign not found.')
        if campaign_id is None:
            rows = [dict(r) for r in overall_rows(conn)]
        else:
            rows = [dict(r) for r in conn.execute(text(RESULTS+"""SELECT cr.*,u.user_id,u.full_name,a.college_name,
                1 AS campaigns_scored FROM campaign_results cr JOIN ambassadors a USING(ambassador_id)
                JOIN users u USING(user_id) WHERE cr.campaign_id=:campaign ORDER BY cr.rank,cr.ambassador_id"""), {'campaign':campaign_id}).mappings()]
    for row in rows:
        row['engagement_rate'] = round(100*row['total_engagements']/row['total_reach'],2) if row['total_reach'] else 0
    own = next((r for r in rows if r['user_id']==user_id),None)
    return {'leaderboard':rows[(page-1)*25:page*25], 'total_ranked':len(rows), 'page':page,'page_size':25,
            'campaigns':[dict(c) for c in campaigns], 'campaign':selected, 'own_result':own,
            'summary':{'five_star':sum(r['star_rating']==5 for r in rows),'four_star':sum(r['star_rating']==4 for r in rows),
                       'three_star':sum(r['star_rating']==3 for r in rows)}}


def install_rankings(api):
    @api.app.get('/admin/rankings')
    def admin_rankings(campaign_id: int | None = None, page: int = 1, user=Depends(api.require_admin)):
        return ranking_page(api.engine,campaign_id,page)

    @api.app.get('/ambassador/rankings')
    def ambassador_rankings(campaign_id: int | None = None, page: int = 1, user=Depends(api.require_ambassador)):
        return ranking_page(api.engine,campaign_id,page,user['user_id'])

    def policy():
        return {'interval_minutes':api.instagram_sync.interval,
                'connection_configured':bool(api.INSTAGRAM_APP_ID and api.INSTAGRAM_APP_SECRET and api.TOKEN_ENCRYPTION_KEY),
                'enabled':os.getenv('INSTAGRAM_SYNC_ENABLED','true').lower()=='true'}

    @api.app.get('/admin/instagram/sync-policy')
    def admin_policy(user=Depends(api.require_admin)):
        return policy()

    @api.app.get('/ambassador/instagram/sync-policy')
    def ambassador_policy(user=Depends(api.require_ambassador)):
        return policy()
