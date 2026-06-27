import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns a lazy-initialized Supabase admin client using the service role key.
 * Only used server-side — never exposed to the client.
 * Bypasses Row Level Security for trusted server operations.
 * Lazy initialization ensures Next.js build succeeds without env vars set.
 */
function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}

/**
 * Supabase admin client proxy — initializes lazily on first use.
 */
export const supabase = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop: string | symbol) {
      const client = getSupabaseClient();
      const value = (client as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);


// ── Type definitions matching our schema ──────────────────────────────────────

export interface DbUser {
  id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  access_token: string; // encrypted
  created_at: string;
  updated_at: string;
}

export interface DbRepository {
  id: number;
  user_id: string;
  repo_full_name: string;
  webhook_id: number | null;
  webhook_secret: string; // encrypted
  active: boolean;
  connected_at: string;
}

export interface DbWebhookEvent {
  id: string;
  delivery_id: string;
  repo_full_name: string;
  event_type: string;
  action: string | null;
  sender_login: string | null;
  title: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "processed" | "skipped" | "error";
  processing_error: string | null;
  ai_summary: string | null;
  ai_suggested_label: string | null;
  ai_priority: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface DbBotAction {
  id: number;
  event_id: string;
  action_type: "add_label" | "post_comment" | "slack_notify" | "ai_analyze";
  details: Record<string, unknown>;
  success: boolean;
  error: string | null;
  executed_at: string;
}

export interface DbRule {
  id: number;
  user_id: string;
  repo_full_name: string;
  name: string;
  enabled: boolean;
  event_type: string;
  conditions: {
    action?: string;
    title_contains?: string;
    body_contains?: string;
    author?: string;
  };
  actions: {
    add_label?: string;
    post_comment?: string;
    slack_notify?: boolean;
    ai_analyze?: boolean;
  };
  priority: number;
  created_at: string;
}
