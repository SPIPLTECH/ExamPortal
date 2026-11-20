import {
  Building2,
  Users,
  ClipboardList,
  FileCheck2,
  CircleCheck,
  CircleX,
  Activity,
  Headphones,
  PlayCircle,
} from "lucide-react";
import { connectDB } from "@/lib/db";
import {
  ALCCenter,
  User,
  Test,
  ExamAttempt,
  StudentProfile,
} from "@/models";
import { StatCard, PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await connectDB();

  const [
    centers,
    students,
    tests,
    pending,
    approved,
    rejected,
    active,
    attempts,
    mscit,
  ] = await Promise.all([
    ALCCenter.countDocuments({}),
    User.countDocuments({ role: "STUDENT" }),
    Test.countDocuments({}),
    Test.countDocuments({ reviewStatus: "SUBMITTED" }),
    Test.countDocuments({ reviewStatus: "APPROVED" }),
    Test.countDocuments({ reviewStatus: "REJECTED" }),
    Test.countDocuments({ status: "ACTIVE" }),
    ExamAttempt.countDocuments({}),
    StudentProfile.countDocuments({ "mscit.interested": true }),
  ]);

  return (
    <div>
      <PageHeader title="Super Admin Dashboard" subtitle="System-wide overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="ALC Centers" value={centers} icon={Building2} tone="blue" />
        <StatCard label="Students" value={students} icon={Users} />
        <StatCard label="Total Examinations" value={tests} icon={ClipboardList} />
        <StatCard label="Pending Approvals" value={pending} icon={FileCheck2} tone="amber" />
        <StatCard label="Approved" value={approved} icon={CircleCheck} tone="green" />
        <StatCard label="Rejected" value={rejected} icon={CircleX} tone="red" />
        <StatCard label="Active Examinations" value={active} icon={PlayCircle} tone="green" />
        <StatCard label="Total Attempts" value={attempts} icon={Activity} />
        <StatCard label="MS-CIT Interested" value={mscit} icon={Headphones} tone="amber" />
      </div>
    </div>
  );
}
