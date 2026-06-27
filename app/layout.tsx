import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitBot — GitHub Automation Bot",
  description:
    "Event-driven GitHub automation: auto-label issues, post comments, send Slack alerts, and AI-triage with Gemini — all driven by configurable rules.",
  keywords: ["GitHub", "automation", "bot", "webhooks", "Slack", "AI triage"],
  openGraph: {
    title: "GitBot — GitHub Automation Bot",
    description: "Automate your GitHub workflow with smart rules and AI triage",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bg-animated" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
