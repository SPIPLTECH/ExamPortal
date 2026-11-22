import { randomInt } from "crypto";
import { ALCCenter } from "@/models/ALCCenter";

// No 0/O/1/I/L so codes are easy to read out and type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a unique, human-friendly exam code like "K7QM-4TXZ" (stored without the dash). */
export async function generateExamCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) code += ALPHABET[randomInt(ALPHABET.length)];
    if (!(await ALCCenter.exists({ code }))) return code;
  }
  throw new Error("Could not generate a unique exam code");
}

/** Normalise whatever the student typed ("k7qm-4txz", " K7QM 4TXZ ") to the stored form. */
export function normalizeExamCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

/** Display form: K7QM-4TXZ */
export function formatExamCode(code: string): string {
  return /^[A-Z0-9]{8}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
