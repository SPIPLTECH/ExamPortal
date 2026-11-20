/**
 * Turns a pool of eligible questions + an allocation into a frozen, per-student
 * question set: random question order, random option order, and the correct
 * answer remapped to the shuffled option keys (kept server-side only).
 */
import { OPTION_KEYS, type Category } from "./constants";
import type { IQuestion } from "@/models/Question";
import type { IFrozenQuestion, IFrozenOption } from "@/models/ExamAttempt";
import type { Allocation } from "./distribution";

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type QuestionLike = Pick<
  IQuestion,
  "_id" | "text" | "imageUrl" | "options" | "correctOption" | "category"
>;

/**
 * Build the frozen set. `byCategory` maps each category to its eligible
 * questions; `allocation` says how many to take from each.
 */
export function buildFrozenQuestions(
  byCategory: Partial<Record<Category, QuestionLike[]>>,
  allocation: Allocation,
  opts: { marksPerQuestion: number; negativeMarks: number }
): IFrozenQuestion[] {
  const picked: QuestionLike[] = [];

  for (const cat of Object.keys(allocation) as Category[]) {
    const need = allocation[cat] ?? 0;
    if (need <= 0) continue;
    const pool = shuffle(byCategory[cat] ?? []);
    picked.push(...pool.slice(0, need));
  }

  // Randomize overall question order, then assign sequential order numbers.
  return shuffle(picked).map((q, idx) => freezeOne(q, idx + 1, opts));
}

/** Freeze one question: shuffle its options and remap the correct key. */
function freezeOne(
  q: QuestionLike,
  order: number,
  opts: { marksPerQuestion: number; negativeMarks: number }
): IFrozenQuestion {
  const shuffledOptions = shuffle(q.options);
  const options: IFrozenOption[] = shuffledOptions.map((o, i) => ({
    key: OPTION_KEYS[i]!,
    text: o.text,
    imageUrl: o.imageUrl ?? null,
  }));
  const correctIndex = shuffledOptions.findIndex((o) => o.key === q.correctOption);
  const correctKey = OPTION_KEYS[correctIndex] ?? OPTION_KEYS[0]!;
  return {
    question: q._id,
    order,
    category: q.category,
    text: q.text,
    imageUrl: q.imageUrl ?? null,
    options,
    correctOption: correctKey,
    marks: opts.marksPerQuestion,
    negativeMarks: opts.negativeMarks,
  } as IFrozenQuestion;
}

/**
 * Pick `count` RANDOM questions from a test's pool and freeze them. Each student
 * gets a different random subset (anti-cheating) with shuffled options.
 */
export function buildFrozenFromPool(
  pool: QuestionLike[],
  count: number,
  opts: { marksPerQuestion: number; negativeMarks: number }
): IFrozenQuestion[] {
  const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
  return picked.map((q, idx) => freezeOne(q, idx + 1, opts));
}

/**
 * Project a frozen question for the STUDENT: strips `correctOption`. Always use
 * this before sending attempt questions to the client.
 */
export function toClientQuestion(q: IFrozenQuestion) {
  return {
    question: String(q.question),
    order: q.order,
    category: q.category,
    text: q.text,
    imageUrl: q.imageUrl ?? null,
    options: q.options.map((o) => ({ key: o.key, text: o.text, imageUrl: o.imageUrl ?? null })),
    marks: q.marks,
  };
}
