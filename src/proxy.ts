import { auth } from "@/lib/auth-edge";
import { NextResponse } from "next/server";

/** Route-prefix → allowed roles. Checked in order; first match wins. */
const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/api/admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/alc", roles: ["ALC_CENTER"] },
  { prefix: "/api/alc", roles: ["ALC_CENTER"] },
  { prefix: "/student", roles: ["STUDENT"] },
  { prefix: "/exam", roles: ["STUDENT"] },
  { prefix: "/api/student", roles: ["STUDENT"] },
  { prefix: "/api/exam", roles: ["STUDENT"] },
];

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/public"];

function homeForRole(role?: string): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "ALC_CENTER") return "/alc";
  if (role === "STUDENT") return "/student";
  return "/login";
}

export default auth((req) => {
  const res = NextResponse.next();

  // ─── Security headers ──────────────────────────────────
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), interest-cohort=()"
  );
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  const { pathname } = req.nextUrl;
  const user = req.auth?.user as { role?: string } | undefined;

  if (pathname === "/") {
    return user
      ? NextResponse.redirect(new URL(homeForRole(user.role), req.url))
      : res;
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return res;

  // Authenticated users shouldn't sit on auth pages.
  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL(homeForRole(user.role), req.url));
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const match = ROLE_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (match && !match.roles.includes(user.role ?? "")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(homeForRole(user.role), req.url));
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)).*)",
  ],
};
