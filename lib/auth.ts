import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { supabase } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      login?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      authorization: {
        params: {
          // public_repo: read/write access to public repos (labels, comments, webhooks)
          scope: "read:user user:email public_repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "github" && account.access_token && profile) {
        const githubProfile = profile as unknown as {
          id: number;
          login: string;
          name?: string;
          avatar_url?: string;
        };

        try {
          // Upsert user with encrypted access token
          const { error } = await supabase.from("users").upsert(
            {
              id: String(githubProfile.id),
              login: githubProfile.login,
              name: githubProfile.name ?? null,
              avatar_url: githubProfile.avatar_url ?? null,
              access_token: await encrypt(account.access_token),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

          if (error) {
            console.error("Failed to upsert user:", error);
            return false;
          }
        } catch (err) {
          console.error("signIn callback error:", err);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, profile, account }) {
      // On first sign-in, capture GitHub profile id and login
      if (profile) {
        const githubProfile = profile as unknown as { id: number; login: string };
        token.sub = String(githubProfile.id);
        token.login = githubProfile.login;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.login) {
        session.user.login = token.login as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
