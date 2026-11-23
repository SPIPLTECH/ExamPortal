import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestEnrollment } from "@/models/TestEnrollment";
import { ExamAttempt } from "@/models/ExamAttempt";
import {
  requireStudentContext,
  eligibleTestFilter,
  enrollmentOpen,
  examLive,
} from "@/lib/student";
import { ok, handleRoute } from "@/lib/api";
import type { ITest } from "@/models/Test";

export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "available";

  await connectDB();

  // Enrollments + attempts for flagging.
  const [enrollments, attempts] = await Promise.all([
    TestEnrollment.find({ student: ctx.user.id }).lean(),
    ExamAttempt.find({ student: ctx.user.id }).select("test status").lean(),
  ]);
  const enrolledIds = new Set(enrollments.map((e) => String(e.test)));
  const attemptByTest = new Map(attempts.map((a) => [String(a.test), a.status]));

  const decorate = (t: ITest & { _id: unknown }) => ({
    _id: String(t._id),
    name: t.name,
    description: t.description,
    targetClass: t.targetClass,
    targetStream: t.targetStream,
    totalQuestions: t.totalQuestions,
    duration: t.duration,
    proctoringMode: t.proctoring?.mode ?? "DISABLED",
    schedule: t.schedule,
    enrolled: enrolledIds.has(String(t._id)),
    enrollmentOpen: enrollmentOpen(t),
    examLive: examLive(t),
    attemptStatus: attemptByTest.get(String(t._id)) ?? null,
  });

  let items;
  if (scope === "dashboard") {
    // Everything the student can take (pending) plus everything already attempted.
    const attemptedIds = attempts.map((a) => a.test);
    items = await Test.find({
      $or: [eligibleTestFilter(ctx.profile), { _id: { $in: attemptedIds } }],
    }).sort({ "schedule.startTime": 1, createdAt: -1 }).lean();
  } else if (scope === "enrolled") {
    const ids = enrollments.filter((e) => e.status === "ENROLLED").map((e) => e.test);
    items = await Test.find({ _id: { $in: ids } }).sort({ "schedule.startTime": 1 }).lean();
  } else {
    // available + explore both start from the eligibility filter.
    items = await Test.find(eligibleTestFilter(ctx.profile)).sort({ "schedule.startTime": 1 }).lean();
  }

  let decorated = (items as (ITest & { _id: unknown })[]).map(decorate);
  if (scope === "available") {
    decorated = decorated.filter((d) => !d.enrolled && d.enrollmentOpen);
  }

  return ok({ items: decorated });
});
