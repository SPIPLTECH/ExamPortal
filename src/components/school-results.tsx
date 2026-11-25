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
  const cell = (k: string, v: string) => `<div class="cell"><span>${k}</span><b>${v}</b></div>`;
  const pct = Math.max(0, Math.min(100, r.percentage));
  return `<div class="page"><div class="sheet">
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="wm">${esc(center)}</div>
    <header>
      <div class="center">${esc(center)}</div>
      <div class="rule"><i></i><em>&#9670;</em><i></i></div>
      <h1>MARKSHEET</h1>
      <div class="exam">${esc(r.exam)}</div>
    </header>

    <section class="who">
      ${cell("Student Name", esc(r.name))}
      ${cell("School", esc(school))}
      ${r.class ? cell("Class", String(r.class)) : ""}
      ${cell("Date", new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }))}
    </section>

    <table class="marks">
      <thead><tr><th>Exam</th><th>Total Marks</th><th>Marks Obtained</th><th>Percentage</th></tr></thead>
      <tbody><tr><td>${esc(r.exam)}</td><td>${r.totalMarks}</td><td><b>${r.score}</b></td><td><b>${r.percentage.toFixed(2)}%</b></td></tr></tbody>
    </table>

    <div class="bar"><div style="width:${pct}%" class="${r.passed ? "ok" : "no"}"></div></div>

    <div class="result ${r.passed ? "ok" : "no"}">
      <span>RESULT</span><strong>${r.passed ? "PASS" : "FAIL"}</strong>
    </div>

    <footer>
      <div><i></i>Date of issue<br><b>${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</b></div>
      <div><i></i>Authorised Signatory<br><b>${esc(center)}</b></div>
    </footer>
  </div></div>`;
}

function printSheets(center: string, items: { r: Row; school: string }[]) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Allow pop-ups to print the marksheet"); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Marksheet</title><style>
    @page{size:A4;margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;background:#e5e7eb;font-family:Georgia,"Times New Roman",serif;color:#1e293b}
    .page{width:210mm;height:297mm;margin:0 auto 8mm;background:#fff;padding:10mm;page-break-after:always;overflow:hidden}
    .sheet{position:relative;height:100%;border:2.5px solid #1e3a8a;padding:14mm 14mm 12mm;display:flex;flex-direction:column;outline:1px solid #b8892b;outline-offset:-7px}
    .corner{position:absolute;width:14mm;height:14mm;border:3px solid #b8892b}
    .tl{top:3mm;left:3mm;border-right:0;border-bottom:0}.tr{top:3mm;right:3mm;border-left:0;border-bottom:0}
    .bl{bottom:3mm;left:3mm;border-right:0;border-top:0}.br{bottom:3mm;right:3mm;border-left:0;border-top:0}
    .wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:46px;font-weight:bold;color:#1e3a8a;opacity:.045;transform:rotate(-28deg);pointer-events:none;padding:0 20mm}
    header{text-align:center}
    .center{font-size:26px;font-weight:bold;color:#1e3a8a;letter-spacing:.5px;text-transform:uppercase}
    .rule{display:flex;align-items:center;gap:8px;margin:8px auto 10px;width:60%}.rule i{flex:1;height:1px;background:#b8892b}.rule em{color:#b8892b;font-style:normal;font-size:11px}
    h1{margin:0;font-size:34px;letter-spacing:10px;color:#0f172a}
    .exam{display:inline-block;margin-top:10px;padding:5px 18px;border-radius:999px;background:#1e3a8a;color:#fff;font:600 14px Arial,sans-serif;letter-spacing:.4px}
    .who{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:11mm 0 8mm}
    .cell{border-bottom:1px solid #cbd5e1;padding:4px 2px}.cell span{display:block;font:11px Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:1px}.cell b{font-size:17px}
    .marks{width:100%;border-collapse:collapse;font-family:Arial,sans-serif}
    .marks th{background:#1e3a8a;color:#fff;padding:10px;font-size:12.5px;letter-spacing:.6px;text-transform:uppercase;border:1px solid #1e3a8a}
    .marks td{padding:16px 10px;text-align:center;font-size:17px;border:1px solid #cbd5e1}.marks td:first-child{text-align:left;font-size:15px}
    .bar{height:10px;background:#e2e8f0;border-radius:99px;margin:10mm 0 8mm;overflow:hidden}.bar div{height:100%;border-radius:99px}
    .ok{background:#059669}.no{background:#dc2626}
    .result{align-self:center;display:flex;flex-direction:column;align-items:center;padding:10px 40px;border-radius:10px;color:#fff;font-family:Arial,sans-serif}
    .result span{font-size:11px;letter-spacing:3px;opacity:.9}.result strong{font-size:34px;letter-spacing:6px}
    footer{margin-top:auto;display:flex;justify-content:space-between;gap:20mm;font:12px Arial,sans-serif;color:#475569;text-align:center}
    footer div{flex:1}footer i{display:block;border-top:1px solid #334155;margin-bottom:6px}footer b{color:#0f172a;font-size:13px}
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
