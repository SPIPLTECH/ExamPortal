import { redirect } from "next/navigation";

/** Students no longer have a dashboard: everything lives on the entry form and the exam. */
export default function StudentLayout() {
  redirect("/exam/done");
}
