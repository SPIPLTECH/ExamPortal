"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, StatCard } from "@/components/stat-card";

type PreviewRow = {
  row: number;
  valid: boolean;
  errors: string[];
  duplicate: boolean;
  data?: {
    text: string;
    class: number;
    category: string;
    difficulty: string;
    correctOption: string;
    options: { key: string; text: string }[];
  };
};

type Summary = { total: number; valid: number; invalid: number; duplicates: number };

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setRows([]);
    setSummary(null);
    setExcluded(new Set());
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/alc/questions/import", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      toast.error(json.error || "Import failed");
      return;
    }
    setRows(json.data.rows);
    setSummary(json.data.summary);
    toast.success(`Parsed ${json.data.summary.total} rows`);
  }

  function toggle(row: number) {
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(row)) n.delete(row);
      else n.add(row);
      return n;
    });
  }

  async function generate() {
    const toImport = rows.filter((r) => r.valid && !excluded.has(r.row)).map((r) => r.data);
    if (toImport.length === 0) {
      toast.error("No rows selected to import");
      return;
    }
    setCommitting(true);
    const res = await fetch("/api/alc/questions/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: toImport }),
    });
    const json = await res.json();
    setCommitting(false);
    if (!res.ok) {
      toast.error(json.error || "Save failed");
      return;
    }
    toast.success(`Imported ${json.data.inserted} questions into your bank`);
    setRows([]);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const CATEGORY_LABEL: Record<string, string> = {
    SYLLABUS: "Syllabus",
    AI_LITERACY: "AI Literacy",
    IT_LITERACY: "IT Literacy",
  };

  return (
    <div>
      <PageHeader title="Excel Question Import" subtitle="Bulk-import questions into your bank" />

      <div className="rounded-xl border bg-background p-6 mb-6">
        <ol className="text-sm text-muted-foreground list-decimal ml-4 space-y-1 mb-4">
          <li>Download the template and fill in your questions.</li>
          <li>Upload it — every row is validated and previewed.</li>
          <li>Exclude any invalid rows, then click Generate Questions.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <a href="/api/alc/questions/template" download>
            <Button variant="outline">
              <Download className="h-4 w-4" /> Download Template
            </Button>
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onFile}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload Filled Sheet
          </Button>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-4 mb-4">
            <StatCard label="Total Rows" value={summary.total} icon={FileSpreadsheet} />
            <StatCard label="Valid" value={summary.valid} icon={CheckCircle2} tone="green" />
            <StatCard label="Invalid" value={summary.invalid} icon={XCircle} tone="red" />
            <StatCard label="Duplicates" value={summary.duplicates} icon={AlertTriangle} tone="amber" />
          </div>

          <div className="rounded-xl border bg-background divide-y mb-4">
            {rows.map((r) => (
              <div key={r.row} className="p-4 flex items-start gap-3">
                <div className="pt-1">
                  <Checkbox
                    checked={r.valid && !excluded.has(r.row)}
                    disabled={!r.valid}
                    onCheckedChange={() => toggle(r.row)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Row {r.row}</span>
                    {r.valid ? (
                      <Badge className="bg-emerald-600">Valid</Badge>
                    ) : (
                      <Badge variant="destructive">Invalid</Badge>
                    )}
                    {r.duplicate && <Badge className="bg-amber-500">Duplicate</Badge>}
                  </div>
                  {r.data ? (
                    <>
                      <p className="font-medium mt-1 line-clamp-2">{r.data.text}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Badge variant="secondary">Class {r.data.class}</Badge>
                        <Badge variant="secondary">{CATEGORY_LABEL[r.data.category] ?? r.data.category}</Badge>
                        <Badge variant="outline">{r.data.difficulty}</Badge>
                        <Badge className="bg-emerald-600">Ans: {r.data.correctOption}</Badge>
                      </div>
                    </>
                  ) : (
                    <ul className="text-sm text-red-600 dark:text-red-400 mt-1 list-disc ml-4">
                      {r.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={generate} disabled={committing}>
              {committing && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Questions
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
