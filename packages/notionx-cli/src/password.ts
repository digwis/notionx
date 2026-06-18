import * as crypto from "node:crypto";

/** Generate a 14-char password with letters + digits, easy to copy. */
export function generateRandomPassword(): string {
  // Avoid 0/O/1/l/I for readability; pick from a friendly alphabet.
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const bytes = crypto.randomBytes(14);
  let out = "";
  // Guarantee at least one letter and one digit.
  out += letters[bytes[0] % letters.length];
  out += digits[bytes[1] % digits.length];
  for (let i = 2; i < 14; i++) {
    out += all[bytes[i] % all.length];
  }
  return out;
}
