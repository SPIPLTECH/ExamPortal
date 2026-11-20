"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, CalendarClock } from "lucide-react";
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

type TestItem = {
  _id: string;
  name: string;
  targetClass: number;
  targetStream?: string | null;
  reviewStatus: string;
  status: string;
  schedule?: { startTime?: string | null; endTime?: string | null };
};

export default function SchedulePage() {
  const [items, setItems] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TestItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ startTime: "", endTime: "", enrollmentDeadline: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/alc/tests?reviewStatus=APPROVED");
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function schedule() {
    if (!active) return;
    if (!form.startTime || !form.endTime) return toast.error("Start and end time required");
    setSaving(true);
    const res = await fetch(`/api/alc/tests/${active._id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        enrollmentDeadline: form.enrollmentDeadline ? new Date(form.enrollmentDeadline).toISOString() : null,
        eligibleClasses: [active.targetClass],
        eligibleStreams: active.targetStream ? [active.targetStream] : [],
        assignedCenters: [],
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(json.error || "Schedule failed");
      return;
    }
    toast.success("Test scheduled");
    setActive(null);
    setForm({ startTime: "", endTime: "", enrollmentDeadline: "" });
    load();
  }

  return (
    <div>
      <PageHeader title="Scheduling" subtitle="Publish approved tests with an exam window" />

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          No approved tests to schedule yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div key={t._id} className="rounded-xl border bg-background p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.status !== "UNPUBLISHED" && <Badge className="bg-emerald-600">{t.status}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Class {t.targetClass}{t.targetStream ? ` · ${t.targetStream}` : ""}
                  {t.schedule?.startTime
                    ? ` · ${new Date(t.schedule.startTime).toLocaleString()} → ${t.schedule.endTime ? new Date(t.schedule.endTime).toLocaleString() : ""}`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setActive(t);
                  setForm({ startTime: "", endTime: "", enrollmentDeadline: "" });
                }}
              >
                <CalendarClock className="h-4 w-4" /> {t.status === "UNPUBLISHED" ? "Schedule" : "Reschedule"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule “{active?.name}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start time *</Label>
              <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End time *</Label>
              <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Enrollment deadline</Label>
              <Input type="datetime-local" value={form.enrollmentDeadline} onChange={(e) => setForm({ ...form, enrollmentDeadline: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={schedule} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
