import Link from "next/link";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { TermsContent } from "@/components/terms-content";

export const metadata = { title: "Terms and Conditions · Exam Portal" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-6 w-6 text-primary" /> Exam Portal
          </div>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-4">Terms and Conditions</h1>
          <TermsContent />
        </div>
      </div>
    </div>
  );
}
