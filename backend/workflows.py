"""Programme membership and administrative management, retaining historical data."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from uuid import UUID, uuid4
from math import ceil
from urllib.parse import parse_qs, urlparse, urlencode

from fastapi import BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text


def ensure_member(engine, user_id):
    with engine.connect() as conn:
        left = conn.execute(text("SELECT left_at FROM ambassadors WHERE user_id=:id"), {"id": user_id}).scalar()
    if left:
        raise HTTPException(403, "You have left the programme. Contact CiPD to request rejoining.")


def activity_page(engine, limit=50, page=1, action=None, admin_user_id=None, date_from=None, date_to=None):
    if page < 1 or not 1 <= limit <= 200:
        raise HTTPException(400, "Invalid page or page size.")
    if date_from and date_to and date_from > date_to:
        raise HTTPException(400, "Start date must be before end date.")
    zone = ZoneInfo("Asia/Kolkata")
    params = dict(action=action or None, admin=admin_user_id,
                  start=datetime.combine(date_from, time.min, zone) if date_from else None,
                  end=datetime.combine(date_to + timedelta(days=1), time.min, zone) if date_to else None,
                  limit=limit, offset=(page - 1) * limit)
    where = """WHERE (:action IS NULL OR l.action=CAST(:action AS TEXT))
        AND (:admin IS NULL OR l.admin_user_id=CAST(:admin AS INT))
        AND (:start IS NULL OR l.created_at>=CAST(:start AS TIMESTAMPTZ))
        AND (:end IS NULL OR l.created_at<CAST(:end AS TIMESTAMPTZ))"""
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM admin_activity_logs l " + where), params).scalar_one()
        rows = conn.execute(text("""SELECT l.*, u.full_name AS admin_name, u.email AS admin_email
            FROM admin_activity_logs l LEFT JOIN users u ON u.user_id=l.admin_user_id """ + where +
            " ORDER BY l.created_at DESC, l.activity_id DESC LIMIT :limit OFFSET :offset"), params).mappings().all()
        admins = conn.execute(text("SELECT user_id, full_name FROM users WHERE role='ADMIN' ORDER BY full_name")).mappings().all()
        actions = conn.execute(text("SELECT DISTINCT action FROM admin_activity_logs ORDER BY action")).scalars().all()
    return dict(activities=[dict(r) for r in rows], total=total, page=page, page_size=limit,
                administrators=[dict(r) for r in admins], actions=actions)


class CampaignUpdate(BaseModel):
    title: str
    description: str | None = None
    mandatory_hashtag: str | None = None
    target_url: str | None = None
    start_date: date
    end_date: date
    is_active: bool = True
    archived: bool = False


class GroupNotice(BaseModel):
    invite_url: str
    request_id: UUID | None = None


def connection_health(row, timestamp=None):
    """Read stored expiry metadata; do not contact Instagram or change credentials."""
    timestamp = timestamp or datetime.now(ZoneInfo('UTC'))
    expiry = row['token_expires_at']
    days = max(0,ceil((expiry-timestamp).total_seconds()/86400)) if expiry else None
    status, message = 'HEALTHY', 'Instagram access is current. No action is needed.'
    if row['left_at']:
        status, message = 'LEFT', 'Programme membership has ended. Historical results remain stored.'
    elif not row['account_id']:
        status, message = 'NOT_CONNECTED', 'Connect Instagram from the Instagram page to participate.'
    elif not row['verified'] or not row['has_token'] or row['connection_failure']:
        status, message = 'RECONNECT_REQUIRED', 'Reconnect Instagram to restore automatic updates. Your saved metrics are retained.'
    elif expiry and expiry <= timestamp:
        status, message = 'EXPIRED', 'Instagram access has expired. Reconnect to resume updates; your saved metrics are retained.'
    elif expiry and expiry <= timestamp+timedelta(days=7):
        status, message = 'EXPIRING_SOON', f'Instagram access expires in {days} day(s). Automatic renewal is attempted during metric updates. Reconnect if the expiry date is not extended.'
    elif expiry is None:
        status, message = 'EXPIRY_UNKNOWN', 'An expiry date is unavailable. Reconnect Instagram to renew and confirm access.'
    return {key:row[key] for key in ('ambassador_id','user_id','full_name','profile_handle')} | {
        'status':status,'message':message,'expires_at':expiry,'days_remaining':days,
        'needs_attention':status in ('RECONNECT_REQUIRED','EXPIRED','EXPIRING_SOON','EXPIRY_UNKNOWN')}


CONNECTION_HEALTH_SQL = """SELECT a.ambassador_id,a.user_id,u.full_name,a.left_at,
    s.account_id,s.profile_handle,s.verified,s.token_expires_at,(s.access_token IS NOT NULL) AS has_token,
    EXISTS(SELECT 1 FROM instagram_sync_state st JOIN instagram_campaign_posts cp USING(post_id)
        WHERE cp.ambassador_id=a.ambassador_id AND st.status='FAILED'
        AND st.last_attempt_at>=s.updated_at AND st.last_error LIKE 'Reconnect Instagram:%') AS connection_failure
    FROM ambassadors a JOIN users u USING(user_id)
    LEFT JOIN instagram_social_accounts s ON s.ambassador_id=a.ambassador_id
