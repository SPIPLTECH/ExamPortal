"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Row = {
  attemptId: string;
  student: string;
  email: string | null;
  test: string;
  center: string | null;
  mode: string;
  status: string;
  warnings: number;
  maxWarnings: number;
  isFlagged: boolean;
  counters?: Record<string, number>;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-blue-500",
  ENDED: "bg-slate-400",
  TERMINATED: "bg-red-600",
  PENDING: "bg-amber-500",
};

/** Shared list for admin (/admin/proctoring) and ALC center (/alc/proctoring). */
export function ProctoringReviewList({ role }: { role: "admin" | "alc" }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "FLAGGED" | "TERMINATED">("ALL");

  const load = useCallback(async () => {
    const res = await fetch(`/api/${role}/proctoring`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, [role]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/${role}/proctoring`)
      .then(async (res) => ({ ok: res.ok, json: await res.json() }))
      .then(({ ok, json }) => {
        if (!alive) return;
        setLoading(false);
        if (ok) setItems(json.data.items);
        else toast.error(json.error || "Failed to load");
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [role]);

  const shown = items.filter((s) =>
    filter === "ALL" ? true : filter === "FLAGGED" ? s.isFlagged || s.warnings > 0 : s.status === "TERMINATED"
  );

  return (
    <div>
      <PageHeader
        title="Proctoring Review"
        subtitle={role === "alc" ? "Violations and evidence for your center's students" : "Violations and evidence across all centers"}
      />
      <div className="flex gap-2 mb-4">
        {(["ALL", "FLAGGED", "TERMINATED"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "ALL" ? "All" : f === "FLAGGED" ? "With warnings" : "Terminated"}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => { setLoading(true); load(); }}>Refresh</Button>
      </div>
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No proctored attempts found.
        </div>
      ) : (
        <div className="rounded-xl border bg-background divide-y">
          {shown.map((s) => (
            <div key={s.attemptId} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.student}</p>
                  <Badge className={STATUS_COLOR[s.status]}>{s.status}</Badge>
                  {s.isFlagged && <Badge variant="outline" className="text-amber-600">Flagged</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.test}
                  {role === "admin" && s.center ? ` · ${s.center}` : ""} · {s.warnings}/{s.maxWarnings} warnings
                  {s.counters ? ` · tab ${s.counters.tabSwitches ?? 0} · fullscreen ${s.counters.fullscreenExits ?? 0} · face ${s.counters.faceMissing ?? 0}` : ""}
                </p>
              </div>
              <Link href={`/${role}/proctoring/${s.attemptId}`}>
                <Button size="sm" variant="outline"><Eye className="h-4 w-4" /> Review</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
