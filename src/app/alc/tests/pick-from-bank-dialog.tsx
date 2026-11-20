"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type BankQ = { _id: string; text: string; category: string; difficulty: string; correctOption: string };

export function PickFromBankDialog({
  open,
  onOpenChange,
  testId,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  testId: string;
  onPicked: () => void;
}) {
  const [items, setItems] = useState<BankQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/alc/questions?${params}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setItems(json.data.items);
    else toast.error(json.error || "Failed to load bank");
  }, [search]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      load();
    }
  }, [open, load]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function add() {
    if (selected.size === 0) return toast.error("Select at least one question");
    setSaving(true);
    const res = await fetch(`/api/alc/tests/${testId}/questions/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: Array.from(selected) }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(json.error || "Failed to add");
    toast.success(`Added ${json.data.added} questions to the test`);
    onPicked();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick from Question Bank</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bank…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-[12rem] max-h-[50vh]">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No bank questions found.</div>
          ) : (
            items.map((q) => (
              <label key={q._id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50">
                <Checkbox checked={selected.has(q._id)} onCheckedChange={() => toggle(q._id)} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm line-clamp-2">{q.text}</p>
                  <div className="flex gap-1.5 mt-1">
                    <Badge variant="secondary">{q.category}</Badge>
                    <Badge variant="outline">{q.difficulty}</Badge>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <span className="mr-auto text-sm text-muted-foreground self-center">{selected.size} selected</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={add} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add to test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
