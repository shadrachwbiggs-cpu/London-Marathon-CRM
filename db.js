const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'crm.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'Not Contacted',
    last_contact_date TEXT,
    contact_method TEXT,
    notes TEXT,
    pledged_amount REAL,
    follow_up_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const DEFAULT_TEMPLATE = `Subject: Support my London Marathon run for [Charity Name]

Hi [Contact Name],

My name is [Your Name], and I'm running the London Marathon on [Date] to raise money for [Charity Name].

I'm reaching out to local businesses like [Business Name] to ask if you'd consider sponsoring my run, whether through a donation or by helping spread the word. Every bit helps me hit my fundraising goal of [Goal Amount].

Would you be open to a quick chat about it, either by phone or in person? I'm happy to work around your schedule.

Thanks so much for considering it — I really appreciate your support.

Best,
[Your Name]
[Your Phone Number]
[Your Email]`;

const existingTemplate = db.prepare('SELECT value FROM settings WHERE key = ?').get('email_template');
if (!existingTemplate) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('email_template', DEFAULT_TEMPLATE);
}

module.exports = db;
