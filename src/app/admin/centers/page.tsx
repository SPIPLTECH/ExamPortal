"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Search, Building2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/stat-card";

type Center = {
  _id: string;
  name: string;
  code: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
  students: number;
};

const EMPTY_FORM = {
  name: "",
  code: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  capacity: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
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

  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    setSaving(true);
    const res = await fetch("/api/admin/centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, capacity: form.capacity || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(json.error || "Create failed");
      if (json.issues) toast.error(Object.values(json.issues)[0] as string);
      return;
    }
    toast.success(`Center ${json.data.code} created`);
    setOpen(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function toggle(id: string) {
    const res = await fetch(`/api/admin/centers/${id}`, { method: "POST" });
    if (res.ok) {
      load();
    } else toast.error("Failed");
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="ALC Centers" subtitle="Create and manage centers and their logins" />
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Create Center
        </Button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name or code…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No centers yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => (
            <div key={c._id} className="rounded-xl border bg-background p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <Badge variant="outline">{c.code}</Badge>
                  <Badge className={c.isActive ? "bg-emerald-600" : "bg-slate-400"}>
                    {c.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {[c.city, c.state].filter(Boolean).join(", ") || "—"} · {c.students} students
                  {c.email ? ` · ${c.email}` : ""}
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
          <DialogHeader>
            <DialogTitle>Create ALC Center</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Center details</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Center name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></F>
              <F label="Code * (invite code)"><Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} /></F>
              <F label="Email"><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></F>
              <F label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></F>
              <F label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></F>
              <F label="State"><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></F>
            </div>
            <p className="text-sm font-medium text-muted-foreground pt-2">Center login account</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Admin name *"><Input value={form.adminName} onChange={(e) => set("adminName", e.target.value)} /></F>
              <F label="Admin email *"><Input value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} /></F>
              <F label="Password *"><Input type="password" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} /></F>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create center
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
