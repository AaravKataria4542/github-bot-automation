import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubSignature } from "@/lib/webhook";
import { supabase } from "@/lib/db";
import { processEvent } from "@/lib/rules-engine";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  // ── 1. Extract headers ─────────────────────────────────────────────────────
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const eventType = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";

  if (!signature || !eventType || !deliveryId) {
    return NextResponse.json(
      { error: "Missing required GitHub webhook headers" },
      { status: 400 }
    );
  }

  // ── 2. Read raw body (must happen before any parsing) ─────────────────────
  const rawBody = await req.text();

  // ── 3. Parse payload ────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoFullName =
    (payload.repository as { full_name?: string })?.full_name ?? null;

  if (!repoFullName) {
    // Some events (e.g. ping) don't have a repository — accept gracefully
    return NextResponse.json({ status: "ok", note: "no repository" });
  }

  // ── 4. Look up connected repository ───────────────────────────────────────
  const { data: repoRow, error: repoError } = await supabase
    .from("repositories")
    .select("*, users(*)")
    .eq("repo_full_name", repoFullName)
    .eq("active", true)
    .maybeSingle();

  if (repoError) {
    console.error("DB error looking up repo:", repoError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!repoRow) {
    // Not connected — reject silently (don't reveal which repos are registered)
    return NextResponse.json(
      { error: "Repository not connected" },
      { status: 404 }
    );
  }

  // ── 5. Verify HMAC-SHA256 signature ───────────────────────────────────────
  const webhookSecret = await decrypt(repoRow.webhook_secret as string);

  if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
    console.warn(`Invalid signature for delivery ${deliveryId} on ${repoFullName}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // ── 6. Extract event metadata ──────────────────────────────────────────────
  const action = (payload.action as string) ?? null;
  const issue = payload.issue as { number?: number; title?: string; body?: string } | undefined;
  const pr = payload.pull_request as { number?: number; title?: string; body?: string } | undefined;
  const headCommit = payload.head_commit as { message?: string } | undefined;

  const title = issue?.title ?? pr?.title ?? headCommit?.message ?? null;
  const body = issue?.body ?? pr?.body ?? null;
  const senderLogin =
    (payload.sender as { login?: string })?.login ?? null;
  const issueOrPrNumber = issue?.number ?? pr?.number ?? null;

  // ── 7. Idempotency check — insert event (UNIQUE on delivery_id) ───────────
  const { error: insertError } = await supabase.from("webhook_events").insert({
    delivery_id: deliveryId,
    repo_full_name: repoFullName,
    event_type: eventType,
    action,
    sender_login: senderLogin,
    title,
    payload,
    status: "pending",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // Duplicate delivery — already processed
      console.log(`Duplicate delivery ${deliveryId} — skipping`);
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    }
    console.error("Failed to insert event:", insertError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // ── 8. Retrieve the inserted event ID ─────────────────────────────────────
  const { data: eventRow } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("delivery_id", deliveryId)
    .single();

  if (!eventRow) {
    return NextResponse.json(
      { error: "Event not found after insert" },
      { status: 500 }
    );
  }

  // ── 9. Process event (rules engine) ───────────────────────────────────────
  const userAccessToken = await decrypt(
    (repoRow.users as { access_token: string }).access_token
  );

  try {
    await processEvent({
      eventId: eventRow.id as string,
      eventType,
      action,
      title,
      body,
      author: senderLogin,
      repoFullName,
      payload,
      userId: repoRow.user_id as string,
      userAccessToken,
      issueOrPrNumber,
    });

    await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventRow.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Event processing failed for ${deliveryId}:`, msg);

    await supabase
      .from("webhook_events")
      .update({ status: "error", processing_error: msg })
      .eq("id", eventRow.id);

    // Still return 200 so GitHub doesn't retry — the event is stored
    return NextResponse.json({ status: "error", message: msg }, { status: 200 });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
