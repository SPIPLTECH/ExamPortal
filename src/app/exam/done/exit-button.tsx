"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { logout } from "@/lib/logout";
import { Button } from "@/components/ui/button";

/** Close = end the student's session and go straight to the home page. */
export function ExitButton({ label = "Close" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void logout("/");
      }}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {label}
    </Button>
  );
}
