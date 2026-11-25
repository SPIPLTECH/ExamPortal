import bcrypt from "bcryptjs";

const ROUNDS = 10; // bcryptjs is pure JS and blocks the event loop; 10 is still strong and ~4x faster

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
