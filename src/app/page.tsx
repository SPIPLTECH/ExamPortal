import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  switch (session.user.role) {
    case "SUPER_ADMIN":
      redirect("/admin");
    case "ALC_CENTER":
      redirect("/alc");
    case "STUDENT":
    default:
      redirect("/student");
  }
}
