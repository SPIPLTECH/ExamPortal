"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, KeyRound, Power, Trash2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Student = {
  _id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  isActive: boolean;
  image: string | null;
  photo?: string | null;
  mscit?: { completed: boolean; percentage?: number | null; interested: boolean } | null;
  class: number | null;
  stream: string | null;
  center: { name: string; code: string } | null;
  centerStatus: string;
};

export default function StudentsPage() {
  const [items, setItems] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/students?${params}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) {
      setItems(json.data.items);
      setPages(json.data.pages || 1);
      setTotal(json.data.total);
    } else toast.error(json.error || "Failed to load");
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, body: Record<string, unknown>, msg: string) {
    const res = await fetch(`/api/admin/students/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok) {
      toast.success(msg);
      load();
    } else toast.error(json.error || "Action failed");
  }

  async function resetPassword(id: string) {
    const pw = prompt("Enter a new password (8+ chars, upper/lower/number/special):");
    if (!pw) return;
    act(id, { action: "RESET_PASSWORD", newPassword: pw }, "Password reset");
  }

  async function del(id: string) {
    if (!confirm("Delete this student permanently?")) return;
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Student deleted");
      load();
    } else toast.error("Delete failed");
  }

  return (
    <div>
      <PageHeader title="Students" subtitle={`${total} registered students`} />

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, email, mobile…"
          className="pl-8"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          No students found.
        </div>
      ) : (
        <div className="rounded-xl border bg-background divide-y">
          {items.map((s) => (
            <div key={s._id} className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserCircle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              {s.photo && s.photo !== s.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo} alt="Registration photo" title="Registration photo" className="h-9 w-9 rounded-md object-cover border shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.name}</p>
                  {!s.isActive && <Badge variant="outline" className="text-red-600">Disabled</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {s.email || s.mobile || "—"}
                  {s.class ? ` · Class ${s.class}${s.stream ? " " + s.stream : ""}` : ""}
                  {s.center ? ` · ${s.center.name} (${s.centerStatus})` : " · Unassigned"}
                </p>
                {s.mscit && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    MS-CIT: {s.mscit.completed ? `completed${s.mscit.percentage != null ? ` (${s.mscit.percentage}%)` : ""}` : s.mscit.interested ? "interested — advisor to call" : "not completed"}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" title="Reset password" onClick={() => resetPassword(s._id)}>
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title={s.isActive ? "Disable" : "Enable"} onClick={() => act(s._id, { action: "TOGGLE_ACTIVE" }, "Updated")}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Delete" onClick={() => del(s._id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
