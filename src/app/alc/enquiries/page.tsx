"use client";

import { useEffect, useState } from "react";
import { Loader2, Headphones, Phone, Mail, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/stat-card";

type Enquiry = { _id: string; name: string; mobile: string | null; email: string | null; contact: string; class: number; school: string | null; status: string; createdAt: string };

export default function AlcEnquiriesPage() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/alc/enquiries")
      .then((r) => r.json())
      .then((j) => setItems(j.data?.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="MS-CIT Enquiries" subtitle="Students of your center who want to join MS-CIT — a course advisor will call them" />
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
          <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" /> No enquiries yet.
        </div>
      ) : (
        <div className="rounded-xl border bg-background divide-y">
          {items.map((e) => (
            <div key={e._id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium">{e.name} <span className="text-muted-foreground font-normal">· Class {e.class}</span></p>
                <p className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {(e.mobile || (!e.email && e.contact)) && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{e.mobile || e.contact}</span>}
                  {e.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{e.email}</span>}
                  {e.school && <span className="inline-flex items-center gap-1"><School className="h-3.5 w-3.5" />{e.school}</span>}
                </p>
              </div>
              <Badge variant="outline">{e.status}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
