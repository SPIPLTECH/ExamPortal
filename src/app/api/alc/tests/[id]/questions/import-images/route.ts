import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { parseImageWorkbook } from "@/lib/excel";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, handleRoute } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;

/** Preview the image-format workbook; flag duplicates against the center's bank. */
export const POST = handleRoute(async (req: Request, ctxArg: unknown) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;
  const { id } = await (ctxArg as { params: Promise<{ id: string }> }).params;

  await connectDB();
  const test = await Test.findOne({ _id: id, center: ctx.centerId });
  if (!test) return fail("Test not found", 404);

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) return fail("No file uploaded", 400);
  if (file.size > MAX_BYTES) return fail("File too large (max 5 MB)", 400);
  if (!/\.xlsx?$/i.test(file.name)) return fail("Please upload an .xlsx file", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = await parseImageWorkbook(buffer);
  } catch (e) {
    return fail((e as Error).message || "Could not read the spreadsheet", 400);
  }
  if (rows.length === 0) return fail("No data rows found", 400);

  // Duplicate check against the center's existing questions (bank + this test).
  const texts = rows.filter((r) => r.valid && r.data).map((r) => r.data!.text);
  const existing = texts.length
    ? await Question.find({ center: ctx.centerId, text: { $in: texts } }).select("text").lean()
    : [];
  const existingSet = new Set(existing.map((e) => e.text.toLowerCase()));

  const enriched = rows.map((r) => ({
    ...r,
    duplicate: r.valid && r.data ? existingSet.has(r.data.text.toLowerCase()) : false,
  }));

  const validCount = enriched.filter((r) => r.valid).length;
  return ok({
    rows: enriched,
    summary: {
      total: enriched.length,
      valid: validCount,
      invalid: enriched.length - validCount,
      duplicates: enriched.filter((r) => r.duplicate).length,
    },
  });
});
