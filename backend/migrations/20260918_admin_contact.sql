-- Keep administrator contact details separate from login and SMTP sender addresses.
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150);
