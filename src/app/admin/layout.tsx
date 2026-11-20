import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/");
  return (
    <AppShell role="SUPER_ADMIN" user={{ name: user.name, email: user.email, image: user.image }}>
      {children}
    </AppShell>
  );
}
