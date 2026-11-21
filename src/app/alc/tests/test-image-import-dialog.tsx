"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Row = {
  row: number;
  valid: boolean;
  errors: string[];
  duplicate: boolean;
  data?: { text: string; correctOption: string; imageUrl?: string | null };
};

export function TestImageImportDialog({
  open,
  onOpenChange,
  testId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  testId: string;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{ valid: number; invalid: number; duplicates: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setRows([]);
    setSummary(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/alc/tests/${testId}/questions/import-images`, { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) return toast.error(json.error || "Import failed");
    setRows(json.data.rows);
    setSummary(json.data.summary);
  }

  async function generate() {
    // Skip duplicates automatically; import valid, non-duplicate rows.
    const toImport = rows.filter((r) => r.valid && !r.duplicate).map((r) => r.data);
    if (toImport.length === 0) return toast.error("No new questions to import (all duplicates or invalid)");
    setCommitting(true);
    const res = await fetch(`/api/alc/tests/${testId}/questions/import-images/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: toImport }),
    });
    const json = await res.json();
    setCommitting(false);
    if (!res.ok) return toast.error(json.error || "Save failed");
    toast.success(`Added ${json.data.addedToTest} to the test · ${json.data.addedToBank} new in bank · ${json.data.skipped} skipped`);
    setRows([]);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
    onImported();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Questions with images</DialogTitle>
          <DialogDescription>
            Format: Q No · Chapter · Question · Image · Option A–D · Answer · Difficulty. Questions are
            also saved to your question bank (no duplicates).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <a href="/api/alc/questions/template-images" download>
            <Button type="button" variant="outline" size="sm"><Download className="h-4 w-4" /> Template</Button>
          </a>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload sheet
          </Button>
        </div>

        {summary && (
          <>
            <div className="flex gap-2 text-sm">
              <Badge className="bg-emerald-600">{summary.valid} valid</Badge>
              <Badge variant="destructive">{summary.invalid} invalid</Badge>
              <Badge className="bg-amber-500">{summary.duplicates} duplicate</Badge>
            </div>
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y max-h-[45vh]">
              {rows.map((r) => (
                <div key={r.row} className="p-2.5 flex items-start gap-2 text-sm">
                  {r.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    {r.data ? <p className="line-clamp-1">{r.data.text}</p> : <p className="text-red-600">Row {r.row}: {r.errors.join("; ")}</p>}
                    <div className="flex gap-1 mt-0.5">
                      {r.duplicate && <Badge className="bg-amber-500">Duplicate — will skip</Badge>}
                      {r.data?.imageUrl && <Badge variant="outline">image</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {summary && (
            <Button onClick={generate} disabled={committing}>
              {committing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import new questions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
