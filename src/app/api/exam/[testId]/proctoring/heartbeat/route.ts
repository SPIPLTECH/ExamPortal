import { connectDB } from "@/lib/db";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ProctoringSession } from "@/models/ProctoringSession";
import { requireStudentContext } from "@/lib/student";
import { ok, fail, handleRoute } from "@/lib/api";

/** Liveness + background-warning channel (polled every ~10s by the monitor). */
export const POST = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  const attempt = await ExamAttempt.findOne({ test: testId, student: ctx.user.id }).select("status");
  if (!attempt) return fail("No active attempt", 404);

  const session = await ProctoringSession.findOne({ attempt: attempt._id })
    .select("status warnings latestWarningMessage")
    .lean();

  const status =
    attempt.status === "IN_PROGRESS"
      ? session?.status === "TERMINATED"
        ? "TERMINATED"
        : "ACTIVE"
      : attempt.status === "TERMINATED"
        ? "TERMINATED"
        : "COMPLETED";

  return ok({
    status,
    warningCount: session?.warnings ?? 0,
    latestWarningMessage: session?.latestWarningMessage ?? null,
  });
});
