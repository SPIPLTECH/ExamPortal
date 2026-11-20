"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Clock, Flag, Eraser, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { configureProctoring, sendConsent } from "@/lib/proctoring/service";
import { useWebcamCapture } from "@/hooks/useWebcamCapture";
import { useBrowserMonitoring } from "@/hooks/useBrowserMonitoring";
import { useObjectDetection } from "@/hooks/useObjectDetection";
import { WebcamPreview } from "@/components/proctoring/webcam-preview";
import { WarningBanner } from "@/components/proctoring/warning-banner";
import { PreExamCheck } from "@/components/proctoring/pre-exam-check";
import { ShieldCheck, UserCheck, Smartphone, UserX, Users } from "lucide-react";

type ClientQuestion = {
  question: string;
  order: number;
  category: string;
  text: string;
  imageUrl: string | null;
  options: { key: string; text: string }[];
};
type RespStatus = "UNATTEMPTED" | "ATTEMPTED" | "MARKED" | "ANSWERED_MARKED";
type AttemptState = {
  attemptId: string;
  testName: string;
  status: string;
  deadlineAt: string;
  serverNow: string;
  durationMinutes: number;
  proctoringMode: string;
  questions: ClientQuestion[];
  responses: { question: string; selectedOption: string | null; status: RespStatus }[];
};

const STATUS_COLOR: Record<RespStatus, string> = {
  ATTEMPTED: "bg-emerald-600 text-white",
  UNATTEMPTED: "bg-slate-200 text-slate-700",
  MARKED: "bg-orange-500 text-white",
  ANSWERED_MARKED: "bg-purple-600 text-white",
};

