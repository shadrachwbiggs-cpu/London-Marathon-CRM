const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const VALID_STATUSES = [
  'Not Contacted',
  'Emailed',
  'Called',
  'Follow-Up Needed',
  'Meeting Scheduled',
  'Committed',
  'Declined',
];

const VALID_METHODS = ['email', 'phone', 'in-person', 'other'];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function serializeBusiness(row) {
  return row;
}

// --- Businesses CRUD ---

app.get('/api/businesses', (req, res) => {
  const rows = db.prepare('SELECT * FROM businesses ORDER BY business_name COLLATE NOCASE ASC').all();
  res.json(rows.map(serializeBusiness));
});

app.get('/api/businesses/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/businesses', (req, res) => {
  const b = req.body || {};
  if (!b.business_name || !b.business_name.trim()) {
    return res.status(400).json({ error: 'business_name is required' });
  }
  const status = VALID_STATUSES.includes(b.status) ? b.status : 'Not Contacted';
  const stmt = db.prepare(`
    INSERT INTO businesses
      (business_name, contact_name, contact_email, contact_phone, status, last_contact_date, contact_method, notes, pledged_amount, follow_up_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(
    b.business_name.trim(),
    b.contact_name || null,
    b.contact_email || null,
    b.contact_phone || null,
    status,
    b.last_contact_date || null,
    VALID_METHODS.includes(b.contact_method) ? b.contact_method : null,
    b.notes || null,
    b.pledged_amount === '' || b.pledged_amount === undefined ? null : Number(b.pledged_amount),
    b.follow_up_date || null
  );
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.put('/api/businesses/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  if (!b.business_name || !b.business_name.trim()) {
    return res.status(400).json({ error: 'business_name is required' });
  }
  const status = VALID_STATUSES.includes(b.status) ? b.status : existing.status;
  const stmt = db.prepare(`
    UPDATE businesses SET
      business_name = ?,
      contact_name = ?,
      contact_email = ?,
      contact_phone = ?,
      status = ?,
      last_contact_date = ?,
      contact_method = ?,
      notes = ?,
      pledged_amount = ?,
      follow_up_date = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(
    b.business_name.trim(),
    b.contact_name || null,
    b.contact_email || null,
    b.contact_phone || null,
    status,
    b.last_contact_date || null,
    VALID_METHODS.includes(b.contact_method) ? b.contact_method : null,
    b.notes || null,
    b.pledged_amount === '' || b.pledged_amount === undefined || b.pledged_amount === null ? null : Number(b.pledged_amount),
    b.follow_up_date || null,
    req.params.id
  );
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/businesses/:id', (req, res) => {
  const info = db.prepare('DELETE FROM businesses WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// --- Quick outreach log: updates status/date/method and appends a timestamped note ---

app.post('/api/businesses/:id/log', (req, res) => {
  const existing = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};

  const status = VALID_STATUSES.includes(b.status) ? b.status : existing.status;
  const method = VALID_METHODS.includes(b.contact_method) ? b.contact_method : existing.contact_method;
  const date = b.date || todayISO();

  let notes = existing.notes || '';
  if (b.note && b.note.trim()) {
    const entry = `[${date}] (${method || 'contact'} - ${status}) ${b.note.trim()}`;
    notes = notes ? `${notes}\n${entry}` : entry;
  }

  const pledged =
    b.pledged_amount === '' || b.pledged_amount === undefined || b.pledged_amount === null
      ? existing.pledged_amount
      : Number(b.pledged_amount);

  const followUp = b.follow_up_date !== undefined ? (b.follow_up_date || null) : existing.follow_up_date;

  db.prepare(`
    UPDATE businesses SET
      status = ?,
      last_contact_date = ?,
      contact_method = ?,
      notes = ?,
      pledged_amount = ?,
      follow_up_date = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, date, method, notes, pledged, followUp, req.params.id);

  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  res.json(row);
});

// --- Stats: total pledged from committed businesses ---

app.get('/api/stats', (req, res) => {
  const total = db
    .prepare("SELECT COALESCE(SUM(pledged_amount), 0) AS total FROM businesses WHERE status = 'Committed'")
    .get().total;
  const committedCount = db
    .prepare("SELECT COUNT(*) AS c FROM businesses WHERE status = 'Committed'")
    .get().c;
  const followUpsDue = db
    .prepare("SELECT COUNT(*) AS c FROM businesses WHERE follow_up_date IS NOT NULL AND follow_up_date <= ?")
    .get(todayISO()).c;
  res.json({ totalPledged: total, committedCount, followUpsDue });
});

// --- Email template storage ---

app.get('/api/template', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('email_template');
  res.json({ template: row ? row.value : '' });
});

app.put('/api/template', (req, res) => {
  const value = (req.body && req.body.template) || '';
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('email_template', value);
  res.json({ template: value });
});

app.listen(PORT, () => {
  console.log(`London Marathon CRM running at http://localhost:${PORT}`);
});
