import { redirect } from "next/navigation";
import { getSessionUser, getStudentProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/");
  const profile = await getStudentProfile(user.id);
  const bannerSubtitle = profile
    ? `Class ${profile.class}${profile.stream ? ` · ${profile.stream}` : ""} · ${profile.schoolName}`
    : "Student dashboard";
  return (
    <AppShell
      role="STUDENT"
      user={{ name: user.name, email: user.email, image: user.image }}
      bannerSubtitle={bannerSubtitle}
    >
      {children}
    </AppShell>
  );
}