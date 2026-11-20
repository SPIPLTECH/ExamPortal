"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, FileSpreadsheet, Library, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionDialog, type QuestionDoc } from "@/app/alc/questions/question-dialog";
import { PickFromBankDialog } from "./pick-from-bank-dialog";
import { TestExcelImportDialog } from "./test-excel-import-dialog";

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

export function TestQuestionsManager({
  testId,
  targetClass,
  targetStream,
  perStudent,
}: {
  testId: string;
  targetClass: number;
  targetStream: string | null;
  perStudent: number;
}) {
  const [items, setItems] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionDoc | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);

  const base = `/api/alc/tests/${testId}/questions`;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(base);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load questions");
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(qid: string) {
    if (!confirm("Remove this question from the test?")) return;
    const res = await fetch(`${base}/${qid}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Question removed");
      load();
    } else toast.error("Delete failed");
  }

  const enough = items.length >= perStudent;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="font-semibold">Questions</h2>
          <p className="text-sm text-muted-foreground">
            Add any number of questions. Each student gets <b>{perStudent}</b> random questions from this pool.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4" /> Add manually
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setExcelOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" /> Import Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPickOpen(true)}>
            <Library className="h-4 w-4" /> Pick from bank
          </Button>
        </div>
      </div>

      <div
        className={`flex items-center gap-2 rounded-lg p-3 text-sm mb-4 ${
          enough ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {enough ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <span>
          {items.length} question{items.length === 1 ? "" : "s"} in the pool
          {enough
            ? ` — ready (students get ${perStudent} random each).`
            : ` — add at least ${perStudent} to publish.`}
        </span>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No questions yet. Add manually, import an Excel file, or pick from your bank.
        </div>
      ) : (
        <div className="divide-y border rounded-lg max-h-[28rem] overflow-y-auto">
          {items.map((q, i) => (
            <div key={q._id} className="p-3 flex items-start gap-3">
              <span className="text-xs text-muted-foreground mt-1 w-6 shrink-0">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-2">{q.text}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="secondary">{CATEGORY_LABEL[q.category] ?? q.category}</Badge>
                  <Badge variant="outline">{q.difficulty}</Badge>
                  <Badge className="bg-emerald-600">Ans: {q.correctOption}</Badge>
                  {q.imageUrl && <Badge variant="outline">image</Badge>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(q); setAddOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(q._id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuestionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editing={editing}
        basePath={base}
        hideClassCategory
        preset={{ class: targetClass, stream: targetStream }}
        onSaved={() => { setAddOpen(false); load(); }}
      />
      <PickFromBankDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        testId={testId}
        onPicked={() => { setPickOpen(false); load(); }}
      />
      <TestExcelImportDialog
        open={excelOpen}
        onOpenChange={setExcelOpen}
        testId={testId}
        onImported={() => { setExcelOpen(false); load(); }}
      />
    </div>
  );
}
