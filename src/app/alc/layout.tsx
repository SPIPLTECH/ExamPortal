import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { ALCCenter } from "@/models/ALCCenter";
import { AppShell } from "@/components/app-shell";

export default async function AlcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ALC_CENTER") redirect("/");
  await connectDB();
  const center = user.centerId ? await ALCCenter.findById(user.centerId).select("name").lean() : null;
  return (
    <AppShell role="ALC_CENTER" user={{ name: center?.name ?? user.name, email: user.email, image: user.image }}>
      {children}
    </AppShell>
  );
}
