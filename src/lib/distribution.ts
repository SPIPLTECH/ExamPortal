/**
 * Class-wise question distribution engine (pure functions, no DB/IO).
 *
 * Given a per-category availability map and the test's category ranges, it
 * computes an allocation that selects EXACTLY `target` questions while keeping
 * every category within [min, max]. If the pool can't satisfy the rules it
 * returns a clear, actionable error instead of silently under/over-filling.
 *
 * Spec rules (defaults, all configurable per test):
 *   Class 5-7   : 25 from SYLLABUS
 *   Class 8-10  : SYLLABUS 8-10, AI_LITERACY 7-8, IT_LITERACY 7-8  (= 25)
 *   Class 11-12 : stream SYLLABUS 9-11, AI_LITERACY 7-8, IT_LITERACY 7-8 (= 25)
 */
import {
  CATEGORIES,
  EXACT_QUESTIONS_PER_ATTEMPT,
  defaultRuleForClass,
  type Category,
} from "./constants";
import type { ICategoryRule } from "@/models/Test";

export type Availability = Partial<Record<Category, number>>;
export type Allocation = Partial<Record<Category, number>>;

export type AllocationResult =
  | { ok: true; allocation: Allocation; total: number }
  | { ok: false; error: string };

/** Resolve the effective category ranges for a test (explicit config or defaults). */
export function resolveRules(
  cls: number,
  configured: ICategoryRule[] | undefined
): ICategoryRule[] {
  if (configured && configured.length > 0) return configured;

  const rule = defaultRuleForClass(cls);
  const out: ICategoryRule[] = [{ category: "SYLLABUS", ...rule.syllabus }];
  if (rule.aiLiteracy) out.push({ category: "AI_LITERACY", ...rule.aiLiteracy });
  if (rule.itLiteracy) out.push({ category: "IT_LITERACY", ...rule.itLiteracy });
  return out;
}

const CATEGORY_LABEL: Record<string, string> = {
  SYLLABUS: "Syllabus",
  AI_LITERACY: "AI Literacy",
  IT_LITERACY: "IT Literacy",
};

/**
 * Validate the ranges themselves (independent of any pool): can the min/max
 * windows add up to exactly `target`? Used when saving/approving a test.
 */
export function validateRanges(
  rules: ICategoryRule[],
  target = EXACT_QUESTIONS_PER_ATTEMPT
): { ok: true } | { ok: false; error: string } {
  if (rules.length === 0) return { ok: false, error: "No category rules defined." };
  for (const r of rules) {
    if (r.min < 0 || r.max < 0 || r.min > r.max) {
      return { ok: false, error: `Invalid range for ${CATEGORY_LABEL[r.category] ?? r.category}.` };
    }
  }
  const sumMin = rules.reduce((s, r) => s + r.min, 0);
  const sumMax = rules.reduce((s, r) => s + r.max, 0);
  if (sumMin > target) {
    return { ok: false, error: `Category minimums add up to ${sumMin}, which exceeds ${target}.` };
  }
  if (sumMax < target) {
    return { ok: false, error: `Category maximums add up to only ${sumMax}, below ${target}.` };
  }
  return { ok: true };
}

/** Compute an exact allocation given the live pool availability. */
export function computeAllocation(
  rules: ICategoryRule[],
  availability: Availability,
  target = EXACT_QUESTIONS_PER_ATTEMPT
): AllocationResult {
  const rangeCheck = validateRanges(rules, target);
  if (!rangeCheck.ok) return rangeCheck;

  type Row = { cat: Category; min: number; effMax: number; alloc: number };
  const rows: Row[] = [];

  for (const r of rules) {
    const cat = r.category as Category;
    const have = availability[cat] ?? 0;
    if (r.min > have) {
      return {
        ok: false,
        error: `Not enough ${CATEGORY_LABEL[cat] ?? cat} questions: need at least ${r.min}, have ${have}.`,
      };
    }
    rows.push({ cat, min: r.min, effMax: Math.min(r.max, have), alloc: r.min });
  }

  const sumMin = rows.reduce((s, r) => s + r.min, 0);
  const sumEffMax = rows.reduce((s, r) => s + r.effMax, 0);
  if (sumEffMax < target) {
    return {
      ok: false,
      error: `The question pool can supply at most ${sumEffMax} eligible questions; ${target} are required. Add more questions.`,
    };
  }

  // Distribute the remaining need across headroom, round-robin for even spread.
  let remaining = target - sumMin;
  while (remaining > 0) {
    let progressed = false;
    for (const row of rows) {
      if (remaining === 0) break;
      if (row.alloc < row.effMax) {
        row.alloc += 1;
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break; // defensive; guaranteed not to hit given sumEffMax>=target
  }

  if (remaining !== 0) {
    return { ok: false, error: "Could not satisfy the category distribution for this pool." };
  }

  const allocation: Allocation = {};
  let total = 0;
  for (const row of rows) {
    allocation[row.cat] = row.alloc;
    total += row.alloc;
  }
  return { ok: true, allocation, total };
}

/** Sum availability across the known categories (helper for callers). */
export function emptyAvailability(): Availability {
  const a: Availability = {};
  for (const c of CATEGORIES) a[c] = 0;
  return a;
}
