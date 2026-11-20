import { connectDB } from "@/lib/db";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/validations";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, parseBody, handleRoute } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import type { FilterQuery } from "mongoose";
import type { IQuestion } from "@/models/Question";

export const GET = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const search = url.searchParams.get("search")?.trim();
  const cls = url.searchParams.get("class");
  const difficulty = url.searchParams.get("difficulty");
  const category = url.searchParams.get("category");
  const stream = url.searchParams.get("stream");

  // The shared bank excludes questions that belong to a specific test's pool.
  const filter: FilterQuery<IQuestion> = { center: ctx.centerId, test: null };
  if (cls) filter.class = Number(cls);
  if (difficulty) filter.difficulty = difficulty;
  if (category) filter.category = category;
  if (stream) filter.stream = stream;
  if (search) filter.text = { $regex: search, $options: "i" };

  await connectDB();
  const [items, total] = await Promise.all([
    Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Question.countDocuments(filter),
  ]);

  return ok({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const parsed = await parseBody(req, questionSchema);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  await connectDB();
  const q = await Question.create({
    ...d,
    stream: d.class >= 11 ? d.stream ?? null : null,
    center: ctx.centerId,
    createdBy: ctx.user.id,
  });

  await audit({
    actorId: ctx.user.id,
    actorRole: "ALC_CENTER",
    action: "QUESTION_CREATED",
    entityType: "Question",
    entityId: q._id.toString(),
    ip: clientIp(req),
  });

  return ok({ id: q._id.toString() }, 201);
});
