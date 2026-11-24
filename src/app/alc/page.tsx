import {
  Users,
  ClipboardList,
  PlayCircle,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { StudentProfile, Test } from "@/models";
import { StatCard, PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function AlcDashboard() {
  const user = await getSessionUser();
  if (!user?.centerId) {
    return (
      <div>
        <PageHeader title="Center Dashboard" />
        <p className="text-muted-foreground">
          Your account is not linked to a center yet. Please contact the administrator.
        </p>
      </div>
    );
  }

  await connectDB();
  const center = user.centerId;

  const [
    students,
    totalTests,
    active,
    completed,
  ] = await Promise.all([
    StudentProfile.countDocuments({ center }),
    Test.countDocuments({ center }),
    Test.countDocuments({ center, status: "ACTIVE" }),
    Test.countDocuments({ center, status: "COMPLETED" }),
  ]);

  return (
    <div>
      <PageHeader title="Center Dashboard" subtitle="Your center at a glance" />

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <QuickAction href="/alc/import" icon={FileSpreadsheet} title="Import Questions (Excel)" desc="Download the template, fill it, upload" tone="emerald" />
        <QuickAction href="/alc/questions" icon={BookOpen} title="Question Bank" desc="Add, edit or delete questions" tone="blue" />
        <QuickAction href="/alc/tests/new" icon={Plus} title="Create Test" desc="Build it and publish for students" tone="violet" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Students" value={students} icon={Users} tone="blue" />
        <StatCard label="Total Tests" value={totalTests} icon={ClipboardList} />
        <StatCard label="Active" value={active} icon={PlayCircle} tone="green" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  desc,
  tone,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  desc: string;
  tone: "emerald" | "blue" | "violet" | "amber";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200 dark:border-emerald-800",
    blue: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 border-purple-200 dark:border-purple-800",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 border-amber-200 dark:border-amber-800",
  };
  return (
    <Link href={href} className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${tones[tone]}`}>
      <Icon className="h-6 w-6 mb-2" />
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </Link>
  );
}
