import { ExamRoom } from "./exam-room";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  return <ExamRoom testId={testId} />;
}
