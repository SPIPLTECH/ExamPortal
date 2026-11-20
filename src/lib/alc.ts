import { requireALC } from "./auth-helpers";
import type { NextResponse } from "next/server";
import type { SessionUser } from "./auth-helpers";

export type AlcContext = { user: SessionUser; centerId: string };

/**
 * Guard + context for ALC-scoped endpoints: ensures the caller is an ALC_CENTER
 * user AND is linked to a center. Returns a 403 otherwise.
 */
export async function requireAlcContext(): Promise<
  { error: NextResponse; ctx: null } | { error: null; ctx: AlcContext }
> {
  const res = await requireALC();
  if (res.error) return { error: res.error, ctx: null };
  const centerId = res.session.user.centerId;
  if (!centerId) {
    const { fail } = await import("./api");
    return { error: fail("Your account is not linked to a center", 403), ctx: null };
  }
  return { error: null, ctx: { user: res.session.user, centerId } };
}
