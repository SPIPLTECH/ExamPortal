"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Loader2, UserRound, Phone, Mail, School, BookOpen, Layers,
  ArrowRight, ArrowLeft, Upload, Headphones, Camera, Lock, CheckCircle2, Contact,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/terms-dialog";
import { STREAMS, STUDENT_CLASSES } from "@/lib/constants";

type SchoolOpt = { id: string; name: string };
type Registered = { userId: string; token: string; username: string; className: string; emailed: boolean; testId: string | null };

/** Shrink a photo to ≤640px JPEG before upload (falls back to the original if the browser can't). */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob: Blob | null = await new Promise((r) => c.toBlob((b) => r(b), "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function cleanMobile(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export default function StudentRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [laterDone, setLaterDone] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", class: "", stream: "", schoolId: "",
    username: "", password: "", confirmPassword: "",
    mscit: "" as "" | "yes" | "no", mscitPct: "", mscitInterested: "" as "" | "yes" | "no",
    acceptTerms: false,
  });
  const cls = Number(form.class);
  const showStream = cls >= 11;
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  useEffect(() => {
    fetch("/api/public/schools")
      .then((r) => r.json())
      .then((j) => setSchools(j.data?.items ?? []))
      .catch(() => {})
      .finally(() => setSchoolsLoading(false));
  }, []);

  async function register() {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("name", form.name.trim());
      fd.set("class", form.class);
      if (showStream) fd.set("stream", form.stream);
      fd.set("email", form.email.trim());
      fd.set("mobile", form.mobile.trim());
      fd.set("schoolId", form.schoolId);
      fd.set("username", form.username.trim());
      fd.set("password", form.password);
      fd.set("confirmPassword", form.confirmPassword);
      fd.set("acceptTerms", String(form.acceptTerms));
      fd.set("mscitCompleted", form.mscit);
      if (form.mscit === "yes" && form.mscitPct !== "") fd.set("mscitPercentage", form.mscitPct);
      if (form.mscit === "no") fd.set("mscitInterested", form.mscitInterested || "no");
      if (photo) fd.set("photo", await shrink(photo));

      const res = await fetch("/api/public/register", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const first = json.issues ? (Object.values(json.issues)[0] as string) : null;
        toast.error(first || json.error || "Could not register");
        return;
      }
      setRegistered(json.data as Registered);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startNow() {
    if (!registered || loading) return;
    setLoading(true);
    try {
      // 1) One-time token from registration (instant, no password check).
      let r = await signIn("exam-entry", { userId: registered.userId, token: registered.token, redirect: false });
      // 2) Fallback (e.g. the token expired while the student waited): username + password.
      if (r?.error || !r?.ok) {
        r = await signIn("credentials", { identifier: registered.username, password: form.password, redirect: false });
      }
      if (r?.error || !r?.ok) {
        toast.error("Could not start your session. Please log in with your username and password.");
        setLoading(false);
        return;
      }
      if (!registered.testId) toast.info("No exam is open for your class right now. You can start it from your dashboard when it opens.");
      // Full page navigation: guarantees the new session cookie is sent (a client-side
      // router.push can be served from the router cache before the session exists).
      window.location.assign(registered.testId ? `/exam/${registered.testId}` : "/student");
    } catch {
      toast.error("Network error. Please try again.");
      setLoading(false);
    }
  }

  const [step, setStep] = useState(1);

  /** Returns an error message for the step, or null when it is fine. */
  function checkStep(n: number): string | null {
    const email = form.email.trim();
    const mobile = cleanMobile(form.mobile);
    if (n === 1) {
      if (!form.name.trim()) return "Please enter your full name";
      if (!form.schoolId) return "Please select your school";
      if (!form.class) return "Please select your class";
      if (showStream && !form.stream) return "Please select your stream";
    }
    if (n === 2) {
      if (!email && !form.mobile.trim()) return "Enter your email address or mobile number";
      if (email && !EMAIL_RE.test(email)) return "Enter a valid email address";
      if (form.mobile.trim() && !/^[6-9]\d{9}$/.test(mobile)) return "Enter a valid 10-digit mobile number";
      if (!form.mscit) return "Please tell us if you have completed MS-CIT";
    }
    if (n === 3) {
      if (form.username.trim().length < 3) return "Choose a username (at least 3 characters)";
      if (form.password.length < 8) return "Password must be at least 8 characters";
      if (form.password !== form.confirmPassword) return "Passwords don't match";
      if (!form.acceptTerms) return "Please accept the Terms and Conditions";
    }
    return null;
  }

  function goNext() {
    const err = checkStep(step);
    if (err) return toast.error(err);
    setStep((x) => Math.min(3, x + 1));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (step < 3) return goNext();
    for (const n of [1, 2, 3]) {
      const err = checkStep(n);
      if (err) { setStep(n); return toast.error(err); }
    }
    void register();
  }

  // ─── Success / choice screens ──────────────────────────────────────
  if (registered) {
    return (
      <div className="min-h-screen py-10 px-4">
        <div className="mx-auto max-w-md bg-background border rounded-2xl shadow-sm p-7 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
          {laterDone ? (
            <>
              <h1 className="text-xl font-bold">Thank you!</h1>
              <p className="text-muted-foreground mt-2">
                You can log in and give the exam later. {registered.emailed ? "We have mailed you your login credentials." : "Your username is below — keep it safe."}
              </p>
              <p className="mt-3 text-sm">Username: <b>{registered.username}</b></p>
              <Button className="mt-5 w-full" onClick={() => router.push("/login")}>Go to login</Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">You have successfully registered for {registered.className}</h1>
              <p className="text-muted-foreground mt-2">
                {registered.emailed ? "Your login credentials have been emailed to you." : "Keep your username safe to log in later."}
                {" "}Are you ready to start the exam now?
              </p>
              <p className="mt-2 text-sm">Username: <b>{registered.username}</b></p>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                <Button onClick={startNow} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Yes, start now
                </Button>
                <Button variant="outline" onClick={() => setLaterDone(true)} disabled={loading}>No, I&apos;ll do it later</Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Registration form: 3 pages, no verification ─────────────────
  const STEPS = ["Student", "Contact", "Account"];
  return (
    <div className="min-h-screen flex items-center justify-center py-4 px-4">
      <div className="w-full max-w-2xl">
        <div className="bg-background border rounded-3xl shadow-xl overflow-hidden">
          <div className="google-bar h-1.5 w-full" />
          <div className="px-6 sm:px-10 pt-6 pb-5">
            <div className="flex items-center justify-center gap-3 mb-4">
              <BrandLogo className="h-10 w-10" />
              <h1 className="text-2xl font-bold tracking-tight">Exam Portal</h1>
            </div>

            {/* Progress */}
            <ol className="flex items-center justify-center gap-2 mb-5">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const done = step > n;
                const active = step === n;
                return (
                  <li key={label} className="flex items-center gap-2">
                    <span className={`h-8 w-8 rounded-full grid place-items-center text-sm font-semibold border-2 transition-colors ${
                      done ? "bg-primary border-primary text-primary-foreground" : active ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground"
                    }`}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
                    <span className={`hidden sm:inline text-sm ${active ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
                    {n < 3 && <span className={`h-px w-8 sm:w-12 ${done ? "bg-primary" : "bg-border"}`} />}
                  </li>
                );
              })}
            </ol>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> Student details</h2>
                  <Field label="Full name" required>
                    <IconInput icon={UserRound} value={form.name} onChange={(v) => set("name", v)} placeholder="Enter your full name" autoComplete="name" />
                  </Field>
                  <Field label="Select your school" required>
                    <Select value={form.schoolId} onValueChange={(v) => set("schoolId", v)}>
                      <SelectTrigger className="w-full h-10"><School className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder={schoolsLoading ? "Loading schools…" : "Select your school"} /></SelectTrigger>
                      <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <div className={showStream ? "grid sm:grid-cols-2 gap-4" : ""}>
                    <Field label="Select class" required>
                      <Select value={form.class} onValueChange={(v) => set("class", v)}>
                        <SelectTrigger className="w-full h-10"><BookOpen className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>{STUDENT_CLASSES.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    {showStream && (
                      <Field label="Select stream" required>
                        <Select value={form.stream} onValueChange={(v) => set("stream", v)}>
                          <SelectTrigger className="w-full h-10"><Layers className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select stream" /></SelectTrigger>
                          <SelectContent>{STREAMS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Contact className="h-5 w-5 text-primary" /> Contact details</h2>
                  <p className="text-sm text-muted-foreground -mt-2">Enter your email address <b>or</b> mobile number — either one is enough.</p>
                  <Field label="Email address">
                    <IconInput icon={Mail} type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="Enter email address" autoComplete="email" />
                  </Field>
                  <Field label="Mobile number">
                    <IconInput icon={Phone} type="tel" value={form.mobile} onChange={(v) => set("mobile", v)} placeholder="Enter 10-digit mobile number" autoComplete="tel" />
                  </Field>

                  <div className="rounded-2xl border p-3 space-y-3 bg-muted/30">
                    <h3 className="font-semibold flex items-center gap-2"><Headphones className="h-4 w-4 text-primary" /> MS-CIT</h3>
                    <Field label="Have you completed MS-CIT?" required>
                      <YesNo value={form.mscit} onChange={(v) => set("mscit", v)} />
                    </Field>
                    {form.mscit === "yes" && (
                      <div className="max-w-[14rem]">
                        <Field label="MS-CIT percentage (%)">
                          <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" value={form.mscitPct} onChange={(e) => set("mscitPct", e.target.value)} placeholder="e.g. 78.5" className="h-10" />
                        </Field>
                      </div>
                    )}
                    {form.mscit === "no" && (
                      <Field label="Interested in MS-CIT? Our advisor will call you.">
                        <YesNo value={form.mscitInterested} onChange={(v) => set("mscitInterested", v)} />
                      </Field>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-2"><Camera className="h-5 w-5 text-primary" /> Profile photo</h2>
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-muted overflow-hidden flex items-center justify-center border shrink-0">
                        {photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoUrl} alt="Your photo" className="h-full w-full object-cover" />
                        ) : (
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="h-10" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Create your login</h2>
                    <Field label="Username" required>
                      <IconInput icon={UserRound} value={form.username} onChange={(v) => set("username", v.toLowerCase())} placeholder="e.g. riya.patil" autoComplete="username" />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Password" required>
                        <IconInput icon={Lock} type="password" value={form.password} onChange={(v) => set("password", v)} autoComplete="new-password" />
                      </Field>
                      <Field label="Confirm password" required>
                        <IconInput icon={Lock} type="password" value={form.confirmPassword} onChange={(v) => set("confirmPassword", v)} autoComplete="new-password" />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">8+ characters with an uppercase letter, a lowercase letter, a number and a special character.</p>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={form.acceptTerms} onCheckedChange={(v) => set("acceptTerms", Boolean(v))} className="mt-0.5" />
                    <span>I accept the <TermsDialog />.</span>
                  </label>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {step > 1 && (
                  <Button type="button" variant="outline" size="lg" className="flex-1 h-10" onClick={() => setStep((x) => x - 1)} disabled={loading}>
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </Button>
                )}
                {step < 3 ? (
                  <Button type="submit" size="lg" className="flex-1 h-10">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" size="lg" className="flex-1 h-10" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Register
                  </Button>
                )}
              </div>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already registered? <a href="/login" className="text-primary font-medium hover:underline">Log in</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: "yes" | "no") => void }) {
  return (
    <div className="flex gap-2">
      {(["yes", "no"] as const).map((v) => (
        <button type="button" key={v} onClick={() => onChange(v)} className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium capitalize transition-colors ${value === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40"}`}>
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

function IconInput({ icon: Icon, value, onChange, placeholder, type = "text", autoComplete = "off" }: {
  icon: typeof UserRound; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="pl-9 h-10" />
    </div>
  );
}
