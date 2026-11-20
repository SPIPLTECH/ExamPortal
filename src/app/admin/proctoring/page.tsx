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
  mode: string;
  status: string;
  warnings: number;
  maxWarnings: number;
  isFlagged: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-blue-500",
  ENDED: "bg-slate-400",
  TERMINATED: "bg-red-600",
  PENDING: "bg-amber-500",
};

export default function ProctoringReviewPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/proctoring");
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Proctoring Review" subtitle="Monitored attempts, violations and evidence" />
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No proctored attempts yet.
        </div>
      ) : (
        <div className="rounded-xl border bg-background divide-y">
          {items.map((s) => (
            <div key={s.attemptId} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.student}</p>
                  <Badge className={STATUS_COLOR[s.status]}>{s.status}</Badge>
                  {s.isFlagged && <Badge variant="outline" className="text-amber-600">Flagged</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {s.test} · {s.mode} · {s.warnings}/{s.maxWarnings} warnings
                  {s.email ? ` · ${s.email}` : ""}
                </p>
              </div>
              <Link href={`/admin/proctoring/${s.attemptId}`}>
                <Button size="sm" variant="outline"><Eye className="h-4 w-4" /> Review</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
