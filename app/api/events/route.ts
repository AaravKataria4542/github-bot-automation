import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/db";

const PAGE_SIZE = 20;

/**
 * GET /api/events?repo=owner/repo&page=1&status=processed
 * Returns a paginated event log with associated bot actions.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const status = searchParams.get("status"); // optional filter
  const offset = (page - 1) * PAGE_SIZE;

  // First, get the repos connected by this user (for authorization)
  const { data: userRepos } = await supabase
    .from("repositories")
    .select("repo_full_name")
    .eq("user_id", session.user.id)
    .eq("active", true);

  const allowedRepos = (userRepos ?? []).map((r) => r.repo_full_name);

  if (allowedRepos.length === 0) {
    return NextResponse.json({ events: [], total: 0, page, pageSize: PAGE_SIZE });
  }

  // Build query — only show events from repos the user owns
  let query = supabase
    .from("webhook_events")
    .select("*, bot_actions(*)", { count: "exact" })
    .in("repo_full_name", repo ? [repo] : allowedRepos)
    .order("received_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Apply optional filters
  if (repo && allowedRepos.includes(repo)) {
    query = query.eq("repo_full_name", repo);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: events, error, count } = await query;

  if (error) {
    console.error("Events query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({
    events: events ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
