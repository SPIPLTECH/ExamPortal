import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db";
import { ALCCenter } from "@/models/ALCCenter";
import { ok, handleRoute } from "@/lib/api";

/** Active centers for the registration dropdown, cached for 60s (tag: centers). */
const getActiveCenters = unstable_cache(
  async () => {
    await connectDB();
    const centers = await ALCCenter.find({ isActive: true })
      .select("name code city state")
      .sort({ name: 1 })
      .lean();
    return centers.map((c) => ({
      code: c.code,
      name: c.name,
      location: [c.city, c.state].filter(Boolean).join(", "),
    }));
  },
  ["public-active-centers"],
  { revalidate: 60, tags: ["centers"] }
);

export const GET = handleRoute(async () => {
  return ok({ items: await getActiveCenters() });
});
