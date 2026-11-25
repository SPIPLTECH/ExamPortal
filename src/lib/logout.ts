"use client";

import { signOut } from "next-auth/react";

/**
 * Log out reliably: clear the session cookie, then do a FULL page load. A soft
 * client-side redirect can keep showing the old "logged in" page from the router cache /
 * stale session state.
 */
export async function logout(to: string = "/") {
  try {
    await signOut({ redirect: false });
  } catch {
    /* cookie is also cleared by the full reload below if the call failed */
  }
  window.location.replace(to);
}
