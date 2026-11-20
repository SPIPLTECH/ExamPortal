import { ClipboardList, FileCheck2, CheckCircle2, Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser, getStudentProfile } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { TestEnrollment, ExamAttempt, ExamResult } from "@/models";
import { StatCard } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  await connectDB();
  const profile = await getStudentProfile(user.id);

  const [enrolled, completed, results] = await Promise.all([
    TestEnrollment.countDocuments({ student: user.id, status: "ENROLLED" }),
    ExamAttempt.countDocuments({ student: user.id, status: { $in: ["SUBMITTED", "TIMED_OUT"] } }),
    ExamResult.find({ student: user.id, released: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate<{ test: { name: string } }>("test", "name")
      .lean(),
  ]);

  const bestPct = results.reduce((m, r) => Math.max(m, r.percentage), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {profile
            ? `Class ${profile.class}${profile.stream ? ` · ${profile.stream}` : ""} · ${profile.schoolName}`
            : "Student dashboard"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled Tests" value={enrolled} icon={FileCheck2} tone="blue" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="green" />
        <StatCard label="Results" value={results.length} icon={ClipboardList} />
        <StatCard
          label="Best Score"
          value={results.length ? `${bestPct.toFixed(0)}%` : "—"}
          icon={Trophy}
          tone="amber"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Recent Results</h2>
        {results.length === 0 ? (
          <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground">
            You haven&apos;t completed any examinations yet.
          </div>
        ) : (
          <div className="rounded-xl border bg-background divide-y">
            {results.map((r) => (
              <div key={String(r._id)} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{r.test?.name ?? "Examination"}</p>
                  <p className="text-sm text-muted-foreground">
                    Score {r.score}/{r.totalMarks}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{r.percentage.toFixed(0)}%</p>
                  <p
                    className={
                      r.passed
                        ? "text-xs text-emerald-600 font-medium"
                        : "text-xs text-red-600 font-medium"
                    }
                  >
                    {r.passed ? "Passed" : "Failed"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
