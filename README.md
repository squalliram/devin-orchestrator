# Devin Orchestrator

An automated GitHub issue fixer powered by [Devin AI](https://devin.ai). This orchestrator automatically triggers Devin sessions to fix GitHub issues when they are labeled with `devin-autofix`, tracks session progress, and posts results back to the issue.

## Features

- **Automated Issue Fixing**: Automatically triggers Devin AI sessions when issues are labeled with `devin-autofix`
- **GitHub Integration**: Posts comments to issues with session links and PR URLs
- **Real-time Tracking**: Polls Devin sessions for status updates (running, completed, failed)
- **Web Dashboard**: Beautiful dark-mode UI to view all sessions and statistics
- **Manual Triggering**: Manually trigger Devin sessions for specific issues via the web UI
- **Session Persistence**: Stores session history in a JSON database
- **Webhook Security**: Supports GitHub webhook signature verification

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   GitHub    │────▶│   Express    │────▶│  Devin AI   │
│   Webhook   │     │   Server     │     │    API      │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  JSON DB     │
                    │ (sessions)   │
                    └──────────────┘
```

### Components

- **`src/devin.js`**: Devin API client - creates sessions, polls for status, handles PR detection
- **`src/github.js`**: GitHub API client - posts comments to issues
- **`src/db.js`**: Simple JSON file-based database for session persistence
- **`src/server.js`**: Express server with API endpoints and webhook handler
- **`public/index.html`**: Dashboard UI for monitoring sessions

## Installation

```bash
# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
# Devin AI Configuration
DEVIN_API_KEY=your_devin_api_key
DEVIN_ORG_ID=your_organization_id

# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=owner/repo  # Optional: default repository
GITHUB_WEBHOOK_SECRET=your_webhook_secret  # Optional: for webhook security

# Server Configuration
PORT=3000  # Optional: defaults to 3000
```

### Required Environment Variables

- `DEVIN_API_KEY`: Your Devin AI API key
- `DEVIN_ORG_ID`: Your Devin organization ID
- `GITHUB_TOKEN`: GitHub personal access token with `repo` scope

### Optional Environment Variables

- `GITHUB_REPO`: Default repository (can be overridden per request)
- `GITHUB_WEBHOOK_SECRET`: Secret for webhook signature verification
- `PORT`: Server port (defaults to 3000)

## Usage

### Starting the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Setting up GitHub Webhook

1. Go to your repository settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.com/webhook`
3. Content type: `application/json`
4. Secret: (optional) Set to match `GITHUB_WEBHOOK_SECRET`
5. Events: Select "Issues" only
6. Click "Add webhook"

### Triggering Devin Sessions

#### Automatic Trigger (via Label)

Simply label any GitHub issue with `devin-autofix`. The orchestrator will:

1. Create a Devin session with the issue details
2. Post a comment with the session link
3. Poll for session completion every 30 seconds
4. Post a comment with the PR link when ready

#### Manual Trigger (via Web UI)

1. Open the dashboard at `http://localhost:3000`
2. Click "+ Manual trigger"
3. Fill in the issue details:
   - Issue number (required)
   - Issue title (required)
   - Issue body (optional)
   - Repo (optional, uses default if not specified)
4. Click "Trigger Devin"

#### Manual Trigger (via API)

```bash
curl -X POST http://localhost:3000/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "issue_number": 123,
    "issue_title": "Fix authentication bug",
    "issue_body": "Users cannot login with SSO",
    "repo": "owner/repo"
  }'
```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{ "ok": true }
```

### `GET /api/stats`
Get session statistics.

**Response:**
```json
{
  "total": 42,
  "running": 3,
  "completed": 35,
  "failed": 4,
  "with_pr": 30
}
```

### `GET /api/sessions`
Get all sessions sorted by start time (newest first).

**Response:**
```json
[
  {
    "session_id": "sess_abc123",
    "issue_number": 123,
    "issue_title": "Fix authentication bug",
    "issue_url": "https://github.com/owner/repo/issues/123",
    "repo": "owner/repo",
    "status": "completed",
    "started_at": "2024-01-15T10:30:00.000Z",
    "finished_at": "2024-01-15T11:45:00.000Z",
    "pr_url": "https://github.com/owner/repo/pull/456",
    "devin_url": "https://app.devin.ai/sessions/sess_abc123",
    "duration": "1h 15m",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
]
```

### `POST /trigger`
Manually trigger a Devin session.

**Request Body:**
```json
{
  "issue_number": 123,
  "issue_title": "Fix authentication bug",
  "issue_body": "Users cannot login with SSO",
  "repo": "owner/repo"
}
```

**Response:** `202 Accepted`

### `POST /webhook`
GitHub webhook endpoint. Handles `issues` labeled events.

**Headers:**
- `X-GitHub-Event`: `issues`
- `X-Hub-Signature-256`: (optional) HMAC signature

**Request Body:** GitHub issue webhook payload

## Session Status

Sessions can have the following statuses:

- `running`: Devin is actively working on the issue
- `completed`: Devin finished successfully and created a PR
- `failed`: Devin encountered an error
- `error`: Technical error occurred
- `timeout`: Session exceeded maximum poll count (500 polls)
- `cancelled`: Session was cancelled

## Data Storage

Sessions are stored in `data/sessions.json` as a simple JSON database:

```json
{
  "sess_abc123": {
    "session_id": "sess_abc123",
    "issue_number": 123,
    "issue_title": "Fix authentication bug",
    "repo": "owner/repo",
    "status": "completed",
    "started_at": "2024-01-15T10:30:00.000Z",
    "finished_at": "2024-01-15T11:45:00.000Z",
    "pr_url": "https://github.com/owner/repo/pull/456",
    "devin_url": "https://app.devin.ai/sessions/sess_abc123",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

## Development

### Project Structure

```
orchestrator/
├── src/
│   ├── devin.js      # Devin API integration
│   ├── github.js     # GitHub API integration
│   ├── db.js         # JSON database
│   └── server.js     # Express server
├── public/
│   └── index.html    # Dashboard UI
├── data/
│   └── sessions.json # Session storage (auto-created)
├── .env              # Environment variables
├── package.json
└── README.md
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
