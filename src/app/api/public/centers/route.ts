import { connectDB } from "@/lib/db";
import { ALCCenter } from "@/models/ALCCenter";
import { ok, handleRoute } from "@/lib/api";

/** Public: active ALC centers for the registration dropdown. */
export const GET = handleRoute(async () => {
  await connectDB();
  const centers = await ALCCenter.find({ isActive: true })
    .select("name code city state")
    .sort({ name: 1 })
    .lean();

  return ok({
    items: centers.map((c) => ({
      code: c.code,
      name: c.name,
      location: [c.city, c.state].filter(Boolean).join(", "),
    })),
  });
});
