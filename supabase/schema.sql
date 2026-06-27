-- ============================================================
-- GitHub Automation Bot — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                     -- GitHub numeric user ID (stable)
  login TEXT NOT NULL,                     -- GitHub username
  name TEXT,
  avatar_url TEXT,
  access_token TEXT NOT NULL,              -- AES-256-GCM encrypted OAuth token
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Repositories ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repositories (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,            -- "owner/repo"
  webhook_id INTEGER,                      -- GitHub webhook ID (for cleanup)
  webhook_secret TEXT NOT NULL,            -- AES-256-GCM encrypted per-repo secret
  active BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_full_name)
);

-- ── Webhook Events ──────────────────────────────────────────
-- delivery_id is UNIQUE → provides idempotency for duplicate deliveries
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id TEXT UNIQUE NOT NULL,        -- X-GitHub-Delivery header (idempotency key)
  repo_full_name TEXT NOT NULL,
  event_type TEXT NOT NULL,                -- issues, pull_request, push, issue_comment
  action TEXT,                             -- opened, closed, labeled, etc.
  sender_login TEXT,
  title TEXT,                              -- issue/PR title or commit message
  payload JSONB NOT NULL,                  -- full raw webhook payload
  status TEXT DEFAULT 'pending',           -- pending | processed | skipped | error
  processing_error TEXT,
  ai_summary TEXT,                         -- Gemini analysis summary
  ai_suggested_label TEXT,
  ai_priority TEXT,                        -- low | medium | high | critical
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ── Bot Actions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_actions (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,              -- add_label | post_comment | slack_notify | ai_analyze
  details JSONB NOT NULL DEFAULT '{}',
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Rules ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rules (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  event_type TEXT NOT NULL,               -- issues | pull_request | push | issue_comment | *
  conditions JSONB NOT NULL DEFAULT '{}',
  -- conditions shape: { "action": "opened", "title_contains": "bug", "body_contains": null, "author": null }
  actions JSONB NOT NULL DEFAULT '{}',
  -- actions shape: { "add_label": "bug", "post_comment": "...", "slack_notify": true, "ai_analyze": true }
  priority INTEGER DEFAULT 10,            -- higher = evaluated first
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_events_repo
  ON webhook_events(repo_full_name);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON webhook_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_delivery
  ON webhook_events(delivery_id);

CREATE INDEX IF NOT EXISTS idx_bot_actions_event
  ON bot_actions(event_id);

CREATE INDEX IF NOT EXISTS idx_rules_user_repo
  ON rules(user_id, repo_full_name);

CREATE INDEX IF NOT EXISTS idx_repositories_user
  ON repositories(user_id);

-- ── Done! ────────────────────────────────────────────────────
-- After running this, you're ready to deploy the app.
