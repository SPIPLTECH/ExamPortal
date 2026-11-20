"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { GraduationCap, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { STREAMS, STUDENT_CLASSES } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [centers, setCenters] = useState<{ code: string; name: string; location: string }[]>([]);

  useEffect(() => {
    fetch("/api/public/centers")
      .then((r) => r.json())
      .then((j) => setCenters(j.data?.items ?? []))
      .catch(() => setCenters([]));
  }, []);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    class: "",
    stream: "",
    schoolName: "",
    centerCode: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    mscitCompleted: "no", // "yes" | "no"
    mscitPercentage: "",
    mscitInterested: false,
  });

  const cls = Number(form.class);
  const showMscit = cls >= 8;
  const showStream = cls >= 11;

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.centerCode) {
      toast.error("Please select your ALC center");
      return;
    }
    if (!form.acceptTerms) {
      toast.error("Please accept the Terms and Conditions");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set("name", form.name);
    fd.set("email", form.email);
    fd.set("mobile", form.mobile);
    fd.set("class", form.class);
    if (showStream) fd.set("stream", form.stream);
    fd.set("schoolName", form.schoolName);
    fd.set("centerCode", form.centerCode);
    fd.set("password", form.password);
    fd.set("confirmPassword", form.confirmPassword);
    fd.set("acceptTerms", String(form.acceptTerms));
    if (showMscit) {
      fd.set("mscitCompleted", form.mscitCompleted === "yes" ? "true" : "false");
      if (form.mscitCompleted === "yes") fd.set("mscitPercentage", form.mscitPercentage);
      else fd.set("mscitInterested", String(form.mscitInterested));
    }
    if (photo) fd.set("photo", photo);

    const res = await fetch("/api/public/register", { method: "POST", body: fd });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error || "Registration failed");
      if (json.issues) {
        const first = Object.values(json.issues)[0] as string;
        if (first) toast.error(first);
      }
      return;
    }
    toast.success("Account created successfully! Please sign in.");
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 font-semibold text-lg mb-6 justify-center">
          <GraduationCap className="h-6 w-6 text-primary" /> Exam Portal
        </div>
        <div className="bg-background border rounded-xl shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Create your student account</h1>
          <p className="text-muted-foreground text-sm mt-1 mb-6">
            Fill in your details. Fields adapt to your class.
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label htmlFor="photo">Profile photo</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Class" required>
                <Select value={form.class} onValueChange={(v) => set("class", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_CLASSES.map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        Class {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="optional if mobile given" />
              </Field>
              <Field label="Mobile">
                <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="optional if email given" />
              </Field>
              {showStream && (
                <Field label="Stream" required>
                  <Select value={form.stream} onValueChange={(v) => set("stream", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stream" />
                    </SelectTrigger>
                    <SelectContent>
                      {STREAMS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="School name" required>
                <Input value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} required />
              </Field>
              <Field label="ALC Center" required>
                <Select value={form.centerCode} onValueChange={(v) => set("centerCode", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your center" />
                  </SelectTrigger>
                  <SelectContent>
                    {centers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No centers available</div>
                    ) : (
                      centers.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}{c.location ? ` — ${c.location}` : ""} ({c.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {showMscit && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="font-medium text-sm">MS-CIT</p>
                <Field label="Have you completed MS-CIT?">
                  <Select value={form.mscitCompleted} onValueChange={(v) => set("mscitCompleted", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.mscitCompleted === "yes" ? (
                  <Field label="MS-CIT percentage">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.mscitPercentage}
                      onChange={(e) => set("mscitPercentage", e.target.value)}
                    />
                  </Field>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.mscitInterested}
                      onCheckedChange={(v) => set("mscitInterested", Boolean(v))}
                    />
                    Yes, I&apos;m interested in MS-CIT — please contact me
                  </label>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Password" required>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required />
              </Field>
              <Field label="Confirm password" required>
                <Input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} required />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Use 8+ characters with upper &amp; lower case, a number and a special character.
            </p>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={form.acceptTerms}
                onCheckedChange={(v) => set("acceptTerms", Boolean(v))}
                className="mt-0.5"
              />
              <span>
                I accept the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms and Conditions
                </Link>
                .
              </span>
            </label>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
