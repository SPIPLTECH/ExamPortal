"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
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
import {
  DIFFICULTIES,
  PROCTORING_MODES,
  STREAMS,
  STUDENT_CLASSES,
} from "@/lib/constants";
import { computeAllocation } from "@/lib/distribution";

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

type Rule = { category: string; min: number; max: number };

export function TestComposer({ testId }: { testId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!testId);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<Record<string, number>>({});

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
  const [distribution, setDistribution] = useState<Rule[]>([]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  // Load existing test for editing.
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
      setDistribution(t.distribution?.length ? t.distribution : []);
      setAvailability(json.data.availability ?? {});
    })();
  }, [testId]);

  // When class/stream changes, fetch availability + default distribution.
  const loadPool = useCallback(async (cls: string, stream: string) => {
    if (!cls) return;
    const params = new URLSearchParams({ class: cls });
    if (Number(cls) >= 11 && stream) params.set("stream", stream);
    const res = await fetch(`/api/alc/pool?${params}`);
    const json = await res.json();
    if (res.ok) {
      setAvailability(json.data.availability ?? {});
      setDistribution((cur) => (cur.length ? cur : json.data.defaultRules));
    }
  }, []);

  function onClass(v: string) {
    set("targetClass", v);
    setDistribution([]); // reset to defaults for the new class
    loadPool(v, f.targetStream);
  }
  function onStream(v: string) {
    set("targetStream", v);
    loadPool(f.targetClass, v);
  }

  function setRule(i: number, key: "min" | "max", v: number) {
    setDistribution((d) => d.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  }

  // Live feasibility check (authoritative check also runs server-side on submit).
  const feasibility =
    distribution.length > 0
      ? computeAllocation(distribution, availability, f.totalQuestions)
      : null;

  async function save(submitAfter: boolean) {
    if (!f.name.trim()) return toast.error("Test name is required");
    if (!f.targetClass) return toast.error("Select a target class");
    if (Number(f.targetClass) >= 11 && !f.targetStream)
      return toast.error("Select a stream for class 11/12");

    setSaving(true);
    const body = {
      name: f.name,
      description: f.description || null,
      instructions: f.instructions || null,
      rules: f.rules || null,
      specialConditions: f.specialConditions || null,
      targetClass: Number(f.targetClass),
      targetStream: Number(f.targetClass) >= 11 ? f.targetStream : null,
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
      distribution,
    };

    const url = testId ? `/api/alc/tests/${testId}` : "/api/alc/tests";
    const res = await fetch(url, {
      method: testId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setSaving(false);
      toast.error(json.error || "Save failed");
      if (json.issues) toast.error(Object.values(json.issues)[0] as string);
      return;
    }
    const id = testId ?? json.data.id;

    if (submitAfter) {
      const sres = await fetch(`/api/alc/tests/${id}/submit`, { method: "POST" });
      const sjson = await sres.json();
      setSaving(false);
      if (!sres.ok) {
        toast.error(sjson.error || "Submit failed");
        router.push("/alc/tests");
        return;
      }
      toast.success("Test submitted for approval");
    } else {
      setSaving(false);
      toast.success(testId ? "Test updated" : "Draft saved");
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

  const showStream = Number(f.targetClass) >= 11;

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
        <div className="space-y-2">
          <Label>Special conditions</Label>
          <Textarea value={f.specialConditions} onChange={(e) => set("specialConditions", e.target.value)} rows={2} />
        </div>
      </Section>

      <Section title="Target & marking">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Class *</Label>
            <Select value={f.targetClass} onValueChange={onClass}>
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
              <Select value={f.targetStream} onValueChange={onStream}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {STREAMS.map((s) => (
                    <SelectItem key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <NumField label="Total questions" value={f.totalQuestions} onChange={(v) => set("totalQuestions", v)} />
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
            <Input
              type="number"
              className="w-28"
              value={f.negValue}
              onChange={(e) => set("negValue", Number(e.target.value))}
              placeholder="per wrong"
            />
          )}
        </div>
      </Section>

      <Section title="Question distribution">
        {distribution.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select a class to configure distribution.</p>
        ) : (
          <>
            <div className="space-y-2">
              {distribution.map((r, i) => (
                <div key={r.category} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{CATEGORY_LABEL[r.category] ?? r.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {availability[r.category] ?? 0} available
                    </p>
                  </div>
                  <LabeledNum label="min" value={r.min} onChange={(v) => setRule(i, "min", v)} />
                  <LabeledNum label="max" value={r.max} onChange={(v) => setRule(i, "max", v)} />
                  <div className="w-5" />
                </div>
              ))}
            </div>
            {feasibility && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${
                  feasibility.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}
              >
                {feasibility.ok ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                    This test can be generated — exactly {f.totalQuestions} questions fit the pool.
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    {feasibility.error}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Proctoring">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={f.proctMode} onValueChange={(v) => set("proctMode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROCTORING_MODES.map((m) => (
                  <SelectItem key={m} value={m}>{m[0] + m.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {f.proctMode !== "DISABLED" && (
            <NumField label="Max tab switches" value={f.maxTabSwitches} onChange={(v) => set("maxTabSwitches", v)} />
          )}
        </div>
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
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save draft
        </Button>
        <Button onClick={() => save(true)} disabled={saving || (feasibility ? !feasibility.ok : false)}>
          Save &amp; submit for approval
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <h2 className="font-semibold mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function LabeledNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        className="w-16 h-9"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
