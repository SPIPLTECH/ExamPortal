"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/stat-card";

type School = { _id: string; name: string; address?: string | null; phone?: string | null; students: number };
const EMPTY = { name: "", address: "", phone: "" };

export default function SchoolsPage() {
  const [items, setItems] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/alc/schools");
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() { setEditId(null); setForm(EMPTY); setOpen(true); }
  function openEdit(s: School) {
    setEditId(s._id);
    setForm({ name: s.name, address: s.address || "", phone: s.phone || "" });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(editId ? `/api/alc/schools/${editId}` : "/api/alc/schools", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error((json.issues && (Object.values(json.issues)[0] as string)) || json.error || "Save failed");
      return;
    }
    toast.success(editId ? "School updated" : "School created");
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this school?")) return;
    const res = await fetch(`/api/alc/schools/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) { toast.success("School deleted"); load(); }
    else toast.error(json.error || "Delete failed");
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Schools" subtitle="Schools under your center. Students pick one at registration; all your tests are available to every school." />
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create School</Button>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" /> No schools yet. Create one so students can register.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((s) => (
            <div key={s._id} className="rounded-xl border bg-background p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <Badge variant="outline">{s.students} students</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {[s.address, s.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => remove(s._id)}><Trash2 className="h-4 w-4" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit School" : "Create School"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>School name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {editId ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
