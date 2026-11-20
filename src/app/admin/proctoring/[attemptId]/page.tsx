"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Detail = {
  session: {
    student: string;
    email: string | null;
    test: string;
    mode: string;
    status: string;
    warnings: number;
    maxWarnings: number;
    counters: Record<string, number>;
    identityBaseline: string | null;
    terminationReason: string | null;
    startedAt: string | null;
    endedAt: string | null;
  };
  events: { type: string; severity: string; metadata: Record<string, unknown> | null; at: string }[];
  evidence: { category: string; url: string; capturedAt: string }[];
};

const SEV_COLOR: Record<string, string> = {
  INFO: "bg-slate-400",
  LOW: "bg-slate-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-orange-600",
  CRITICAL: "bg-red-600",
};

export default function ProctoringDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/proctoring/${attemptId}`);
      const json = await res.json();
      setLoading(false);
      if (res.ok) setData(json.data);
      else toast.error(json.error || "Failed to load");
    })();
  }, [attemptId]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data) return <p className="text-muted-foreground">Not found.</p>;

  const s = data.session;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/proctoring" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to review
      </Link>
      <PageHeader title={s.student} subtitle={`${s.test} · ${s.mode}`} />

      <div className="grid sm:grid-cols-[auto_1fr] gap-4 mb-6">
        {s.identityBaseline && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Identity</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.identityBaseline} alt="identity" className="h-32 w-32 rounded-lg object-cover border" />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Status" value={s.status} />
          <Stat label="Warnings" value={`${s.warnings}/${s.maxWarnings}`} />
          <Stat label="Tab switches" value={s.counters?.tabSwitches ?? 0} />
          <Stat label="Fullscreen exits" value={s.counters?.fullscreenExits ?? 0} />
          <Stat label="Focus lost" value={s.counters?.visibilityHidden ?? 0} />
          <Stat label="Face missing" value={s.counters?.faceMissing ?? 0} />
        </div>
      </div>
      {s.terminationReason && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-6">
          Terminated: {s.terminationReason}
        </div>
      )}

      <h2 className="font-semibold mb-2">Evidence ({data.evidence.length})</h2>
      {data.evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No evidence captured.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
          {data.evidence.map((e, i) => (
            <a key={i} href={e.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.url} alt={e.category} className="aspect-square w-full object-cover rounded-md border" />
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{e.category}</p>
            </a>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2">Event timeline ({data.events.length})</h2>
      <div className="rounded-xl border bg-background divide-y text-sm max-h-96 overflow-y-auto">
        {data.events.map((ev, i) => (
          <div key={i} className="p-2.5 flex items-center gap-2">
            <Badge className={`${SEV_COLOR[ev.severity] ?? "bg-slate-400"} font-mono text-[10px]`}>{ev.severity}</Badge>
            <span className="font-mono text-xs">{ev.type}</span>
            <span className="ml-auto text-xs text-muted-foreground">{new Date(ev.at).toLocaleTimeString()}</span>
          </div>
        ))}
        {data.events.length === 0 && <div className="p-4 text-muted-foreground">No events recorded.</div>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
