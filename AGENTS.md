# AGENTS.md — AI Context File for GitHub Automation Bot

## Project Overview
This is a full-stack Next.js 15 application that acts as a GitHub automation bot.
It receives webhooks from GitHub repositories and processes them with configurable rules.

## Tech Stack
- **Framework**: Next.js 15 App Router (TypeScript)
- **Hosting**: Vercel Hobby (free tier)
- **Database**: Supabase Postgres (free tier) — using `@supabase/supabase-js` with service role key
- **Auth**: NextAuth.js v5 (beta) with GitHub OAuth provider
- **GitHub API**: `@octokit/rest`
- **AI**: Google Gemini 2.0 Flash via `@google/generative-ai`
- **Notifications**: Slack Incoming Webhooks (Block Kit)

## Key Architecture Decisions

### Single OAuth App (not GitHub App)
We use a single GitHub OAuth App for both user authentication AND bot API operations.
The user's encrypted token is used to call the GitHub API on their behalf.
This avoids GitHub App JWT complexity for the MVP.

### Security Model
- Webhook signature: HMAC-SHA256 with `crypto.timingSafeEqual` (per-repo secrets)
- Token storage: AES-256-GCM encrypted with `ENCRYPTION_KEY` env var
- Idempotency: `X-GitHub-Delivery` header used as UNIQUE DB primary key
- Auth: NextAuth session cookies, middleware protects `/dashboard/*`

### CRITICAL: Raw Body for Webhook Verification
The webhook handler MUST read `await req.text()` BEFORE any JSON parsing.
Never do `await req.json()` and then re-serialize — HMAC verification will fail.

```typescript
const rawBody = await req.text()          // ← correct: raw bytes
const payload = JSON.parse(rawBody)        // ← parse AFTER verification
```

### Database Access
Always use the server-side Supabase client from `@/lib/db` (service role key).
Never expose the service role key to the client — it bypasses Row Level Security.

## File Structure
```
lib/
  crypto.ts        — AES-256-GCM encrypt/decrypt + generateSecret()
  db.ts            — Supabase client + TypeScript interfaces
  auth.ts          — NextAuth v5 config (saves encrypted token on signIn)
  webhook.ts       — verifyGitHubSignature()
  github.ts        — Octokit: listUserRepos, createRepoWebhook, addLabel, postComment
  slack.ts         — sendSlackNotification() with Block Kit
  gemini.ts        — analyzeGitHubEvent() returning GeminiAnalysis
  rules-engine.ts  — processEvent() + DEFAULT_RULES + matchesRule()

app/api/
  auth/[...nextauth]/route.ts  — NextAuth handlers
  webhook/github/route.ts      — Main webhook receiver (verify → dedup → process)
  repos/route.ts               — GET/POST/DELETE repos
  rules/route.ts               — CRUD rules (Zod validation)
  events/route.ts              — Paginated event log

app/
  page.tsx                     — Landing page (server component, signIn form action)
  dashboard/page.tsx           — Dashboard (server component, auth check)
  dashboard/DashboardClient.tsx — Client component (tabs, repo selector)

components/
  RepoConnector.tsx  — Connect/disconnect repos
  EventLog.tsx       — Live-polling event table with expanded detail
  RuleEditor.tsx     — CRUD rule form with condition/action UI
```

## Environment Variables
All secrets are in `.env.local` (local) or Vercel env vars (production):
- `NEXTAUTH_SECRET` — NextAuth session secret
- `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` — App public URL
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth App credentials
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase
- `ENCRYPTION_KEY` — 32-byte hex for AES-256-GCM
- `SLACK_WEBHOOK_URL` — Slack Incoming Webhook URL
- `GEMINI_API_KEY` — Google AI Studio API key

## Rules Schema
```typescript
conditions: {
  action?: string         // "opened", "closed", etc.
  title_contains?: string // case-insensitive substring
  body_contains?: string  // case-insensitive substring
  author?: string         // exact GitHub login
}
actions: {
  add_label?: string      // label name (auto-created if missing)
  post_comment?: string   // supports {ai_summary} placeholder
  slack_notify?: boolean
  ai_analyze?: boolean
}
```

## Do Not
- Do NOT use `req.json()` before HMAC verification in webhook handlers
- Do NOT expose SUPABASE_SERVICE_ROLE_KEY to client-side code
- Do NOT store plain-text access tokens or webhook secrets
- Do NOT return non-2xx for duplicate webhook deliveries (GitHub will retry)
- Do NOT use `===` for signature comparison (timing attack vulnerability)
