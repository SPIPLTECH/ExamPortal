"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ChevronDown, FileText, School, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { id: string; name: string; class: number | null; exam: string; score: number; totalMarks: number; percentage: number; passed: boolean; date: string };
type SchoolGroup = { school: string; students: Row[]; passed: number };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function marksheetHtml(center: string, r: Row, school: string) {
  const row = (k: string, v: string) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`;
  return `<div class="page"><div class="sheet">
    <h1>${esc(center)}</h1>
    <h2>MARKSHEET</h2>
    <table>
      ${row("Center", esc(center))}
      ${row("Student Name", esc(r.name))}
      ${row("School", esc(school))}
      ${r.class ? row("Class", String(r.class)) : ""}
      ${row("Exam", esc(r.exam))}
      ${row("Marks Obtained", `${r.score} / ${r.totalMarks}`)}
      ${row("Percentage", `${r.percentage.toFixed(2)}%`)}
      ${row("Result", `<b class="${r.passed ? "p" : "f"}">${r.passed ? "PASS" : "FAIL"}</b>`)}
    </table>
    <div class="sign"><i></i>Sign &amp; Date<br>Center Authorised Person</div>
  </div></div>`;
}

function printSheets(center: string, items: { r: Row; school: string }[]) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Allow pop-ups to print the marksheet"); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Marksheet</title><style>
    @page{size:A4;margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;background:#e5e7eb;font-family:Arial,sans-serif;color:#111}
    .page{width:210mm;height:297mm;margin:0 auto 8mm;background:#fff;padding:12mm;page-break-after:always;overflow:hidden}
    .sheet{height:100%;border:2px solid #222;padding:14mm;display:flex;flex-direction:column}
    h1{margin:0;text-align:center;font-size:24px;text-transform:uppercase}
    h2{margin:8px 0 22px;text-align:center;font-size:16px;letter-spacing:5px;font-weight:600}
    table{width:100%;border-collapse:collapse}
    td{border:1px solid #888;padding:11px 14px;font-size:15px}.k{width:36%;background:#f3f4f6;font-weight:bold}
    .p{color:#047857}.f{color:#b91c1c}
    .sign{margin-top:auto;align-self:flex-end;width:62mm;text-align:center;font-size:12px;color:#333}
    .sign i{display:block;border-top:1px solid #222;margin-bottom:6px}
    @media print{body{background:#fff}.page{margin:0}}
  </style></head><body>
    ${items.map((i) => marksheetHtml(center, i.r, i.school)).join("")}
    <script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script></body></html>`);
  w.document.close();
}

export function SchoolResults() {
  const [data, setData] = useState<{ center: string; schools: SchoolGroup[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/alc/results/schools")
      .then(async (res) => {
        const j = await res.json();
        if (res.ok) setData(j.data);
        else toast.error(j.error || "Failed to load results");
      })
      .catch(() => toast.error("Network error"));
  }, []);

  const schools = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data.schools;
    return data.schools
      .map((s) => ({ ...s, students: s.students.filter((r) => r.name.toLowerCase().includes(t) || s.school.toLowerCase().includes(t)) }))
      .filter((s) => s.students.length > 0);
  }, [data, q]);

  if (!data) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (data.schools.length === 0)
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />No results yet.
      </div>
    );

  return (
    <div className="space-y-3">
      <Input placeholder="Search student or school…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {schools.map((s) => (
        <div key={s.school} className="rounded-xl border bg-card overflow-hidden">
          <button type="button" onClick={() => setOpen(open === s.school ? null : s.school)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40">
            <School className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{s.school}</p>
              <p className="text-xs text-muted-foreground">{s.students.length} students · {s.passed} passed · {s.students.length - s.passed} failed</p>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${open === s.school ? "rotate-180" : ""}`} />
          </button>
          {open === s.school && (
            <div className="border-t overflow-x-auto">
              <div className="flex justify-end p-2">
                <Button size="sm" variant="outline" onClick={() => printSheets(data.center, s.students.map((r) => ({ r, school: s.school })))}>
                  <FileText className="h-4 w-4" /> Marksheets of this school
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr><th className="text-left p-2 pl-4">Student</th><th className="text-left p-2">Exam</th><th className="text-right p-2">Marks</th><th className="text-right p-2">%</th><th className="p-2">Result</th><th className="p-2" /></tr>
                </thead>
                <tbody>
                  {s.students.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 pl-4 font-medium">{r.name}</td>
                      <td className="p-2">{r.exam}</td>
                      <td className="p-2 text-right">{r.score}/{r.totalMarks}</td>
                      <td className="p-2 text-right">{r.percentage.toFixed(1)}%</td>
                      <td className="p-2 text-center"><Badge variant={r.passed ? "default" : "destructive"}>{r.passed ? "Pass" : "Fail"}</Badge></td>
                      <td className="p-2 pr-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => printSheets(data.center, [{ r, school: s.school }])}><FileText className="h-4 w-4" /> Marksheet</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
