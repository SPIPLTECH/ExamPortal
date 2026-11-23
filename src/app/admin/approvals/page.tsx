"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Item = {
  _id: string;
  name: string;
  targetClass: number;
  targetStream?: string | null;
  totalQuestions: number;
  duration: number;
  submittedAt?: string;
  center?: { name: string; code: string };
  createdBy?: { name: string };
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/approvals");
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
      <PageHeader title="Test Approvals" subtitle="Review tests submitted by centers" />
      {loading ? (
        <div className="p-10 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <FileCheck2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No tests are awaiting approval.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div key={t._id} className="rounded-xl border bg-background p-4 flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{t.name}</h3>
                  <Badge variant="secondary">{t.center?.name ?? "—"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Class {t.targetClass}
                  {t.targetStream ? ` · ${t.targetStream}` : ""} · {t.totalQuestions} questions · {t.duration} min
                  {t.createdBy ? ` · by ${t.createdBy.name}` : ""}
                </p>
              </div>
              <Link href={`/admin/approvals/${t._id}`}>
                <Button size="sm">Review</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
