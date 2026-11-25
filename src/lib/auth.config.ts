import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config: NO providers that import Node-only libs (mongoose,
 * bcrypt). Shared by the full server auth (`auth.ts`) and the lightweight
 * edge instance used by middleware (`auth-edge.ts`).
 */
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      // Keep the session cookie tiny: a photo (esp. an inline data: URL) in the JWT can push
      // the cookie over the browser's 4 KB limit, which silently logs the user out.
      delete token.picture;
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role;
        token.centerId = (user as { centerId?: string }).centerId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.centerId = (token.centerId as string) ?? null;
      }
      return session;
    },
  },
};