"""


def install_workflows(api):
    app, engine = api.app, api.engine

    # Keep the collaborator-owned OAuth functions unchanged. Programme membership
    # and redirect-message privacy are enforced at the portal route boundary.
    paths = {'/ambassador/social-accounts/instagram/authorize',
             '/ambassador/social-accounts/instagram/callback'}
    app.router.routes[:] = [route for route in app.router.routes if getattr(route,'path',None) not in paths]

    @app.get('/ambassador/social-accounts/instagram/authorize')
    def authorize_current_member(user=Depends(api.require_ambassador)):
        ensure_member(api.engine,user['user_id'])
        return api.instagram_authorize(user)

    @app.get('/ambassador/social-accounts/instagram/callback')
    def portal_callback(code: str | None = None, state: str | None = None,
                        error: str | None = None, error_description: str | None = None):
        owner = None
        if not error and code and state:
            try:
                owner = api.verify_oauth_state(state)
            except HTTPException:
                pass  # The original callback handles invalid state itself.
            if owner:
                with api.engine.connect() as conn:
                    left = conn.execute(text('SELECT left_at FROM ambassadors WHERE user_id=:id'), {'id':owner}).scalar()
                if left:
                    return api.RedirectResponse(api.FRONTEND_URL+'/ambassador/social-accounts?'+urlencode(
                        {'instagram':'error','message':'Programme membership has ended. Contact CiPD to rejoin.'}))
                api.instagram_sync.finalize_for_member(owner)
        result = api.instagram_callback(code=code,state=state,error=error,error_description=error_description)
        if owner:
            with api.engine.begin() as conn:
                conn.execute(text("UPDATE ambassadors SET status='LEFT' WHERE user_id=:id AND left_at IS NOT NULL"), {'id':owner})
        query = parse_qs(urlparse(result.headers.get('location','')).query)
        if query.get('instagram') == ['error']:
            # Original requests/SQL exceptions may include credential-bearing URLs.
            return api.RedirectResponse(api.FRONTEND_URL+'/ambassador/social-accounts?'+urlencode(
                {'instagram':'error','message':'Instagram connection could not be completed. Please retry or contact programme support.'}))
        return result

    @app.get('/ambassador/connections/health')
    def own_health(user=Depends(api.require_ambassador)):
        with api.engine.connect() as conn:
            row = conn.execute(text(CONNECTION_HEALTH_SQL+' WHERE a.user_id=:id'), {'id':user['user_id']}).mappings().first()
        if not row:
            raise HTTPException(404,'Ambassador profile not found.')
        return connection_health(row)

    @app.get('/admin/connections/health')
    def admin_health(page: int = 1, user=Depends(api.require_admin)):
        if page<1:
            raise HTTPException(400,'Invalid page.')
        with api.engine.connect() as conn:
            rows = conn.execute(text(CONNECTION_HEALTH_SQL+' WHERE a.left_at IS NULL ORDER BY u.full_name,a.ambassador_id')).mappings().all()
        warnings = [connection_health(row) for row in rows]
        warnings = [row for row in warnings if row['needs_attention']]
        order = {'EXPIRED':0,'RECONNECT_REQUIRED':1,'EXPIRING_SOON':2,'EXPIRY_UNKNOWN':3}
        warnings.sort(key=lambda row:(order[row['status']],row['days_remaining'] if row['days_remaining'] is not None else 999,row['ambassador_id']))
        return {'connections':warnings[(page-1)*25:page*25],'total':len(warnings),'page':page,'page_size':25}

    @app.get('/ambassador/membership')
    def membership(user=Depends(api.require_ambassador)):
        with engine.connect() as conn:
            row = conn.execute(text("SELECT status, left_at FROM ambassadors WHERE user_id=:id"), {"id": user['user_id']}).mappings().first()
        if not row:
            raise HTTPException(404, 'Ambassador not found.')
        return dict(row)

    @app.post('/ambassador/membership/leave')
    def leave(user=Depends(api.require_ambassador)):
        api.instagram_sync.finalize_for_member(user['user_id'])
        with engine.begin() as conn:
            row = conn.execute(text("""UPDATE ambassadors SET status='LEFT', left_at=CURRENT_TIMESTAMP
                WHERE user_id=:id AND left_at IS NULL RETURNING ambassador_id"""), {'id': user['user_id']}).first()
            conn.execute(text("""UPDATE email_outbox SET status='CANCELLED', last_error='Programme membership ended'
                WHERE user_id=:id AND kind IN ('WELCOME','CAMPAIGN','MONTHLY_REPORT','BROADCAST')
                AND status IN ('PENDING','FAILED','SENDING')"""), {'id': user['user_id']})
        return {'message': 'You have left the programme. Programme emails are stopped; your historical data is retained.', 'status': 'LEFT'}

    @app.post('/admin/ambassadors/{ambassador_id}/reinstate')
    def reinstate(ambassador_id: int, user=Depends(api.require_admin)):
        with engine.connect() as conn:
            owner = conn.execute(text('SELECT user_id FROM ambassadors WHERE ambassador_id=:id'), {'id':ambassador_id}).scalar()
        if owner:
            api.instagram_sync.finalize_for_member(owner)
        with engine.begin() as conn:
            result = conn.execute(text("""UPDATE ambassadors a SET left_at=NULL,
                status=CASE WHEN EXISTS(SELECT 1 FROM instagram_social_accounts s WHERE s.ambassador_id=a.ambassador_id AND s.verified)
                THEN 'ACTIVE' ELSE 'PENDING' END WHERE ambassador_id=:id AND left_at IS NOT NULL RETURNING status"""), {'id': ambassador_id}).first()
            if not result:
                raise HTTPException(404, 'Departed ambassador not found.')
            api.log_admin_activity(conn, user, 'AMBASSADOR_REINSTATED', 'Reinstated ambassador after a rejoining request.', 'ambassador', ambassador_id)
        return {'status': result.status, 'message': 'Membership restored. Cancelled emails will not be resent.'}

    @app.get('/admin/campaigns/{campaign_id}/management')
    def management(campaign_id: int, user=Depends(api.require_admin)):
        with engine.connect() as conn:
            row = conn.execute(text('SELECT * FROM campaigns WHERE campaign_id=:id'), {'id': campaign_id}).mappings().first()
            if not row:
                raise HTTPException(404, 'Campaign not found.')
            latest = conn.execute(text("""SELECT MAX(ms.fetched_at) FROM instagram_metric_snapshots ms JOIN instagram_campaign_posts cp USING(post_id)
                WHERE cp.campaign_id=:id AND cp.is_verified"""), {'id': campaign_id}).scalar()
            last = row['last_calculated_at'] or conn.execute(text('SELECT MAX(calculated_at) FROM ambassador_ratings WHERE campaign_id=:id'), {'id': campaign_id}).scalar()
        return {'campaign': dict(row), 'recalculation_needed': not row['finalized_at'] and bool(latest and (not last or latest > last))}

    @app.put('/admin/campaigns/{campaign_id}/management')
    def update(campaign_id: int, data: CampaignUpdate, user=Depends(api.require_admin)):
        if not data.title.strip() or len(data.title.strip()) > 200 or data.end_date < data.start_date:
            raise HTTPException(400, 'Provide a title of at most 200 characters and a valid date range.')
        if data.mandatory_hashtag and len(data.mandatory_hashtag) > 50:
            raise HTTPException(400, 'Hashtag must be at most 50 characters.')
        if data.target_url and not data.target_url.startswith(('https://', 'http://')):
            raise HTTPException(400, 'Content URL must use HTTP or HTTPS.')
        params = data.model_dump()
        params.update(id=campaign_id, title=data.title.strip(), is_active=data.is_active and not data.archived)
        with engine.begin() as conn:
            conn.execute(text('SELECT pg_advisory_xact_lock(826033,:id)'), {'id':campaign_id})
            previous = conn.execute(text('SELECT * FROM campaigns WHERE campaign_id=:id'), {'id':campaign_id}).mappings().first()
            if previous and (previous['finalized_at'] or previous['end_date'] < datetime.now(ZoneInfo('Asia/Kolkata')).date()):
                if data.start_date != previous['start_date'] or data.end_date != previous['end_date'] or params['is_active']:
                    raise HTTPException(409,'Ended campaign rankings are fixed. Dates and submissions cannot be reopened; create a new campaign instead.')
            row = conn.execute(text("""UPDATE campaigns SET title=:title, description=:description,
                mandatory_hashtag=:mandatory_hashtag, target_url=:target_url, start_date=:start_date,
                end_date=:end_date, is_active=:is_active,
                archived_at=CASE WHEN :archived THEN COALESCE(archived_at,CURRENT_TIMESTAMP) ELSE NULL END
                WHERE campaign_id=:id RETURNING campaign_id"""), params).first()
            if not row:
                raise HTTPException(404, 'Campaign not found.')
            api.log_admin_activity(conn, user, 'CAMPAIGN_UPDATED', 'Updated campaign details or open/archive status; existing posts and ratings retained.', 'campaign', campaign_id)
        return {'message': 'Campaign saved. No announcement email was sent.'}

    @app.post('/admin/settings/whatsapp-notice/preview')
    def group_preview(data: GroupNotice, user=Depends(api.require_admin)):
        with engine.connect() as conn:
            saved = conn.execute(text('SELECT whatsapp_group_invite_url FROM portal_settings WHERE settings_id=1')).scalar()
            count = conn.execute(text("""SELECT COUNT(*) FROM users u JOIN ambassadors a USING(user_id)
                WHERE u.password_hash IS NOT NULL AND a.left_at IS NULL AND a.status IN ('ACTIVE','PENDING')""")).scalar_one()
        if not saved or saved != data.invite_url:
            raise HTTPException(409, 'The saved group link changed. Save and preview the current link again.')
        return {'subject': 'CiPD WhatsApp group invitation updated',
                'body': f'Hello Ambassador,\n\nThe official CiPD WhatsApp group invitation has changed.\n\nOfficial WhatsApp group invite: {saved}\n\nThis message was sent by a CiPD administrator.',
                'recipient_count': count, 'request_id': str(uuid4())}

    @app.post('/admin/settings/whatsapp-notice/send')
    def group_send(data: GroupNotice, background_tasks: BackgroundTasks, user=Depends(api.require_admin)):
        if not data.request_id:
            raise HTTPException(400, 'Preview the email before sending.')
        preview = group_preview(data, user)
        with engine.begin() as conn:
            # Lock settings through queueing so the approved link cannot change mid-send.
            saved = conn.execute(text('SELECT whatsapp_group_invite_url FROM portal_settings WHERE settings_id=1 FOR UPDATE')).scalar()
            if saved != data.invite_url:
                raise HTTPException(409, 'Group link changed. Preview it again.')
            claimed = conn.execute(text('INSERT INTO group_notice_dispatches(request_id) VALUES(:id) ON CONFLICT DO NOTHING RETURNING request_id'), {'id': str(data.request_id)}).first()
            if not claimed:
                return {'message': 'This invitation was already queued. No duplicate emails were created.'}
            count = api.queue_broadcast(conn, preview['subject'], 'The official CiPD WhatsApp group invitation has changed.', saved)
            api.log_admin_activity(conn, user, 'WHATSAPP_NOTICE_QUEUED', f'Queued group invitation for {count} current members.', 'portal_settings', 1)
        if count and api.email_ready():
            background_tasks.add_task(api.deliver_pending, engine)
        return {'message': f'Queued {count} invitation emails for current members.'}
