import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { markNeedsReview } from "@/lib/test-review";
import { audit, clientIp } from "@/lib/audit";

const commitSchema = z.object({
  questions: z.array(z.unknown()).min(1, "No questions to import").max(5000),
});

/** Commit step: re-validate confirmed rows and insert into THIS test's pool. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);

  const parsed = await parseBody(req, commitSchema);
  if (parsed.error) return parsed.error;

  const docs: Record<string, unknown>[] = [];
  const rejected: { index: number; error: string }[] = [];

  parsed.data.questions.forEach((q, i) => {
    const v = questionSchema.safeParse(q);
    if (!v.success) {
      rejected.push({ index: i, error: v.error.issues[0]?.message ?? "Invalid" });
      return;
    }
    const d = v.data;
    docs.push({
      text: d.text,
      options: d.options,
      correctOption: d.correctOption,
      difficulty: d.difficulty,
      class: test.targetClass,
      stream: test.targetClass >= 11 ? test.targetStream ?? null : null,
      category: d.category,
      classGroup: d.classGroup ?? null,
      explanation: d.explanation ?? null,
      imageUrl: d.imageUrl ?? null,
      center: ctx.centerId,
      test: id,
      createdBy: ctx.user.id,
    });
  });

  if (docs.length === 0) return fail("No valid questions to import", 422, { rejected });

  const inserted = await Question.insertMany(docs, { ordered: false });

  await markNeedsReview(id);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_QUESTIONS_IMPORTED",
    entityType: "Test",
    entityId: id,
    metadata: { count: inserted.length, rejected: rejected.length },
    ip: clientIp(req),
  });

  return ok({ inserted: inserted.length, rejected }, 201);
});
