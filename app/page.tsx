import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main>
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Logo */}
        <div className="fade-in" style={{ animationDelay: "0ms" }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              margin: "0 auto 24px",
              boxShadow: "0 0 60px rgba(124, 58, 237, 0.5)",
            }}
          >
            ⚡
          </div>
        </div>

        {/* Headline */}
        <div className="fade-in" style={{ animationDelay: "80ms" }}>
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              marginBottom: 16,
              lineHeight: 1.1,
            }}
          >
            <span className="gradient-text">GitHub</span> Automation
            <br />
            on Autopilot
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2vw, 20px)",
              color: "var(--text-secondary)",
              maxWidth: 560,
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}
          >
            Connect your repositories. Define smart rules. Let the bot handle
            labeling, commenting, Slack alerts, and AI triage — automatically.
          </p>
        </div>

        {/* CTA */}
        <div className="fade-in" style={{ animationDelay: "160ms" }}>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="btn btn-primary"
              id="sign-in-github"
              style={{
                fontSize: 16,
                padding: "14px 32px",
                borderRadius: 12,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Sign in with GitHub
            </button>
          </form>

          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            Free to use · No credit card required · Public repos only
          </p>
        </div>

        {/* Feature cards */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            maxWidth: 900,
            width: "100%",
            marginTop: 80,
            animationDelay: "240ms",
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} {...f} delay={240 + i * 60} />
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: 32,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 48,
            letterSpacing: "-0.03em",
          }}
        >
          How it works
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {STEPS.map((step, i) => (
            <StepCard key={i} step={i + 1} {...step} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "32px 24px",
          color: "var(--text-muted)",
          fontSize: 13,
          borderTop: "1px solid var(--glass-border)",
        }}
      >
        Built with Next.js · Supabase · Gemini AI · Slack
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div
      className="glass fade-in"
      style={{
        padding: "24px",
        textAlign: "left",
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div
      className="glass-flat"
      style={{
        display: "flex",
        gap: 20,
        padding: "20px 24px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
          boxShadow: "0 0 20px rgba(124, 58, 237, 0.3)",
        }}
      >
        {step}
      </div>
      <div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🔗",
    title: "Webhook Integration",
    description:
      "Connect any public repo. We auto-create GitHub webhooks listening to issues, PRs, and pushes.",
  },
  {
    icon: "⚡",
    title: "Configurable Rules",
    description:
      "Match on event type, keywords in the title/body, or author. Trigger labels, comments, or Slack alerts.",
  },
  {
    icon: "🤖",
    title: "AI Triage",
    description:
      "Powered by Gemini 2.0 Flash. Auto-classify priority, suggest labels, and generate summaries.",
  },
  {
    icon: "📣",
    title: "Slack Notifications",
    description:
      "Rich Block Kit messages with event details, AI analysis, and a direct link to GitHub.",
  },
  {
    icon: "🔒",
    title: "Secure by Design",
    description:
      "Per-repo HMAC secrets, encrypted token storage, duplicate event detection, and forged request rejection.",
  },
  {
    icon: "📊",
    title: "Live Dashboard",
    description:
      "See every event, every bot action, and every AI analysis — in a real-time log behind your login.",
  },
];

const STEPS = [
  {
    title: "Sign in with GitHub",
    description:
      "OAuth login connects your GitHub account. We request only public_repo access — nothing private.",
  },
  {
    title: "Connect a repository",
    description:
      "Pick any public repo you own. We create a webhook on GitHub that points to our secure endpoint.",
  },
  {
    title: "Configure your rules",
    description:
      "Set up conditions (e.g. title contains 'bug') and actions (add label, comment, Slack alert, AI analyze).",
  },
  {
    title: "Watch the bot work",
    description:
      "Open an issue, submit a PR, or push code — the bot reacts in seconds. Check the dashboard to see everything it did.",
  },
];
