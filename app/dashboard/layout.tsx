import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — GitBot",
  description:
    "Monitor your GitHub automation events, configure rules, and manage repositories.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
