"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Send, Trash2, Loader2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type TestItem = {
  _id: string;
  name: string;
  targetClass: number;
  targetStream?: string | null;
  totalQuestions: number;
  duration: number;
  reviewStatus: string;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
};

const REVIEW_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-500",
  SUBMITTED: "bg-amber-500",
  APPROVED: "bg-emerald-600",
  REJECTED: "bg-red-600",
  CHANGES_REQUESTED: "bg-orange-500",
};

export default function TestsPage() {
  const [items, setItems] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/alc/tests");
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(id: string) {
    const res = await fetch(`/api/alc/tests/${id}/submit`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      toast.success("Published — live for students");
      load();
    } else {
      toast.error(json.error || "Publish failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this draft test?")) return;
    const res = await fetch(`/api/alc/tests/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      load();
    } else {
      const j = await res.json();
      toast.error(j.error || "Delete failed");
    }
  }

  const editable = (s: string) => ["DRAFT", "CHANGES_REQUESTED"].includes(s);
  const submittable = (s: string) => ["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(s);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Tests" subtitle="Create and publish examinations" />
        <Link href="/alc/tests/new">
          <Button>
            <Plus className="h-4 w-4" /> Create Test
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          No tests yet. Click “Create Test” to build your first examination.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div key={t._id} className="rounded-xl border bg-background p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{t.name}</h3>
                    <Badge className={REVIEW_BADGE[t.reviewStatus]}>{t.reviewStatus.replace("_", " ")}</Badge>
                    {t.status !== "UNPUBLISHED" && <Badge variant="outline">{t.status}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Class {t.targetClass}
                    {t.targetStream ? ` · ${t.targetStream}` : ""} · {t.totalQuestions} questions · {t.duration} min
                  </p>
                  {t.reviewStatus === "REJECTED" && t.rejectionReason && (
                    <p className="text-sm text-red-600 mt-1">Reason: {t.rejectionReason}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {t.reviewStatus === "APPROVED" && (
                    <Link href={`/alc/schedule?test=${t._id}`}>
                      <Button size="sm" variant="outline">
                        <CalendarClock className="h-4 w-4" /> Schedule
                      </Button>
                    </Link>
                  )}
                  {editable(t.reviewStatus) && (
                    <Link href={`/alc/tests/${t._id}`}>
                      <Button size="sm" variant="ghost">
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    </Link>
                  )}
                  {submittable(t.reviewStatus) && (
                    <Button size="sm" variant="ghost" onClick={() => submit(t._id)}>
                      <Send className="h-4 w-4" /> Publish
                    </Button>
                  )}
                  {editable(t.reviewStatus) && (
                    <Button size="sm" variant="ghost" onClick={() => remove(t._id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
