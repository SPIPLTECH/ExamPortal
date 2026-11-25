import { connectDB } from "@/lib/db";
import { Test, type ITest } from "@/models/Test";
import { ExamAttempt } from "@/models/ExamAttempt";
import { requireStudentContext } from "@/lib/student";
import { ok, fail, handleRoute } from "@/lib/api";

/** What the exam room shows BEFORE the exam starts: the center's instructions & rules,
 *  duration, marks, languages on offer and whether an attempt already exists. */
export const GET = handleRoute(async (_req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;
  const { testId } = await (ctxArg as { params: Promise<{ testId: string }> }).params;

  await connectDB();
  const [test, existing] = await Promise.all([
    Test.findById(testId)
      .select("name description instructions rules specialConditions languages duration totalQuestions blueprint marksPerQuestion passingMarks passingPercentage negativeMarking proctoring")
      .lean<ITest>(),
    ExamAttempt.findOne({ test: testId, student: ctx.user.id }).select("status language").lean(),
  ]);
  if (!test) return fail("Test not found", 404);

  // Blueprint papers: the question count depends on the student's stream.
  const stream = ctx.profile.stream ?? null;
  const totalQuestions =
    test.blueprint && test.blueprint.length > 0
      ? test.blueprint
          .filter((e) => !e.streams?.length || (stream && (e.streams as string[]).includes(stream)))
          .reduce((n, e) => n + e.count, 0)
      : test.totalQuestions;
  const marksPerQuestion = test.marksPerQuestion ?? 1;

  return ok({
    name: test.name,
    description: test.description ?? null,
    instructions: test.instructions ?? null,
    rules: test.rules ?? null,
    specialConditions: test.specialConditions ?? null,
    languages: test.languages ?? [],
    duration: test.duration,
    totalQuestions,
    marksPerQuestion,
    totalMarks: Math.round(totalQuestions * marksPerQuestion * 100) / 100,
    passingMarks: test.passingMarks ?? 0,
    passingPercentage: test.passingPercentage ?? 0,
    negativeMarking: test.negativeMarking?.enabled ? test.negativeMarking.value : 0,
    proctored: !!test.proctoring && test.proctoring.mode !== "DISABLED",
    fullscreenLock: !!test.proctoring?.requireFullscreen,
    maxWarnings: Math.max(1, test.proctoring?.maxTabSwitches ?? 4),
    hasAttempt: !!existing,
    language: existing?.language ?? null,
  });
});
