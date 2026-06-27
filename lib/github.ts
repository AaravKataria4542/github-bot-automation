import { Octokit } from "@octokit/rest";

/**
 * Creates an authenticated Octokit instance for the given user token.
 */
export function getOctokit(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    userAgent: "github-automation-bot/1.0",
  });
}

/**
 * Lists a user's public repositories (sorted by push date).
 */
export async function listUserRepos(accessToken: string) {
  const octokit = getOctokit(accessToken);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    visibility: "public",
    sort: "pushed",
    per_page: 100,
  });
  return data;
}

/**
 * Creates a webhook on a GitHub repository.
 * Returns the webhook ID and secret.
 */
export async function createRepoWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const octokit = getOctokit(accessToken);
  const { data } = await octokit.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    },
    events: ["issues", "pull_request", "push", "issue_comment"],
    active: true,
  });
  return data.id;
}

/**
 * Deletes a webhook from a GitHub repository.
 */
export async function deleteRepoWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookId: number
): Promise<void> {
  const octokit = getOctokit(accessToken);
  await octokit.repos.deleteWebhook({ owner, repo, hook_id: webhookId });
}

/**
 * Adds a label to an issue or pull request.
 * If the label doesn't exist on the repo, creates it first.
 */
export async function addLabel(
  accessToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string
): Promise<void> {
  const octokit = getOctokit(accessToken);

  // Ensure label exists on the repo
  try {
    await octokit.issues.getLabel({ owner, repo, name: labelName });
  } catch {
    // Label doesn't exist — create it with a sensible color
    const color = getLabelColor(labelName);
    try {
      await octokit.issues.createLabel({ owner, repo, name: labelName, color });
    } catch {
      // Label may have been created concurrently — ignore
    }
  }

  await octokit.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [labelName],
  });
}

/**
 * Posts a comment on an issue or pull request.
 */
export async function postComment(
  accessToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  const octokit = getOctokit(accessToken);
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

/**
 * Returns a consistent hex color for common label names.
 */
function getLabelColor(labelName: string): string {
  const lower = labelName.toLowerCase();
  if (lower.includes("bug")) return "d73a4a";
  if (lower.includes("enhancement") || lower.includes("feature")) return "a2eeef";
  if (lower.includes("security")) return "e4e669";
  if (lower.includes("critical") || lower.includes("priority")) return "b60205";
  if (lower.includes("documentation")) return "0075ca";
  if (lower.includes("question")) return "d876e3";
  if (lower.includes("help")) return "008672";
  // Default: random pleasant color based on name
  const hash = labelName
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return hslToHex(hue, 70, 60);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `${f(0)}${f(8)}${f(4)}`;
}
