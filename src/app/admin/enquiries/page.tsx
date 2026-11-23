"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/stat-card";
import { MSCIT_ENQUIRY_STATUSES } from "@/lib/constants";

type Enquiry = {
  _id: string;
  name: string;
  contact: string;
  class: number;
  school: string | null;
  center?: string | null;
  status: string;
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-amber-500",
  CONVERTED: "bg-emerald-600",
  CLOSED: "bg-slate-400",
};

export default function EnquiriesPage() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/admin/enquiries?${params}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/enquiries/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("Updated");
      load();
    } else toast.error("Update failed");
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="MS-CIT Enquiries" subtitle="Interested students captured at registration" />
        <a href="/api/admin/enquiries?format=csv" download>
          <Button variant="outline"><Download className="h-4 w-4" /> Export CSV</Button>
        </a>
      </div>

      <div className="max-w-xs mb-4">
        <Select value={filter || "ALL"} onValueChange={(v) => setFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {MSCIT_ENQUIRY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No enquiries yet.
        </div>
      ) : (
        <div className="rounded-xl border bg-background divide-y">
          {items.map((e) => (
            <div key={e._id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{e.name}</p>
                  <Badge className={STATUS_COLOR[e.status]}>{e.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {e.contact} · Class {e.class}{e.school ? ` · ${e.school}` : ""}{e.center ? ` · Center: ${e.center}` : ""} · {new Date(e.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Select value={e.status} onValueChange={(v) => setStatus(e._id, v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MSCIT_ENQUIRY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
