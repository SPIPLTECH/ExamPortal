import { PageHeader } from "@/components/stat-card";
import { TestComposer } from "../test-composer";

export default async function EditTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <PageHeader title="Edit Test" subtitle="Update your test and publish it" />
      <TestComposer testId={id} />
    </div>
  );
}
