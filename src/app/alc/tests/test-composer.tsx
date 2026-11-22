"use client";

import { ShieldCheck, ShieldQuestion, ShieldOff, CheckCircle2 } from "lucide-react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTIES, PROCTORING_MODES, STREAMS, STUDENT_CLASSES } from "@/lib/constants";
import { TestQuestionsManager } from "./test-questions-manager";

export function TestComposer({ testId }: { testId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!testId);
  const [saving, setSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string>("DRAFT");

  const [f, setF] = useState({
    name: "",
    description: "",
    instructions: "",
    rules: "",
    specialConditions: "",
    targetClass: "",
    targetStream: "",
    totalQuestions: 25,
    duration: 30,
    marksPerQuestion: 1,
    passingMarks: 0,
    passingPercentage: 40,
    difficulty: "MEDIUM",
    negEnabled: false,
    negValue: 0,
    proctMode: "DISABLED",
    requireMic: false,
    requireFullscreen: true,
    maxTabSwitches: 3,
  });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!testId) return;
    (async () => {
      const res = await fetch(`/api/alc/tests/${testId}`);
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        toast.error(json.error || "Failed to load test");
        return;
      }
      const t = json.data.test;
      setReviewStatus(t.reviewStatus);
      setF({
        name: t.name,
        description: t.description ?? "",
        instructions: t.instructions ?? "",
        rules: t.rules ?? "",
        specialConditions: t.specialConditions ?? "",
        targetClass: String(t.targetClass),
        targetStream: t.targetStream ?? "",
        totalQuestions: t.totalQuestions,
        duration: t.duration,
        marksPerQuestion: t.marksPerQuestion,
        passingMarks: t.passingMarks,
        passingPercentage: t.passingPercentage,
        difficulty: t.difficulty,
        negEnabled: t.negativeMarking?.enabled ?? false,
        negValue: t.negativeMarking?.value ?? 0,
        proctMode: t.proctoring?.mode ?? "DISABLED",
        requireMic: t.proctoring?.requireMic ?? false,
        requireFullscreen: t.proctoring?.requireFullscreen ?? true,
        maxTabSwitches: t.proctoring?.maxTabSwitches ?? 3,
      });
    })();
  }, [testId]);

  const showStream = Number(f.targetClass) >= 11;

  function buildBody() {
    return {
      name: f.name,
      description: f.description || null,
      instructions: f.instructions || null,
      rules: f.rules || null,
      specialConditions: f.specialConditions || null,
      targetClass: Number(f.targetClass),
      targetStream: showStream ? f.targetStream : null,
      totalQuestions: Number(f.totalQuestions),
      duration: Number(f.duration),
      marksPerQuestion: Number(f.marksPerQuestion),
      passingMarks: Number(f.passingMarks),
      passingPercentage: Number(f.passingPercentage),
      difficulty: f.difficulty,
      negativeMarking: { enabled: f.negEnabled, value: Number(f.negValue) },
      proctoring: {
        mode: f.proctMode,
        requireMic: f.requireMic,
        requireFullscreen: f.requireFullscreen,
        maxTabSwitches: Number(f.maxTabSwitches),
      },
      distribution: [],
    };
  }

  function validate() {
    if (!f.name.trim()) return toast.error("Test name is required"), false;
    if (!f.targetClass) return toast.error("Select a target class"), false;
    if (showStream && !f.targetStream) return toast.error("Select a stream for class 11/12"), false;
    return true;
  }

  async function saveTest(): Promise<string | null> {
    const url = testId ? `/api/alc/tests/${testId}` : "/api/alc/tests";
    const res = await fetch(url, {
      method: testId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody()),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Save failed");
      if (json.issues) toast.error(Object.values(json.issues)[0] as string);
      return null;
    }
    return testId ?? json.data.id;
  }

  // New test → create draft, then go to the edit page to add questions.
  async function createAndContinue() {
    if (!validate()) return;
    setSaving(true);
    const id = await saveTest();
    setSaving(false);
    if (!id) return;
    toast.success("Draft saved — now add questions");
    router.push(`/alc/tests/${id}`);
    router.refresh();
  }

  async function save(submitAfter: boolean) {
    if (!validate()) return;
    setSaving(true);
    const id = await saveTest();
    if (!id) {
      setSaving(false);
      return;
    }
    if (submitAfter) {
      const sres = await fetch(`/api/alc/tests/${id}/submit`, { method: "POST" });
      const sjson = await sres.json();
      setSaving(false);
      if (!sres.ok) {
        toast.error(sjson.error || "Submit failed");
        return;
      }
      toast.success("Test published — students can now take it with your exam code");
    } else {
      setSaving(false);
      toast.success("Test saved");
    }
    router.push("/alc/tests");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="p-10 flex justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Section title="Basic details">
        <div className="space-y-2">
          <Label>Test name *</Label>
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Rules</Label>
            <Textarea value={f.rules} onChange={(e) => set("rules", e.target.value)} rows={3} />
          </div>
        </div>
      </Section>

      <Section title="Target & marking">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Class *</Label>
            <Select value={f.targetClass} onValueChange={(v) => set("targetClass", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {STUDENT_CLASSES.map((c) => (
                  <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showStream && (
            <div className="space-y-2">
              <Label>Stream *</Label>
              <Select value={f.targetStream} onValueChange={(v) => set("targetStream", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {STREAMS.map((s) => (
                    <SelectItem key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Questions per student</Label>
            <Input type="number" min={1} value={f.totalQuestions} onChange={(e) => set("totalQuestions", Number(e.target.value))} />
            <p className="text-[11px] text-muted-foreground">Random per student from the pool</p>
          </div>
          <NumField label="Duration (min)" value={f.duration} onChange={(v) => set("duration", v)} />
          <NumField label="Marks / question" value={f.marksPerQuestion} onChange={(v) => set("marksPerQuestion", v)} />
          <NumField label="Passing marks" value={f.passingMarks} onChange={(v) => set("passingMarks", v)} />
          <NumField label="Passing %" value={f.passingPercentage} onChange={(v) => set("passingPercentage", v)} />
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={f.difficulty} onValueChange={(v) => set("difficulty", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Switch checked={f.negEnabled} onCheckedChange={(v) => set("negEnabled", v)} />
          <Label>Negative marking</Label>
          {f.negEnabled && (
            <Input type="number" className="w-28" value={f.negValue} onChange={(e) => set("negValue", Number(e.target.value))} placeholder="per wrong" />
          )}
        </div>
      </Section>

      {/* Questions manager — only once the test exists (so questions can attach to it). */}
      {testId ? (
        <TestQuestionsManager
          testId={testId}
          targetClass={Number(f.targetClass)}
          targetStream={showStream ? f.targetStream : null}
          perStudent={Number(f.totalQuestions)}
        />
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
          Save the test first, then you can add questions manually, import from Excel, or pick from your bank.
        </div>
      )}

      <Section title="Proctoring">
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            { v: "MANDATORY", title: "Mandatory", desc: "Every student is proctored: live face selfie, camera, fullscreen and violation tracking.", icon: ShieldCheck, tone: "emerald" },
            { v: "OPTIONAL", title: "Optional", desc: "Student chooses at entry whether to take the exam with or without proctoring.", icon: ShieldQuestion, tone: "amber" },
            { v: "DISABLED", title: "No proctoring", desc: "Plain exam. No camera, no selfie, no monitoring.", icon: ShieldOff, tone: "slate" },
          ] as const).map((m) => {
            const active = f.proctMode === m.v;
            return (
              <button
                type="button"
                key={m.v}
                onClick={() => set("proctMode", m.v)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <m.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} /> {m.title}
                  {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{m.desc}</p>
              </button>
            );
          })}
        </div>
        {f.proctMode !== "DISABLED" && (
          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            <NumField label="Max warnings / tab switches" value={f.maxTabSwitches} onChange={(v) => set("maxTabSwitches", v)} />
          </div>
        )}
        {f.proctMode !== "DISABLED" && (
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.requireFullscreen} onCheckedChange={(v) => set("requireFullscreen", v)} /> Require fullscreen
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.requireMic} onCheckedChange={(v) => set("requireMic", v)} /> Require microphone
            </label>
          </div>
        )}
      </Section>

      <div className="flex justify-end gap-2">
        {!testId ? (
          <Button onClick={createAndContinue} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save &amp; add questions
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            {reviewStatus !== "SUBMITTED" && reviewStatus !== "APPROVED" && (
              <Button onClick={() => save(true)} disabled={saving}>
                Save &amp; publish
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
