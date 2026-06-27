"use client";

import { useState, useEffect } from "react";

interface ConnectedRepo {
  id: number;
  repo_full_name: string;
  active: boolean;
  connected_at: string;
}

interface AvailableRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
}

export default function RepoConnector({
  onRepoSelect,
  selectedRepo,
}: {
  onRepoSelect: (repo: string | null) => void;
  selectedRepo: string | null;
}) {
  const [connected, setConnected] = useState<ConnectedRepo[]>([]);
  const [available, setAvailable] = useState<AvailableRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [showAvailable, setShowAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repos");
      if (!res.ok) throw new Error("Failed to load repositories");
      const data = await res.json();
      setConnected(data.connected ?? []);
      setAvailable(data.available ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const connectRepo = async (repoFullName: string) => {
    setConnecting(repoFullName);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      await fetchRepos();
      setShowAvailable(false);
      onRepoSelect(repoFullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(null);
    }
  };

  const disconnectRepo = async (repoFullName: string) => {
    if (!confirm(`Disconnect ${repoFullName}? This will delete the GitHub webhook.`)) return;
    setDisconnecting(repoFullName);
    try {
      const res = await fetch("/api/repos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName }),
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      if (selectedRepo === repoFullName) onRepoSelect(null);
      await fetchRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "20px 0",
          color: "var(--text-muted)",
        }}
      >
        <div className="spinner" />
        Loading repositories…
      </div>
    );
  }

  return (
    <div>
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
        </div>
      )}

      {/* Connected repos */}
      {connected.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Connected
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {connected.map((repo) => (
              <div
                key={repo.id}
                className="glass-flat"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  cursor: "pointer",
                  background:
                    selectedRepo === repo.repo_full_name
                      ? "rgba(124, 58, 237, 0.1)"
                      : "var(--glass-bg)",
                  borderColor:
                    selectedRepo === repo.repo_full_name
                      ? "rgba(124, 58, 237, 0.3)"
                      : "var(--glass-border)",
                }}
                onClick={() =>
                  onRepoSelect(
                    selectedRepo === repo.repo_full_name
                      ? null
                      : repo.repo_full_name
                  )
                }
                id={`repo-${repo.repo_full_name.replace("/", "-")}`}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 14 }}>📦</span>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color:
                          selectedRepo === repo.repo_full_name
                            ? "var(--text-accent)"
                            : "var(--text-primary)",
                      }}
                    >
                      {repo.repo_full_name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Connected {formatDate(repo.connected_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--success)",
                      boxShadow: "0 0 6px var(--success)",
                    }}
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    id={`disconnect-${repo.repo_full_name.replace("/", "-")}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnectRepo(repo.repo_full_name);
                    }}
                    disabled={disconnecting === repo.repo_full_name}
                    title="Disconnect repository"
                  >
                    {disconnecting === repo.repo_full_name ? (
                      <div className="spinner" />
                    ) : (
                      "✕"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect new repo */}
      <button
        className="btn btn-secondary btn-sm"
        id="connect-new-repo"
        onClick={() => setShowAvailable(!showAvailable)}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {showAvailable ? "▲ Hide" : "＋ Connect a repository"}
      </button>

      {showAvailable && (
        <div style={{ marginTop: 12 }}>
          {available.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "16px 0",
              }}
            >
              All your public repos are connected!
            </p>
          ) : (
            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {available.map((repo) => (
                <div
                  key={repo.full_name}
                  className="glass-flat"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {repo.full_name}
                    </div>
                    {repo.description && (
                      <div
                        className="truncate"
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          maxWidth: 200,
                        }}
                      >
                        {repo.description}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    id={`connect-${repo.full_name.replace("/", "-")}`}
                    onClick={() => connectRepo(repo.full_name)}
                    disabled={connecting === repo.full_name}
                  >
                    {connecting === repo.full_name ? (
                      <div className="spinner" />
                    ) : (
                      "Connect"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
