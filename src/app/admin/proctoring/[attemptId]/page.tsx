import { ProctoringReviewDetail } from "@/components/proctoring/review-detail";

export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ProctoringReviewDetail role="admin" attemptId={attemptId} />;
}
