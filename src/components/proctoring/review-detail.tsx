"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Detail = {
  session: {
    student: string;
    email: string | null;
    profileImage: string | null;
    test: string;
    center: string | null;
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
  evidence: { category: string; url: string; capturedAt: string; reason: string | null }[];
};

const SEV_COLOR: Record<string, string> = {
  INFO: "bg-slate-400",
  LOW: "bg-slate-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-orange-600",
  CRITICAL: "bg-red-600",
};

const LABEL: Record<string, string> = {
  TAB_HIDDEN: "Switched tab / minimised",
  TAB_VISIBLE: "Returned to exam tab",
  WINDOW_BLUR: "Window lost focus",
  FULLSCREEN_EXIT: "Exited fullscreen",
  FULLSCREEN_ENTER: "Entered fullscreen",
  FULLSCREEN_TIMEOUT: "Did not return to fullscreen (terminated)",
  FACE_MISSING: "Face not visible",
  MULTIPLE_FACES: "Another person detected",
  PHONE_DETECTED: "Mobile phone detected",
  HEAD_POSE_AWAY: "Looking away from screen",
  IDENTITY_MISMATCH: "Face does not match verified photo",
  SCREENSHOT_ATTEMPT: "Screenshot attempt",
  SCREEN_SHARE_ATTEMPT: "Screen share attempt",
  COPY_ATTEMPT: "Copy attempt",
  PASTE_ATTEMPT: "Paste attempt",
  CUT_ATTEMPT: "Cut attempt",
  CONTEXT_MENU: "Right-click attempt",
  CONSENT_GIVEN: "Consent given",
};
const EVIDENCE_LABEL: Record<string, string> = {
  IDENTITY: "Pre-exam photo",
  SNAPSHOT: "Periodic snapshot",
  INCIDENT: "Violation snapshot",
};

export function ProctoringReviewDetail({ role, attemptId }: { role: "admin" | "alc"; attemptId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/${role}/proctoring/${attemptId}`);
      const json = await res.json();
      setLoading(false);
      if (res.ok) setData(json.data);
      else toast.error(json.error || "Failed to load");
    })();
  }, [role, attemptId]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data) return <p className="text-muted-foreground">Not found.</p>;
  const s = data.session;
  const violations = data.events.filter((e) => ["MEDIUM", "HIGH", "CRITICAL"].includes(e.severity));
  const incidents = data.evidence.filter((e) => e.category === "INCIDENT");
  const others = data.evidence.filter((e) => e.category !== "INCIDENT");

  return (
    <div className="max-w-4xl">
      <Link href={`/${role}/proctoring`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to review
      </Link>
      <PageHeader title={s.student} subtitle={`${s.test}${s.center ? ` · ${s.center}` : ""} · ${s.mode}`} />

      <div className="flex flex-wrap gap-4 mb-6">
        {s.profileImage && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Profile photo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.profileImage} alt="profile" className="h-32 w-32 rounded-lg object-cover border" />
          </div>
        )}
        {s.identityBaseline && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Captured at exam start</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.identityBaseline} alt="identity" className="h-32 w-32 rounded-lg object-cover border" />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 min-w-[16rem]">
          <Stat label="Status" value={s.status} />
          <Stat label="Warnings" value={`${s.warnings}/${s.maxWarnings}`} />
          <Stat label="Tab switches" value={s.counters?.tabSwitches ?? 0} />
          <Stat label="Fullscreen exits" value={s.counters?.fullscreenExits ?? 0} />
          <Stat label="Focus lost" value={s.counters?.visibilityHidden ?? 0} />
          <Stat label="Face missing" value={s.counters?.faceMissing ?? 0} />
          <Stat label="Phone / others" value={s.counters?.multipleFaces ?? 0} />
          <Stat label="Violations logged" value={violations.length} />
        </div>
      </div>
      {s.terminationReason && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-6">Terminated: {s.terminationReason}</div>
      )}

      <h2 className="font-semibold mb-2">Violation snapshots ({incidents.length})</h2>
      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No violation snapshots.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {incidents.map((e, i) => (
            <a key={i} href={e.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.url} alt="violation" className="aspect-video w-full object-cover rounded-md border border-red-300" />
              <p className="text-xs font-medium mt-0.5">{LABEL[e.reason ?? ""] ?? e.reason ?? "Violation"}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(e.capturedAt).toLocaleTimeString()}</p>
            </a>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2">Other captures ({others.length})</h2>
      {others.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No captures stored.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {others.map((e, i) => (
            <a key={i} href={e.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.url} alt={e.category} className="aspect-square w-full object-cover rounded-md border" />
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {EVIDENCE_LABEL[e.category] ?? e.category} · {new Date(e.capturedAt).toLocaleTimeString()}
              </p>
            </a>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2">Event timeline ({data.events.length})</h2>
      <div className="rounded-xl border bg-background divide-y text-sm max-h-[28rem] overflow-y-auto">
        {data.events.map((ev, i) => (
          <div key={i} className="p-2.5 flex items-center gap-2">
            <Badge className={`${SEV_COLOR[ev.severity] ?? "bg-slate-400"} font-mono text-[10px]`}>{ev.severity}</Badge>
            <span className="text-sm">{LABEL[ev.type] ?? ev.type}</span>
            <span className="ml-auto text-xs text-muted-foreground">{new Date(ev.at).toLocaleString()}</span>
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
