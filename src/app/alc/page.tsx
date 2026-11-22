import {
  Users,
  ClipboardList,
  FileCheck2,
  CircleCheck,
  CircleX,
  CalendarClock,
  PlayCircle,
  CheckCircle2,
  UserCheck,
  FileSpreadsheet,
  BookOpen,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { StudentProfile, Test, TestEnrollment, ALCCenter } from "@/models";
import { formatExamCode } from "@/lib/exam-code";
import { StatCard, PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function AlcDashboard() {
  const user = await getSessionUser();
  if (!user?.centerId) {
    return (
      <div>
        <PageHeader title="ALC Center Dashboard" />
        <p className="text-muted-foreground">
          Your account is not linked to a center yet. Please contact the administrator.
        </p>
      </div>
    );
  }

  await connectDB();
  const center = user.centerId;
  const centerDoc = await ALCCenter.findById(center).select("code name").lean();

  const [
    students,
    totalTests,
    approved,
    pending,
    rejected,
    scheduled,
    active,
    completed,
    enrollments,
  ] = await Promise.all([
    StudentProfile.countDocuments({ center }),
    Test.countDocuments({ center }),
    Test.countDocuments({ center, reviewStatus: "APPROVED" }),
    Test.countDocuments({ center, reviewStatus: "SUBMITTED" }),
    Test.countDocuments({ center, reviewStatus: "REJECTED" }),
    Test.countDocuments({ center, status: "SCHEDULED" }),
    Test.countDocuments({ center, status: "ACTIVE" }),
    Test.countDocuments({ center, status: "COMPLETED" }),
    TestEnrollment.countDocuments({ center }),
  ]);

  return (
    <div>
      <PageHeader title="ALC Center Dashboard" subtitle="Your center at a glance" />

      {centerDoc && (
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Your Exam Code — share this with students</p>
            <p className="text-3xl font-mono font-bold tracking-widest">{formatExamCode(centerDoc.code)}</p>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Students open the portal home page, enter this code, pick their class and start the exam.
            They get 25 random questions from the test published for their class.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <QuickAction href="/alc/import" icon={FileSpreadsheet} title="Import Questions (Excel)" desc="Download the template, fill it, upload" tone="emerald" />
        <QuickAction href="/alc/questions" icon={BookOpen} title="Question Bank" desc="Add, edit or delete questions" tone="blue" />
        <QuickAction href="/alc/tests/new" icon={Plus} title="Create Test" desc="Build it and publish for students" tone="violet" />
        <QuickAction href="/alc/schedule" icon={CalendarClock} title="Schedule Tests" desc="Optional exam window" tone="amber" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Students" value={students} icon={Users} tone="blue" />
        <StatCard label="Total Tests" value={totalTests} icon={ClipboardList} />
        <StatCard label="Approved" value={approved} icon={CircleCheck} tone="green" />
        <StatCard label="Pending Approval" value={pending} icon={FileCheck2} tone="amber" />
        <StatCard label="Rejected" value={rejected} icon={CircleX} tone="red" />
        <StatCard label="Scheduled" value={scheduled} icon={CalendarClock} />
        <StatCard label="Active" value={active} icon={PlayCircle} tone="green" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} />
        <StatCard label="Enrollments" value={enrollments} icon={UserCheck} />
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
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <Link href={href} className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${tones[tone]}`}>
      <Icon className="h-6 w-6 mb-2" />
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </Link>
  );
}
