import { PageHeader } from "@/components/stat-card";
import { ResultsExplorer } from "@/components/results-explorer";

export default function AdminResultsPage() {
  return (
    <div>
      <PageHeader title="Results" subtitle="All centers — open a student to see their answers" />
      <ResultsExplorer api="/api/admin/results" />
    </div>
  );
}
