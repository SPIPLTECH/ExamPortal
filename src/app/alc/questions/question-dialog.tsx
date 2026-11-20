"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, DIFFICULTIES, OPTION_KEYS, STREAMS, STUDENT_CLASSES } from "@/lib/constants";

export type QuestionDoc = {
  _id: string;
  text: string;
  options: { key: string; text: string }[];
  correctOption: string;
  difficulty: string;
  class: number;
  category: string;
  stream?: string | null;
  classGroup?: string | null;
  explanation?: string | null;
  imageUrl?: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

type OptRow = { key: string; text: string };

function initialOptions(): OptRow[] {
  return OPTION_KEYS.slice(0, 4).map((k) => ({ key: k, text: "" }));
}

export function QuestionDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  preset,
  basePath = "/api/alc/questions",
  hideClassCategory = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: QuestionDoc | null;
  onSaved: () => void;
  /** Pre-fill class/stream when adding for a specific test. */
  preset?: { class?: number; stream?: string | null };
  /** API base: bank (default) or a test pool `/api/alc/tests/<id>/questions`. */
  basePath?: string;
  /** When adding to a test, class/stream come from the test — hide those fields. */
  hideClassCategory?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [options, setOptions] = useState<OptRow[]>(initialOptions);
  const [correct, setCorrect] = useState<string>("A");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [cls, setCls] = useState("");
  const [category, setCategory] = useState("SYLLABUS");
  const [stream, setStream] = useState("");
  const [explanation, setExplanation] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setText(editing.text);
      setOptions(editing.options.map((o) => ({ key: o.key, text: o.text })));
      setCorrect(editing.correctOption);
      setDifficulty(editing.difficulty);
      setCls(String(editing.class));
      setCategory(editing.category);
      setStream(editing.stream ?? "");
      setExplanation(editing.explanation ?? "");
      setImageUrl(editing.imageUrl ?? null);
    } else {
      setText("");
      setImageUrl(null);
      setOptions(initialOptions());
      setCorrect("A");
      setDifficulty("MEDIUM");
      setCls(preset?.class ? String(preset.class) : "");
      setCategory("SYLLABUS");
      setStream(preset?.stream ?? "");
      setExplanation("");
    }
  }, [open, editing, preset]);

  const showStream = Number(cls) >= 11;

  function setOptText(idx: number, v: string) {
    setOptions((o) => o.map((row, i) => (i === idx ? { ...row, text: v } : row)));
  }
  function addOption() {
    if (options.length >= OPTION_KEYS.length) return;
    setOptions((o) => [...o, { key: OPTION_KEYS[o.length], text: "" }]);
  }
  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((o) =>
      o.filter((_, i) => i !== idx).map((row, i) => ({ ...row, key: OPTION_KEYS[i] }))
    );
    // Reset correct if it pointed past the end
    setCorrect((c) =>
      (OPTION_KEYS as readonly string[]).indexOf(c) >= options.length - 1 ? "A" : c
    );
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("image", file);
    const res = await fetch("/api/alc/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      toast.error(json.error || "Image upload failed");
      return;
    }
    setImageUrl(json.data.url);
    toast.success("Image attached");
  }

  async function submit() {
    if (!cls) return toast.error("Select a class");
    if (showStream && !stream) return toast.error("Select a stream");
    if (options.some((o) => !o.text.trim())) return toast.error("All options need text");
    if (!options.find((o) => o.key === correct)) return toast.error("Choose the correct option");

    setSaving(true);
    const body = {
      text,
      options: options.map((o) => ({ key: o.key, text: o.text })),
      correctOption: correct,
      difficulty,
      class: Number(cls),
      category,
      stream: showStream ? stream : null,
      explanation: explanation || null,
      imageUrl: imageUrl || null,
    };
    const url = editing ? `${basePath}/${editing._id}` : basePath;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(json.error || "Save failed");
      if (json.issues) toast.error(Object.values(json.issues)[0] as string);
      return;
    }
    toast.success(editing ? "Question updated" : "Question added");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Question text *</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>

          {/* Optional question image */}
          <div className="space-y-2">
            <Label>Question image (optional)</Label>
            <div className="flex items-center gap-3">
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="question" className="h-16 w-24 rounded-md border object-cover" />
              )}
              <Input
                type="file"
                accept="image/*"
                className="max-w-xs"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {imageUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setImageUrl(null)}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Options * (select the correct one)</Label>
            {options.map((o, i) => (
              <div key={o.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(o.key)}
                  className={`h-8 w-8 shrink-0 rounded-full border flex items-center justify-center text-sm font-medium ${
                    correct === o.key ? "bg-emerald-600 text-white border-emerald-600" : "bg-muted"
                  }`}
                  title="Mark correct"
                >
                  {o.key}
                </button>
                <Input value={o.text} onChange={(e) => setOptText(i, e.target.value)} placeholder={`Option ${o.key}`} />
                {options.length > 2 && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < OPTION_KEYS.length && (
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="h-4 w-4" /> Add option
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {!hideClassCategory && (
              <Field label="Class *">
                <Select value={cls} onValueChange={setCls}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {STUDENT_CLASSES.map((c) => (
                      <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Category *">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {showStream && !hideClassCategory && (
              <Field label="Stream *">
                <Select value={stream} onValueChange={setStream}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {STREAMS.map((s) => (
                      <SelectItem key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <div className="space-y-2">
            <Label>Explanation (optional)</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
