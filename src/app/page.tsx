"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  GraduationCap, Loader2, KeyRound, UserRound, Phone, Mail, School, BookOpen, Layers, ShieldCheck, ShieldOff,
  ArrowRight, BadgeCheck, Upload, Headphones, RefreshCw, Pencil, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/terms-dialog";
import { STREAMS, STUDENT_CLASSES } from "@/lib/constants";

type VType = "MOBILE" | "EMAIL";
type Verified = { type: VType; value: string; proof: string; already: boolean };

/** Shrink a photo to ≤640px JPEG before upload. */
async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export default function StudentEntryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [choiceFor, setChoiceFor] = useState<string | null>(null);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [form, setForm] = useState({
    examCode: "", name: "", class: "", stream: "", schoolName: "",
    mscit: "" as "" | "yes" | "no", mscitPct: "", mscitInterested: "" as "" | "yes" | "no",
    acceptTerms: false,
  });
  const cls = Number(form.class);
  const showStream = cls >= 11;
  const showMscit = cls >= 8;
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  async function submit(choice?: "MANDATORY" | "DISABLED") {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("examCode", form.examCode);
      fd.set("name", form.name);
      fd.set("class", form.class);
      if (showStream) fd.set("stream", form.stream);
      fd.set(verified!.type === "MOBILE" ? "mobile" : "email", verified!.value);
      fd.set("verifiedType", verified!.type);
      fd.set("verifyProof", verified!.proof);
      fd.set("schoolName", form.schoolName);
      fd.set("acceptTerms", String(form.acceptTerms));
      if (showMscit) {
        fd.set("mscitCompleted", form.mscit);
        if (form.mscit === "yes") fd.set("mscitPercentage", form.mscitPct);
        if (form.mscit === "no") fd.set("mscitInterested", form.mscitInterested || "no");
      }
      if (photo) fd.set("photo", await shrink(photo));
      if (choice) fd.set("proctoringChoice", choice);

      const res = await fetch("/api/public/enter", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        const first = json.issues ? (Object.values(json.issues)[0] as string) : null;
        toast.error(first || json.error || "Could not start the exam");
        setLoading(false);
        return;
      }
      if (json.data.needsChoice) {
        setChoiceFor(json.data.testName);
        setLoading(false);
        return;
      }
      const { userId, token, testId } = json.data as { userId: string; token: string; testId: string };
      const r = await signIn("exam-entry", { userId, token, redirect: false });
      if (r?.error) {
        toast.error("Could not start your session. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/exam/${testId}`);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!verified) return toast.error("Verify your email or mobile number first");
    if (!form.class) return toast.error("Please select your class");
    if (showMscit && !form.mscit) return toast.error("Please tell us if you have completed MS-CIT");
    if (!photo) return toast.error("Please upload your photo");
    if (!form.acceptTerms) return toast.error("Please accept the Terms and Conditions");
    void submit();
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-center gap-2 font-semibold text-lg mb-5">
          <GraduationCap className="h-6 w-6 text-primary" /> Exam Portal
        </div>

        {choiceFor ? (
          <div className="bg-background border rounded-2xl shadow-sm p-6">
            <h1 className="text-xl font-bold">Choose how to take the exam</h1>
            <p className="text-sm text-muted-foreground mt-1 mb-5">“{choiceFor}” allows both options.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button disabled={loading} onClick={() => submit("MANDATORY")} className="text-left rounded-xl border-2 p-4 hover:border-primary hover:bg-primary/5 disabled:opacity-60">
                <ShieldCheck className="h-6 w-6 text-emerald-600 mb-2" />
                <p className="font-semibold">With proctoring</p>
                <p className="text-xs text-muted-foreground mt-1">Camera, face selfie and fullscreen monitoring.</p>
              </button>
              <button disabled={loading} onClick={() => submit("DISABLED")} className="text-left rounded-xl border-2 p-4 hover:border-primary hover:bg-primary/5 disabled:opacity-60">
                <ShieldOff className="h-6 w-6 text-slate-500 mb-2" />
                <p className="font-semibold">Without proctoring</p>
                <p className="text-xs text-muted-foreground mt-1">No camera. Just the questions.</p>
              </button>
            </div>
            <Button variant="ghost" className="mt-3" onClick={() => setChoiceFor(null)} disabled={loading}>Back</Button>
            {loading && <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Starting…</p>}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Card title="Exam code" icon={KeyRound}>
              <IconInput icon={KeyRound} value={form.examCode} onChange={(v) => set("examCode", v.toUpperCase())} placeholder="Enter the code from your ALC center" mono required />
            </Card>

            <VerifyContact verified={verified} onVerified={setVerified} />

            <Card title="Student details" icon={UserRound}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name" required>
                  <IconInput icon={UserRound} value={form.name} onChange={(v) => set("name", v)} required />
                </Field>
                <Field label="Class" required>
                  <Select value={form.class} onValueChange={(v) => set("class", v)}>
                    <SelectTrigger className="w-full"><BookOpen className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{STUDENT_CLASSES.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                {showStream && (
                  <Field label="Stream" required>
                    <Select value={form.stream} onValueChange={(v) => set("stream", v)}>
                      <SelectTrigger className="w-full"><Layers className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select stream" /></SelectTrigger>
                      <SelectContent>{STREAMS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                )}
                <div className={showStream ? "" : "sm:col-span-2"}>
                  <Field label="School name" required>
                    <IconInput icon={School} value={form.schoolName} onChange={(v) => set("schoolName", v)} required />
                  </Field>
                </div>
              </div>
            </Card>

            {showMscit && (
              <Card title="MS-CIT" icon={Headphones}>
                <Field label="Have you completed MS-CIT?" required>
                  <YesNo value={form.mscit} onChange={(v) => set("mscit", v)} />
                </Field>
                {form.mscit === "yes" && (
                  <div className="mt-4 max-w-[12rem]">
                    <Field label="MS-CIT percentage (%)" required>
                      <Input type="number" min={0} max={100} step="0.01" value={form.mscitPct} onChange={(e) => set("mscitPct", e.target.value)} required />
                    </Field>
                  </div>
                )}
                {form.mscit === "no" && (
                  <div className="mt-4">
                    <Field label="Are you interested in MS-CIT? Our course advisor will call you.">
                      <YesNo value={form.mscitInterested} onChange={(v) => set("mscitInterested", v)} />
                    </Field>
                  </div>
                )}
              </Card>
            )}

            <Card title="Your photo" icon={Camera}>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center border shrink-0">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="Your photo" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <Label htmlFor="photo">Upload a clear photo of yourself <span className="text-destructive">*</span></Label>
                  <Input id="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground mt-1">Shared with your ALC center and the admin.</p>
                </div>
              </div>
            </Card>

            <label className="flex items-start gap-2 text-sm px-1">
              <Checkbox checked={form.acceptTerms} onCheckedChange={(v) => set("acceptTerms", Boolean(v))} className="mt-0.5" />
              <span>I accept the <TermsDialog />.</span>
            </label>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Register &amp; Start Exam
            </Button>
          </form>
        )}
      
      </div>
    </div>
  );
}

/** Verify ONE of email / mobile. Once one is verified the other is not asked for. */
function VerifyContact({ verified, onVerified }: { verified: Verified | null; onVerified: (v: Verified | null) => void }) {
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [active, setActive] = useState<VType | null>(null); // which channel has an OTP pending
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"send" | "confirm" | null>(null);
  const [cool, setCool] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  function startCooldown(sec: number) {
    setCool(sec);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setCool((c) => (c <= 1 ? (clearInterval(timer.current!), 0) : c - 1)), 1000);
  }

  async function send(type: VType) {
    const contact = type === "MOBILE" ? mobile : email;
    setBusy("send");
    try {
      const res = await fetch("/api/public/verify/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, contact }) });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not send the code");
        if (json.retryAfter) startCooldown(json.retryAfter);
        return;
      }
      if (json.data.alreadyVerified) {
        onVerified({ type, value: contact.trim(), proof: json.data.proof, already: true });
        setActive(null);
        return;
      }
      setActive(type);
      setOtp("");
      startCooldown(45);
      toast.success(type === "MOBILE" ? "Code sent by SMS" : "Code sent to your email");
      if (json.data.devMode) toast.info("Dev mode: the code is printed in the server console");
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!active) return;
    const contact = active === "MOBILE" ? mobile : email;
    setBusy("confirm");
    try {
      const res = await fetch("/api/public/verify/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: active, contact, code: otp }) });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Verification failed");
      onVerified({ type: active, value: contact.trim(), proof: json.data.proof, already: !!json.data.alreadyVerified });
      setActive(null);
    } finally {
      setBusy(null);
    }
  }

  if (verified) {
    const Icon = verified.type === "MOBILE" ? Phone : Mail;
    return (
      <Card title="Verify your contact" icon={BadgeCheck}>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">
          <BadgeCheck className="h-6 w-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium flex items-center gap-1.5"><Icon className="h-4 w-4" /> <span className="truncate">{verified.value}</span></p>
            <p className="text-sm">{verified.already ? "Already verified" : "Verified"} — no need to verify the other one.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { onVerified(null); setOtp(""); }}>
            <Pencil className="h-4 w-4" /> Change
          </Button>
        </div>
      </Card>
    );
  }

  const otpBox = (type: VType) =>
    active === type && (
      <div className="mt-3 space-y-2">
        <Label>Enter the 6-digit code</Label>
        <div className="flex gap-2">
          <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="font-mono tracking-[0.4em] text-center" />
          <Button type="button" onClick={confirm} disabled={otp.length !== 6 || busy === "confirm"}>
            {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Verify
          </Button>
        </div>
        <button type="button" disabled={cool > 0 || busy === "send"} onClick={() => send(type)} className="text-xs text-primary disabled:text-muted-foreground inline-flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> {cool > 0 ? `Resend code in ${cool}s` : "Resend code"}
        </button>
      </div>
    );

  return (
    <Card title="Verify your contact" icon={BadgeCheck}>
      <p className="text-sm text-muted-foreground mb-4">Verify your email address <b>or</b> mobile number to continue. You only need to verify one.</p>

      <Field label="Email Address">
        <IconInput icon={Mail} type="email" value={email} onChange={(v) => { setEmail(v); if (active === "EMAIL") setActive(null); }} placeholder="Enter email address" />
      </Field>
      <Button type="button" className="w-full mt-2" onClick={() => send("EMAIL")} disabled={busy === "send" || !email.includes("@") || (active === "EMAIL" && cool > 0)}>
        {busy === "send" && active === "EMAIL" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Verify Email Address
      </Button>
      {otpBox("EMAIL")}

      <div className="flex items-center gap-3 my-4 text-xs font-medium text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
      </div>

      <Field label="Mobile Number">
        <IconInput icon={Phone} type="tel" value={mobile} onChange={(v) => { setMobile(v); if (active === "MOBILE") setActive(null); }} placeholder="Enter 10-digit mobile number" />
      </Field>
      <Button type="button" variant="outline" className="w-full mt-2" onClick={() => send("MOBILE")} disabled={busy === "send" || mobile.replace(/\D/g, "").length < 10 || (active === "MOBILE" && cool > 0)}>
        {busy === "send" && active !== "EMAIL" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Verify Mobile Number
      </Button>
      {otpBox("MOBILE")}

      <p className="text-xs text-muted-foreground text-center mt-4">At least one contact method must be verified.</p>
    </Card>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof KeyRound; children: React.ReactNode }) {
  return (
    <section className="bg-background border rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-3"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
      {children}
    </section>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: "yes" | "no") => void }) {
  return (
    <div className="flex gap-2">
      {(["yes", "no"] as const).map((v) => (
        <button type="button" key={v} onClick={() => onChange(v)} className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium capitalize transition-colors ${value === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40"}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function IconInput({ icon: Icon, value, onChange, placeholder, type = "text", required, mono }: {
  icon: typeof KeyRound; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; mono?: boolean;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} autoComplete="off" className={`pl-9 ${mono ? "font-mono tracking-widest uppercase" : ""}`} />
    </div>
  );
}