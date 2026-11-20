"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Result = {
  _id: string;
  attemptId: string;
  test: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  categoryBreakdown: { category: string; total: number; correct: number }[];
  createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

export default function HistoryPage() {
  const [items, setItems] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/student/results");
      const json = await res.json();
      setLoading(false);
      if (res.ok) setItems(json.data.items);
      else toast.error(json.error || "Failed to load");
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Exam History" subtitle="Your completed examinations and results" />
      {loading ? (
        <div className="p-10 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          You haven&apos;t completed any examinations yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <Link
              key={r._id}
              href={`/student/results/${r.attemptId}`}
              className="block rounded-xl border bg-background p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold flex items-center gap-1">
                    {r.test}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{r.percentage.toFixed(0)}%</p>
                  <Badge className={r.passed ? "bg-emerald-600" : "bg-red-600"}>
                    {r.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span>Score: <b className="text-foreground">{r.score}/{r.totalMarks}</b></span>
                <span className="text-emerald-600">Correct: {r.correctCount}</span>
                <span className="text-red-600">Wrong: {r.wrongCount}</span>
                <span>Unattempted: {r.unattemptedCount}</span>
              </div>
              {r.categoryBreakdown?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {r.categoryBreakdown.map((c) => (
                    <Badge key={c.category} variant="secondary">
                      {CATEGORY_LABEL[c.category] ?? c.category}: {c.correct}/{c.total}
                    </Badge>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
