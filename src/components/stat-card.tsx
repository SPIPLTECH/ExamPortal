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
    default: { text: "text-foreground", bar: "bg-[#4285f4]", bg: "bg-[#e8f0fe] dark:bg-[#394457]" },
    blue: { text: "text-[#1a73e8] dark:text-[#8ab4f8]", bar: "bg-[#4285f4]", bg: "bg-[#e8f0fe] dark:bg-[#394457]" },
    red: { text: "text-[#d93025] dark:text-[#f28b82]", bar: "bg-[#ea4335]", bg: "bg-[#fce8e6] dark:bg-[#4a2f2d]" },
    amber: { text: "text-[#b06000] dark:text-[#fdd663]", bar: "bg-[#fbbc04]", bg: "bg-[#fef7e0] dark:bg-[#4a4228]" },
    green: { text: "text-[#188038] dark:text-[#81c995]", bar: "bg-[#34a853]", bg: "bg-[#e6f4ea] dark:bg-[#2b3f31]" },
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
