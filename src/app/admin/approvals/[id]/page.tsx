"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/stat-card";

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

export default function ReviewTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<{ test: any; availability: Record<string, number>; sample: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/tests/${id}`);
      const json = await res.json();
      setLoading(false);
      if (res.ok) setData(json.data);
      else toast.error(json.error || "Failed to load");
    })();
  }, [id]);

  async function decide(decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    if (decision !== "APPROVED" && !reason.trim()) {
      toast.error("A reason is required to reject or request changes");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/tests/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason: reason || null }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(json.error || "Action failed");
      return;
    }
    toast.success(`Test ${decision.toLowerCase().replace("_", " ")}`);
    router.push("/admin/approvals");
    router.refresh();
  }

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!data) return <p className="text-muted-foreground">Not found.</p>;

  const t = data.test;
  return (
    <div className="max-w-3xl">
      <PageHeader title={t.name} subtitle={`${t.center?.name ?? ""} · submitted for approval`} />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Info label="Target" value={`Class ${t.targetClass}${t.targetStream ? " · " + t.targetStream : ""}`} />
        <Info label="Questions / Duration" value={`${t.totalQuestions} / ${t.duration} min`} />
        <Info label="Passing" value={`${t.passingMarks} marks · ${t.passingPercentage}%`} />
        <Info label="Difficulty" value={t.difficulty} />
        <Info label="Negative marking" value={t.negativeMarking?.enabled ? `Yes (${t.negativeMarking.value})` : "No"} />
        <Info label="Proctoring" value={t.proctoring?.mode ?? "DISABLED"} />
      </div>

      {(t.instructions || t.rules) && (
        <div className="rounded-xl border bg-background p-4 mb-6 space-y-3">
          {t.instructions && <div><p className="text-sm font-medium">Instructions</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.instructions}</p></div>}
          {t.rules && <div><p className="text-sm font-medium">Rules</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.rules}</p></div>}
        </div>
      )}

      <div className="rounded-xl border bg-background p-4 mb-6">
        <p className="font-medium mb-3">Category distribution &amp; pool</p>
        <div className="space-y-2">
          {(t.distribution?.length ? t.distribution : []).map((r: any) => (
            <div key={r.category} className="flex items-center justify-between text-sm">
              <span>{CATEGORY_LABEL[r.category] ?? r.category}</span>
              <span className="text-muted-foreground">
                {r.min}–{r.max} required · {data.availability[r.category] ?? 0} available
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background p-4 mb-6">
        <p className="font-medium mb-3">Question sample ({data.sample.length})</p>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {data.sample.slice(0, 20).map((q: any) => (
            <div key={q._id} className="text-sm border-b pb-2">
              <p className="font-medium">{q.text}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {q.options.map((o: any) => (
                  <Badge key={o.key} variant={o.key === q.correctOption ? "default" : "outline"} className={o.key === q.correctOption ? "bg-emerald-600" : ""}>
                    {o.key}. {o.text}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <p className="font-medium mb-2">Decision</p>
        <Textarea
          placeholder="Reason (required for reject / request changes)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="mb-3"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decide("APPROVED")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
          <Button onClick={() => decide("CHANGES_REQUESTED")} disabled={busy} variant="outline">
            <RotateCcw className="h-4 w-4" /> Request changes
          </Button>
          <Button onClick={() => decide("REJECTED")} disabled={busy} variant="destructive">
            <XCircle className="h-4 w-4" /> Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
