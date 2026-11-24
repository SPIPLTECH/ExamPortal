"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/stat-card";
import { CATEGORIES, DIFFICULTIES, STREAMS, STUDENT_CLASSES } from "@/lib/constants";
import { QuestionDialog, type QuestionDoc } from "./question-dialog";

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

export default function QuestionsPage() {
  const [items, setItems] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ search: "", class: "", difficulty: "", category: "", stream: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionDoc | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const res = await fetch(`/api/alc/questions?${params}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error || "Failed to load questions");
      return;
    }
    setItems(json.data.items);
    setTotal(json.data.total);
    setPages(json.data.pages || 1);
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    const res = await fetch(`/api/alc/questions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Question deleted");
      load();
    } else {
      toast.error("Delete failed");
    }
  }

  const setF = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v === "ALL" ? "" : v }));
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Question Bank" subtitle={`${total} question${total === 1 ? "" : "s"} in your repository`} />
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Question
        </Button>
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search text…"
            className="pl-8"
            value={filters.search}
            onChange={(e) => setF("search", e.target.value)}
          />
        </div>
        <FilterSelect label="Class" value={filters.class} onChange={(v) => setF("class", v)}
          options={STUDENT_CLASSES.map((c) => ({ value: String(c), label: `Class ${c}` }))} />
        <FilterSelect label="Difficulty" value={filters.difficulty} onChange={(v) => setF("difficulty", v)}
          options={DIFFICULTIES.map((d) => ({ value: d, label: d[0] + d.slice(1).toLowerCase() }))} />
        <FilterSelect label="Category" value={filters.category} onChange={(v) => setF("category", v)}
          options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
        <FilterSelect label="Stream" value={filters.stream} onChange={(v) => setF("stream", v)}
          options={STREAMS.map((s) => ({ value: s, label: s[0] + s.slice(1).toLowerCase() }))} />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No questions yet. Add one manually or use Excel Import.
          </div>
        ) : (
          <div className="divide-y">
            {items.map((q) => (
              <div key={q._id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-2">{q.text}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="secondary">Class {q.class}</Badge>
                    <Badge variant="secondary">{CATEGORY_LABEL[q.category] ?? q.category}</Badge>
                    <Badge variant="outline">{q.difficulty}</Badge>
                    {q.stream && <Badge variant="outline">{q.stream}</Badge>}
                    <Badge className="bg-emerald-600">Ans: {q.correctOption}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(q); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(q._id)}>
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <QuestionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value || "ALL"} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All {label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
