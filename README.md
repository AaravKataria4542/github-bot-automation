# GitBot — GitHub Automation Bot

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://github-bot-automation-np17.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-green?logo=supabase)](https://supabase.com)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-blue?logo=google)](https://aistudio.google.com)

An event-driven GitHub automation bot that reacts to repository activity — labeling issues, posting smart comments, sending Slack alerts, and AI-triaging with Gemini 2.0 Flash — all driven by configurable rules.

**Live URL:** https://github-bot-automation-np17.vercel.app

---

## What It Does

GitBot watches your GitHub repo and reacts automatically:

1. Someone opens an issue titled **"bug: login not working"**
2. GitBot instantly:
   - 🏷️ Adds the `bug` label
   - 💬 Posts a smart comment on the issue
   - 📣 Sends a Slack alert to your channel
   - 🤖 Gemini AI analyzes priority, suggests labels, summarizes the issue

All without you doing anything.

---

## Features

- 🔐 **GitHub OAuth sign-in** — authenticate and connect any repo you own
- ⚡ **Configurable rules engine** — match on event type, keywords in title/body, or author
- 🤖 **AI triage via Gemini 2.0 Flash** — auto-classify priority (critical/high/medium/low), suggest labels, generate summaries
- 📣 **Slack notifications** — rich Block Kit messages with priority color coding, AI summary, and "View on GitHub" button
- 🛡️ **Security** — HMAC-SHA256 webhook signature verification, encrypted token storage, idempotent event processing
- 📊 **Live dashboard** — real-time event log (polls every 5s) showing event type, repo, author, AI priority, bot actions taken
- 🔁 **Multi-event support** — handles `issues`, `pull_request`, `push`, `issue_comment`, `ping`

---

## Live Demo

| Action | Result |
|--------|--------|
| Open issue: `bug: login not working` | Bot adds `bug` label + posts comment + Slack alert |
| Open issue: `security: data exposed` | Bot adds `security` label + posts security-specific comment + Slack alert |
| Open issue: `feature: add dark mode` | Bot adds `enhancement` label + posts comment |
| Push code to main | `PUSH` event logged in dashboard |
| Open a Pull Request | `PULL_REQUEST` event logged + Slack alert |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (Edge-compatible) |
| Database | Supabase (Postgres) |
| Auth | NextAuth.js v5 with GitHub OAuth |
| AI | Google Gemini 2.0 Flash |
| Notifications | Slack Incoming Webhooks (Block Kit) |
| Deployment | Vercel |

---

## Architecture

```
GitHub Repo Activity
       │
       ▼
Webhook POST → /api/webhook/github
       │
       ├── Verify HMAC-SHA256 signature
       ├── Check idempotency (delivery ID)
       ├── Run rules engine (keyword/event matching)
       │
       ├── GitHub API → add label
       ├── GitHub API → post comment
       ├── Gemini AI → analyze priority + suggest label
       └── Slack → send Block Kit notification
       │
       ▼
Supabase (events table) ← Dashboard polls every 5s
```

---

## Database Schema

```sql
-- Connected repositories per user
repositories (
  id, user_id, repo_full_name, installation_token,
  webhook_id, webhook_secret, created_at
)

-- Every received webhook event
events (
  id, repo_id, delivery_id, event_type, action,
  sender_login, title, ref, payload,
  ai_summary, ai_priority, ai_suggested_label, ai_reasoning,
  bot_actions[], slack_notified, processed_at, created_at
)

-- User-defined automation rules
rules (
  id, user_id, repo_id, name, event_type,
  keyword, action_type, action_value,
  is_active, created_at
)
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- A GitHub OAuth App
- A Supabase project
- (Optional) Slack Incoming Webhook URL
- (Optional) Google Gemini API key

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/AaravKataria4542/github-bot-automation.git
cd github-bot-automation

# 2. Install dependencies
npm install

# 3. Copy env file and fill in values
cp .env.example .env.local

# 4. Run the database schema
# Go to Supabase → SQL Editor → paste contents of supabase/schema.sql

# 5. Start the dev server
npm run dev
```

Open http://localhost:3000

> **Note:** GitHub webhooks cannot point at localhost. Use [ngrok](https://ngrok.com) or [smee.io](https://smee.io) to tunnel your local server for webhook testing.

---

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `NEXTAUTH_URL` | Your deployed app URL |
| `NEXT_PUBLIC_APP_URL` | Your deployed app URL (public) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `ENCRYPTION_KEY` | 32-byte hex key for encrypting GitHub tokens |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL (optional) |
| `GEMINI_API_KEY` | Google Gemini API key (optional, enables AI triage) |

---

## Deployment

Deployed on **Vercel** connected to this GitHub repo. Every push to `main` triggers an automatic redeploy.

### GitHub OAuth App settings
- Homepage URL: `https://github-bot-automation-np17.vercel.app`
- Authorization callback URL: `https://github-bot-automation-np17.vercel.app/api/auth/callback/github`

---

## Security

- **Webhook verification** — every incoming webhook is verified using HMAC-SHA256 against the per-repo secret
- **Idempotency** — delivery IDs are stored; duplicate webhook deliveries are ignored
- **Token encryption** — GitHub OAuth tokens are AES-256 encrypted before storing in the database
- **No secrets in client** — all sensitive operations happen server-side only
- **RLS** — Supabase Row Level Security ensures users only see their own data

---

## Testing the Bot

1. Sign in at https://github-bot-automation-np17.vercel.app
2. Click **"+ Connect a repository"** and select any repo you own
3. Open an issue with "bug" in the title on that repo
4. Watch the dashboard Event Log — event appears within 5 seconds
5. Check your repo — `bug` label added and bot comment posted
6. Check Slack — notification received in your channel

---

## AI Notes

See [AI_NOTES.md](./AI_NOTES.md) for details on AI tool usage, key decisions, hardest bugs, and what I'd improve.

## Agent Context

See [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md) for the AI context files used during development.
