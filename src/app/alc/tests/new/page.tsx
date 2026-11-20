import { PageHeader } from "@/components/stat-card";
import { TestComposer } from "../test-composer";

export default function NewTestPage() {
  return (
    <div>
      <PageHeader title="Create Test" subtitle="Build an examination and submit it for approval" />
      <TestComposer />
    </div>
  );
}
