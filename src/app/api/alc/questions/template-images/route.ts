import { buildImageTemplate } from "@/lib/excel";
import { requireAlcContext } from "@/lib/alc";
import { handleRoute } from "@/lib/api";

export const GET = handleRoute(async () => {
  const { error } = await requireAlcContext();
  if (error) return error;
  const buf = await buildImageTemplate();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="question-image-import-template.xlsx"',
    },
  });
});
