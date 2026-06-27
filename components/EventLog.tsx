"use client";

import { useState, useEffect, useCallback } from "react";

interface BotAction {
  id: number;
  action_type: "add_label" | "post_comment" | "slack_notify" | "ai_analyze";
  details: Record<string, unknown>;
  success: boolean;
  error: string | null;
  executed_at: string;
}

interface WebhookEvent {
  id: string;
  delivery_id: string;
  repo_full_name: string;
  event_type: string;
  action: string | null;
  sender_login: string | null;
  title: string | null;
  status: "pending" | "processed" | "skipped" | "error";
  processing_error: string | null;
  ai_summary: string | null;
  ai_suggested_label: string | null;
  ai_priority: string | null;
  received_at: string;
  processed_at: string | null;
  bot_actions: BotAction[];
}

const ACTION_ICONS: Record<string, string> = {
  add_label: "🏷️",
  post_comment: "💬",
  slack_notify: "📣",
  ai_analyze: "🤖",
};

const EVENT_ICONS: Record<string, string> = {
  issues: "🐛",
  pull_request: "🔀",
  push: "📦",
  issue_comment: "💬",
};

export default function EventLog({ selectedRepo }: { selectedRepo: string | null }) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchEvents = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (selectedRepo) params.set("repo", selectedRepo);
        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) throw new Error("Failed to fetch events");
        const data = await res.json();
        setEvents(data.events);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setLastFetched(new Date());
      } catch (err) {
        console.error("Failed to load events:", err);
      } finally {
        setLoading(false);
      }
    },
    [page, selectedRepo]
  );

  // Initial load + page/repo changes
  useEffect(() => {
    setPage(1);
  }, [selectedRepo]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Live polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchEvents(true), 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Live updates every 5s
          </span>
          {lastFetched && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              · last: {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {total} event{total !== 1 ? "s" : ""} total
          </span>
          <button
            className="btn btn-ghost btn-sm"
            id="refresh-events"
            onClick={() => fetchEvents()}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 0",
            gap: 12,
            color: "var(--text-muted)",
          }}
        >
          <div className="spinner" />
          Loading events…
        </div>
      ) : events.length === 0 ? (
        <EmptyState selectedRepo={selectedRepo} />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Title / Ref</th>
                <th>Repo</th>
                <th>By</th>
                <th>Status</th>
                <th>AI Priority</th>
                <th>Actions</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <>
                  <tr
                    key={ev.id}
                    onClick={() =>
                      setExpandedId(expandedId === ev.id ? null : ev.id)
                    }
                    style={{ cursor: "pointer" }}
                    id={`event-${ev.id}`}
                  >
                    {/* Event type */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span>{EVENT_ICONS[ev.event_type] ?? "⚡"}</span>
                        <span>
                          <span
                            className={`badge badge-${ev.event_type}`}
                          >
                            {ev.event_type}
                          </span>
                          {ev.action && (
                            <span
                              style={{
                                marginLeft: 4,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {ev.action}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Title */}
                    <td style={{ maxWidth: 200 }}>
                      <span
                        className="truncate"
                        style={{
                          display: "block",
                          color: ev.title
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                          fontStyle: ev.title ? "normal" : "italic",
                        }}
                        title={ev.title ?? undefined}
                      >
                        {ev.title ?? "(no title)"}
                      </span>
                    </td>

                    {/* Repo */}
                    <td>
                      <span
                        className="mono text-xs"
                        style={{ color: "var(--text-accent)" }}
                      >
                        {ev.repo_full_name}
                      </span>
                    </td>

                    {/* Sender */}
                    <td>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {ev.sender_login ? `@${ev.sender_login}` : "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge badge-${ev.status}`}>
                        {ev.status}
                      </span>
                    </td>

                    {/* AI Priority */}
                    <td>
                      {ev.ai_priority ? (
                        <span className={`badge badge-${ev.ai_priority}`}>
                          {ev.ai_priority}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>

                    {/* Bot Actions */}
                    <td>
                      <div className="flex gap-1">
                        {ev.bot_actions.length === 0 ? (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        ) : (
                          ev.bot_actions.slice(0, 4).map((a) => (
                            <span
                              key={a.id}
                              title={`${a.action_type}${a.success ? "" : ` (failed: ${a.error})`}`}
                              style={{
                                opacity: a.success ? 1 : 0.4,
                                fontSize: 14,
                              }}
                            >
                              {ACTION_ICONS[a.action_type]}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Time */}
                    <td>
                      <span
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                        title={new Date(ev.received_at).toLocaleString()}
                      >
                        {formatRelativeTime(ev.received_at)}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === ev.id && (
                    <tr key={`${ev.id}-expanded`}>
                      <td
                        colSpan={8}
                        style={{
                          padding: "0 16px 16px",
                          background: "rgba(0,0,0,0.2)",
                        }}
                      >
                        <ExpandedEventDetail event={ev} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-3"
          style={{ marginTop: 20 }}
        >
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            id="events-prev"
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            id="events-next"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function ExpandedEventDetail({ event }: { event: WebhookEvent }) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.3)",
        borderRadius: 8,
        padding: "16px",
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      {/* AI Analysis */}
      {event.ai_summary && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "rgba(124, 58, 237, 0.08)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: 8,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-accent)",
              marginBottom: 6,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            🤖 AI Analysis
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            {event.ai_summary}
          </p>
          <div className="flex gap-2">
            {event.ai_priority && (
              <span className={`badge badge-${event.ai_priority}`}>
                Priority: {event.ai_priority}
              </span>
            )}
            {event.ai_suggested_label && (
              <span className="badge badge-skipped">
                Label: {event.ai_suggested_label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bot Actions */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 8,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Bot Actions
        </div>
        {event.bot_actions.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No actions taken</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {event.bot_actions.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: a.success ? "var(--text-secondary)" : "var(--error)",
                }}
              >
                <span>{ACTION_ICONS[a.action_type]}</span>
                <span>{formatActionDetail(a)}</span>
                {!a.success && (
                  <span
                    style={{ fontSize: 11, color: "var(--error)" }}
                    title={a.error ?? undefined}
                  >
                    ✗ failed
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error info */}
      {event.processing_error && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--error)",
              marginBottom: 8,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Processing Error
          </div>
          <code
            style={{
              fontSize: 12,
              color: "var(--error)",
              background: "var(--error-bg)",
              padding: "8px 12px",
              borderRadius: 6,
              display: "block",
            }}
          >
            {event.processing_error}
          </code>
        </div>
      )}

      {/* Delivery ID */}
      <div style={{ gridColumn: "1 / -1" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Delivery ID:{" "}
          <code className="mono" style={{ color: "var(--text-secondary)" }}>
            {event.delivery_id}
          </code>
        </span>
      </div>
    </div>
  );
}

function EmptyState({ selectedRepo }: { selectedRepo: string | null }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 24px",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        No events yet
      </h3>
      <p style={{ fontSize: 14 }}>
        {selectedRepo
          ? `Waiting for webhooks from ${selectedRepo}…`
          : "Connect a repository and trigger some events to see them here."}
      </p>
      <p style={{ fontSize: 13, marginTop: 8 }}>
        Try opening an issue or submitting a PR on a connected repo.
      </p>
    </div>
  );
}

function formatActionDetail(action: BotAction): string {
  switch (action.action_type) {
    case "add_label":
      return `Added label "${(action.details as { label?: string }).label}"`;
    case "post_comment":
      return `Posted comment`;
    case "slack_notify":
      return `Slack notification sent`;
    case "ai_analyze":
      return `AI analysis complete`;
    default:
      return action.action_type;
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
