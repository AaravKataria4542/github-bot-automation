import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { decrypt, encrypt, generateSecret } from "@/lib/crypto";
import { listUserRepos, createRepoWebhook, deleteRepoWebhook } from "@/lib/github";
import { DEFAULT_RULES } from "@/lib/rules-engine";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";

/**
 * GET /api/repos
 * Returns the user's connected repos and their available public repos from GitHub.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get connected repos from DB
  const { data: connectedRepos, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("connected_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Get user's GitHub token to list available repos
  const { data: user } = await supabase
    .from("users")
    .select("access_token")
    .eq("id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let availableRepos: { full_name: string; description: string | null; stargazers_count: number }[] = [];
  try {
    const accessToken = decrypt(user.access_token);
    const githubRepos = await listUserRepos(accessToken);
    const connectedNames = new Set((connectedRepos ?? []).map((r) => r.repo_full_name));
    availableRepos = githubRepos
      .filter((r) => !connectedNames.has(r.full_name))
      .map((r) => ({
        full_name: r.full_name,
        description: r.description,
        stargazers_count: r.stargazers_count,
      }));
  } catch (err) {
    console.error("Failed to list GitHub repos:", err);
  }

  return NextResponse.json({
    connected: connectedRepos ?? [],
    available: availableRepos,
  });
}

/**
 * POST /api/repos
 * Connects a repository: creates a GitHub webhook and stores the repo in DB.
 * Seeds default automation rules.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { repoFullName } = (await req.json()) as { repoFullName: string };

  if (!repoFullName || !repoFullName.includes("/")) {
    return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
  }

  const [owner, repo] = repoFullName.split("/");

  // Get user's access token
  const { data: user } = await supabase
    .from("users")
    .select("access_token")
    .eq("id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const accessToken = decrypt(user.access_token);
  const webhookSecret = generateSecret(32);
  const webhookUrl = `${APP_URL}/api/webhook/github`;

  // Create webhook on GitHub
  let webhookId: number;
  try {
    webhookId = await createRepoWebhook(accessToken, owner, repo, webhookUrl, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create GitHub webhook: ${msg}` },
      { status: 422 }
    );
  }

  // Store repo in DB with encrypted webhook secret
  const { error: insertError } = await supabase.from("repositories").insert({
    user_id: userId,
    repo_full_name: repoFullName,
    webhook_id: webhookId,
    webhook_secret: encrypt(webhookSecret),
    active: true,
  });

  if (insertError) {
    // Clean up the webhook we just created
    try {
      await deleteRepoWebhook(accessToken, owner, repo, webhookId);
    } catch {
      // Best effort
    }
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Seed default rules
  const defaultRuleRows = DEFAULT_RULES.map((rule) => ({
    ...rule,
    user_id: userId,
    repo_full_name: repoFullName,
  }));

  await supabase.from("rules").insert(defaultRuleRows);

  return NextResponse.json({ status: "connected", webhookId });
}

/**
 * DELETE /api/repos
 * Disconnects a repository: removes GitHub webhook and marks repo inactive.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { repoFullName } = (await req.json()) as { repoFullName: string };

  // Get repo from DB
  const { data: repoRow } = await supabase
    .from("repositories")
    .select("*")
    .eq("user_id", userId)
    .eq("repo_full_name", repoFullName)
    .single();

  if (!repoRow) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  // Get user's access token
  const { data: user } = await supabase
    .from("users")
    .select("access_token")
    .eq("id", userId)
    .single();

  if (user && repoRow.webhook_id) {
    const [owner, repo] = repoFullName.split("/");
    try {
      await deleteRepoWebhook(decrypt(user.access_token), owner, repo, repoRow.webhook_id);
    } catch (err) {
      console.warn("Failed to delete GitHub webhook (may already be gone):", err);
    }
  }

  // Mark repo as inactive
  await supabase
    .from("repositories")
    .update({ active: false })
    .eq("id", repoRow.id);

  return NextResponse.json({ status: "disconnected" });
}
