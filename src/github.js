async function postGitHubComment(repo, issue, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.warn('[github] No token'); return; }
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
  if (!res.ok) console.error('[github] Comment failed:', res.status);
  else console.log('[github] Comment posted on issue #' + issue);
}
module.exports = { postGitHubComment };
