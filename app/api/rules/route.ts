import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { z } from "zod";

const RuleSchema = z.object({
  name: z.string().min(1).max(100),
  repo_full_name: z.string().regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/),
  enabled: z.boolean().default(true),
  event_type: z.enum(["issues", "pull_request", "push", "issue_comment", "*"]),
  conditions: z.object({
    action: z.string().optional(),
    title_contains: z.string().optional(),
    body_contains: z.string().optional(),
    author: z.string().optional(),
  }),
  actions: z
    .object({
      add_label: z.string().optional(),
      post_comment: z.string().optional(),
      slack_notify: z.boolean().optional(),
      ai_analyze: z.boolean().optional(),
    })
    .refine(
      (a) =>
        a.add_label ||
        a.post_comment ||
        a.slack_notify ||
        a.ai_analyze,
      { message: "At least one action must be configured" }
    ),
  priority: z.number().int().min(0).max(100).default(10),
});

/**
 * GET /api/rules?repo=owner/repo
 * Returns all rules for the user (optionally filtered by repo).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");

  let query = supabase
    .from("rules")
    .select("*")
    .eq("user_id", session.user.id)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (repo) {
    query = query.eq("repo_full_name", repo);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

/**
 * POST /api/rules
 * Creates a new automation rule.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RuleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify user owns this repo
  const { data: repo } = await supabase
    .from("repositories")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("repo_full_name", parsed.data.repo_full_name)
    .eq("active", true)
    .maybeSingle();

  if (!repo) {
    return NextResponse.json(
      { error: "Repository not connected to your account" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("rules")
    .insert({ ...parsed.data, user_id: session.user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ rule: data }, { status: 201 });
}

/**
 * PATCH /api/rules/:id
 * Updates an existing rule (partial update).
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...updates } = body as { id: number } & Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("rules")
    .select("id")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}

/**
 * DELETE /api/rules
 * Deletes a rule by ID.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json()) as { id: number };

  if (!id) {
    return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("rules")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted" });
}
