import { connectDB } from "@/lib/db";
import { ExamResult } from "@/models/ExamResult";
import "@/models/Test";
import { requireStudentContext } from "@/lib/student";
import { ok, handleRoute } from "@/lib/api";

/** The student's released exam results (history), newest first. */
export const GET = handleRoute(async () => {
  const { error, ctx } = await requireStudentContext();
  if (error) return error;

  await connectDB();
  const items = await ExamResult.find({ student: ctx.user.id, released: true })
    .sort({ createdAt: -1 })
    .populate<{ test: { name: string } }>("test", "name")
    .lean();

  return ok({
    items: items.map((r) => ({
      _id: String(r._id),
      attemptId: String(r.attempt),
      test: r.test?.name ?? "Examination",
      score: r.score,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      passed: r.passed,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      unattemptedCount: r.unattemptedCount,
      categoryBreakdown: r.categoryBreakdown,
      createdAt: r.createdAt,
    })),
  });
});
