import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from notifications import automatic_email_cutoff, campaign_email_body, deliver_pending, email_ready, missing_email_settings, monthly_email_body, queue_campaign_notifications, queue_welcome_email


class Result:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class Connection:
    def __init__(self, recipients=None):
        self.recipients = recipients or []
        self.messages = []

    def execute(self, query, params=None):
        sql = str(query)
        if "SELECT user_id, full_name FROM users" in sql:
            return Result(rows=self.recipients)
        if "INSERT INTO email_outbox" in sql:
            self.messages.append(params)
            return Result(row=(len(self.messages),))
        raise AssertionError(f"Unexpected query: {sql}")


class NotificationTests(unittest.TestCase):
    def test_welcome_without_invite(self):
        conn = Connection()
        self.assertTrue(queue_welcome_email(conn, 1, "Test Ambassador", None))
        body = conn.messages[0]["body"]
        self.assertIn("Connect a supported social account", body)
        self.assertIn("Submit the direct URL", body)
        self.assertIn("/ambassador/guide", body)
        self.assertNotIn("WHATSAPP GROUP", body)

    def test_welcome_with_invite(self):
        conn = Connection()
        invite = "https://chat.whatsapp.com/TestInvite"
        self.assertTrue(queue_welcome_email(conn, 1, "Test Ambassador", invite))
        self.assertIn(invite, conn.messages[0]["body"])
        self.assertIn("OFFICIAL WHATSAPP GROUP", conn.messages[0]["body"])

    def test_campaign_template_for_every_recipient(self):
        class Recipient:
            def __init__(self, user_id, full_name):
                self.user_id = user_id
                self.full_name = full_name

        conn = Connection([Recipient(1, "One"), Recipient(2, "Two")])
        campaign = {
            "campaign_id": 42,
            "title": "Demo Campaign",
            "start_date": "2026-09-17",
            "end_date": "2026-09-30",
            "target_url": "https://example.org/post",
            "mandatory_hashtag": "#Demo",
            "description": "Use the official creative.",
        }
        self.assertEqual(queue_campaign_notifications(conn, campaign), 2)
        self.assertEqual([m["user_id"] for m in conn.messages], [1, 2])
        for message in conn.messages:
            self.assertIn(campaign["target_url"], message["body"])
            self.assertIn(campaign["description"], message["body"])
            self.assertIn("Submit the direct URL", message["body"])
            self.assertIn("/ambassador/campaigns/42", message["body"])
            self.assertEqual(message["campaign_id"], 42)

    def test_campaign_template_preserves_brief_and_hashtag(self):
        body = campaign_email_body("Student", {
            "campaign_id": 42,
            "title": "Demo Campaign",
            "start_date": "2026-09-17",
            "end_date": "2026-09-30",
            "target_url": "https://example.org/official",
            "mandatory_hashtag": "#CiPD",
            "description": "Use the approved artwork.",
        })
        self.assertIn("https://example.org/official", body)
        self.assertIn("#CiPD", body)
        self.assertIn("Use the approved artwork.", body)

    def test_monthly_template_shows_verified_metrics_and_normalized_benchmark(self):
        row = {
            "full_name": "Student",
            "reach": 1200,
            "engagements": 45,
            "verified_posts": 2,
            "normalized_score": 87.5,
            "percentile_rank": 90,
            "star_rating": 5,
            "current_rank": 2,
            "platform_metrics": [{
                "platform": "instagram", "reach": 1200, "likes": 30,
                "comments": 10, "shares": 3, "saves": 2, "verified_posts": 2,
            }],
        }
        body = monthly_email_body(row, "August 2026", "1. Leader: normalized score 95.00")
        self.assertIn("Total reach: 1,200", body)
        self.assertIn("Instagram: 1,200 reach", body)
        self.assertIn("Rank: #2", body)
        self.assertIn("1. Leader: normalized score 95.00", body)
        self.assertIn("not raw reach", body)

    def test_monthly_template_handles_unrated_ambassador(self):
        row = {
            "full_name": "New Student", "reach": 0, "engagements": 0,
            "verified_posts": 0, "normalized_score": None,
            "platform_metrics": [],
        }
        body = monthly_email_body(row, "August 2026", "No calculated ratings.")
        self.assertIn("Not calculated yet", body)
        self.assertNotIn("Rank: #None", body)

    def test_mail_requires_delivery_switch_and_smtp(self):
        with patch.dict(os.environ, {
            "EMAIL_DELIVERY_ENABLED": "false",
            "SMTP_HOST": "mail.example.org",
            "SMTP_FROM": "portal@example.org",
            "SMTP_USERNAME": "",
        }):
            self.assertFalse(email_ready())
        with patch.dict(os.environ, {
            "EMAIL_DELIVERY_ENABLED": "true",
            "SMTP_HOST": "",
            "SMTP_FROM": "",
            "SMTP_USERNAME": "",
        }):
            self.assertFalse(email_ready())
            self.assertEqual(missing_email_settings(), ["SMTP_HOST", "SMTP_FROM"])

    def test_pending_welcome_uses_registered_recipient_and_gmail_sender(self):
        engine = MagicMock()
        write_connection = engine.begin.return_value.__enter__.return_value
        read_connection = engine.connect.return_value.__enter__.return_value
        claim = MagicMock()
        claim.fetchall.return_value = [SimpleNamespace(
            message_id=1,
            user_id=7,
            subject="Welcome to CiPD",
            body="Your onboarding guide",
        )]
        write_connection.execute.side_effect = [claim, MagicMock()]
        recipient = MagicMock()
        recipient.scalar.return_value = "ambassador@example.org"
        read_connection.execute.return_value = recipient
        config = {
            "EMAIL_DELIVERY_ENABLED": "true",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_PORT": "587",
            "SMTP_USERNAME": "sender@example.org",
            "SMTP_PASSWORD": "test-only-password",
            "SMTP_FROM": "sender@example.org",
            "SMTP_USE_TLS": "true",
            "EMAIL_AUTOSEND_AFTER": "2026-09-18T14:21:35+05:30",
        }
        with patch.dict(os.environ, config), patch("notifications.smtplib.SMTP") as smtp_class:
            result = deliver_pending(engine)

        self.assertEqual(result["sent"], 1)
        smtp = smtp_class.return_value.__enter__.return_value
        smtp.starttls.assert_called_once()
        smtp.login.assert_called_once_with("sender@example.org", "test-only-password")
        message = smtp.send_message.call_args.args[0]
        self.assertEqual(message["From"], "sender@example.org")
        self.assertEqual(message["To"], "ambassador@example.org")
        claim_parameters = write_connection.execute.call_args_list[0].args[1]
        self.assertIsNotNone(claim_parameters["cutoff"].tzinfo)

    def test_automatic_cutoff_requires_timezone(self):
        with patch.dict(os.environ, {"EMAIL_AUTOSEND_AFTER": "2026-09-18T14:21:35"}):
            with self.assertRaises(ValueError):
                automatic_email_cutoff()


if __name__ == "__main__":
    unittest.main()
