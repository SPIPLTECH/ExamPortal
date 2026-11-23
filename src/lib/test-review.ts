import { Test } from "@/models/Test";

/**
 * A center added its own questions to a test. If the test was already approved
 * it goes back to the admin for approval (and stops being offered to students).
 */
export async function markNeedsReview(testId: string) {
  await Test.updateOne(
    { _id: testId, reviewStatus: "APPROVED" },
    { $set: { reviewStatus: "SUBMITTED", submittedAt: new Date() } }
  );
}
