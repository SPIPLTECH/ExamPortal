import { connectDB } from "./db";
import { Question } from "@/models/Question";
import { computeAllocation, resolveRules, type Availability } from "./distribution";
import type { ICategoryRule } from "@/models/Test";
import type { Stream } from "./constants";
import { Types } from "mongoose";

/**
 * Count eligible questions per category for a given center/class/stream.
 * Stream filter: questions with matching stream OR no stream (null) are eligible
 * (syllabus-agnostic questions apply to any stream).
 */
export async function getPoolAvailability(
  centerId: string,
  cls: number,
  stream: Stream | null
): Promise<Availability> {
  await connectDB();

  const match: Record<string, unknown> = {
    center: new Types.ObjectId(centerId),
    class: cls,
    isActive: true,
  };
  if (cls >= 11 && stream) {
    match.$or = [{ stream }, { stream: null }];
  }

  const grouped = await Question.aggregate<{ _id: string; count: number }>([
    { $match: match },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const availability: Availability = {};
  for (const g of grouped) {
    availability[g._id as keyof Availability] = g.count;
  }
  return availability;
}

/**
 * Check a test can actually be generated: its distribution ranges must be
 * satisfiable by the live pool to exactly `totalQuestions`.
 */
export async function validateTestFeasibility(test: {
  center: string;
  targetClass: number;
  targetStream?: Stream | null;
  totalQuestions: number;
  distribution?: ICategoryRule[];
}): Promise<{ ok: true; availability: Availability } | { ok: false; error: string }> {
  const availability = await getPoolAvailability(
    test.center,
    test.targetClass,
    test.targetStream ?? null
  );
  const rules = resolveRules(test.targetClass, test.distribution);
  const result = computeAllocation(rules, availability, test.totalQuestions);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, availability };
}
