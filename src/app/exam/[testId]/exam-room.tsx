"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Flag, Eraser, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { configureProctoring, sendConsent, type PolicyResult } from "@/lib/proctoring/service";
import { useWebcamCapture } from "@/hooks/useWebcamCapture";
import { useBrowserMonitoring } from "@/hooks/useBrowserMonitoring";
import { useObjectDetection } from "@/hooks/useObjectDetection";
import { WebcamPreview } from "@/components/proctoring/webcam-preview";
import { WarningBanner } from "@/components/proctoring/warning-banner";
import { PreExamCheck } from "@/components/proctoring/pre-exam-check";
import { FullscreenGate } from "@/components/proctoring/fullscreen-gate";
import { sendProctoringEvent } from "@/lib/proctoring/service";
import { releaseExamLock } from "@/lib/proctoring/examLock";
import { ExamTimer } from "@/components/exam-timer";
import { ShieldCheck, Smartphone, UserX, Users, Building2 } from "lucide-react";

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
  student?: { name: string; imageUrl: string | null };
  centerName?: string | null;
  questions: ClientQuestion[];
  responses: { question: string; selectedOption: string | null; status: RespStatus }[];
};

const STATUS_COLOR: Record<RespStatus, string> = {
  ATTEMPTED: "bg-emerald-600 text-white",
  UNATTEMPTED: "bg-slate-200 text-slate-700",
  MARKED: "bg-orange-500 text-white",
  ANSWERED_MARKED: "bg-purple-600 text-white",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ExamRoom({ testId }: { testId: string }) {
  const router = useRouter();
  const [state, setState] = useState<AttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const submittedRef = useRef(false);

  // ── Proctoring ─────────────────────────────────────────
  const proctoringEnabled = !!state && state.proctoringMode !== "DISABLED"; // camera proctoring
  // Fullscreen lock: works even when camera proctoring is OFF. Leaving fullscreen / switching
  // tabs costs a warning; after `max` warnings the exam is auto-submitted.
  const [lock, setLock] = useState<{ on: boolean; max: number }>({ on: false, max: 4 });
  const lockdown = !!state && (proctoringEnabled || lock.on);
  const [proctorReady, setProctorReady] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const endedRef = useRef(false);

  useEffect(() => {
    configureProctoring(testId);
  }, [testId]);

  const onProctorEnded = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setFinished(true);
    releaseExamLock();
    toast.error("Your exam was ended due to proctoring violations.");
    router.replace("/exam/done");
  }, [router]);

  // Server policy decisions from AI frames are routed into the monitor (set below).
  const policyHandlerRef = useRef<(p: PolicyResult) => void>(() => {});
  const webcam = useWebcamCapture({
    autoStartPeriodic: proctoringEnabled && proctorReady,
    periodicIntervalSeconds: 15,
    onAttemptEnded: onProctorEnded,
    aiEnabled,
    aiIntervalSeconds: 5,
    onPolicyResult: (p) => policyHandlerRef.current(p),
  });

  const captureRef = useRef(webcam.captureAndUpload);
  useEffect(() => {
    captureRef.current = webcam.captureAndUpload;
  }, [webcam.captureAndUpload]);

  const monitor = useBrowserMonitoring({
    isActive: lockdown && proctorReady,
    initialMaxWarnings: lock.max,
    onEnded: onProctorEnded,
    // Every warning stores a camera snapshot for the center and admin to review.
    onWarning: (eventType) => {
      if (proctoringEnabled) void captureRef.current("INCIDENT_SNAPSHOT", eventType);
    },
  });
  const applyPolicyResult = monitor.applyPolicyResult;
  useEffect(() => {
    policyHandlerRef.current = applyPolicyResult;
  }, [applyPolicyResult]);

  // In-browser detection is the fallback; when the AI service is on it does the job server-side
  // (running both would double-count the same incident).
  // Show the alert instantly (even before the server answers), then the server's
  // official warning replaces it.
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detection = useObjectDetection({
    videoRef: webcam.videoRef,
    active: proctoringEnabled && proctorReady && !aiEnabled,
    onViolation: (eventType, meta) => {
      const text: Record<string, string> = {
        PHONE_DETECTED: "A mobile phone was detected. Put it away immediately.",
        MULTIPLE_FACES: "Another person was detected near you. Only you may be present.",
        FACE_MISSING: "Your face is not visible. Stay in front of the camera.",
        HEAD_POSE_AWAY: "You are looking away from the screen. Face the camera.",
      };
      setLocalWarning(text[eventType] ?? "Proctoring violation detected.");
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      localTimerRef.current = setTimeout(() => setLocalWarning(null), 7000);
      monitor.reportExternal(eventType, "HIGH", meta);
    },
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
    if (lockdown && !proctorReady && !consentSentRef.current && (proctoringEnabled || lock.on)) {
      consentSentRef.current = true;
      sendConsent()
        .then((r) => {
          if (proctoringEnabled) setAiEnabled(!!r.aiEnabled);
          else setProctorReady(true); // fullscreen-only: no camera check, the lock is live now
        })
        .catch(() => {
          consentSentRef.current = false;
        });
    }
  }, [lockdown, proctoringEnabled, proctorReady, lock.on]);

  // Start / resume. A multi-language test first asks the student which language
  // to use; the question paper is only built (and frozen) after that choice.
  type Intro = {
    name: string; description: string | null; instructions: string | null; rules: string | null;
    specialConditions: string | null; languages: string[]; duration: number; totalQuestions: number;
    totalMarks: number; passingMarks: number; passingPercentage: number; negativeMarking: number;
    proctored: boolean; fullscreenLock: boolean; maxWarnings: number; hasAttempt: boolean;
  };
  const [langChoices, setLangChoices] = useState<Intro | null>(null);
  const [pickedLang, setPickedLang] = useState<string | null>(null);
  const [startingLang, setStartingLang] = useState<string | null>(null);

  const startExam = useCallback(
    async (language?: string) => {
      const res = await fetch(`/api/exam/${testId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(language ? { language } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not start exam");
        const alreadyAttempted = /already attempted|time is up/i.test(json.error ?? "");
        if (language) {
          setStartingLang(null); // stay on the picker so the student can retry
          if (!alreadyAttempted) return;
        }
        router.replace(alreadyAttempted ? "/exam/done" : "/");
        return;
      }
      const s: AttemptState = json.data;
      if (s.status !== "IN_PROGRESS") {
        router.replace(`/exam/done`);
        return;
      }
      setLangChoices(null);
      setState(s);
      const a: Record<string, string | null> = {};
      const m: Record<string, boolean> = {};
      s.responses.forEach((r) => {
        a[r.question] = r.selectedOption;
        m[r.question] = r.status === "MARKED" || r.status === "ANSWERED_MARKED";
      });
      setAnswers(a);
      setMarks(m);
      setLoading(false);
    },
    [testId, router]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/exam/${testId}/meta`);
        const json = await res.json();
        const meta = res.ok ? (json.data as Intro) : null;
        if (meta) setLock({ on: !!meta.fullscreenLock, max: meta.maxWarnings || 4 });
        // New attempt: always show the center's instructions & rules first.
        if (meta && !meta.hasAttempt) {
          setLangChoices(meta);
          if (meta.languages.length === 1) setPickedLang(meta.languages[0]!);
          setLoading(false);
          return;
        }
      } catch {
        /* fall through to a normal start */
      }
      await startExam();
    })();
  }, [testId, startExam]);

  // ── Answer saving: per-question, latest-wins, retried until it lands ──
  const latestRef = useRef(new Map<string, { selectedOption: string | null; markedForReview: boolean }>());
  const inflightRef = useRef(new Set<string>());

  const flushAnswer = useCallback(
    async (questionId: string) => {
      if (inflightRef.current.has(questionId)) return; // the running loop will pick up the newest value
      inflightRef.current.add(questionId);
      try {
        while (latestRef.current.has(questionId) && !endedRef.current) {
          const payload = latestRef.current.get(questionId)!;
          latestRef.current.delete(questionId);
          try {
            const res = await fetch(`/api/exam/${testId}/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questionId, ...payload }),
            });
            if (res.status === 409) {
              const j = await res.json().catch(() => ({}));
              toast.error(j.error || "Exam ended");
              endedRef.current = true;
              router.replace("/exam/done");
              return;
            }
            if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
            // other 4xx: nothing a retry can fix
          } catch {
            // Network blip / server hiccup: keep the value (unless a newer one arrived) and retry.
            if (!latestRef.current.has(questionId)) latestRef.current.set(questionId, payload);
            await sleep(2000);
          }
        }
      } finally {
        inflightRef.current.delete(questionId);
      }
    },
    [testId, router]
  );

  const saveAnswer = useCallback(
    (questionId: string, selectedOption: string | null, markedForReview: boolean) => {
      latestRef.current.set(questionId, { selectedOption, markedForReview });
      void flushAnswer(questionId);
    },
    [flushAnswer]
  );

  /** Wait (briefly) for queued saves so the last answers are not lost on submit. */
  const settleSaves = useCallback(async (maxMs: number) => {
    const t0 = Date.now();
    while ((latestRef.current.size > 0 || inflightRef.current.size > 0) && Date.now() - t0 < maxMs) {
      await sleep(100);
    }
  }, []);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      await settleSaves(auto ? 1500 : 4000);

      // A timed-out exam MUST end: keep retrying so a network blip can never leave the
      // student stuck on 00:00. A manual submit gives up after 3 tries so they can retry.
      const maxTries = auto ? 60 : 3;
      for (let attempt = 0; attempt < maxTries; attempt++) {
        try {
          const res = await fetch(`/api/exam/${testId}/submit`, { method: "POST" });
          const json = await res.json().catch(() => ({}));
          // 409 = "already submitted / time is up": the server has it, so we are done.
          if (res.ok || res.status === 409) {
            toast.success(auto ? "Time up — exam submitted" : "Exam submitted");
            endedRef.current = true; // stop proctoring side-effects (no fullscreen gate after submit)
            setFinished(true);
            releaseExamLock();
            router.replace(`/exam/done`);
            return;
          }
          if (res.status < 500 && res.status !== 429 && res.status !== 408) {
            toast.error(json.error || "Submit failed");
            break;
          }
        } catch {
          /* network error → retry */
        }
        await sleep(Math.min(5000, 1000 * (attempt + 1)));
      }
      setSubmitting(false);
      submittedRef.current = false;
      if (!auto) toast.error("Could not submit. Check your connection and try again.");
    },
    [testId, router, settleSaves]
  );

  const handleExpire = useCallback(() => {
    void doSubmit(true);
  }, [doSubmit]);

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

  if (langChoices && !state) {
    const m = langChoices;
    const label: Record<string, string> = { en: "English", mr: "मराठी (Marathi)" };
    const multi = m.languages.length > 1;
    const canStart = startingLang === null && (!multi || !!pickedLang);
    const Block = ({ title, text }: { title: string; text: string | null }) =>
      text ? (
        <section>
          <h2 className="font-semibold mb-1">{title}</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{text}</p>
        </section>
      ) : null;
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex justify-center">
        <div className="w-full max-w-2xl my-4 rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-semibold">{m.name}</h1>
            {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <Stat label="Time" value={`${m.duration} min`} />
            <Stat label="Questions" value={String(m.totalQuestions)} />
            <Stat label="Total marks" value={String(m.totalMarks)} />
            <Stat
              label="Passing"
              value={[m.passingMarks > 0 ? `${m.passingMarks} marks` : "", m.passingPercentage > 0 ? `${m.passingPercentage}%` : ""].filter(Boolean).join(" / ") || "—"}
            />
          </div>
          {m.negativeMarking > 0 && (
            <p className="text-sm rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
              Negative marking: −{m.negativeMarking} for each wrong answer.
            </p>
          )}

          <Block title="Instructions" text={m.instructions} />
          <Block title="Rules" text={m.rules} />
          <Block title="Special conditions" text={m.specialConditions} />
          {m.proctored && (
            <p className="text-sm text-slate-700">
              This is a proctored exam: your camera will be used, and you must stay in full-screen. Switching tabs or leaving the screen gives warnings.
            </p>
          )}
          {m.fullscreenLock && (
            <p className="text-sm rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2">
              <b>Full-screen exam:</b> the exam opens in full-screen and must stay in full-screen. Exiting full-screen or switching tabs/windows gives a warning.
              You have <b>{m.maxWarnings} chances</b>; when they are used up your exam is submitted automatically.
            </p>
          )}
          <p className="text-sm text-slate-700">The timer starts as soon as you press <b>Start exam</b> and cannot be paused. The exam can be attempted only once.</p>

          {multi && (
            <section>
              <h2 className="font-semibold mb-1">Choose your language / भाषा निवडा</h2>
              <p className="text-xs text-muted-foreground mb-2">You cannot change it once the exam starts. परीक्षा सुरू झाल्यावर भाषा बदलता येणार नाही.</p>
              <div className="flex flex-wrap gap-2">
                {m.languages.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setPickedLang(l)}
                    className={`flex-1 min-w-[8rem] rounded-lg border-2 py-2.5 text-sm font-medium transition-colors ${
                      pickedLang === l ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40"
                    }`}
                  >
                    {label[l] ?? l}
                  </button>
                ))}
              </div>
            </section>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={!canStart}
            onClick={() => {
              setStartingLang(pickedLang ?? "");
              // Must be called inside the click (browser needs a user gesture for full-screen).
              if (m.fullscreenLock || m.proctored) void monitor.requestFullscreen();
              void startExam(pickedLang ?? undefined);
            }}
          >
            {startingLang !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {multi && !pickedLang ? "Select a language to start" : "Start exam"}
          </Button>
        </div>
      </div>
    );
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
        onSelfie={async (blob) => {
          const fd = new FormData();
          fd.set("photo", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
          const res = await fetch(`/api/exam/${testId}/proctoring/selfie`, { method: "POST", body: fd });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error(json.error || "Could not save your photo");
            return false;
          }
          setState((st) => (st ? { ...st, student: { name: st.student?.name ?? "", imageUrl: json.data.url } } : st));
          // Baseline for identity checks / evidence (best-effort: needs evidence storage).
          void webcam.captureAndUpload("PRE_EXAM_IDENTITY");
          return true;
        }}
        onStart={async () => {
          await monitor.requestFullscreen();
          setProctorReady(true);
        }}
      />
    );
  }

  const fullscreenViolation = lockdown && proctorReady && !monitor.isFullscreen && !finished;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-20 bg-white border-b shadow-sm flex items-center px-4 gap-4 shrink-0">
        <ProfileBadge name={state.student?.name ?? ""} imageUrl={state.student?.imageUrl ?? null} />
        <div className="min-w-0">
          <p className="font-semibold truncate leading-tight">{state.testName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> {proctoringEnabled ? "Proctored exam" : lockdown ? "Full-screen exam" : "Exam in progress"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ExamTimer deadlineAt={state.deadlineAt} serverNow={state.serverNow} onExpire={handleExpire} />
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            Submit
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Question area */}
        <main className="flex-1 p-4 lg:p-8 pb-48">
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
              {idx < state.questions.length - 1 ? (
                <Button onClick={next} className="ml-auto">
                  Save &amp; Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    saveAnswer(q.question, answers[q.question] ?? null, !!marks[q.question]);
                    setConfirmOpen(true);
                  }}
                  className="ml-auto"
                >
                  <CheckCircle2 className="h-4 w-4" /> Submit Exam
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* Palette */}
        <aside className="w-full lg:w-72 bg-white border-t lg:border-t-0 lg:border-l p-4 pb-48 lg:pb-4 shrink-0">
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

      {/* Strict fullscreen: exam is hidden until the student returns, else it is terminated. */}
      {fullscreenViolation && (
        <FullscreenGate
          warnings={monitor.warnings}
          maxWarnings={monitor.maxWarnings}
          onReturn={monitor.requestFullscreen}
          onTimeout={() => {
            sendProctoringEvent({ eventType: "FULLSCREEN_TIMEOUT", severity: "CRITICAL" })
              .then((r) => {
                if (r.policyResult?.terminated) onProctorEnded();
              })
              .catch(() => onProctorEnded());
          }}
        />
      )}

      {/* Live proctoring overlays. */}
      {lockdown && proctorReady && (
        <>
          {(monitor.activeWarningMessage || localWarning) && (
            <WarningBanner
              message={monitor.activeWarningMessage ?? localWarning ?? ""}
              warningCount={monitor.warnings}
              maxWarnings={monitor.maxWarnings}
              onDismiss={() => {
                monitor.clearWarningMessage();
                setLocalWarning(null);
              }}
            />
          )}

          {/* Live camera + detection status — bottom-right (camera proctoring only). */}
          {proctoringEnabled && (
            <div className="fixed bottom-4 right-4 z-40 space-y-1">
              <WebcamPreview videoRef={webcam.videoRef} cameraStatus={webcam.cameraStatus} compact showStatusBanner={false} />
              <DetectionBadge status={detection.status} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function ProfileBadge({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "S";
  return (
    <div className="flex items-center gap-2.5 shrink-0 pr-3 border-r">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name || "Student"}
          className="h-14 w-14 rounded-full object-cover border-2 border-primary/40 shadow"
        />
      ) : (
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold">
          {initials}
        </div>
      )}
      {name && <span className="hidden sm:block text-sm font-semibold max-w-[10rem] truncate">{name}</span>}
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
    AWAY: { label: "Looking away — face the screen", cls: "bg-amber-500 text-white", Icon: UserX },
    ERROR: { label: "Detection unavailable — reload page", cls: "bg-amber-600 text-white", Icon: ShieldCheck },
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
