import { connectDB } from "@/lib/db";
import { Test, type ITest } from "@/models/Test";
import { ExamAttempt } from "@/models/ExamAttempt";
import { requireStudentContext } from "@/lib/student";
import { ok, fail, handleRoute } from "@/lib/api";

/** What the exam room needs before it starts: languages on offer and whether an attempt already exists. */
export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  const test = await Test.findById(testId).select("name languages").lean<ITest>();
  if (!test) return fail("Test not found", 404);
  const existing = await ExamAttempt.findOne({ test: testId, student: ctx.user.id })
    .select("status language")
    .lean();

  return ok({
    name: test.name,
    languages: test.languages ?? [],
    hasAttempt: !!existing,
    language: existing?.language ?? null,
  });
});
