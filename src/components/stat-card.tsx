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
  const tones: Record<string, string> = {
    default: "text-foreground",
    amber: "text-amber-600",
    green: "text-emerald-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };
  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", tones[tone])} />}
      </div>
      <p className={cn("mt-2 text-3xl font-bold tracking-tight", tones[tone])}>{value}</p>
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
