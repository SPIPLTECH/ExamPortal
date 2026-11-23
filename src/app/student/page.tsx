import { PageHeader } from "@/components/stat-card";
import { StudentTestList } from "@/components/student-test-list";

export const dynamic = "force-dynamic";

export default function StudentDashboard() {
  return (
    <div>
      <PageHeader title="My Exams" subtitle="Start your pending exams or see the ones you have completed" />
      <StudentTestList scope="dashboard" />
    </div>
  );
}
