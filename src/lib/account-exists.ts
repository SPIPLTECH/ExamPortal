import { User } from "@/models/User";
import type { ContactType } from "@/lib/contact";

/** Does a student account already exist for this (verified) email / mobile? */
export async function accountExistsFor(type: ContactType, contact: string): Promise<boolean> {
  return !!(await User.exists({ role: "STUDENT", ...(type === "EMAIL" ? { email: contact } : { mobile: contact }) }));
}
