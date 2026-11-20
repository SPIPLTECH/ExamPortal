"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Account = {
  user: { name: string; email: string | null; mobile: string | null; image: string | null };
  profile: {
    class: number;
    stream: string | null;
    schoolName: string;
    center: { name: string; code: string } | null;
    centerStatus: string;
    mscit: { completed: boolean; percentage: number | null; interested: boolean };
  };
};

export default function AccountPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  async function load() {
    const res = await fetch("/api/student/account");
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(json.error || "Failed to load");
    setData(json.data);
    setName(json.data.user.name);
    setSchool(json.data.profile.schoolName);
  }
  useEffect(() => {
    load();
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("schoolName", school);
    if (photo) fd.set("photo", photo);
    const res = await fetch("/api/student/account", { method: "PATCH", body: fd });
    const json = await res.json();
    setSavingProfile(false);
    if (!res.ok) return toast.error(json.error || "Save failed");
    toast.success("Profile updated");
    setPhoto(null);
    load();
  }

  async function changePassword() {
    setSavingPw(true);
    const res = await fetch("/api/student/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pw),
    });
    const json = await res.json();
    setSavingPw(false);
    if (!res.ok) {
      toast.error(json.error || "Change failed");
      if (json.issues) toast.error(Object.values(json.issues)[0] as string);
      return;
    }
    toast.success("Password changed");
    setPw({ currentPassword: "", newPassword: "" });
  }

  if (loading || !data) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const preview = photo ? URL.createObjectURL(photo) : data.user.image;

  return (
    <div className="max-w-2xl">
      <PageHeader title="My Account" subtitle="Manage your profile and password" />

      <div className="rounded-xl border bg-background p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserCircle className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Change photo
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>School name</Label>
            <Input value={school} onChange={(e) => setSchool(e.target.value)} />
          </div>
          <Readonly label="Email" value={data.user.email ?? "—"} />
          <Readonly label="Mobile" value={data.user.mobile ?? "—"} />
          <Readonly label="Class" value={`Class ${data.profile.class}${data.profile.stream ? " · " + data.profile.stream : ""}`} />
          <div className="space-y-2">
            <Label>Center</Label>
            <div className="flex items-center gap-2 h-9">
              {data.profile.center ? (
                <>
                  <span className="text-sm">{data.profile.center.name}</span>
                  <Badge variant="outline">{data.profile.centerStatus}</Badge>
                </>
              ) : (
                <Badge variant="outline">Unassigned</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-background p-6">
        <h2 className="font-semibold mb-4">Change password</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Current password</Label>
            <Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <Button variant="outline" onClick={changePassword} disabled={savingPw}>
            {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </div>
    </div>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="h-9 flex items-center text-sm text-muted-foreground">{value}</div>
    </div>
  );
}
