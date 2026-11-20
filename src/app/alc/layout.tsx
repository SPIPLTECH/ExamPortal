import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function AlcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ALC_CENTER") redirect("/");
  return (
    <AppShell role="ALC_CENTER" user={{ name: user.name, email: user.email, image: user.image }}>
      {children}
    </AppShell>
  );
}
