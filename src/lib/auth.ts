import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import { User } from "@/models/User";
import { loginSchema } from "./validations";
import { rateLimit } from "./rate-limit";
import { authConfig } from "./auth.config";
import { verifyEntryToken } from "./entry-token";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Mobile", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;

        if (!rateLimit(`login:${identifier.toLowerCase()}`, 10, 60000)) return null;

        await connectDB();

        // A single login box: match the identifier against username, email, or mobile.
        const id = identifier.trim();
        const user = await User.findOne({
          $or: [
            { username: id.toLowerCase() },
            { email: id.toLowerCase() },
            { mobile: id },
          ],
        });
        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) return null;
        if (!user.isActive) return null;
        // Center logins expire; reject once past their validity date.
        if (user.loginExpiresAt && user.loginExpiresAt < new Date()) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          user.loginAttempts = (user.loginAttempts ?? 0) + 1;
          if (user.loginAttempts >= MAX_ATTEMPTS) {
            user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
            user.loginAttempts = 0;
          }
          await user.save();
          return null;
        }

        user.loginAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = new Date();
        await user.save();

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email ?? undefined,
          role: user.role,
          image: user.image?.url ?? undefined,
          centerId: user.center ? user.center.toString() : undefined,
        } as unknown as import("next-auth").User;
      },
    }),
      // Passwordless student entry: only valid with a fresh server-signed token
    // issued by /api/public/enter right after registration.
    Credentials({
      id: "exam-entry",
      name: "exam-entry",
      credentials: {
        userId: { type: "text" },
        token: { type: "text" },
      },
      async authorize(credentials) {
        const userId = String(credentials?.userId ?? "");
        const token = String(credentials?.token ?? "");
        if (!/^[a-f\d]{24}$/i.test(userId) || !verifyEntryToken(userId, token)) return null;
        await connectDB();
        const user = await User.findById(userId);
        if (!user || !user.isActive || user.role !== "STUDENT") return null;
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email ?? undefined,
          role: user.role,
          image: user.image?.url ?? undefined,
        } as unknown as import("next-auth").User;
      },
    }),
  ],
});
