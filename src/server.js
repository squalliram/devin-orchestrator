require("dotenv").config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/stats', (req, res) => {
  const { getAllSessions } = require('./db');
  const s = getAllSessions();
  res.json({ total: s.length, running: s.filter(x=>x.status==='running').length, completed: s.filter(x=>x.status==='completed').length, failed: s.filter(x=>['failed','error','timeout'].includes(x.status)).length, with_pr: s.filter(x=>x.pr_url).length });
});

app.get('/api/sessions', (req, res) => {
  const { getAllSessions } = require('./db');
  res.json(getAllSessions());
});

app.post('/trigger', async (req, res) => {
  const { triggerDevinSession } = require('./devin');
  const { issue_number, issue_title, issue_body, repo } = req.body;
  if (!issue_number || !issue_title) return res.status(400).json({ error: 'issue_number and issue_title required' });
  const issue = { number: issue_number, title: issue_title, body: issue_body || '', html_url: `https://github.com/${repo||process.env.GITHUB_REPO}/issues/${issue_number}` };
  res.status(202).json({ status: 'accepted' });
  triggerDevinSession(issue, { full_name: repo || process.env.GITHUB_REPO }).catch(console.error);
});

app.post('/webhook', async (req, res) => {
  const { triggerDevinSession } = require('./devin');
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['x-hub-signature-256'];
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return res.status(401).json({ error: 'Invalid signature' });
  }
  const { action, label, issue, repository } = req.body;
  if (req.headers['x-github-event'] === 'issues' && action === 'labeled' && label?.name === 'devin-autofix') {
    console.log(`[webhook] Issue #${issue.number} labelled devin-autofix`);
    res.status(202).json({ status: 'accepted' });
    triggerDevinSession(issue, repository).catch(console.error);
    return;
  }
  res.json({ status: 'ignored' });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`\n🚀 Running on http://localhost:${process.env.PORT || 3000}\n`);
});
