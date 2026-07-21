# London Marathon Sponsorship CRM

A simple, local, single-user CRM for tracking outreach to local businesses for
charity sponsorship of a London Marathon run. No login, no cloud — just a
small web app backed by a SQLite file on your machine.

## Setup

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

Your data is stored in `data/crm.db` (created automatically on first run).
Back it up by copying that file — nothing else is needed.

## Features

- Dashboard table of every business — sortable (click column headers) and
  filterable by status
- Search by business name or contact name
- Add / edit / delete business records
- "Log" button on each row for quickly recording a new outreach attempt
  (status, date, method, note) without opening the full edit form — each
  logged note is appended with a timestamp so you keep a history
- "Follow-ups due/overdue" filter to see who to contact next
- Running total of pledged amounts from "Committed" businesses, shown at
  the top of the page
- Editable email outreach template with a one-click Copy button, so you can
  paste it into a new email when reaching out to a business

## Data tracked per business

- Business name, contact name, contact email, contact phone
- Status: Not Contacted, Emailed, Called, Follow-Up Needed, Meeting
  Scheduled, Committed, Declined
- Date of last contact and method used (email, phone, in-person, other)
- Free-text notes
- Pledged amount
- Follow-up date

## Tech

- Backend: Node.js + Express + better-sqlite3 (file-based SQLite database)
- Frontend: plain HTML/CSS/JS — no build step, no framework
