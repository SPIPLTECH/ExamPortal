"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, BarChart3, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Summary = {
  testId: string;
  name: string;
  attempts: number;
  avg: number;
  highest: number;
  lowest: number;
  passCount: number;
  failCount: number;
};
type StudentRow = { name: string; email: string | null; mobile?: string | null; image?: string | null; score: number; totalMarks: number; percentage: number; passed: boolean };

export default function AlcResultsPage() {
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/alc/results");
      const json = await res.json();
      setLoading(false);
      if (res.ok) setItems(json.data.items);
      else toast.error(json.error || "Failed to load");
    })();
  }, []);

  async function toggle(testId: string) {
    if (openId === testId) {
      setOpenId(null);
      return;
    }
    setOpenId(testId);
    setRowsLoading(true);
    const res = await fetch(`/api/alc/results?testId=${testId}`);
    const json = await res.json();
    setRowsLoading(false);
    if (res.ok) setRows(json.data.students);
    else toast.error(json.error || "Failed");
  }

  return (
    <div>
      <PageHeader title="Results & Analytics" subtitle="Performance across your tests" />

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No results yet — results appear once students complete your tests.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((s) => (
            <div key={s.testId} className="rounded-xl border bg-background overflow-hidden">
              <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggle(s.testId)}>
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {s.attempts} attempts · avg {s.avg}% · high {s.highest}% · low {s.lowest}%
                  </p>
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
                      {rows.map((r, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
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
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
