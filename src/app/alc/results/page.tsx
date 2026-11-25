import { PageHeader } from "@/components/stat-card";
import { SchoolResults } from "@/components/school-results";

export default function AlcResultsPage() {
  return (
    <div>
      <PageHeader title="Results" subtitle="School-wise student results — generate a marksheet for any student" />
      <SchoolResults />
    </div>
  );
}
