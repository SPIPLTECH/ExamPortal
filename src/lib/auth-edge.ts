import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/** Lightweight NextAuth instance for middleware (reads JWT; no DB/providers). */
export const { auth } = NextAuth(authConfig);
