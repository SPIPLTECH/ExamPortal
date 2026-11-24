import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { ExamResult } from "@/models";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ExamDonePage() {
  const user = await getSessionUser();
  let result: { score: number; totalMarks: number; percentage: number; passed: boolean } | null = null;
  if (user) {
    await connectDB();
    result = await ExamResult.findOne({ student: user.id })
      .sort({ createdAt: -1 })
      .select("score totalMarks percentage passed")
      .lean();
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
        <h1 className="text-2xl font-bold">{result ? "Exam submitted" : "No exam in progress"}</h1>
        {user && result ? (
          <>
            <p className="text-muted-foreground mt-1">Thank you, {user.name}. Your responses have been recorded.</p>
            <div className="mt-5 rounded-lg bg-muted/50 p-4">
              <p className="text-3xl font-bold">
                {result.score} <span className="text-lg text-muted-foreground">/ {result.totalMarks}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {result.percentage.toFixed(1)}% · {result.passed ? "Passed" : "Not passed"}
              </p>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground mt-1">Go to your dashboard to see your exams.</p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {user ? (
            <>
              <Button asChild><Link href="/student">Close</Link></Button>
            </>
          ) : (
            <Button asChild>
              <Link href="/">Go to home</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
