import { connectDB } from "@/lib/db";
import { MSCITEnquiry } from "@/models/MSCITEnquiry";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { ok, handleRoute } from "@/lib/api";

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = ["name", "mobile", "email", "class", "school", "center", "status", "date"];
  if (rows.length === 0) return headers.join(",") + "\n";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export const GET = handleRoute(async (req: Request) => {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const format = url.searchParams.get("format");

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  await connectDB();
  const items = await MSCITEnquiry.find(filter).populate<{ center: { name: string; code: string } | null }>("center", "name code").sort({ createdAt: -1 }).limit(2000).lean();

  if (format === "csv") {
    const csv = toCsv(
      items.map((e) => ({
        name: e.name,
        mobile: e.mobile ?? (e.email ? "" : e.contact),
        email: e.email ?? "",
        class: e.class,
        school: e.school,
        center: (e.center as { name?: string } | null)?.name ?? "",
        status: e.status,
        date: e.createdAt?.toISOString?.() ?? "",
      }))
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="mscit-enquiries.csv"',
      },
    });
  }

  return ok({
    items: items.map((e) => ({
      _id: String(e._id),
      name: e.name,
      mobile: e.mobile ?? null,
      email: e.email ?? null,
      contact: e.contact,
      class: e.class,
      school: e.school,
      center: (e.center as { name?: string } | null)?.name ?? null,
      interested: e.interested,
      status: e.status,
      followUps: e.followUps,
      createdAt: e.createdAt,
    })),
  });
});
