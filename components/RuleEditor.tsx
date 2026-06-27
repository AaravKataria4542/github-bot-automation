"use client";

import { useState, useEffect } from "react";
import { z } from "zod";

interface Rule {
  id: number;
  name: string;
  repo_full_name: string;
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

const EVENT_TYPES = [
  { value: "issues", label: "Issues" },
  { value: "pull_request", label: "Pull Requests" },
  { value: "push", label: "Push" },
  { value: "issue_comment", label: "Issue Comments" },
  { value: "*", label: "All Events" },
];

const EVENT_ACTIONS: Record<string, { value: string; label: string }[]> = {
  issues: [
    { value: "opened", label: "opened" },
    { value: "closed", label: "closed" },
    { value: "labeled", label: "labeled" },
    { value: "reopened", label: "reopened" },
  ],
  pull_request: [
    { value: "opened", label: "opened" },
    { value: "closed", label: "closed" },
    { value: "merged", label: "merged" },
    { value: "review_requested", label: "review_requested" },
  ],
  issue_comment: [
    { value: "created", label: "created" },
    { value: "edited", label: "edited" },
  ],
};

const BLANK_RULE: Omit<Rule, "id" | "created_at"> = {
  name: "",
  repo_full_name: "",
  enabled: true,
  event_type: "issues",
  conditions: { action: "opened" },
  actions: { slack_notify: true },
  priority: 10,
};

export default function RuleEditor({
  selectedRepo,
}: {
  selectedRepo: string | null;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [form, setForm] = useState<Omit<Rule, "id" | "created_at">>(BLANK_RULE);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRepo) params.set("repo", selectedRepo);
      const res = await fetch(`/api/rules?${params}`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch {
      setError("Failed to load rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [selectedRepo]);

  const startCreate = () => {
    setEditingRule(null);
    setForm({ ...BLANK_RULE, repo_full_name: selectedRepo ?? "" });
    setError(null);
    setShowForm(true);
  };

  const startEdit = (rule: Rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      repo_full_name: rule.repo_full_name,
      enabled: rule.enabled,
      event_type: rule.event_type,
      conditions: { ...rule.conditions },
      actions: { ...rule.actions },
      priority: rule.priority,
    });
    setError(null);
    setShowForm(true);
  };

  const saveRule = async () => {
    if (!form.name.trim()) return setError("Rule name is required");
    if (!form.repo_full_name) return setError("Repository is required");

    const hasAction =
      form.actions.add_label ||
      form.actions.post_comment ||
      form.actions.slack_notify ||
      form.actions.ai_analyze;
    if (!hasAction) return setError("At least one action must be configured");

    setSaving(true);
    setError(null);
    try {
      const method = editingRule ? "PATCH" : "POST";
      const body = editingRule
        ? { id: editingRule.id, ...form }
        : form;

      const res = await fetch("/api/rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      await fetchRules();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch {
      setError("Failed to toggle rule");
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchRules();
    } catch {
      setError("Failed to delete rule");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {rules.length} rule{rules.length !== 1 ? "s" : ""}
            {selectedRepo ? ` for ${selectedRepo}` : " total"}
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          id="create-rule"
          onClick={startCreate}
          disabled={!selectedRepo}
          title={!selectedRepo ? "Select a repository first" : undefined}
        >
          ＋ New Rule
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--error-bg)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 8,
            color: "var(--error)",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{
              float: "right",
              background: "none",
              border: "none",
              color: "var(--error)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Rule Form */}
      {showForm && (
        <div
          className="glass-flat"
          style={{ padding: 20, marginBottom: 20 }}
          id="rule-form"
        >
          <h4
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 16,
              color: "var(--text-primary)",
            }}
          >
            {editingRule ? "Edit Rule" : "New Automation Rule"}
          </h4>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {/* Name */}
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="rule-name">
                Rule Name
              </label>
              <input
                id="rule-name"
                className="form-input"
                placeholder='e.g. "Bug Auto-Label"'
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Event Type */}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-event-type">
                Event Type
              </label>
              <select
                id="rule-event-type"
                className="form-select"
                value={form.event_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    event_type: e.target.value,
                    conditions: {},
                  }))
                }
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-action">
                Action (optional)
              </label>
              <select
                id="rule-action"
                className="form-select"
                value={form.conditions.action ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    conditions: {
                      ...f.conditions,
                      action: e.target.value || undefined,
                    },
                  }))
                }
              >
                <option value="">Any action</option>
                {(EVENT_ACTIONS[form.event_type] ?? []).map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Title contains */}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-title-contains">
                Title Contains (optional)
              </label>
              <input
                id="rule-title-contains"
                className="form-input"
                placeholder='e.g. "bug"'
                value={form.conditions.title_contains ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    conditions: {
                      ...f.conditions,
                      title_contains: e.target.value || undefined,
                    },
                  }))
                }
              />
            </div>

            {/* Author */}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-author">
                Author (optional)
              </label>
              <input
                id="rule-author"
                className="form-input"
                placeholder="GitHub username"
                value={form.conditions.author ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    conditions: {
                      ...f.conditions,
                      author: e.target.value || undefined,
                    },
                  }))
                }
              />
            </div>

            {/* Separator */}
            <div
              style={{
                gridColumn: "1 / -1",
                borderTop: "1px solid var(--glass-border)",
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Actions (when conditions match)
              </p>
            </div>

            {/* Add Label */}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-add-label">
                Add Label
              </label>
              <input
                id="rule-add-label"
                className="form-input"
                placeholder='e.g. "bug"'
                value={form.actions.add_label ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actions: {
                      ...f.actions,
                      add_label: e.target.value || undefined,
                    },
                  }))
                }
              />
            </div>

            {/* Priority */}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-priority">
                Priority (higher = runs first)
              </label>
              <input
                id="rule-priority"
                className="form-input"
                type="number"
                min={0}
                max={100}
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 10 }))
                }
              />
            </div>

            {/* Post Comment */}
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="rule-post-comment">
                Post Comment (optional — use{" "}
                <code
                  className="mono"
                  style={{
                    color: "var(--text-accent)",
                    fontSize: 11,
                    background: "rgba(124,58,237,0.1)",
                    padding: "1px 4px",
                    borderRadius: 3,
                  }}
                >
                  {"{ai_summary}"}
                </code>{" "}
                to inject AI summary)
              </label>
              <textarea
                id="rule-post-comment"
                className="form-textarea"
                placeholder="Leave empty to skip commenting"
                value={form.actions.post_comment ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actions: {
                      ...f.actions,
                      post_comment: e.target.value || undefined,
                    },
                  }))
                }
              />
            </div>

            {/* Toggle actions */}
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <ToggleOption
                id="rule-slack-notify"
                label="Slack Notification"
                emoji="📣"
                checked={form.actions.slack_notify ?? false}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    actions: { ...f.actions, slack_notify: v },
                  }))
                }
              />
              <ToggleOption
                id="rule-ai-analyze"
                label="AI Analysis (Gemini)"
                emoji="🤖"
                checked={form.actions.ai_analyze ?? false}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    actions: { ...f.actions, ai_analyze: v },
                  }))
                }
              />
              <ToggleOption
                id="rule-enabled"
                label="Rule Enabled"
                emoji="⚡"
                checked={form.enabled}
                onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>
          </div>

          {/* Form actions */}
          <div className="flex gap-2" style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary"
              id="save-rule"
              onClick={saveRule}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="spinner" /> Saving…
                </>
              ) : editingRule ? (
                "Save Changes"
              ) : (
                "Create Rule"
              )}
            </button>
            <button
              className="btn btn-secondary"
              id="cancel-rule"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            color: "var(--text-muted)",
            padding: "20px 0",
          }}
        >
          <div className="spinner" /> Loading rules…
        </div>
      ) : rules.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 0",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 14, marginBottom: 8 }}>No rules configured yet</p>
          <p style={{ fontSize: 12 }}>
            {selectedRepo
              ? "Create a rule to automate this repository."
              : "Select a repository to see its rules."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => startEdit(rule)}
              onToggle={() => toggleRule(rule)}
              onDelete={() => deleteRule(rule.id)}
              isDeleting={deleting === rule.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onToggle,
  onDelete,
  isDeleting,
}: {
  rule: Rule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const conditionBits = [
    rule.conditions.action && `action: ${rule.conditions.action}`,
    rule.conditions.title_contains && `title ∋ "${rule.conditions.title_contains}"`,
    rule.conditions.body_contains && `body ∋ "${rule.conditions.body_contains}"`,
    rule.conditions.author && `author: @${rule.conditions.author}`,
  ].filter(Boolean);

  const actionBits = [
    rule.actions.add_label && `label: "${rule.actions.add_label}"`,
    rule.actions.post_comment && "comment",
    rule.actions.slack_notify && "Slack",
    rule.actions.ai_analyze && "AI",
  ].filter(Boolean);

  return (
    <div
      className="glass-flat"
      style={{
        padding: "14px 16px",
        opacity: rule.enabled ? 1 : 0.5,
        transition: "opacity 0.2s",
      }}
      id={`rule-card-${rule.id}`}
    >
      <div className="flex items-center justify-between">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: rule.enabled
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              }}
            >
              {rule.name}
            </span>
            <span className={`badge badge-${rule.event_type}`}>
              {rule.event_type}
            </span>
            {!rule.enabled && (
              <span className="badge badge-skipped">disabled</span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {conditionBits.length > 0 ? (
              <>
                <span>IF</span>
                {conditionBits.map((c, i) => (
                  <code
                    key={i}
                    className="mono"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {c}
                  </code>
                ))}
              </>
            ) : (
              <span>ALWAYS</span>
            )}
            <span style={{ color: "var(--text-muted)" }}>→</span>
            {actionBits.map((a, i) => (
              <code
                key={i}
                className="mono"
                style={{
                  background: "rgba(124, 58, 237, 0.1)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  color: "var(--text-accent)",
                }}
              >
                {a}
              </code>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ marginLeft: 12 }}>
          <label className="toggle" title={rule.enabled ? "Disable" : "Enable"}>
            <input
              type="checkbox"
              id={`toggle-rule-${rule.id}`}
              checked={rule.enabled}
              onChange={onToggle}
            />
            <span className="toggle-slider" />
          </label>
          <button
            className="btn btn-ghost btn-sm"
            id={`edit-rule-${rule.id}`}
            onClick={onEdit}
            title="Edit rule"
          >
            ✏️
          </button>
          <button
            className="btn btn-danger btn-sm"
            id={`delete-rule-${rule.id}`}
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete rule"
          >
            {isDeleting ? <div className="spinner" /> : "🗑️"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  id,
  label,
  emoji,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  emoji: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="toggle">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </label>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        {emoji} {label}
      </span>
    </div>
  );
}
