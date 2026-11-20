import { PageHeader } from "@/components/stat-card";
import { StudentTestList } from "@/components/student-test-list";

export default function EnrolledTestsPage() {
  return (
    <div>
      <PageHeader title="Enrolled Tests" subtitle="Start your exams when they go live" />
      <StudentTestList scope="enrolled" />
    </div>
  );
}
