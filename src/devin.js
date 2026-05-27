require('dotenv').config();
const { upsertSession, updateSession } = require('./db');
const { postGitHubComment } = require('./github');

function apiBase() {
  return `https://api.devin.ai/v3/organizations/${process.env.DEVIN_ORG_ID}`;
}

async function triggerDevinSession(issue, repo) {
  const repoName = repo.full_name;
  const prompt = `Fix GitHub issue #${issue.number} in ${repoName}.\n\nTitle: ${issue.title}\nURL: ${issue.html_url}\n\nDescription:\n${issue.body || '(none)'}\n\nSteps:\n1. Clone https://github.com/${repoName}\n2. Make the minimal fix\n3. Open a PR: "Fix #${issue.number}: ${issue.title}" with "Closes #${issue.number}"`;

  console.log(`[devin] Creating session for issue #${issue.number} using org: ${process.env.DEVIN_ORG_ID}`);

  const res = await fetch(`${apiBase()}/sessions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, idempotent_client_id: `issue-${repoName.replace('/', '_')}-${issue.number}` })
  });
  if (!res.ok) throw new Error(`Devin API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const session_id = data.session_id || data.id;
  console.log(`[devin] Session created: ${session_id}`);

  upsertSession({ session_id, issue_number: issue.number, issue_title: issue.title, issue_url: issue.html_url, repo: repoName, status: 'running', started_at: new Date().toISOString(), pr_url: null, devin_url: `https://app.devin.ai/sessions/${session_id}` });
  await postGitHubComment(repoName, issue.number, `🤖 **Devin is on it!**\n\n[View session](https://app.devin.ai/sessions/${session_id})`);
  setTimeout(() => poll(session_id, issue, repoName, 0), 5000);
}

async function poll(id, issue, repo, n) {
  if (n > 500) { updateSession(id, { status: 'timeout', finished_at: new Date().toISOString() }); return; }
  try {
    const res = await fetch(`${apiBase()}/sessions/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.DEVIN_API_KEY}` }
    });
    const s = await res.json();
    const prUrl = s.pull_requests?.[0]?.url || s.pull_requests?.[0]?.html_url || null;
    const status = ['completed', 'finished'].includes(s.status) ? 'completed' : ['failed', 'error'].includes(s.status) ? 'failed' : s.status;
    console.log(`[devin] ${id} — ${s.status} (poll ${n + 1})`);
    updateSession(id, { status, pr_url: prUrl });
    if (['completed', 'finished', 'failed', 'error', 'cancelled'].includes(s.status)) {
      updateSession(id, { finished_at: new Date().toISOString() });
      const msg = prUrl ? `✅ **PR ready:** ${prUrl}` : `${status === 'failed' ? '❌ Failed' : '✅ Done'} — [session](https://app.devin.ai/sessions/${id})`;
      await postGitHubComment(repo, issue.number, msg);
      return;
    }
    setTimeout(() => poll(id, issue, repo, n + 1), 30000);
  } catch (e) {
    console.error('[devin] poll error:', e.message);
    setTimeout(() => poll(id, issue, repo, n + 1), 30000);
  }
}
module.exports = { triggerDevinSession };
