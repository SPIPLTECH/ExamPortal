import { PageHeader } from "@/components/stat-card";
import { StudentTestList } from "@/components/student-test-list";

export default function AvailableTestsPage() {
  return (
    <div>
      <PageHeader title="Available Tests" subtitle="Tests you are eligible to enroll in" />
      <StudentTestList scope="available" />
    </div>
  );
}
