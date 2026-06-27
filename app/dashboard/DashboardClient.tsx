"use client";

import { useState } from "react";
import RepoConnector from "@/components/RepoConnector";
import EventLog from "@/components/EventLog";
import RuleEditor from "@/components/RuleEditor";

type Tab = "events" | "rules" | "repos";

export default function DashboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px",
      }}
    >
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: 6,
          }}
        >
          <span className="gradient-text">Automation</span> Dashboard
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Monitor your GitHub events, configure rules, and manage connected repositories.
        </p>
      </div>

      {/* ── Layout: Sidebar + Main ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside>
          <div className="glass" style={{ padding: 20 }}>
            <h2
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Repositories
            </h2>
            <RepoConnector
              onRepoSelect={setSelectedRepo}
              selectedRepo={selectedRepo}
            />
          </div>

          {/* Quick tips */}
          <div
            className="glass-flat"
            style={{ padding: 16, marginTop: 16 }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Quick Tips
            </p>
            <ul
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <li>🐛 Open an issue with "bug" in the title</li>
              <li>🔀 Submit a pull request</li>
              <li>📦 Push code to any branch</li>
              <li>⚡ Events appear in the log within seconds</li>
            </ul>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────────── */}
        <div>
          {/* Tabs */}
          <div
            className="glass-flat"
            style={{
              display: "flex",
              gap: 4,
              padding: 6,
              marginBottom: 20,
              width: "fit-content",
              borderRadius: 12,
            }}
          >
            {(
              [
                { id: "events", label: "📊 Event Log" },
                { id: "rules", label: "⚡ Rules" },
              ] as { id: Tab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s",
                  background:
                    activeTab === tab.id
                      ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                      : "transparent",
                  color:
                    activeTab === tab.id
                      ? "white"
                      : "var(--text-secondary)",
                  boxShadow:
                    activeTab === tab.id
                      ? "0 4px 16px rgba(124, 58, 237, 0.3)"
                      : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active repo banner */}
          {selectedRepo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                background: "rgba(124, 58, 237, 0.08)",
                border: "1px solid rgba(124, 58, 237, 0.2)",
                borderRadius: 10,
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              <span>📦</span>
              <span style={{ color: "var(--text-secondary)" }}>
                Showing data for:
              </span>
              <code
                className="mono"
                style={{ color: "var(--text-accent)", fontWeight: 600 }}
              >
                {selectedRepo}
              </code>
              <button
                onClick={() => setSelectedRepo(null)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 16,
                }}
                id="clear-repo-filter"
                title="Show all repos"
              >
                ✕
              </button>
            </div>
          )}

          {/* Tab content */}
          <div className="glass" style={{ padding: 24 }}>
            {activeTab === "events" && (
              <EventLog selectedRepo={selectedRepo} />
            )}
            {activeTab === "rules" && (
              <RuleEditor selectedRepo={selectedRepo} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