export function ExamRoom({ testId }: { testId: string }) {
  const router = useRouter();
  const [state, setState] = useState<AttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const endLocalRef = useRef<number>(0);
  const submittedRef = useRef(false);

  // ── Proctoring ─────────────────────────────────────────
  const proctoringEnabled = !!state && state.proctoringMode !== "DISABLED";
  const [proctorReady, setProctorReady] = useState(false);
  const [identityUrl, setIdentityUrl] = useState<string | null>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    configureProctoring(testId);
  }, [testId]);

  const onProctorEnded = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    toast.error("Your exam was ended due to proctoring violations.");
    router.replace("/student/history");
  }, [router]);

  const webcam = useWebcamCapture({
    autoStartPeriodic: proctoringEnabled && proctorReady,
    periodicIntervalSeconds: 15,
    onAttemptEnded: onProctorEnded,
  });

  const monitor = useBrowserMonitoring({
    isActive: proctoringEnabled && proctorReady,
    onEnded: onProctorEnded,
  });

  // Live camera object detection (phone / multiple people / no face).
  const detection = useObjectDetection({
    videoRef: webcam.videoRef,
    active: proctoringEnabled && proctorReady,
    onViolation: (eventType, meta) => monitor.reportExternal(eventType, "HIGH", meta),
  });

  // Re-bind the camera stream to the exam's <video> after the pre-check unmounts.
  const attachStream = webcam.attachStream;
  useEffect(() => {
    if (proctoringEnabled && proctorReady) {
      const t = setTimeout(() => attachStream(), 50);
      return () => clearTimeout(t);
    }
  }, [proctoringEnabled, proctorReady, attachStream]);

  // Open the monitoring session as soon as the proctored gate is shown, so the
  // identity snapshot (which needs a session) can be captured during the check.
  const consentSentRef = useRef(false);
  useEffect(() => {
    if (proctoringEnabled && !proctorReady && !consentSentRef.current) {
      consentSentRef.current = true;
      sendConsent().catch(() => {
        consentSentRef.current = false;
      });
    }
  }, [proctoringEnabled, proctorReady]);

  // Start / resume.
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/exam/${testId}/start`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not start exam");
        const alreadyAttempted = /already attempted|time is up/i.test(json.error ?? "");
        router.replace(alreadyAttempted ? "/student/history" : "/student/enrolled");
        return;
      }
      const s: AttemptState = json.data;
      if (s.status !== "IN_PROGRESS") {
        router.replace(`/student/history`);
        return;
      }
      setState(s);
      const a: Record<string, string | null> = {};
      const m: Record<string, boolean> = {};
      s.responses.forEach((r) => {
        a[r.question] = r.selectedOption;
        m[r.question] = r.status === "MARKED" || r.status === "ANSWERED_MARKED";
      });
      setAnswers(a);
      setMarks(m);
      // Clock-skew-aware deadline.
      const skew = Date.now() - new Date(s.serverNow).getTime();
      endLocalRef.current = new Date(s.deadlineAt).getTime() + skew;
      setRemaining(Math.max(0, Math.floor((endLocalRef.current - Date.now()) / 1000)));
      setLoading(false);
    })();
  }, [testId, router]);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      const res = await fetch(`/api/exam/${testId}/submit`, { method: "POST" });
      const json = await res.json();
      setSubmitting(false);
      if (!res.ok) {
        toast.error(json.error || "Submit failed");
        submittedRef.current = false;
        return;
      }
      toast.success(auto ? "Time up — exam submitted" : "Exam submitted");
      router.replace(`/student/history`);
    },
    [testId, router]
  );

  // Timer tick.
  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((endLocalRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        doSubmit(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [loading, doSubmit]);

  const saveAnswer = useCallback(
    async (questionId: string, selectedOption: string | null, markedForReview: boolean) => {
      try {
        const res = await fetch(`/api/exam/${testId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, selectedOption, markedForReview }),
        });
        if (res.status === 409) {
          const j = await res.json();
          toast.error(j.error || "Exam ended");
          router.replace("/student/history");
        }
      } catch {
        // Network blip — keep local state; will retry on next action.
        toast.error("Saving… check your connection");
      }
    },
    [testId, router]
  );

  const q = state?.questions[idx];

  const statusOf = useCallback(
    (qid: string): RespStatus => {
      const answered = !!answers[qid];
      const marked = !!marks[qid];
      if (answered && marked) return "ANSWERED_MARKED";
      if (marked) return "MARKED";
      if (answered) return "ATTEMPTED";
      return "UNATTEMPTED";
    },
    [answers, marks]
  );

  const counts = useMemo(() => {
    const c = { attempted: 0, unattempted: 0, marked: 0, answeredMarked: 0 };
    state?.questions.forEach((qq) => {
      const s = statusOf(qq.question);
      if (s === "ATTEMPTED") c.attempted++;
      else if (s === "UNATTEMPTED") c.unattempted++;
      else if (s === "MARKED") c.marked++;
      else c.answeredMarked++;
    });
    return c;
  }, [state, statusOf]);

  function select(opt: string) {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.question]: opt }));
    saveAnswer(q.question, opt, !!marks[q.question]);
  }
  function clearResponse() {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.question]: null }));
    saveAnswer(q.question, null, !!marks[q.question]);
  }
  function toggleMark() {
    if (!q) return;
    const nm = !marks[q.question];
    setMarks((m) => ({ ...m, [q.question]: nm }));
    saveAnswer(q.question, answers[q.question] ?? null, nm);
  }
  function next() {
    if (q) saveAnswer(q.question, answers[q.question] ?? null, !!marks[q.question]);
    setIdx((i) => Math.min((state?.questions.length ?? 1) - 1, i + 1));
  }

  if (loading || !state || !q) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Proctored exams: gate behind the readiness check (camera + identity + consent).
  if (proctoringEnabled && !proctorReady) {
    return (
      <PreExamCheck
        testName={state.testName}
        videoRef={webcam.videoRef}
        cameraStatus={webcam.cameraStatus}
        errorMessage={webcam.errorMessage}
        onRequestCamera={webcam.requestCamera}
        onCaptureIdentity={async () => {
          const r = await webcam.captureAndUpload("PRE_EXAM_IDENTITY");
          if (r?.url) setIdentityUrl(r.url);
          return !!r;
        }}
        onStart={async () => {
          await monitor.requestFullscreen();
          setProctorReady(true);
        }}
      />
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining <= 60;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-white border-b flex items-center px-4 gap-3 shrink-0">
        <span className="font-semibold truncate">{state.testName}</span>
        <div className="ml-auto flex items-center gap-4">
          <div
            className={`flex items-center gap-2 font-mono font-semibold px-3 py-1.5 rounded-lg ${
              low ? "bg-red-100 text-red-700 animate-pulse" : "bg-slate-100 text-slate-800"
            }`}
          >
            <Clock className="h-4 w-4" />
            {mm}:{ss}
          </div>
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            Submit
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Question area */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Question {idx + 1}</h2>
              <span className="text-xs uppercase tracking-wide text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                {q.category.replace("_", " ")}
              </span>
            </div>
            <p className="text-slate-800 mb-6 whitespace-pre-wrap">{q.text}</p>
            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="mb-6 max-h-60 rounded border" />
            )}
            <div className="space-y-3">
              {q.options.map((o) => {
                const checked = answers[q.question] === o.key;
                return (
                  <button
                    key={o.key}
                    onClick={() => select(o.key)}
                    className={`w-full text-left flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-7 w-7 shrink-0 rounded-full border flex items-center justify-center text-sm font-medium ${
                        checked ? "bg-primary text-primary-foreground border-primary" : "bg-white"
                      }`}
                    >
                      {o.key}
                    </span>
                    <span>{o.text}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 mt-8">
              <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button variant="outline" onClick={toggleMark}>
                <Flag className="h-4 w-4" /> {marks[q.question] ? "Unmark" : "Mark for Review"}
              </Button>
              <Button variant="outline" onClick={clearResponse}>
                <Eraser className="h-4 w-4" /> Clear
              </Button>
              <Button onClick={next} className="ml-auto">
                Save &amp; Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>

        {/* Palette */}
        <aside className="w-full lg:w-72 bg-white border-t lg:border-t-0 lg:border-l p-4 shrink-0">
          <p className="font-medium mb-3">Question Palette</p>
          <div className="grid grid-cols-6 lg:grid-cols-5 gap-2 mb-4">
            {state.questions.map((qq, i) => (
              <button
                key={qq.question}
                onClick={() => setIdx(i)}
                className={`h-9 w-9 rounded-md text-sm font-medium flex items-center justify-center ${
                  STATUS_COLOR[statusOf(qq.question)]
                } ${i === idx ? "ring-2 ring-offset-1 ring-primary" : ""}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 text-sm">
            <Legend color="bg-emerald-600" label={`Attempted (${counts.attempted})`} />
            <Legend color="bg-slate-200" label={`Unattempted (${counts.unattempted})`} dark />
            <Legend color="bg-orange-500" label={`Marked for Review (${counts.marked})`} />
            <Legend color="bg-purple-600" label={`Answered & Marked (${counts.answeredMarked})`} />
          </div>
        </aside>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit examination?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Summary label="Attempted" value={counts.attempted} />
            <Summary label="Unattempted" value={counts.unattempted} />
            <Summary label="Marked for Review" value={counts.marked} />
            <Summary label="Answered & Marked" value={counts.answeredMarked} />
          </div>
          <p className="text-sm text-muted-foreground">
            Once submitted you cannot change your answers.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button onClick={() => doSubmit(false)} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" /> Confirm submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live proctoring overlays. */}
      {proctoringEnabled && proctorReady && (
        <>
          {monitor.activeWarningMessage && (
            <WarningBanner
              message={monitor.activeWarningMessage}
              warningCount={monitor.warnings}
              maxWarnings={monitor.maxWarnings}
              onDismiss={monitor.clearWarningMessage}
            />
          )}

          {/* Captured identity photo — top-left. */}
          {identityUrl && (
            <div className="fixed top-16 left-4 z-40">
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={identityUrl} alt="Your verified identity" className="w-28 h-20 object-cover rounded-lg" />
                <div className="flex items-center gap-1 justify-center py-0.5 text-[10px] text-emerald-400">
                  <UserCheck className="h-3 w-3" /> Verified identity
                </div>
              </div>
            </div>
          )}

          {/* Live camera + detection status — bottom-right. */}
          <div className="fixed bottom-4 right-4 z-40 space-y-1">
            <WebcamPreview videoRef={webcam.videoRef} cameraStatus={webcam.cameraStatus} compact showStatusBanner={false} />
            <DetectionBadge status={detection.status} />
          </div>
        </>
      )}
    </div>
  );
}

function DetectionBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
    LOADING: { label: "Starting detection…", cls: "bg-slate-700 text-slate-200", Icon: ShieldCheck },
    OK: { label: "Monitoring — you are in view", cls: "bg-emerald-600 text-white", Icon: ShieldCheck },
    NO_FACE: { label: "No face detected — stay in view", cls: "bg-amber-500 text-white", Icon: UserX },
    MULTIPLE: { label: "Multiple people detected!", cls: "bg-red-600 text-white", Icon: Users },
    PHONE: { label: "Phone detected — put it away!", cls: "bg-red-600 text-white", Icon: Smartphone },
    IDLE: { label: "Camera monitored", cls: "bg-slate-700 text-slate-200", Icon: ShieldCheck },
  };
  const s = map[status] ?? map.IDLE;
  const Icon = s.Icon;
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium w-44 ${s.cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{s.label}</span>
    </div>
  );
}

function Legend({ color, label, dark }: { color: string; label: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-4 w-4 rounded ${color} ${dark ? "border" : ""}`} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
