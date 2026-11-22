import { connectDB } from "@/lib/db";
import { ExamResult } from "@/models/ExamResult";
import { Test } from "@/models/Test";
import { User } from "@/models/User";
import { requireAlcContext } from "@/lib/alc";
import { ok, handleRoute } from "@/lib/api";
import { Types } from "mongoose";

export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const centerId = new Types.ObjectId(ctx.centerId);

  const url = new URL(req.url);
  const testId = url.searchParams.get("testId");

  await connectDB();

  // Student-wise drill-down for one test.
  if (testId) {
    const rows = await ExamResult.find({ center: centerId, test: testId })
      .populate<{ student: { name: string; email?: string; mobile?: string; image?: { url?: string } } }>("student", "name email mobile image")
      .sort({ percentage: -1 })
      .lean();
    return ok({
      students: rows.map((r) => ({
        name: (r.student as { name?: string } | null)?.name ?? "—",
        email: (r.student as { email?: string } | null)?.email ?? null,
        mobile: (r.student as { mobile?: string } | null)?.mobile ?? null,
        image: (r.student as { image?: { url?: string } } | null)?.image?.url ?? null,
        score: r.score,
        totalMarks: r.totalMarks,
        percentage: r.percentage,
        passed: r.passed,
      })),
    });
  }

  // Test-wise summary.
  const summary = await ExamResult.aggregate([
    { $match: { center: centerId } },
    {
      $group: {
        _id: "$test",
        attempts: { $sum: 1 },
        avg: { $avg: "$percentage" },
        highest: { $max: "$percentage" },
        lowest: { $min: "$percentage" },
        passCount: { $sum: { $cond: ["$passed", 1, 0] } },
      },
    },
  ]);

  const testIds = summary.map((s) => s._id);
  const tests = await Test.find({ _id: { $in: testIds } }).select("name").lean();
  const nameMap = new Map(tests.map((t) => [String(t._id), t.name]));

  return ok({
    items: summary.map((s) => ({
      testId: String(s._id),
      name: nameMap.get(String(s._id)) ?? "Examination",
      attempts: s.attempts,
      avg: Math.round((s.avg ?? 0) * 10) / 10,
      highest: Math.round((s.highest ?? 0) * 10) / 10,
      lowest: Math.round((s.lowest ?? 0) * 10) / 10,
      passCount: s.passCount,
      failCount: s.attempts - s.passCount,
    })),
  });
});

// Ensure referenced models are registered for populate.
void User;
