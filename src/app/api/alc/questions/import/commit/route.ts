import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";

const commitSchema = z.object({
  questions: z.array(z.unknown()).min(1, "No questions to import").max(2000),
});

/** Commit step: re-validate client-confirmed rows server-side and insert. */
export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

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
      class: d.class,
      classGroup: d.classGroup ?? null,
      category: d.category,
      stream: d.class >= 11 ? d.stream ?? null : null,
      explanation: d.explanation ?? null,
      center: ctx.centerId,
      createdBy: ctx.user.id,
    });
  });

  if (docs.length === 0) {
    return fail("No valid questions to import", 422, { rejected });
  }

  await connectDB();
  const inserted = await Question.insertMany(docs, { ordered: false });

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "QUESTIONS_IMPORTED",
    entityType: "Question",
    metadata: { count: inserted.length, rejected: rejected.length },
    ip: clientIp(req),
  });

  return ok({ inserted: inserted.length, rejected }, 201);
});
