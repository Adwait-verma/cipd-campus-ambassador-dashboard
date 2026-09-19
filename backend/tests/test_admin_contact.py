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

from main import AdminContactRequest, get_admin_contact, require_admin, update_admin_contact


class AdminContactTests(unittest.TestCase):
    def test_ambassador_cannot_use_admin_endpoints(self):
        with self.assertRaises(HTTPException) as error:
            require_admin({"user_id": 3, "role": "AMBASSADOR"})
        self.assertEqual(error.exception.status_code, 403)

    def test_admin_reads_global_help_contact_and_own_login_email(self):
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        login_result = MagicMock()
        login_result.scalar.return_value = "login@example.org"
        contact_result = MagicMock()
        contact_result.fetchone.return_value = SimpleNamespace(
            support_contact_email="contact@example.org",
            support_phone_number="+919876543210",
        )
        conn.execute.side_effect = [login_result, contact_result]
        with patch("main.engine", engine):
            result = get_admin_contact({"user_id": 7, "role": "ADMIN"})
        self.assertEqual(result["contact_email"], "contact@example.org")
        self.assertEqual(result["email"], "login@example.org")
        self.assertEqual(conn.execute.call_args_list[0].args[1], {"user_id": 7})

    def test_update_keeps_login_email_separate(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        login_result = MagicMock()
        login_result.scalar.return_value = "login@example.org"
        update_result = MagicMock()
        update_result.fetchone.return_value = SimpleNamespace(
            support_contact_email="contact@example.org",
            support_phone_number="+919876543210",
        )
        conn.execute.side_effect = [login_result, update_result, MagicMock()]
        request = AdminContactRequest(
            contact_email="contact@example.org",
            phone_number="98765 43210",
        )
        with patch("main.engine", engine):
            result = update_admin_contact(request, {"user_id": 7, "role": "ADMIN"})
        params = conn.execute.call_args_list[1].args[1]
        self.assertEqual(params["phone_number"], "+919876543210")
        self.assertNotIn("user_id", params)
        self.assertEqual(result["email"], "login@example.org")
        self.assertIn("INSERT INTO admin_activity_logs", str(conn.execute.call_args_list[2].args[0]))

    def test_invalid_phone_is_rejected_before_write(self):
        engine = MagicMock()
        request = AdminContactRequest(phone_number="123")
        with patch("main.engine", engine), self.assertRaises(HTTPException) as error:
            update_admin_contact(request, {"user_id": 7, "role": "ADMIN"})
        self.assertEqual(error.exception.status_code, 400)
        engine.begin.assert_not_called()


if __name__ == "__main__":
    unittest.main()
