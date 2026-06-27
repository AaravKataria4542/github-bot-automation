import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <div>
      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="logo">
            <div className="logo-icon">⚡</div>
            GitBot
          </a>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  width={32}
                  height={32}
                  style={{ borderRadius: "50%", border: "2px solid var(--glass-border)" }}
                />
              )}
              <span
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}
                className="hide-mobile"
              >
                {session.user.login ?? session.user.name ?? session.user.email}
              </span>
            </div>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                id="sign-out"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* ── Dashboard Content ─────────────────────────────────────────────── */}
      <DashboardClient />
    </div>
  );
}
