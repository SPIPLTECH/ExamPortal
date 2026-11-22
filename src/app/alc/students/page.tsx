"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserCircle, CheckCircle2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Student = {
  _id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  class: number;
  stream: string | null;
  schoolName: string;
  centerStatus: string;
  image: string | null;
  photo?: string | null;
  mscit?: { completed: boolean; percentage?: number | null; interested: boolean } | null;
};

const STATUS_COLOR: Record<string, string> = {
  VERIFIED: "bg-emerald-600",
  PENDING: "bg-amber-500",
  UNASSIGNED: "bg-slate-400",
};

export default function AlcStudentsPage() {
  const [items, setItems] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/alc/students?${params}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "VERIFY" | "REMOVE") {
    if (action === "REMOVE" && !confirm("Remove this student from your center?")) return;
    const res = await fetch(`/api/alc/students/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      toast.success(action === "VERIFY" ? "Student verified" : "Student removed");
      load();
    } else toast.error("Action failed");
  }

  return (
    <div>
      <PageHeader title="Students" subtitle="Students associated with your center" />

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          No students associated with your center yet. Share your center code so students can join.
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
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.name}</p>
                  <Badge className={STATUS_COLOR[s.centerStatus]}>{s.centerStatus}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {s.email || s.mobile || "—"} · Class {s.class}{s.stream ? ` ${s.stream}` : ""} · {s.schoolName}
                </p>
                {s.mscit && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    MS-CIT: {s.mscit.completed ? `completed${s.mscit.percentage != null ? ` (${s.mscit.percentage}%)` : ""}` : s.mscit.interested ? "interested — advisor to call" : "not completed"}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {s.centerStatus === "PENDING" && (
                  <Button size="sm" variant="outline" onClick={() => act(s._id, "VERIFY")}>
                    <CheckCircle2 className="h-4 w-4" /> Verify
                  </Button>
                )}
                <Button size="icon" variant="ghost" title="Remove" onClick={() => act(s._id, "REMOVE")}>
                  <UserMinus className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
