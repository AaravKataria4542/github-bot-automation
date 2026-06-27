import { supabase, type DbRule } from "@/lib/db";
import { addLabel, postComment } from "@/lib/github";
import { sendSlackNotification } from "@/lib/slack";
import { analyzeGitHubEvent } from "@/lib/gemini";

export interface EventContext {
  eventId: string;
  eventType: string;
  action: string | null;
  title: string | null;
  body: string | null;
  author: string | null;
  repoFullName: string;
  payload: Record<string, unknown>;
  userId: string;
  userAccessToken: string;
  issueOrPrNumber: number | null;
}

/**
 * Evaluates whether a rule's conditions match the incoming event.
 */
function matchesRule(
  rule: DbRule,
  ctx: EventContext
): boolean {
  if (!rule.enabled) return false;

  // Event type filter (wildcard "*" matches all)
  if (rule.event_type !== "*" && rule.event_type !== ctx.eventType) {
    return false;
  }

  const { action, title_contains, body_contains, author } = rule.conditions;

  if (action && ctx.action !== action) return false;

  if (
    title_contains &&
    !ctx.title?.toLowerCase().includes(title_contains.toLowerCase())
  ) {
    return false;
  }

  if (
    body_contains &&
    !ctx.body?.toLowerCase().includes(body_contains.toLowerCase())
  ) {
    return false;
  }

  if (author && ctx.author !== author) return false;

  return true;
}

/**
 * Records a bot action in the database.
 */
async function recordAction(
  eventId: string,
  actionType: "add_label" | "post_comment" | "slack_notify" | "ai_analyze",
  details: Record<string, unknown>,
  success: boolean,
  error?: string
): Promise<void> {
  await supabase.from("bot_actions").insert({
    event_id: eventId,
    action_type: actionType,
    details,
    success,
    error: error ?? null,
  });
}

/**
 * Core event processor.
 * Loads the user's rules, matches them against the event,
 * and executes each action (label, comment, Slack, AI).
 */
