import { connectDB } from "./db";
import { Question } from "@/models/Question";

/** Number of questions in a test's own pool. */
export async function getTestPoolCount(testId: string): Promise<number> {
  await connectDB();
  return Question.countDocuments({ test: testId, isActive: true });
}

/**
 * A test can be generated only if its own pool has at least `totalQuestions`
 * (the number served to each student). Students then get that many at random.
 */
export async function validateTestFeasibility(test: {
  _id: string;
  totalQuestions: number;
}): Promise<{ ok: true; poolCount: number } | { ok: false; error: string }> {
  const poolCount = await getTestPoolCount(test._id);
  if (poolCount < test.totalQuestions) {
    return {
      ok: false,
      error: `This test has only ${poolCount} question(s); at least ${test.totalQuestions} are required (students get ${test.totalQuestions} at random). Add more questions.`,
    };
  }
  return { ok: true, poolCount };
}
