import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

/** Distraction-free exam shell — intentionally NOT the dashboard layout. */
export default async function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/");
  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
