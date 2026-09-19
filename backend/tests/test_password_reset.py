import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:test@localhost/test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-import-only")

from main import ForgotPasswordRequest, PasswordResetRequest, forgot_password, reset_password


class PasswordResetTests(unittest.TestCase):
    def request(self):
        return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))

    def test_unknown_email_receives_generic_response_without_queueing(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        user_result = MagicMock()
        user_result.fetchone.return_value = None
        limits_result = MagicMock()
        limits_result.fetchone.return_value = SimpleNamespace(email_attempts=0, ip_attempts=0)
        conn.execute.side_effect = [MagicMock(), limits_result, MagicMock(), user_result]
        background = MagicMock()

        with patch("main.engine", engine), patch("main.queue_password_reset_email") as queue:
            result = forgot_password(
                ForgotPasswordRequest(email="missing@example.org"),
                self.request(),
                background,
            )

        self.assertIn("If an account exists", result["message"])
        queue.assert_not_called()
        background.add_task.assert_not_called()

    def test_known_email_creates_hashed_single_use_request(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        user_result = MagicMock()
        user_result.fetchone.return_value = SimpleNamespace(user_id=8, full_name="Student")
        recent_result = MagicMock()
        recent_result.scalar.return_value = None
        request_result = MagicMock()
        request_result.scalar_one.return_value = 21
        limits_result = MagicMock()
        limits_result.fetchone.return_value = SimpleNamespace(email_attempts=0, ip_attempts=0)
        conn.execute.side_effect = [
            MagicMock(), limits_result, MagicMock(), user_result,
            recent_result, request_result,
        ]
        background = MagicMock()

        with (
            patch("main.engine", engine),
            patch("main.queue_password_reset_email", return_value=True) as queue,
            patch("main.email_ready", return_value=True),
            patch("main.deliver_pending"),
        ):
            result = forgot_password(
                ForgotPasswordRequest(email="student@example.org"),
                self.request(),
                background,
            )

        token_hash = conn.execute.call_args_list[5].args[1]["token_hash"]
        self.assertEqual(len(token_hash), 64)
        reset_url = queue.call_args.args[4]
        self.assertIn("/reset-password?token=", reset_url)
        self.assertNotIn(token_hash, reset_url)
        self.assertIn("If an account exists", result["message"])
        background.add_task.assert_called_once()

    def test_reset_request_rate_limit_returns_same_generic_response(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        limits_result = MagicMock()
        limits_result.fetchone.return_value = SimpleNamespace(email_attempts=3, ip_attempts=2)
        conn.execute.side_effect = [MagicMock(), limits_result]
        background = MagicMock()

        with patch("main.engine", engine), patch("main.queue_password_reset_email") as queue:
            result = forgot_password(
                ForgotPasswordRequest(email="student@example.org"),
                self.request(),
                background,
            )

        self.assertIn("If an account exists", result["message"])
        self.assertEqual(conn.execute.call_count, 2)
        queue.assert_not_called()
        background.add_task.assert_not_called()

    def test_reset_rejects_expired_or_used_token(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        result = MagicMock()
        result.fetchone.return_value = None
        conn.execute.return_value = result
        with patch("main.engine", engine), self.assertRaises(HTTPException) as error:
            reset_password(PasswordResetRequest(token="expired", password="new-password"), MagicMock())
        self.assertEqual(error.exception.status_code, 400)

    def test_reset_updates_argon2_password_and_queues_confirmation(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        request_result = MagicMock()
        request_result.fetchone.return_value = SimpleNamespace(reset_request_id=4, user_id=9)
        user_result = MagicMock()
        user_result.fetchone.return_value = SimpleNamespace(full_name="Student")
        conn.execute.side_effect = [request_result, user_result, MagicMock()]
        background = MagicMock()

        with (
            patch("main.engine", engine),
            patch("main.password_hash.hash", return_value="argon2-hash"),
            patch("main.queue_password_changed_email", return_value=True) as queue,
            patch("main.email_ready", return_value=False),
        ):
            result = reset_password(PasswordResetRequest(token="valid-token", password="new-password"), background)

        update_parameters = conn.execute.call_args_list[1].args[1]
        self.assertEqual(update_parameters["password_hash"], "argon2-hash")
        queue.assert_called_once_with(conn, 9, "Student", 4)
        self.assertIn("successfully", result["message"])
        background.add_task.assert_not_called()


if __name__ == "__main__":
    unittest.main()
