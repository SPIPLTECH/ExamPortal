import { requireAlcContext } from "@/lib/alc";
import { connectDB } from "@/lib/db";
import { ExamResult } from "@/models/ExamResult";
import { StudentProfile } from "@/models/StudentProfile";
import { ALCCenter } from "@/models/ALCCenter";
import { User } from "@/models/User";
import { Test } from "@/models/Test";
import { ok, handleRoute } from "@/lib/api";

void User;
void Test;

/** All results of this center, grouped by the student's school. */
export const GET = handleRoute(async () => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  await connectDB();

  const [center, results] = await Promise.all([
    ALCCenter.findById(ctx.centerId).select("name").lean(),
    ExamResult.find({ center: ctx.centerId })
      .select("student test score totalMarks percentage passed createdAt")
      .populate("student", "name")
      .populate("test", "name")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean(),
  ]);
  const profiles = await StudentProfile.find({ user: { $in: results.map((r) => (r.student as { _id: unknown })._id) } })
    .select("user schoolName class")
    .lean();
  const profMap = new Map(profiles.map((p) => [String(p.user), p]));

  const bySchool = new Map<string, { school: string; students: unknown[]; passed: number }>();
  for (const r of results) {
    const st = r.student as unknown as { _id: unknown; name?: string } | null;
    const test = r.test as unknown as { name?: string } | null;
    const prof = st ? profMap.get(String(st._id)) : undefined;
    const school = prof?.schoolName || "Other / No school";
    const g = bySchool.get(school) ?? { school, students: [], passed: 0 };
    g.students.push({
      id: String(r._id),
      name: st?.name ?? "—",
      class: prof?.class ?? null,
      exam: test?.name ?? "Exam",
      score: r.score,
      totalMarks: r.totalMarks,
      percentage: Math.round(r.percentage * 100) / 100,
      passed: r.passed,
      date: r.createdAt,
    });
    if (r.passed) g.passed++;
    bySchool.set(school, g);
  }
  const schools = [...bySchool.values()].sort((a, b) => a.school.localeCompare(b.school));
  return ok({ center: center?.name ?? "", schools });
});
