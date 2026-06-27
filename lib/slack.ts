const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export interface SlackNotificationPayload {
  eventType: string;
  action?: string | null;
  repoFullName: string;
  title?: string | null;
  senderLogin?: string | null;
  aiSummary?: string | null;
  aiPriority?: string | null;
  aiSuggestedLabel?: string | null;
  botActions?: string[];
  url?: string | null;
}

const EVENT_EMOJI: Record<string, string> = {
  issues: "🐛",
  pull_request: "🔀",
  push: "📦",
  issue_comment: "💬",
  default: "⚡",
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#b60205",
  high: "#d93f0b",
  medium: "#e4e669",
  low: "#0e8a16",
};

/**
 * Sends a rich Slack Block Kit notification when a bot action fires.
 */
export async function sendSlackNotification(
  payload: SlackNotificationPayload
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not configured — skipping Slack notification");
    return;
  }

  const emoji = EVENT_EMOJI[payload.eventType] ?? EVENT_EMOJI.default;
  const actionText = payload.action ? ` (${payload.action})` : "";
  const headerText = `${emoji} *${payload.eventType}${actionText}* in \`${payload.repoFullName}\``;

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `GitHub Bot Alert`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: headerText,
      },
    },
  ];

  // Add title field if present
  if (payload.title) {
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Title*\n${payload.title}`,
        },
        {
          type: "mrkdwn",
          text: `*By*\n${payload.senderLogin ? `@${payload.senderLogin}` : "unknown"}`,
        },
      ],
    });
  }

  // Add AI analysis if present
  if (payload.aiSummary) {
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🤖 *AI Analysis*\n${payload.aiSummary}`,
        },
      }
    );

    if (payload.aiPriority || payload.aiSuggestedLabel) {
      blocks.push({
        type: "section",
        fields: [
          ...(payload.aiPriority
            ? [
                {
                  type: "mrkdwn",
                  text: `*Priority*\n${getPriorityBadge(payload.aiPriority)}`,
                },
              ]
            : []),
          ...(payload.aiSuggestedLabel
            ? [
                {
                  type: "mrkdwn",
                  text: `*Suggested Label*\n\`${payload.aiSuggestedLabel}\``,
                },
              ]
            : []),
        ],
      });
    }
  }

  // Add bot actions taken
  if (payload.botActions && payload.botActions.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🤖 Bot actions: ${payload.botActions.join(" · ")}`,
        },
      ],
    });
  }

  // Add link button if URL present
  if (payload.url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View on GitHub",
            emoji: true,
          },
          url: payload.url,
          style: "primary",
        },
      ],
    });
  }

  const color = payload.aiPriority
    ? (PRIORITY_COLOR[payload.aiPriority] ?? "#6366f1")
    : "#6366f1";

  const body = {
    attachments: [
      {
        color,
        blocks,
      },
    ],
  };

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${text}`);
  }
}

function getPriorityBadge(priority: string): string {
  const badges: Record<string, string> = {
    critical: "🔴 Critical",
    high: "🟠 High",
    medium: "🟡 Medium",
    low: "🟢 Low",
  };
  return badges[priority] ?? priority;
}
