/**
 * Same rules as the backend (app/modules/iam/service.py → password_strength), so the meter matches what the
 * server will accept. The server has the final say.
 */

const COMMON_WORDS = new Set([
  "password", "passw", "pass", "qwerty", "qwertyuiop", "asdf", "admin", "administrator", "welcome", "letmein",
  "iloveyou", "abc", "abcd", "abcdef", "test", "user", "login", "india", "bharat", "annadata", "kisan", "farmer",
  "vendor",
]);

export type Strength = "empty" | "weak" | "medium" | "strong";

export function passwordStrength(password: string, email = ""): { strength: Strength; missing: string[] } {
  if (!password) return { strength: "empty", missing: [] };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const lower = password.toLowerCase();
  const missing: string[] = [];
  if (password.length < 8) missing.push("at least 8 characters");
  if (kinds < 2 || (kinds < 3 && password.length < 12)) missing.push("a mix of small letters, capitals, numbers and symbols");
  if (new Set(password).size < 5) missing.push("more different characters");
  const letters = lower.replace(/[^a-z]/g, "");
  if (COMMON_WORDS.has(letters) || /^\d+$/.test(lower)) missing.push("not a common password");
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) missing.push("not your email name");
  if (missing.length) return { strength: "weak", missing };
  return { strength: password.length >= 12 && kinds >= 3 ? "strong" : "medium", missing: [] };
}
