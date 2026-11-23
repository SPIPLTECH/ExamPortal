import { cn } from "@/lib/utils";

/** Exam Portal mark: four Google-colour tiles with a check. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt="Exam Portal" className={cn("h-8 w-8", className)} />
  );
}

export const BRAND_NAME = "Exam Portal";
