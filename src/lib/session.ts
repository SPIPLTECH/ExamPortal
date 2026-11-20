import { auth } from "./auth";
import { connectDB } from "./db";
import { User, type IUser } from "@/models/User";
import { StudentProfile, type IStudentProfile } from "@/models/StudentProfile";
import type { Role } from "./constants";

export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  image: string | null;
  centerId: string | null;
};

/** Session user shaped from the JWT (no DB hit). Null if not signed in. */
export async function getSessionUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? null,
    role: u.role as Role,
    image: u.image ?? null,
    centerId: u.centerId ?? null,
  };
}

/** Full user document from the DB for the signed-in user. */
export async function getDbUser(): Promise<(IUser & { _id: unknown }) | null> {
  const s = await getSessionUser();
  if (!s) return null;
  await connectDB();
  return User.findById(s.id).lean<IUser>();
}

export async function getStudentProfile(
  userId: string
): Promise<IStudentProfile | null> {
  await connectDB();
  return StudentProfile.findOne({ user: userId }).lean<IStudentProfile>();
}
