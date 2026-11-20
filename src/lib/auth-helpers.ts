import { auth } from "./auth";
import { NextResponse } from "next/server";
import type { Role } from "./constants";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
  centerId?: string | null;
};

type Guard =
  | { error: NextResponse; session: null }
  | { error: null; session: { user: SessionUser } };

function forbid(message: string, status = 403): Guard {
  return { error: NextResponse.json({ error: message }, { status }), session: null };
}

export async function requireAuth(): Promise<Guard> {
  const session = await auth();
  if (!session?.user) return forbid("Unauthorized", 401);
  return { error: null, session: session as unknown as { user: SessionUser } };
}

export async function requireRole(...roles: Role[]): Promise<Guard> {
  const res = await requireAuth();
  if (res.error) return res;
  if (!roles.includes(res.session.user.role)) {
    return forbid(`Forbidden: requires ${roles.join(" or ")}`);
  }
  return res;
}

export const requireSuperAdmin = () => requireRole("SUPER_ADMIN");
export const requireALC = () => requireRole("ALC_CENTER");
export const requireStudent = () => requireRole("STUDENT");
/** Super admin or the ALC center — used for shared management endpoints. */
export const requireStaff = () => requireRole("SUPER_ADMIN", "ALC_CENTER");
