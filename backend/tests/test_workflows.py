"""PostgreSQL integration tests in an isolated, rolled-back schema.

Set CIPD_TEST_DATABASE_URL to enable these tests. SMTP is always mocked.
"""
import os
import sys
import unittest
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from urllib.parse import urlparse, parse_qs
from cryptography.fernet import Fernet
from instagram_sync import InstagramSync, usage_from_headers

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DATABASE_URL', 'postgresql+psycopg2://postgres:test@localhost/test')
os.environ.setdefault('JWT_SECRET', 'test-only-key-01234567890123456789012345')
import main
import notifications
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine, text
from workflows import CampaignUpdate, GroupNotice, activity_page, ensure_member
from rankings import ranking_page
from service_adapters import ServiceAPI


@unittest.skipUnless(os.getenv('CIPD_TEST_DATABASE_URL'), 'Requires an explicit test database connection')
class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(os.environ['CIPD_TEST_DATABASE_URL'], hide_parameters=True)
        self.conn = self.engine.connect()
        self.transaction = self.conn.begin()
        self.schema = 'test_programme_' + uuid.uuid4().hex
        self.conn.exec_driver_sql(f'CREATE SCHEMA "{self.schema}"')
        self.conn.exec_driver_sql(f'SET LOCAL search_path TO "{self.schema}"')
        self.conn.exec_driver_sql((Path(__file__).parents[1] / 'schema.sql').read_text(encoding='utf-8'))
        connection = self.conn

        class Engine:
            @contextmanager
            def begin(self):
                with connection.begin_nested():
                    yield connection

            @contextmanager
            def connect(self):
                yield connection

        # Workflow route closures captured main.engine at installation.
        self.patches = [patch.object(main, 'engine', Engine())]
        for route in main.app.routes:
            endpoint = getattr(route, 'endpoint', None)
            if endpoint and endpoint.__module__ == 'workflows':
                for cell in endpoint.__closure__ or []:
                    if hasattr(cell.cell_contents, 'begin') and hasattr(cell.cell_contents, 'connect'):
                        self.patches.append(patch.object(cell.cell_contents, 'begin', Engine().begin))
                        self.patches.append(patch.object(cell.cell_contents, 'connect', Engine().connect))
        for p in self.patches:
            p.start()
        self.conn.execute(text("""INSERT INTO users(full_name,email,role,password_hash)
            VALUES ('Current','current@example.org','AMBASSADOR','test-hash'),
                   ('Departed','departed@example.org','AMBASSADOR','test-hash')"""))
        self.conn.execute(text("""INSERT INTO ambassadors(user_id,college_name,graduation_year,status)
            VALUES (4,'Test',2028,'ACTIVE'),(5,'Test',2028,'ACTIVE')"""))
        self.admin = {'user_id': 3, 'role': 'ADMIN'}
        self.user = {'user_id': 5, 'role': 'AMBASSADOR'}

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.transaction.rollback()
        self.conn.close()
        with self.engine.connect() as conn:
            self.assertFalse(conn.execute(text('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=:s)'), {'s': self.schema}).scalar())
        self.engine.dispose()

    def endpoint(self, path, method='POST'):
        return next(r.endpoint for r in main.app.routes if getattr(r, 'path', '') == path and method in r.methods)

    def instagram_fixture(self, count=1, month=None):
        key = patch.object(main, 'TOKEN_ENCRYPTION_KEY', Fernet.generate_key().decode())
        key.start(); self.patches.append(key)
        self.conn.execute(text("""INSERT INTO campaigns(title,start_date,end_date,is_active)
            VALUES('Sync test',CURRENT_DATE-INTERVAL '60 days',CURRENT_DATE+INTERVAL '2 days',TRUE)"""))
        campaign = self.conn.execute(text('SELECT MAX(campaign_id) FROM campaigns')).scalar()
        self.conn.execute(text("""INSERT INTO social_accounts(ambassador_id,platform,platform_user_id,profile_handle,verified,access_token)
            VALUES(1,'INSTAGRAM','account1','test',TRUE,:token)"""), {'token': main.encrypt_token('test-secret-must-not-be-exposed')})
        for index in range(count):
            self.conn.execute(text("""INSERT INTO campaign_posts(campaign_id,ambassador_id,platform,post_url,platform_post_id,published_at)
                VALUES(:campaign,1,'INSTAGRAM',:url,:media,:published)"""),
                {'campaign': campaign, 'url': f'https://instagram.com/p/test{index}', 'media': str(123+index), 'published': month or date.today()})
        return campaign

    @staticmethod
    def instagram_responses(reach=100, incomplete=False):
        def response(payload):
            return SimpleNamespace(status_code=200, ok=True, headers={}, json=lambda: payload)
        metrics = {'reach': reach, 'views': 200, 'saved': 2, 'shares': 3}
        if incomplete:
            del metrics['views']
        return [response({'like_count': 10, 'comments_count': 1}), response({'data': [
            {'name': name, 'values': [{'value': value}]} for name, value in metrics.items()]})]

    def test_existing_instagram_oauth_flow_remains_unchanged(self):
        self.instagram_fixture()
        user = {'user_id':4,'role':'AMBASSADOR'}
        config = dict(INSTAGRAM_APP_ID='test-app',INSTAGRAM_APP_SECRET='test-secret',
                      INSTAGRAM_REDIRECT_URI='https://test.ngrok-free.app/ambassador/social-accounts/instagram/callback')
        def response(payload):
            return SimpleNamespace(json=lambda:payload,raise_for_status=lambda:None)
        with patch.multiple(main,**config):
            url = main.instagram_authorize(user)['authorize_url']
            self.assertEqual(urlparse(url).hostname,'api.instagram.com')
            params = parse_qs(urlparse(url).query)
            self.assertEqual(params['scope'],['instagram_business_basic'])
            with patch('main.requests.post',return_value=response({'access_token':'test-short'})), patch('main.requests.get',side_effect=[
                response({'access_token':'test-long','expires_in':5184000}),
                response({'id':'original-app-id','username':'test-professional','followers_count':12}),
            ]):
                result = main.instagram_callback(code='test-code',state=params['state'][0])
            self.assertIn('instagram=connected',result.headers['location'])
            row = self.conn.execute(text("SELECT access_token,platform_user_id,token_expires_at FROM social_accounts WHERE ambassador_id=1 AND platform='INSTAGRAM'")).one()
            self.assertNotEqual(row.access_token,'test-long')
            self.assertEqual(main.decrypt_token(row.access_token),'test-long')
            self.assertEqual(row.platform_user_id,'original-app-id')
            self.assertIsNotNone(row.token_expires_at)

    def test_read_only_connection_expiry_warnings_are_scoped_and_exclude_departed(self):
        self.instagram_fixture()
        own = self.endpoint('/ambassador/connections/health','GET')
        admin = self.endpoint('/admin/connections/health','GET')
        member = {'user_id':4,'role':'AMBASSADOR'}
        self.conn.execute(text("UPDATE social_accounts SET token_expires_at=CURRENT_TIMESTAMP+INTERVAL '2 days' WHERE ambassador_id=1"))
        stored = self.conn.execute(text('SELECT access_token,token_expires_at,updated_at FROM social_accounts WHERE ambassador_id=1')).one()
        with patch('requests.get') as network, patch('requests.post') as post:
            warning = own(member)
            network.assert_not_called(); post.assert_not_called()
        self.assertEqual(warning['status'],'EXPIRING_SOON')
        self.assertEqual(warning['days_remaining'],2)
        self.assertNotIn('access_token',warning)
        self.assertNotIn('test-secret',str(warning))
        self.assertEqual(tuple(stored),tuple(self.conn.execute(text('SELECT access_token,token_expires_at,updated_at FROM social_accounts WHERE ambassador_id=1')).one()))
        self.assertEqual(admin(1,self.admin)['total'],1)
        self.assertEqual(own({'user_id':5,'role':'AMBASSADOR'})['status'],'NOT_CONNECTED')
        self.conn.execute(text("UPDATE social_accounts SET token_expires_at=CURRENT_TIMESTAMP+INTERVAL '60 days' WHERE ambassador_id=1"))
        self.assertEqual(own(member)['status'],'HEALTHY')
        self.conn.execute(text("UPDATE social_accounts SET token_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 day' WHERE ambassador_id=1"))
        self.assertEqual(own(member)['status'],'EXPIRED')
        self.conn.execute(text("UPDATE social_accounts SET token_expires_at=NULL WHERE ambassador_id=1"))
        self.assertEqual(own(member)['status'],'EXPIRY_UNKNOWN')
        self.conn.execute(text("UPDATE ambassadors SET left_at=CURRENT_TIMESTAMP,status='LEFT' WHERE ambassador_id=1"))
        self.assertEqual(own(member)['status'],'LEFT')
        self.assertEqual(admin(1,self.admin)['total'],0)
        with self.assertRaises(HTTPException):
            admin(0,self.admin)
        for path,dependency in [('/admin/connections/health',main.require_admin),('/ambassador/connections/health',main.require_ambassador)]:
            route = next(r for r in main.app.routes if getattr(r,'path','')==path)
            self.assertTrue(any(d.call is dependency for d in route.dependant.dependencies))

    def test_portal_membership_guard_and_safe_errors_wrap_original_authentication(self):
        self.instagram_fixture()
        member = {'user_id':4,'role':'AMBASSADOR'}
        self.conn.execute(text("UPDATE ambassadors SET left_at=CURRENT_TIMESTAMP,status='LEFT' WHERE user_id=4"))
        authorize = self.endpoint('/ambassador/social-accounts/instagram/authorize','GET')
        with patch.object(main,'instagram_authorize') as original:
            with self.assertRaises(HTTPException):
                authorize(member)
            original.assert_not_called()
        callback = self.endpoint('/ambassador/social-accounts/instagram/callback','GET')
        with patch('requests.post') as network:
            result = callback(code='test-code',state=main.create_oauth_state(4))
            self.assertIn('membership',result.headers['location'])
            network.assert_not_called()
        unsafe = main.RedirectResponse(main.FRONTEND_URL+'/ambassador/social-accounts?instagram=error&message=secret-token-value')
        with patch.object(main,'instagram_callback',return_value=unsafe):
            result = callback(error='access_denied')
        self.assertNotIn('secret-token-value',result.headers['location'])
        self.assertIn('instagram=error',result.headers['location'])

    def test_instagram_daily_upsert_and_failure_preserves_success(self):
        self.instagram_fixture()
        service = InstagramSync(ServiceAPI(main))
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses()):
            self.assertTrue(service.sync_post(1, force=True)['changed'])
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses()):
            self.assertFalse(service.sync_post(1, force=True)['changed'])
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses(reach=150)):
            self.assertTrue(service.sync_post(1, force=True)['changed'])
        self.assertEqual(self.conn.execute(text('SELECT COUNT(*) FROM metric_snapshots')).scalar(), 1)
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses(reach=0, incomplete=True)):
            with self.assertRaises(HTTPException):
                service.sync_post(1, force=True)
        self.assertEqual(self.conn.execute(text('SELECT reach_count FROM metric_snapshots')).scalar(), 150)
        state = self.conn.execute(text('SELECT * FROM instagram_sync_state')).mappings().one()
        self.assertEqual(state['status'], 'FAILED'); self.assertIsNotNone(state['last_success_at'])
        status = self.endpoint('/admin/instagram/sync-status', 'GET')(None, self.admin)
        self.assertEqual(status['posts'][0]['post_id'], 1)
        self.assertNotIn('test-secret', str(status))

    def test_instagram_throttling_is_durable_and_shared(self):
        self.instagram_fixture()
        service = InstagramSync(ServiceAPI(main))
        response = SimpleNamespace(status_code=429, ok=False,
            headers={'Retry-After':'1200', 'X-Business-Use-Case-Usage':'{"account":[{"call_count":95,"estimated_time_to_regain_access":30}]}'},
            json=lambda: {'error': {'code': 80002}})
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', return_value=response) as network:
            with self.assertRaises(HTTPException):
                service.sync_post(1, force=True)
            with self.assertRaises(HTTPException):
                service.sync_post(1, force=True)
        self.assertEqual(network.call_count, 1)
        self.assertEqual(self.conn.execute(text('SELECT COUNT(*) FROM instagram_api_calls')).scalar(), 1)
        self.assertGreaterEqual(usage_from_headers(response.headers)[1], 1800)
        self.assertIsNotNone(self.conn.execute(text("SELECT paused_until FROM instagram_api_cooldowns WHERE scope='global'")).scalar())
        self.assertEqual(self.conn.execute(text('SELECT COUNT(*) FROM metric_snapshots')).scalar(), 0)

    def test_instagram_batch_calculates_once_per_campaign(self):
        campaign = self.instagram_fixture(count=2)
        service = InstagramSync(ServiceAPI(main))
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses()+self.instagram_responses()), patch.object(service, 'recalculate') as calculate:
            service.run_tick()
        calculate.assert_called_once_with(campaign)
        self.assertEqual(self.conn.execute(text("SELECT COUNT(*) FROM instagram_sync_state WHERE status='SUCCESS'")).scalar(), 2)

    def test_instagram_local_budget_and_real_zero(self):
        self.instagram_fixture()
        service = InstagramSync(ServiceAPI(main))
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses(reach=0)):
            service.sync_post(1, force=True)
        self.assertEqual(self.conn.execute(text('SELECT reach_count FROM metric_snapshots')).scalar(), 0)
        with patch.dict(os.environ, {'INSTAGRAM_API_APP_CALLS_PER_HOUR':'2'}), patch('instagram_sync.requests.get') as network:
            with self.assertRaises(HTTPException):
                service.sync_post(1, force=True)
            network.assert_not_called()
        self.assertEqual(self.conn.execute(text('SELECT status FROM instagram_sync_state')).scalar(), 'PAUSED')

    def test_monthly_waits_for_sync_then_uses_refreshed_metrics(self):
        month = notifications.previous_month()
        self.instagram_fixture(month=month)
        self.conn.execute(text('UPDATE users SET created_at=:month WHERE user_id IN (4,5)'), {'month':month})
        service = InstagramSync(ServiceAPI(main))
        with patch.object(service, 'refresh_campaign', return_value=False):
            service.prepare_monthly()
        self.assertEqual(self.conn.execute(text("SELECT COUNT(*) FROM email_outbox WHERE kind='MONTHLY_REPORT'")).scalar(), 0)
        with patch('instagram_sync.time.sleep'), patch('instagram_sync.requests.get', side_effect=self.instagram_responses(reach=321)):
            service.prepare_monthly()
        self.assertEqual(self.conn.execute(text('SELECT status FROM monthly_sync_runs')).scalar(), 'READY')
        body = self.conn.execute(text("SELECT body FROM email_outbox WHERE user_id=4 AND kind='MONTHLY_REPORT'")).scalar()
        self.assertIn('321', body)
        self.assertIn('cumulative', body)
        with patch('instagram_sync.requests.get') as network:
            service.prepare_monthly()
            network.assert_not_called()
        self.conn.execute(text("UPDATE email_outbox SET body='Old queued report' WHERE kind='MONTHLY_REPORT'"))
        notifications.queue_monthly_reports(self.conn, month)
        self.assertIn('321', self.conn.execute(text("SELECT body FROM email_outbox WHERE user_id=4 AND kind='MONTHLY_REPORT'")).scalar())
        self.conn.execute(text("UPDATE email_outbox SET status='SENT',body='Already sent' WHERE kind='MONTHLY_REPORT'"))
        notifications.queue_monthly_reports(self.conn, month)
        self.assertEqual(self.conn.execute(text("SELECT body FROM email_outbox WHERE user_id=4 AND kind='MONTHLY_REPORT'")).scalar(), 'Already sent')

    def test_delivery_holds_monthly_mail_until_refresh_ready(self):
        month = notifications.previous_month()
        self.conn.execute(text("""INSERT INTO email_outbox(user_id,kind,report_month,subject,body)
            VALUES(4,'MONTHLY_REPORT',:month,'Report','Not refreshed')"""), {'month':month})
        with patch.dict(os.environ, {'EMAIL_DELIVERY_ENABLED':'true','SMTP_HOST':'test.example.org','SMTP_FROM':'test@example.org','SMTP_USERNAME':'','EMAIL_AUTOSEND_AFTER':''}), patch('notifications.smtplib.SMTP') as smtp:
            self.assertEqual(notifications.deliver_pending(main.engine)['sent'], 0)
            smtp.assert_not_called()


    def test_overall_averages_campaign_scores_and_ignores_other_platforms(self):
        first = self.instagram_fixture()
        second = self.conn.execute(text("""INSERT INTO campaigns(title,start_date,end_date,is_active)
            VALUES('Second',CURRENT_DATE,CURRENT_DATE+INTERVAL '3 days',TRUE) RETURNING campaign_id""")).scalar()
        self.conn.execute(text("""INSERT INTO campaign_posts(campaign_id,ambassador_id,platform,post_url,platform_post_id,published_at,is_verified)
            VALUES(:second,1,'INSTAGRAM','https://instagram.com/p/second','222',CURRENT_TIMESTAMP,TRUE),
                  (:first,2,'INSTAGRAM','https://instagram.com/p/other','333',CURRENT_TIMESTAMP,TRUE),
                  (:first,1,'LINKEDIN','https://linkedin.com/test','legacy',CURRENT_TIMESTAMP,TRUE)"""), {'first':first,'second':second})
        self.conn.execute(text('UPDATE campaign_posts SET is_verified=TRUE WHERE post_id=1'))
        self.conn.execute(text("""INSERT INTO metric_snapshots(post_id,reach_count,likes_count)
            VALUES(1,100,10),(2,200,20),(3,300,30),(4,999999,9999)"""))
        self.conn.execute(text("""INSERT INTO ambassador_ratings(campaign_id,ambassador_id,normalized_score,percentile_rank,star_rating)
            VALUES(:first,1,60,0,3),(:second,1,100,100,5),(:first,2,85,100,5)"""), {'first':first,'second':second})
        results = ranking_page(main.engine,user_id=4)
        self.assertEqual(results['total_ranked'],2)
        self.assertEqual(results['own_result']['normalized_score'],80)
        self.assertEqual(results['own_result']['rank'],2)
        self.assertEqual(results['own_result']['total_reach'],300)
        self.assertEqual(results['own_result']['campaigns_scored'],2)
        self.assertEqual(ranking_page(main.engine,first,user_id=4)['own_result']['total_reach'],100)
        report = next(r for r in notifications.monthly_metrics(self.conn,date.today().replace(day=1)) if r['user_id']==4)
        self.assertEqual(report['normalized_score'],80)
        self.assertEqual(report['reach'],300)
        with self.assertRaises(HTTPException):
            main.connect_social_account(main.SocialAccountConnectRequest(user_id=4,platform='LINKEDIN',
                platform_user_id='legacy',profile_handle='test'),{'user_id':4,'role':'AMBASSADOR'})
        with self.assertRaises(HTTPException):
            main.submit_campaign_post(main.CampaignPostSubmitRequest(user_id=4,campaign_id=first,
                platform='TWITTER',post_url='https://example.org/post'),{'user_id':4,'role':'AMBASSADOR'})

    def test_ended_campaign_freezes_preclosing_metrics_and_survives_departure(self):
        campaign = self.instagram_fixture()
        self.conn.execute(text("UPDATE campaigns SET end_date=CURRENT_DATE-INTERVAL '1 day' WHERE campaign_id=:id"), {'id':campaign})
        self.conn.execute(text("UPDATE campaign_posts SET published_at=CURRENT_TIMESTAMP-INTERVAL '2 days',is_verified=TRUE"))
        self.conn.execute(text("""INSERT INTO metric_snapshots(post_id,reach_count,likes_count,fetched_at)
            VALUES(1,100,10,CURRENT_TIMESTAMP-INTERVAL '2 days'),(1,99999,999,CURRENT_TIMESTAMP)"""))
        # Leaving after closing finalises the result before eligibility changes.
        with patch('instagram_sync.requests.get') as network:
            self.endpoint('/ambassador/membership/leave')({'user_id':4,'role':'AMBASSADOR'})
            network.assert_not_called()
        frozen = ranking_page(main.engine,campaign,user_id=4)
        self.assertIsNotNone(frozen['campaign']['finalized_at'])
        self.assertFalse(self.conn.execute(text('SELECT is_active FROM campaigns WHERE campaign_id=:id'), {'id':campaign}).scalar())
        self.assertEqual(frozen['own_result']['total_reach'],100)
        self.assertEqual(frozen['own_result']['rank'],1)
        self.assertEqual(frozen['own_result']['normalized_score'],100)
        self.assertIsNone(ranking_page(main.engine,user_id=4)['own_result'])
        with self.assertRaises(HTTPException):
            main.verify_campaign_post(1,main.MetricVerificationRequest(reach_count=999,likes_count=9,
                comments_count=0,shares_count=0,saves_count=0,views_impressions=0),self.admin)
        with self.assertRaises(HTTPException):
            main.instagram_sync.sync_post(1,force=True)
        main._calculate_campaign_ratings(campaign,self.admin)
        self.assertEqual(ranking_page(main.engine,campaign,user_id=4)['own_result']['total_reach'],100)
        self.assertEqual(self.conn.execute(text('SELECT COUNT(*) FROM campaign_ranking_snapshots')).scalar(),1)

    def test_ended_campaign_with_missing_data_has_no_zero_award(self):
        campaign = self.instagram_fixture()
        self.conn.execute(text("UPDATE campaigns SET end_date=CURRENT_DATE-INTERVAL '1 day' WHERE campaign_id=:id"), {'id':campaign})
        main.instagram_sync.finalize_due()
        result = ranking_page(main.engine,campaign)
        self.assertIsNotNone(result['campaign']['finalized_at'])
        self.assertEqual(result['leaderboard'],[])

    def test_manual_ranking_waits_when_refresh_fails(self):
        with patch.object(main.instagram_sync, 'refresh_campaign', return_value=False), patch.object(main, '_calculate_campaign_ratings') as calculate:
            with self.assertRaises(HTTPException):
                main.calculate_campaign_ratings(123, self.admin)
            calculate.assert_not_called()

    def test_leave_retains_data_cancels_mail_blocks_reactivation_and_reinstates(self):
        notifications.queue_welcome_email(self.conn, 5, 'Departed', None)
        leave = self.endpoint('/ambassador/membership/leave')
        leave(self.user)
        leave(self.user)
        self.assertEqual(self.conn.execute(text('SELECT status FROM ambassadors WHERE user_id=5')).scalar(), 'LEFT')
        self.assertEqual(self.conn.execute(text('SELECT COUNT(*) FROM users WHERE user_id=5')).scalar(), 1)
        self.assertEqual(self.conn.execute(text("SELECT status FROM email_outbox WHERE user_id=5")).scalar(), 'CANCELLED')
        self.assertFalse(notifications.queue_welcome_email(self.conn, 5, 'Departed', None))
        with self.assertRaises(HTTPException):
            ensure_member(main.engine, 5)
        self.assertEqual(notifications.queue_broadcast(self.conn, 'Test', 'Hello', None), 1)
        self.assertEqual(main.get_notification_recipients(self.admin)['ambassadors'][0]['user_id'], 4)
        self.assertEqual(len(main.get_notification_recipients(self.admin)['ambassadors']), 1)
        self.endpoint('/admin/ambassadors/{ambassador_id}/reinstate')(2, self.admin)
        self.assertIsNone(self.conn.execute(text('SELECT left_at FROM ambassadors WHERE user_id=5')).scalar())
        self.assertEqual(self.conn.execute(text("SELECT status FROM email_outbox WHERE user_id=5 AND kind='WELCOME'")).scalar(), 'CANCELLED')

    def test_campaign_management_and_recalculation_status(self):
        today = date.today()
        created = main.create_admin_campaign(main.CampaignCreateRequest(title='Original', start_date=today, end_date=today + timedelta(days=3)), BackgroundTasks(), self.admin)
        campaign_id = created['campaign']['campaign_id']
        update = self.endpoint('/admin/campaigns/{campaign_id}/management', 'PUT')
        update(campaign_id, CampaignUpdate(title='Edited', start_date=today, end_date=today + timedelta(days=3), archived=True), self.admin)
        row = self.conn.execute(text('SELECT title,is_active,archived_at FROM campaigns WHERE campaign_id=:id'), {'id': campaign_id}).one()
        self.assertEqual(row.title, 'Edited'); self.assertFalse(row.is_active); self.assertIsNotNone(row.archived_at)
        self.assertEqual(self.conn.execute(text("SELECT COUNT(*) FROM email_outbox WHERE kind='CAMPAIGN'")).scalar(), 2)
        with self.assertRaises(HTTPException):
            update(campaign_id, CampaignUpdate(title='', start_date=today, end_date=today), self.admin)
        self.conn.execute(text("INSERT INTO social_accounts(ambassador_id,platform,platform_user_id,profile_handle,verified) VALUES(1,'INSTAGRAM','1','test',TRUE)"))
        self.conn.execute(text("INSERT INTO campaign_posts(campaign_id,ambassador_id,platform,post_url,platform_post_id,is_verified) VALUES(:id,1,'INSTAGRAM','https://instagram.com/p/test','test',TRUE)"), {'id': campaign_id})
        self.conn.execute(text('INSERT INTO metric_snapshots(post_id,reach_count,likes_count) VALUES(1,100,10)'))
        management = self.endpoint('/admin/campaigns/{campaign_id}/management', 'GET')
        self.assertTrue(management(campaign_id, self.admin)['recalculation_needed'])
        self.conn.execute(text("INSERT INTO ambassador_ratings(ambassador_id,campaign_id,normalized_score,percentile_rank,star_rating) VALUES(2,:id,50,20,3)"), {'id': campaign_id})
        self.endpoint('/ambassador/membership/leave')(self.user)
        main.calculate_campaign_ratings(campaign_id, self.admin)
        self.assertEqual(self.conn.execute(text('SELECT COUNT(*) FROM ambassador_ratings WHERE ambassador_id=2 AND campaign_id=:id'), {'id': campaign_id}).scalar(), 1)
        self.assertFalse(management(campaign_id, self.admin)['recalculation_needed'])
        self.conn.execute(text("INSERT INTO metric_snapshots(post_id,reach_count,fetched_at) VALUES(1,200,CURRENT_TIMESTAMP + INTERVAL '1 second')"))
        self.assertTrue(management(campaign_id, self.admin)['recalculation_needed'])

    def test_group_preview_excludes_departed_and_activity_paginates(self):
        self.endpoint('/ambassador/membership/leave')(self.user)
        url = 'https://chat.whatsapp.com/TestInvite'
        self.conn.execute(text('INSERT INTO portal_settings(settings_id,whatsapp_group_invite_url) VALUES(1,:url)'), {'url': url})
        preview = self.endpoint('/admin/settings/whatsapp-notice/preview')(GroupNotice(invite_url=url), self.admin)
        self.assertEqual(preview['recipient_count'], 1)
        self.assertIn(url, preview['body'])
        with patch.object(main, 'email_ready', return_value=False):
            notice = GroupNotice(invite_url=url, request_id=preview['request_id'])
            self.endpoint('/admin/settings/whatsapp-notice/send')(notice, BackgroundTasks(), self.admin)
            self.endpoint('/admin/settings/whatsapp-notice/send')(notice, BackgroundTasks(), self.admin)
        self.assertEqual(self.conn.execute(text("SELECT COUNT(*) FROM email_outbox WHERE user_id=5")).scalar(), 0)
        self.assertEqual(self.conn.execute(text("SELECT COUNT(*) FROM email_outbox WHERE user_id=4 AND kind='BROADCAST'")).scalar(), 1)
        for i in range(4):
            main.log_admin_activity(self.conn, self.admin, 'TEST_ACTION', str(i))
        first = activity_page(main.engine, limit=2, page=1, action='TEST_ACTION', admin_user_id=3)
        second = activity_page(main.engine, limit=2, page=2, action='TEST_ACTION', admin_user_id=3)
        self.assertEqual(first['total'], 4)
        self.assertTrue({r['activity_id'] for r in first['activities']}.isdisjoint({r['activity_id'] for r in second['activities']}))
        self.assertEqual(activity_page(main.engine, date_from=date.today()+timedelta(days=2))['total'], 0)

    def test_delivery_rechecks_departed_members_and_monthly_recipients(self):
        notifications.queue_welcome_email(self.conn, 4, 'Current', None)
        notifications.queue_welcome_email(self.conn, 5, 'Departed', None)
        self.conn.execute(text("UPDATE ambassadors SET status='LEFT',left_at=CURRENT_TIMESTAMP WHERE user_id=5"))
        with patch.dict(os.environ, {'EMAIL_DELIVERY_ENABLED':'true','SMTP_HOST':'test.example.org','SMTP_FROM':'test@example.org','SMTP_USERNAME':'','EMAIL_AUTOSEND_AFTER':''}), patch('notifications.smtplib.SMTP') as smtp:
            result = notifications.deliver_pending(main.engine)
        self.assertEqual(result['sent'], 1)
        self.assertEqual(smtp.return_value.__enter__.return_value.send_message.call_count, 1)
        self.assertEqual(self.conn.execute(text('SELECT status FROM email_outbox WHERE user_id=5')).scalar(), 'CANCELLED')
        rows = notifications.monthly_metrics(self.conn, date.today().replace(day=1))
        self.assertEqual([r['user_id'] for r in rows], [4])


if __name__ == '__main__':
    unittest.main()
