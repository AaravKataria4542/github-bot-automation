# GitBot — GitHub Automation Bot

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://github-bot-automation.vercel.app)

An event-driven GitHub automation bot that reacts to repository activity — labeling issues, posting comments, sending Slack alerts, and AI-triaging with Gemini 2.0 Flash — all driven by configurable rules.

**Live URL:** `https://github-bot-automation.vercel.app`

---

## Features

- 🔐 **GitHub OAuth sign-in** — Authenticate with your GitHub account
- 🔗 **Repository connection** — Connect any public repo; we auto-create the webhook
- ⚡ **Configurable rules** — Match on event type, keywords, author, action → trigger labels, comments, Slack, or AI
- 🤖 **AI triage** — Gemini 2.0 Flash classifies priority, suggests labels, summarizes issues/PRs
- 📣 **Slack notifications** — Rich Block Kit messages with AI summary and GitHub link
- 📊 **Live dashboard** — Real-time event log, bot actions, AI analysis results
- 🛡️ **Security-first** — HMAC-SHA256 per-repo webhook verification, encrypted token storage, idempotent processing

---

## Architecture

```
GitHub Repo → Webhook (HMAC signed) → Next.js API (/api/webhook/github)
                                           │
                               Verify sig → Dedup → Store
                                           │
                                     Rules Engine
                                     ├── GitHub API (add label, comment)
                                     ├── Gemini 2.0 Flash (AI triage)
                                     └── Slack Webhook (notification)
                                           │
                                      Supabase DB
                                           │
                                    Dashboard (live poll)
```

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/github-bot.git
cd github-bot
npm install
```

### 2. Set up external services

#### Supabase (database)
1. Go to [supabase.com](https://supabase.com) → New project (free, no card)
2. Once created, go to **SQL Editor** → **New query**
3. Copy/paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it
4. Go to **Settings → API** → copy `Project URL` and `service_role` key

#### GitHub OAuth App
1. Go to [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. Fill in:
   - **Application name**: `GitBot (local dev)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**
4. Copy the **Client ID** and generate a **Client secret**

#### Slack Incoming Webhook
**Option A — New workspace:**
1. Go to [slack.com/create](https://slack.com/create) → create a free workspace
2. Skip the "add teammates" step

**Option B — Existing workspace:**
1. Open your workspace in a browser

**Both options continue here:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. App Name: `GitBot`, pick your workspace
3. In the left menu: **Incoming Webhooks** → toggle **ON**
4. Click **Add New Webhook to Workspace** → pick a channel → **Allow**
5. Copy the Webhook URL (`https://hooks.slack.com/services/...`)

#### Google Gemini API (AI triage)
1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key**
2. Create a new API key (no billing, no card needed)
3. Copy the key

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all values:

```bash
# Generate these:
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# From GitHub OAuth App:
AUTH_GITHUB_ID=your_client_id
AUTH_GITHUB_SECRET=your_client_secret

# From Supabase:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# From Slack:
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# From Google AI Studio:
GEMINI_API_KEY=your_key

# For local dev:
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **Note:** GitHub webhooks cannot point to `localhost`. For local testing of webhooks, use [ngrok](https://ngrok.com) or [localtunnel](https://github.com/localtunnel/localtunnel) to expose your local server.
>
> ```bash
> npx localtunnel --port 3000
> # Then set NEXT_PUBLIC_APP_URL and NEXTAUTH_URL to the tunnel URL
> ```

### 4. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo at [vercel.com/new](https://vercel.com/new) for automatic deployments on push.

### 2. Set environment variables

In the Vercel dashboard → your project → **Settings → Environment Variables**, add all variables from `.env.example`.

Use **Production** values:
- `NEXTAUTH_URL`: `https://github-bot-automation.vercel.app`
- `NEXT_PUBLIC_APP_URL`: `https://github-bot-automation.vercel.app`

### 3. Update GitHub OAuth App

Go back to your GitHub OAuth App settings and update the callback URL:
- **Authorization callback URL**: `https://github-bot-automation.vercel.app/api/auth/callback/github`

### 4. Run the database schema

If you haven't already, run `supabase/schema.sql` in your Supabase SQL Editor.

---

## How to test it

1. **Sign in** with your GitHub account at the deployed URL
2. **Connect a repository** — pick any public repo you own (click "Connect a repository" in the sidebar)
3. **Verify the webhook** — go to your repo on GitHub → Settings → Webhooks → you should see a new webhook pointing to your app
4. **Trigger an event**:
   - Open an issue with "bug" in the title → bot adds `bug` label + posts comment + Slack alert + AI triage
   - Open a PR → bot posts welcome comment + Slack alert
   - Push to the repo → Slack notification
5. **Check the dashboard** → event appears in the log within seconds

### Testing security

- **Invalid signature test**: Send a request to `/api/webhook/github` without a valid `X-Hub-Signature-256` header → should get `403 Forbidden`
- **Duplicate delivery test**: GitHub's "Redeliver" button on a webhook delivery → event is skipped (not processed twice)
- **Unauthenticated dashboard**: Try visiting `/dashboard` without logging in → redirects to `/`

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | ✅ | Random secret for NextAuth session encryption |
| `NEXTAUTH_URL` | ✅ | Your app's public URL |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same as NEXTAUTH_URL (used for webhook URL) |
| `AUTH_GITHUB_ID` | ✅ | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | ✅ | GitHub OAuth App Client Secret |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `ENCRYPTION_KEY` | ✅ | 32-byte hex key for AES-256-GCM token encryption |
| `SLACK_WEBHOOK_URL` | ✅ | Slack Incoming Webhook URL |
| `GEMINI_API_KEY` | ⚪ | Google AI Studio key (optional — enables AI triage) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Hosting | Vercel (Hobby free tier) |
| Database | Supabase (free Postgres) |
| Auth | NextAuth.js v5 |
| GitHub API | Octokit REST |
| AI | Google Gemini 2.0 Flash |
| Notifications | Slack Incoming Webhooks |
| Encryption | AES-256-GCM (Node.js crypto) |

---

## Security

- **Webhook verification**: Every request verified with HMAC-SHA256 using per-repo secrets. Timing-safe comparison via `crypto.timingSafeEqual`.
- **Idempotency**: `X-GitHub-Delivery` UUID used as a database primary key — duplicate deliveries are silently skipped.
- **Token encryption**: GitHub OAuth tokens and webhook secrets are AES-256-GCM encrypted before storage.
- **Auth protection**: All dashboard routes protected by NextAuth middleware.
- **No secrets in code**: All secrets via environment variables. `.env.local` in `.gitignore`.

---

## Default Automation Rules

When you connect a repository, these 6 rules are automatically created:

| Rule | Trigger | Actions |
|---|---|---|
| 🐛 Bug Auto-Label + AI Triage | Issue opened with "bug" in title | Add `bug` label, post comment, Slack, AI analyze |
| ✨ Feature Request Label | Issue opened with "feature" in title | Add `enhancement` label, Slack, AI analyze |
| 🚨 Critical Issue Alert | Issue opened with "critical" in title | Add `priority: critical` label, post comment, Slack, AI analyze |
| 🔐 Security Vulnerability Alert | Issue opened with "security" in title | Add `security` label, post comment, Slack, AI analyze |
| 🔀 New PR Welcome | PR opened | Post welcome comment, Slack |
| 📦 Push Notification | Any push | Slack notification |

All rules can be edited, disabled, or deleted from the dashboard.
