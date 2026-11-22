/** Contact normalisation shared by OTP + registration so "+91 98765-43210" and "9876543210" are the same person. */
export type ContactType = "MOBILE" | "EMAIL";

export function normalizeMobile(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}
export const isValidMobile = (m: string) => /^[6-9]\d{9}$/.test(m);
export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 255;

export function normalizeContact(type: ContactType, value: string): string {
  return type === "MOBILE" ? normalizeMobile(value) : normalizeEmail(value);
}
export function isValidContact(type: ContactType, value: string): boolean {
  return type === "MOBILE" ? isValidMobile(value) : isValidEmail(value);
}
