import { PageHeader } from "@/components/stat-card";
import { ResultsExplorer } from "@/components/results-explorer";

export default function AlcResultsPage() {
  return (
    <div>
      <PageHeader title="Results & Analytics" subtitle="Performance across your tests — open a student to see their answers" />
      <ResultsExplorer api="/api/alc/results" />
    </div>
  );
}
