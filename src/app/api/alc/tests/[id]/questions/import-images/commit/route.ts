import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { markNeedsReview } from "@/lib/test-review";
import { audit, clientIp } from "@/lib/audit";
import { OPTION_KEYS, DIFFICULTIES, CATEGORIES } from "@/lib/constants";

const rowSchema = z.object({
  text: z.string().trim().min(3).max(5000),
  options: z
    .array(z.object({ key: z.enum(OPTION_KEYS), text: z.string().trim().min(1).max(1000) }))
    .min(2)
    .max(OPTION_KEYS.length),
  correctOption: z.enum(OPTION_KEYS),
  difficulty: z.enum(DIFFICULTIES).default("MEDIUM"),
  classGroup: z.string().trim().max(200).nullable().optional(),
  category: z.enum(CATEGORIES).default("SYLLABUS"),
  imageUrl: z.string().trim().max(2000).nullable().optional(), // path OR url
});
const commitSchema = z.object({ questions: z.array(z.unknown()).min(1).max(5000) });

/**
 * Commit image-format questions: ALWAYS store each as a NEW bank question
 * (test: null) when not already present, AND add it to this test's pool.
 * Duplicates (same text within the center) are skipped — no duplicates allowed.
 */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);

  const parsed = await parseBody(req, commitSchema);
  if (parsed.error) return parsed.error;

  // Existing texts: bank (test:null) and this test pool.
  const [bankExisting, poolExisting] = await Promise.all([
    Question.find({ center: ctx.centerId, test: null }).select("text").lean(),
    Question.find({ center: ctx.centerId, test: id }).select("text").lean(),
  ]);
  const bankSet = new Set(bankExisting.map((q) => q.text.toLowerCase()));
  const poolSet = new Set(poolExisting.map((q) => q.text.toLowerCase()));
  const batchSeen = new Set<string>();

  const bankDocs: Record<string, unknown>[] = [];
  const poolDocs: Record<string, unknown>[] = [];
  let skipped = 0;
  const rejected: { index: number; error: string }[] = [];

  parsed.data.questions.forEach((q, i) => {
    const v = rowSchema.safeParse(q);
    if (!v.success) {
      rejected.push({ index: i, error: v.error.issues[0]?.message ?? "Invalid" });
      return;
    }
    const d = v.data;
    if (!d.options.some((o) => o.key === d.correctOption)) {
      rejected.push({ index: i, error: "Answer not among options" });
      return;
    }
    const key = d.text.toLowerCase();
    if (batchSeen.has(key)) {
      skipped++;
      return;
    }
    batchSeen.add(key);

    const common = {
      center: ctx.centerId,
      createdBy: ctx.user.id,
      text: d.text,
      options: d.options,
      correctOption: d.correctOption,
      difficulty: d.difficulty,
      class: test.targetClass,
      stream: test.targetClass >= 11 ? test.targetStream ?? null : null,
      category: d.category,
      classGroup: d.classGroup ?? null,
      imageUrl: d.imageUrl ?? null,
    };

    let isNew = false;
    if (!bankSet.has(key)) {
      // New questions reach the shared library only after admin approval of the test.
      bankSet.add(key);
      isNew = true;
    }
    if (!poolSet.has(key)) {
      poolDocs.push({ ...common, test: id }); // and add to this test's pool
      poolSet.add(key);
    } else {
      // already in the test pool
      if (!isNew) skipped++;
    }
  });

  if (bankDocs.length === 0 && poolDocs.length === 0) {
    return fail("All questions are duplicates — nothing new to import.", 422, { skipped, rejected });
  }

  const [bankIns, poolIns] = await Promise.all([
    bankDocs.length ? Question.insertMany(bankDocs, { ordered: false }) : [],
    poolDocs.length ? Question.insertMany(poolDocs, { ordered: false }) : [],
  ]);

  await markNeedsReview(id);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_QUESTIONS_IMAGE_IMPORTED",
    entityType: "Test",
    entityId: id,
    metadata: { addedToBank: bankIns.length, addedToTest: poolIns.length, skipped },
    ip: clientIp(req),
  });

  return ok(
    { addedToBank: (bankIns as unknown[]).length, addedToTest: (poolIns as unknown[]).length, skipped, rejected },
    201
  );
});
