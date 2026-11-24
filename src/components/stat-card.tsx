import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "amber" | "green" | "red" | "blue";
}) {
  const tones: Record<string, { text: string; bar: string; bg: string }> = {
    default: { text: "text-foreground", bar: "bg-[#5b2a86]", bg: "bg-[#f4e9f8]" },
    blue: { text: "text-[#5b2a86]", bar: "bg-[#5b2a86]", bg: "bg-[#f4e9f8]" },
    red: { text: "text-[#c2306f]", bar: "bg-[#d63a7b]", bg: "bg-[#fde7f0]" },
    amber: { text: "text-[#9a6700]", bar: "bg-[#e4a91f]", bg: "bg-[#fdf3d8]" },
    green: { text: "text-[#1f7a53]", bar: "bg-[#2f9e6b]", bg: "bg-[#e3f5ec]" },
  };
  const t = tones[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className={cn("absolute inset-x-0 top-0 h-1", t.bar)} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", t.bg)}>
            <Icon className={cn("h-4 w-4", t.text)} />
          </span>
        )}
      </div>
      <p className={cn("mt-3 text-3xl font-bold tracking-tight", t.text)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
