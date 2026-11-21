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
 * Tests a student may see: every ADMIN-APPROVED test of their center that
 * targets their class (and their stream, if the test is stream-specific).
 * We deliberately do NOT require the ALC to have scheduled it or filter on the
 * exam window here — approved center tests are visible; the exam window only
 * gates *starting* (see examLive). Tests whose window has already ended are hidden.
 */
export function eligibleTestFilter(profile: IStudentProfile): FilterQuery<ITest> {
  const now = new Date();
  const centerIds = profile.center ? [profile.center] : [];

  const filter: FilterQuery<ITest> = {
    reviewStatus: "APPROVED",
    targetClass: profile.class,
    $and: [
      {
        $or: [
          { center: { $in: centerIds } },
          { assignedCenters: { $in: centerIds } },
        ],
      },
      // Stream-specific tests (11/12) must match the student's stream; others apply to all.
      {
        $or: [
          { targetStream: null },
          ...(profile.stream ? [{ targetStream: profile.stream }] : []),
        ],
      },
      // Hide only tests whose exam window has clearly ended.
      {
        $or: [
          { "schedule.endTime": null },
          { "schedule.endTime": { $exists: false } },
          { "schedule.endTime": { $gte: now } },
        ],
      },
    ],
  };
  return filter;
}

/** Is enrollment currently open? Open until the exam window ends (or always, if unscheduled). */
export function enrollmentOpen(test: Pick<ITest, "schedule">): boolean {
  const now = new Date();
  const deadline = test.schedule?.enrollmentDeadline ?? test.schedule?.endTime;
  if (!deadline) return true;
  return now <= new Date(deadline);
}

/**
 * Can the exam be started now?
 *  - Unscheduled (no window): always takeable once approved (timer = duration).
 *  - Scheduled: only within the start/end window.
 */
export function examLive(test: Pick<ITest, "schedule">): boolean {
  const s = test.schedule?.startTime;
  const e = test.schedule?.endTime;
  if (!s && !e) return true;
  const now = new Date();
  if (s && now < new Date(s)) return false;
  if (e && now > new Date(e)) return false;
  return true;
}
