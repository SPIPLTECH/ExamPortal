import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { requireAlcContext } from "@/lib/alc";
import { objectIdSchema } from "@/lib/validations";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const schema = z.object({
  questionIds: z.array(objectIdSchema).min(1, "Select at least one question").max(1000),
});

/** Copy selected bank questions into this test's pool (test stays self-contained). */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);

  // Only copy bank questions (test: null) owned by this center.
  const bankQs = await Question.find({
    _id: { $in: parsed.data.questionIds },
    center: ctx.centerId,
    test: null,
  }).lean();

  if (bankQs.length === 0) return fail("No eligible bank questions selected", 400);

  const copies = bankQs.map((q) => ({
    center: ctx.centerId,
    test: id,
    createdBy: ctx.user.id,
    text: q.text,
    options: q.options,
    correctOption: q.correctOption,
    difficulty: q.difficulty,
    class: test.targetClass,
    stream: test.targetClass >= 11 ? test.targetStream ?? null : null,
    category: q.category,
    classGroup: q.classGroup ?? null,
    explanation: q.explanation ?? null,
    imageUrl: q.imageUrl ?? null,
  }));
  const inserted = await Question.insertMany(copies);

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "TEST_QUESTIONS_PICKED",
    entityType: "Test",
    entityId: id,
    metadata: { count: inserted.length },
    ip: clientIp(req),
  });

  return ok({ added: inserted.length }, 201);
});
