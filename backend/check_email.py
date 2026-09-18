"""Verify the configured SMTP sender without touching the notification queue."""

import argparse
import os
import smtplib
import ssl
from email.message import EmailMessage

from dotenv import load_dotenv


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--send-self",
        action="store_true",
        help="Send one test message to the configured sender mailbox.",
    )
    args = parser.parse_args()
    load_dotenv()

    required = ("SMTP_HOST", "SMTP_FROM", "SMTP_USERNAME", "SMTP_PASSWORD")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        print("Missing SMTP settings: " + ", ".join(missing))
        return 1

    try:
        with smtplib.SMTP(
            os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587")), timeout=20
        ) as smtp:
            smtp.ehlo()
            if os.getenv("SMTP_USE_TLS", "true").lower() == "true":
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            smtp.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
            if args.send_self:
                message = EmailMessage()
                message["From"] = os.environ["SMTP_FROM"]
                message["To"] = os.environ["SMTP_FROM"]
                message["Subject"] = "CiPD portal email delivery test"
                message.set_content(
                    "This is a one-time sender test. No ambassador or queued email was sent."
                )
                smtp.send_message(message)
    except (OSError, ValueError, smtplib.SMTPException) as exc:
        print(f"SMTP check failed: {type(exc).__name__}")
        return 1

    print("SMTP authentication succeeded.")
    if args.send_self:
        print("One test email was accepted for the sender mailbox.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
