"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

type Question = {
  order: number;
  category: string;
  text: string;
  options: { key: string; text: string }[];
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
};
type Detail = {
  testName: string;
  status: string;
  submittedAt: string | null;
  result: {
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    categoryBreakdown: { category: string; total: number; correct: number }[];
  } | null;
  questions: Question[];
};

export default function ResultDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/student/results/${attemptId}`);
      const json = await res.json();
      setLoading(false);
      if (res.ok) setData(json.data);
      else toast.error(json.error || "Failed to load");
    })();
  }, [attemptId]);

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!data) return <p className="text-muted-foreground">Result not found.</p>;

  const r = data.result;

  return (
    <div className="max-w-3xl">
      <Link href="/student/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>
      <PageHeader title={data.testName} subtitle={data.status === "TERMINATED" ? "Exam was terminated" : "Result detail"} />

      {r && (
        <div className="rounded-xl border bg-background p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-4xl font-bold">{r.percentage.toFixed(0)}%</p>
              <p className="text-muted-foreground">Score {r.score} / {r.totalMarks}</p>
            </div>
            <Badge className={`${r.passed ? "bg-emerald-600" : "bg-red-600"} text-base px-4 py-1`}>
              {r.passed ? "Passed" : "Failed"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {r.correctCount} correct</span>
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><XCircle className="h-4 w-4" /> {r.wrongCount} wrong</span>
            <span className="text-muted-foreground flex items-center gap-1"><MinusCircle className="h-4 w-4" /> {r.unattemptedCount} unattempted</span>
          </div>
          {r.categoryBreakdown?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {r.categoryBreakdown.map((c) => (
                <Badge key={c.category} variant="secondary">
                  {CATEGORY_LABEL[c.category] ?? c.category}: {c.correct}/{c.total}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Question review</h2>
      <div className="space-y-3">
        {data.questions.map((q) => (
          <div key={q.order} className="rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">
                <span className="text-muted-foreground mr-2">Q{q.order}.</span>
                {q.text}
              </p>
              {q.selectedOption == null ? (
                <Badge variant="outline" className="shrink-0">Skipped</Badge>
              ) : q.isCorrect ? (
                <Badge className="bg-emerald-600 shrink-0">Correct</Badge>
              ) : (
                <Badge className="bg-red-600 shrink-0">Wrong</Badge>
              )}
            </div>
            <div className="space-y-1.5 mt-3">
              {q.options.map((o) => {
                const isCorrect = o.key === q.correctOption;
                const isChosen = o.key === q.selectedOption;
                return (
                  <div
                    key={o.key}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      isCorrect
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                        : isChosen
                          ? "border-red-400 bg-red-50 dark:bg-red-950/40"
                          : "border-transparent"
                    }`}
                  >
                    <span className="font-medium w-5">{o.key}.</span>
                    <span className="flex-1">{o.text}</span>
                    {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    {isChosen && !isCorrect && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
