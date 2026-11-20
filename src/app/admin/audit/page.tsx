"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Entry = {
  _id: string;
  actor: string;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  ip: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (action) params.set("action", action);
    const res = await fetch(`/api/admin/audit?${params}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) {
      setItems(json.data.items);
      setPages(json.data.pages || 1);
    } else toast.error(json.error || "Failed to load");
  }, [page, action]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="System-wide activity trail" />

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action…"
          className="pl-8"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        />
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No audit entries.
        </div>
      ) : (
        <div className="rounded-xl border bg-background divide-y text-sm">
          {items.map((e) => (
            <div key={e._id} className="p-3 flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="font-mono">{e.action}</Badge>
              <span className="text-muted-foreground">{e.actor}{e.actorRole ? ` (${e.actorRole})` : ""}</span>
              {e.entityType && <span className="text-muted-foreground">· {e.entityType}</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}{e.ip ? ` · ${e.ip}` : ""}
              </span>
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
