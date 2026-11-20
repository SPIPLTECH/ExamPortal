import { requireStudent } from "./auth-helpers";
import { connectDB } from "./db";
import { StudentProfile, type IStudentProfile } from "@/models/StudentProfile";
import type { NextResponse } from "next/server";
import type { SessionUser } from "./auth-helpers";
import type { FilterQuery } from "mongoose";
import type { ITest } from "@/models/Test";

export type StudentContext = {
  user: SessionUser;
  profile: IStudentProfile;
};

export async function requireStudentContext(): Promise<
  { error: NextResponse; ctx: null } | { error: null; ctx: StudentContext }
> {
  const res = await requireStudent();
  if (res.error) return { error: res.error, ctx: null };
  await connectDB();
  const profile = await StudentProfile.findOne({ user: res.session.user.id }).lean<IStudentProfile>();
  if (!profile) {
    const { fail } = await import("./api");
    return { error: fail("Student profile not found", 404), ctx: null };
  }
  return { error: null, ctx: { user: res.session.user, profile } };
}

/**
 * Mongoose filter for tests this student is eligible to see: published,
 * approved, within the exam window, matching class/stream, and belonging to
 * the student's center (or explicitly assigned to it).
 */
export function eligibleTestFilter(profile: IStudentProfile): FilterQuery<ITest> {
  const now = new Date();
  const centerIds = profile.center ? [profile.center] : [];

  const filter: FilterQuery<ITest> = {
    reviewStatus: "APPROVED",
    status: { $in: ["SCHEDULED", "ACTIVE"] },
    "schedule.endTime": { $gte: now },
    "schedule.eligibleClasses": profile.class,
    $and: [
      {
        $or: [
          { center: { $in: centerIds } },
          { assignedCenters: { $in: centerIds } },
        ],
      },
      {
        $or: [
          { "schedule.eligibleStreams": { $size: 0 } },
          ...(profile.stream ? [{ "schedule.eligibleStreams": profile.stream }] : []),
        ],
      },
    ],
  };
  return filter;
}

/** Is the enrollment window currently open for a test? */
export function enrollmentOpen(test: Pick<ITest, "schedule">): boolean {
  const now = new Date();
  const deadline = test.schedule?.enrollmentDeadline ?? test.schedule?.startTime;
  if (!deadline) return true;
  return now <= new Date(deadline);
}

/** Is the exam currently live (within start/end window)? */
export function examLive(test: Pick<ITest, "schedule">): boolean {
  const now = new Date();
  const s = test.schedule?.startTime;
  const e = test.schedule?.endTime;
  if (!s || !e) return false;
  return now >= new Date(s) && now <= new Date(e);
}
