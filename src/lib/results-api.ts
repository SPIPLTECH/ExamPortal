import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ExamResult } from "@/models/ExamResult";
import { ExamAttempt } from "@/models/ExamAttempt";
import { ExamResponse } from "@/models/ExamResponse";
import { Test } from "@/models/Test";
import { User } from "@/models/User";
import { ALCCenter } from "@/models/ALCCenter";
import { ok, fail } from "@/lib/api";

void User;
void ALCCenter;

/** Test-wise summary, or the student list of one test. `centerId` scopes a center; null = all (admin). */
export async function resultsList(req: Request, centerId: string | null) {
  const url = new URL(req.url);
  const testId = url.searchParams.get("testId");
  const match: Record<string, unknown> = centerId ? { center: new Types.ObjectId(centerId) } : {};
  await connectDB();

  if (testId) {
    const rows = await ExamResult.find({ ...match, test: testId })
      .populate("student", "name email mobile image")
      .sort({ percentage: -1 })
      .lean();
    return ok({
      students: rows.map((r) => {
        const st = r.student as unknown as { name?: string; email?: string; mobile?: string; image?: { url?: string } } | null;
        return {
          id: String(r._id),
          name: st?.name ?? "—",
          email: st?.email ?? null,
          mobile: st?.mobile ?? null,
          image: st?.image?.url ?? null,
          score: r.score,
          totalMarks: r.totalMarks,
          percentage: r.percentage,
          passed: r.passed,
        };
      }),
    });
  }

  const summary = await ExamResult.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$test",
        center: { $first: "$center" },
        attempts: { $sum: 1 },
        avg: { $avg: "$percentage" },
        highest: { $max: "$percentage" },
        lowest: { $min: "$percentage" },
        passCount: { $sum: { $cond: ["$passed", 1, 0] } },
      },
    },
  ]);
  const tests = await Test.find({ _id: { $in: summary.map((s) => s._id) } }).select("name").lean();
  const nameMap = new Map(tests.map((t) => [String(t._id), t.name]));
  const centers = await ALCCenter.find({ _id: { $in: summary.map((s) => s.center) } }).select("name").lean();
  const centerMap = new Map(centers.map((c) => [String(c._id), c.name]));
  const r1 = (n: number) => Math.round((n ?? 0) * 10) / 10;
  return ok({
    items: summary.map((s) => ({
      testId: String(s._id),
      name: nameMap.get(String(s._id)) ?? "Exam",
      center: centerMap.get(String(s.center)) ?? null,
      attempts: s.attempts,
      avg: r1(s.avg),
      highest: r1(s.highest),
      lowest: r1(s.lowest),
      passCount: s.passCount,
      failCount: s.attempts - s.passCount,
    })),
  });
}

/** Question-by-question view of what one student answered. */
export async function resultAnswers(resultId: string, centerId: string | null) {
  if (!Types.ObjectId.isValid(resultId)) return fail("Invalid result", 400);
  await connectDB();
  const result = await ExamResult.findOne({ _id: resultId, ...(centerId ? { center: centerId } : {}) }).lean();
  if (!result) return fail("Result not found", 404);
  const attempt = await ExamAttempt.findById(result.attempt).select("questions").lean();
  if (!attempt) return fail("Attempt not found", 404);
  const responses = await ExamResponse.find({ attempt: result.attempt }).lean();
  const byQ = new Map(responses.map((r) => [String(r.question), r.selectedOption ?? null]));
  const items = [...attempt.questions]
    .sort((a, b) => a.order - b.order)
    .map((q, i) => {
      const selected = byQ.get(String(q.question)) ?? null;
      return {
        no: i + 1,
        text: q.text,
        imageUrl: q.imageUrl ?? null,
        options: q.options.map((o) => ({ key: o.key, text: o.text, imageUrl: o.imageUrl ?? null })),
        selected,
        correct: q.correctOption,
        status: selected == null ? "UNATTEMPTED" : selected === q.correctOption ? "CORRECT" : "WRONG",
        marks: q.marks,
      };
    });
  return ok({ score: result.score, totalMarks: result.totalMarks, items });
}