export async function processEvent(ctx: EventContext): Promise<void> {
  const [owner, repo] = ctx.repoFullName.split("/");

  // Load rules for this repo, ordered by priority desc
  const { data: rules, error: rulesError } = await supabase
    .from("rules")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("repo_full_name", ctx.repoFullName)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  if (rulesError) {
    console.error("Failed to load rules:", rulesError);
    return;
  }

  if (!rules || rules.length === 0) return;

  // Track accumulated bot actions for Slack summary
  let aiAnalysis: Awaited<ReturnType<typeof analyzeGitHubEvent>> = null;
  let aiRan = false;
  const botActionSummary: string[] = [];

  for (const rule of rules as DbRule[]) {
    if (!matchesRule(rule, ctx)) continue;

    const { actions } = rule;

    // ── AI Analysis (run once, shared across rules) ────────────────────────
    if (actions.ai_analyze && !aiRan && ctx.title) {
      aiRan = true;
      try {
        aiAnalysis = await analyzeGitHubEvent({
          eventType: ctx.eventType,
          action: ctx.action,
          title: ctx.title,
          body: ctx.body,
          repoFullName: ctx.repoFullName,
          senderLogin: ctx.author,
        });

        if (aiAnalysis) {
          // Store AI results on the event
          await supabase
            .from("webhook_events")
            .update({
              ai_summary: aiAnalysis.summary,
              ai_suggested_label: aiAnalysis.suggested_label,
              ai_priority: aiAnalysis.priority,
            })
            .eq("id", ctx.eventId);

          await recordAction(ctx.eventId, "ai_analyze", { analysis: aiAnalysis }, true);
          botActionSummary.push(`🤖 AI analyzed (${aiAnalysis.priority} priority)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordAction(ctx.eventId, "ai_analyze", {}, false, msg);
      }
    }

    // ── Add Label ──────────────────────────────────────────────────────────
    if (actions.add_label && ctx.issueOrPrNumber) {
      try {
        await addLabel(
          ctx.userAccessToken,
          owner,
          repo,
          ctx.issueOrPrNumber,
          actions.add_label
        );
        await recordAction(
          ctx.eventId,
          "add_label",
          { label: actions.add_label },
          true
        );
        botActionSummary.push(`🏷️ Label: \`${actions.add_label}\``);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordAction(ctx.eventId, "add_label", { label: actions.add_label }, false, msg);
      }
    }

    // ── Post Comment ───────────────────────────────────────────────────────
    if (actions.post_comment && ctx.issueOrPrNumber) {
      try {
        let commentBody = actions.post_comment;

        // Inject AI summary if placeholder present
        if (aiAnalysis && commentBody.includes("{ai_summary}")) {
          commentBody = commentBody.replace("{ai_summary}", aiAnalysis.summary);
        }

        await postComment(
          ctx.userAccessToken,
          owner,
          repo,
          ctx.issueOrPrNumber,
          commentBody
        );
        await recordAction(
          ctx.eventId,
          "post_comment",
          { comment: commentBody },
          true
        );
        botActionSummary.push("💬 Comment posted");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordAction(ctx.eventId, "post_comment", {}, false, msg);
      }
    }

    // ── Slack Notification ─────────────────────────────────────────────────
    if (actions.slack_notify) {
      try {
        // Build GitHub URL for the event
        const githubUrl = buildGitHubUrl(ctx);

        await sendSlackNotification({
          eventType: ctx.eventType,
          action: ctx.action,
          repoFullName: ctx.repoFullName,
          title: ctx.title,
          senderLogin: ctx.author,
          aiSummary: aiAnalysis?.summary,
          aiPriority: aiAnalysis?.priority,
          aiSuggestedLabel: aiAnalysis?.suggested_label,
          botActions: botActionSummary.filter((a) => !a.startsWith("📣")),
          url: githubUrl,
        });

        await recordAction(ctx.eventId, "slack_notify", { channel: "configured" }, true);
        botActionSummary.push("📣 Slack notified");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordAction(ctx.eventId, "slack_notify", {}, false, msg);
      }
    }
  }
}

/**
 * Default rules seeded when a user first connects a repository.
 */
export const DEFAULT_RULES: Omit<DbRule, "id" | "user_id" | "repo_full_name" | "created_at">[] = [
  {
    name: "🐛 Bug Auto-Label + AI Triage",
    enabled: true,
    event_type: "issues",
    conditions: { action: "opened", title_contains: "bug" },
    actions: {
      add_label: "bug",
      post_comment:
        "🤖 This looks like a **bug report**! I've tagged it with the `bug` label and alerted the team. We'll look into it shortly.",
      slack_notify: true,
      ai_analyze: true,
    },
    priority: 20,
  },
  {
    name: "✨ Feature Request Auto-Label",
    enabled: true,
    event_type: "issues",
    conditions: { action: "opened", title_contains: "feature" },
    actions: {
      add_label: "enhancement",
      slack_notify: true,
      ai_analyze: true,
    },
    priority: 15,
  },
  {
    name: "🚨 Critical Issue Alert",
    enabled: true,
    event_type: "issues",
    conditions: { action: "opened", title_contains: "critical" },
    actions: {
      add_label: "priority: critical",
      post_comment:
        "🚨 This has been flagged as **critical** and the team has been alerted immediately!",
      slack_notify: true,
      ai_analyze: true,
    },
    priority: 30,
  },
  {
    name: "🔐 Security Vulnerability Alert",
    enabled: true,
    event_type: "issues",
    conditions: { action: "opened", title_contains: "security" },
    actions: {
      add_label: "security",
      post_comment:
        "🔐 Thank you for the security report! The team has been alerted. Please avoid sharing exploit details publicly.",
      slack_notify: true,
      ai_analyze: true,
    },
    priority: 30,
  },
  {
    name: "🔀 New Pull Request Welcome",
    enabled: true,
    event_type: "pull_request",
    conditions: { action: "opened" },
    actions: {
      post_comment:
        "👋 Thanks for the PR! A maintainer will review it soon. Please make sure your changes are well-tested.",
      slack_notify: true,
    },
    priority: 10,
  },
  {
    name: "📦 Push Notification",
    enabled: true,
    event_type: "push",
    conditions: {},
    actions: {
      slack_notify: true,
    },
    priority: 5,
  },
];

function buildGitHubUrl(ctx: EventContext): string | null {
  const base = `https://github.com/${ctx.repoFullName}`;
  if (ctx.issueOrPrNumber) {
    if (ctx.eventType === "pull_request") {
      return `${base}/pull/${ctx.issueOrPrNumber}`;
    }
    return `${base}/issues/${ctx.issueOrPrNumber}`;
  }
  if (ctx.eventType === "push") {
    const sha = (ctx.payload as { after?: string }).after;
    if (sha) return `${base}/commit/${sha}`;
  }
  return base;
}
