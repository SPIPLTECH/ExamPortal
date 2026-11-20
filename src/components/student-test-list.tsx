"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CalendarClock, Clock, ShieldCheck, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type TestItem = {
  _id: string;
  name: string;
  description?: string | null;
  targetClass: number;
  targetStream?: string | null;
  totalQuestions: number;
  duration: number;
  proctoringMode: string;
  schedule?: {
    startTime?: string | null;
    endTime?: string | null;
    enrollmentDeadline?: string | null;
  };
  enrolled: boolean;
  enrollmentOpen: boolean;
  examLive: boolean;
  attemptStatus: string | null;
};

const EMPTY: Record<string, string> = {
  available: "No tests are open for enrollment right now.",
  enrolled: "You haven't enrolled in any tests yet.",
  explore: "No published tests are available to you right now.",
};

export function StudentTestList({ scope }: { scope: "available" | "enrolled" | "explore" }) {
  const router = useRouter();
  const [items, setItems] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [proctorFor, setProctorFor] = useState<TestItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/student/tests?scope=${scope}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load");
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const enroll = useCallback(
    async (testId: string, proctoringChoice: string | null) => {
      const res = await fetch(`/api/student/tests/${testId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proctoringChoice }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Enrolled successfully");
        load();
      } else {
        toast.error(json.error || "Enrollment failed");
      }
    },
    [load]
  );

  function onEnrollClick(t: TestItem) {
    if (t.proctoringMode === "OPTIONAL") setProctorFor(t);
    else enroll(t._id, null);
  }

  if (loading) {
    return (
      <div className="p-10 flex justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
        {EMPTY[scope]}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((t) => {
          const start = t.schedule?.startTime ? new Date(t.schedule.startTime) : null;
          const completed = t.attemptStatus && t.attemptStatus !== "IN_PROGRESS";
          return (
            <div key={t._id} className="rounded-xl border bg-background p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t.name}</h3>
                {t.proctoringMode !== "DISABLED" && (
                  <Badge variant="outline" className="shrink-0">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {t.proctoringMode === "MANDATORY" ? "Proctored" : "Optional proctor"}
                  </Badge>
                )}
              </div>
              {t.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge variant="secondary">Class {t.targetClass}{t.targetStream ? ` · ${t.targetStream}` : ""}</Badge>
                <Badge variant="secondary">{t.totalQuestions} Q</Badge>
                <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t.duration} min</Badge>
              </div>
              {start && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {start.toLocaleString()}
                </p>
              )}
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                {completed ? (
                  <Badge className="bg-slate-500">Completed</Badge>
                ) : t.enrolled ? (
                  t.examLive ? (
                    <Button size="sm" onClick={() => router.push(`/exam/${t._id}`)}>
                      <PlayCircle className="h-4 w-4" /> Start Exam
                    </Button>
                  ) : (
                    <Badge className="bg-emerald-600">Enrolled</Badge>
                  )
                ) : t.enrollmentOpen ? (
                  <Button size="sm" variant="outline" onClick={() => onEnrollClick(t)}>
                    Enroll
                  </Button>
                ) : (
                  <Badge variant="outline">Enrollment closed</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!proctorFor} onOpenChange={(v) => !v && setProctorFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable proctoring?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This test allows optional proctoring. If you enable it, your camera will be used to
            monitor the exam. This choice is locked once the exam begins.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (proctorFor) enroll(proctorFor._id, "DISABLED");
                setProctorFor(null);
              }}
            >
              Without proctoring
            </Button>
            <Button
              onClick={() => {
                if (proctorFor) enroll(proctorFor._id, "MANDATORY");
                setProctorFor(null);
              }}
            >
              <ShieldCheck className="h-4 w-4" /> Enable proctoring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
