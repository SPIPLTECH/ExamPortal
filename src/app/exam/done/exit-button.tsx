"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function ExitButton() {
  return <Button onClick={() => signOut({ callbackUrl: "/" })}>Finish &amp; exit</Button>;
}
