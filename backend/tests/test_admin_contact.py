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

    def test_admin_contact_is_read_from_own_account(self):
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        conn.execute.return_value.fetchone.return_value = SimpleNamespace(
            _mapping={
                "email": "login@example.org",
                "contact_email": "contact@example.org",
                "phone_number": "+919876543210",
            }
        )
        with patch("main.engine", engine):
            result = get_admin_contact({"user_id": 7, "role": "ADMIN"})
        self.assertEqual(result["contact_email"], "contact@example.org")
        self.assertEqual(conn.execute.call_args.args[1], {"user_id": 7})

    def test_update_keeps_login_email_separate(self):
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        conn.execute.return_value.fetchone.return_value = SimpleNamespace(
            _mapping={
                "email": "login@example.org",
                "contact_email": "contact@example.org",
                "phone_number": "+919876543210",
            }
        )
        request = AdminContactRequest(
            contact_email="contact@example.org",
            phone_number="98765 43210",
        )
        with patch("main.engine", engine):
            result = update_admin_contact(request, {"user_id": 7, "role": "ADMIN"})
        params = conn.execute.call_args.args[1]
        self.assertEqual(params["phone_number"], "+919876543210")
        self.assertEqual(params["user_id"], 7)
        self.assertEqual(result["email"], "login@example.org")

    def test_invalid_phone_is_rejected_before_write(self):
        engine = MagicMock()
        request = AdminContactRequest(phone_number="123")
        with patch("main.engine", engine), self.assertRaises(HTTPException) as error:
            update_admin_contact(request, {"user_id": 7, "role": "ADMIN"})
        self.assertEqual(error.exception.status_code, 400)
        engine.begin.assert_not_called()


if __name__ == "__main__":
    unittest.main()
