"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Search, Building2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/stat-card";
import { CENTER_EXPIRY_MONTHS, QUESTION_DB_MODES } from "@/lib/constants";

type Center = {
  _id: string;
  name: string;
  code: string;
  email?: string | null;
  owner?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  proctoringEnabled: boolean;
  questionDbMode: string;
  username?: string | null;
  loginExpiresAt?: string | null;
  isActive: boolean;
  students: number;
};

const EMPTY_FORM = {
  name: "", email: "", address: "",
  ownerName: "", ownerEmail: "", ownerPhone: "",
  username: "", password: "",
  expiryMonths: "3",
  proctoringEnabled: "yes",
  questionDbMode: "BOTH",
};

const DB_LABEL: Record<string, string> = {
  COMMON: "Common / default library (all centers)",
  OWN: "Own database only",
  BOTH: "Both (common + own)",
};

export default function CentersPage() {
  const [items, setItems] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/centers?${params}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    setSaving(true);
    const res = await fetch("/api/admin/centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        expiryMonths: Number(form.expiryMonths),
        proctoringEnabled: form.proctoringEnabled === "yes",
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error((json.issues && (Object.values(json.issues)[0] as string)) || json.error || "Create failed");
      return;
    }
    toast.success(
      `Center created. Username: ${json.data.username}. ${json.data.emailed ? "Credentials emailed." : "Email not configured — share the login manually."}`,
      { duration: 15000 }
    );
    setOpen(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function toggle(id: string) {
    const res = await fetch(`/api/admin/centers/${id}`, { method: "POST" });
    if (res.ok) load();
    else toast.error("Failed");
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Centers" subtitle="Create and manage centers and their logins" />
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Center</Button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name or code…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" /> No centers yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => (
            <div key={c._id} className="rounded-xl border bg-background p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.username && <Badge variant="outline" className="font-mono">@{c.username}</Badge>}
                  <Badge className={c.isActive ? "bg-emerald-600" : "bg-slate-400"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                  <Badge variant="outline">{c.proctoringEnabled ? "Proctoring ON" : "Proctoring OFF"}</Badge>
                  <Badge variant="outline">{c.questionDbMode}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {c.students} students{c.email ? ` · ${c.email}` : ""}
                  {c.owner?.name ? ` · Owner: ${c.owner.name}` : ""}
                  {c.loginExpiresAt ? ` · Expires ${new Date(c.loginExpiresAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggle(c._id)}>
                <Power className="h-4 w-4" /> {c.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Center</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Center details</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Center name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></F>
              <F label="Center email *"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></F>
              <div className="sm:col-span-2"><F label="Center address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></F></div>
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-1">Center owner</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Owner name *"><Input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></F>
              <F label="Owner email *"><Input type="email" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} /></F>
              <F label="Owner phone *"><Input value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} /></F>
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-1">Login credentials</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Username *"><Input value={form.username} onChange={(e) => set("username", e.target.value)} /></F>
              <F label="Password *"><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></F>
              <F label="Login validity *">
                <Select value={form.expiryMonths} onValueChange={(v) => set("expiryMonths", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{CENTER_EXPIRY_MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </F>
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-1">Features</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Enable proctoring for this center?">
                <Select value={form.proctoringEnabled} onValueChange={(v) => set("proctoringEnabled", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                </Select>
              </F>
              <F label="Question database">
                <Select value={form.questionDbMode} onValueChange={(v) => set("questionDbMode", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{QUESTION_DB_MODES.map((m) => <SelectItem key={m} value={m}>{DB_LABEL[m]}</SelectItem>)}</SelectContent>
                </Select>
              </F>
            </div>
            <p className="text-xs text-muted-foreground">The login validity date is calculated automatically from the chosen months. Credentials are emailed to the center and owner.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create center & email login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
