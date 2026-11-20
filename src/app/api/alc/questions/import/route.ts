import { connectDB } from "@/lib/db";
import { Question } from "@/models/Question";
import { parseWorkbook } from "@/lib/excel";
import { requireAlcContext } from "@/lib/alc";
import { ok, fail, handleRoute } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;

/** Preview step: parse + validate the uploaded workbook, flag duplicates. */
export const POST = handleRoute(async (req: Request) => {
  const { error, ctx } = await requireAlcContext();
  if (error) return error;

  const formEntry = await req.formData();
  const file = formEntry.get("file");
  if (!file || !(file instanceof File)) return fail("No file uploaded", 400);
  if (file.size > MAX_BYTES) return fail("File too large (max 5 MB)", 400);
  if (!/\.xlsx?$/i.test(file.name)) return fail("Please upload an .xlsx file", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = await parseWorkbook(buffer);
  } catch (e) {
    return fail((e as Error).message || "Could not read the spreadsheet", 400);
  }
  if (rows.length === 0) return fail("No data rows found in the sheet", 400);

  // Duplicate detection against the center's existing repository.
  await connectDB();
  const texts = rows.filter((r) => r.valid && r.data).map((r) => r.data!.text);
  const existing = texts.length
    ? await Question.find({ center: ctx.centerId, text: { $in: texts } })
        .select("text")
        .lean()
    : [];
  const existingSet = new Set(existing.map((e) => e.text.toLowerCase()));

  const enriched = rows.map((r) => ({
    ...r,
    duplicate: r.valid && r.data ? existingSet.has(r.data.text.toLowerCase()) : false,
  }));

  const validCount = enriched.filter((r) => r.valid).length;
  const invalidCount = enriched.length - validCount;
  const duplicateCount = enriched.filter((r) => r.duplicate).length;

  return ok({
    rows: enriched,
    summary: { total: enriched.length, valid: validCount, invalid: invalidCount, duplicates: duplicateCount },
  });
});
