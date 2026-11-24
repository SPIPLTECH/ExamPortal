"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, BarChart3, ChevronDown, Eye, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Summary = { testId: string; name: string; center?: string | null; attempts: number; avg: number; highest: number; lowest: number; passCount: number; failCount: number };
type StudentRow = { id: string; name: string; email: string | null; mobile?: string | null; image?: string | null; score: number; totalMarks: number; percentage: number; passed: boolean };
type AnswerItem = {
  no: number; text: string; imageUrl: string | null;
  options: { key: string; text: string; imageUrl: string | null }[];
  selected: string | null; correct: string; status: "CORRECT" | "WRONG" | "UNATTEMPTED"; marks: number;
};

export function ResultsExplorer({ api }: { api: string }) {
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [review, setReview] = useState<{ id: string; loading: boolean; items: AnswerItem[] } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(api);
      const json = await res.json();
      setLoading(false);
      if (res.ok) setItems(json.data.items);
      else toast.error(json.error || "Failed to load");
    })();
  }, [api]);

  async function toggle(testId: string) {
    setReview(null);
    if (openId === testId) { setOpenId(null); return; }
    setOpenId(testId);
    setRowsLoading(true);
    const res = await fetch(`${api}?testId=${testId}`);
    const json = await res.json();
    setRowsLoading(false);
    if (res.ok) setRows(json.data.students);
    else toast.error(json.error || "Failed");
  }

  async function toggleReview(id: string) {
    if (review?.id === id) { setReview(null); return; }
    setReview({ id, loading: true, items: [] });
    const res = await fetch(`${api}/${id}/answers`);
    const json = await res.json();
    if (res.ok) setReview({ id, loading: false, items: json.data.items });
    else { setReview(null); toast.error(json.error || "Failed to load answers"); }
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (items.length === 0)
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No results yet — results appear once students complete tests.
      </div>
    );

  return (
    <div className="grid gap-3">
      {items.map((s) => (
        <div key={s.testId} className="rounded-xl border bg-card overflow-hidden">
          <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggle(s.testId)}>
            <div>
              <h3 className="font-semibold">{s.name}{s.center ? <span className="text-sm font-normal text-muted-foreground"> · {s.center}</span> : null}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.attempts} attempts · avg {s.avg}% · high {s.highest}% · low {s.lowest}%</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-600">{s.passCount} pass</Badge>
              <Badge className="bg-red-600">{s.failCount} fail</Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${openId === s.testId ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openId === s.testId && (
            <div className="border-t">
              {rowsLoading ? (
                <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (
                <div className="divide-y">
                  {rows.map((r) => (
                    <div key={r.id}>
                      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-3">
                          {r.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image} alt="" className="h-10 w-10 rounded-full object-cover border" />
                          ) : (
                            <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">{r.name.slice(0, 1)}</span>
                          )}
                          <span>{r.name}<span className="block text-xs text-muted-foreground">{r.mobile || r.email || ""}</span></span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted-foreground">{r.score}/{r.totalMarks}</span>
                          <b>{r.percentage}%</b>
                          <Badge className={r.passed ? "bg-emerald-600" : "bg-red-600"}>{r.passed ? "Pass" : "Fail"}</Badge>
                          <Button size="sm" variant="outline" onClick={() => toggleReview(r.id)}>
                            <Eye className="h-4 w-4" /> {review?.id === r.id ? "Hide answers" : "View answers"}
                          </Button>
                        </span>
                      </div>
                      {review?.id === r.id && (
                        <div className="bg-muted/40 px-4 py-3 space-y-3">
                          {review.loading ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                          ) : (
                            review.items.map((q) => (
                              <div key={q.no} className="rounded-lg border bg-card p-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-medium">Q{q.no}. {q.text}</p>
                                  {q.status === "CORRECT" ? (
                                    <Badge className="bg-emerald-600 shrink-0"><CheckCircle2 className="h-3 w-3" /> Correct</Badge>
                                  ) : q.status === "WRONG" ? (
                                    <Badge className="bg-red-600 shrink-0"><XCircle className="h-3 w-3" /> Wrong</Badge>
                                  ) : (
                                    <Badge variant="outline" className="shrink-0"><MinusCircle className="h-3 w-3" /> Not answered</Badge>
                                  )}
                                </div>
                                {q.imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={q.imageUrl} alt="" className="mt-2 max-h-40 rounded border" />
                                )}
                                <ul className="mt-2 grid gap-1.5">
                                  {q.options.map((o) => {
                                    const isSel = q.selected === o.key;
                                    const isCor = q.correct === o.key;
                                    return (
                                      <li key={o.key} className={`rounded-md border px-3 py-1.5 flex items-center justify-between gap-2 ${isCor ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : isSel ? "border-red-500 bg-red-50 dark:bg-red-950/40" : ""}`}>
                                        <span><b>{o.key}.</b> {o.text}</span>
                                        <span className="text-xs font-medium whitespace-nowrap">
                                          {isSel && "Student's answer"}{isSel && isCor && " · "}{isCor && "Correct answer"}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
