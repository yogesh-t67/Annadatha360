/**
 * Same rules as the backend (app/modules/iam/service.py → password_strength), so the meter matches what the
 * server will accept. The server has the final say.
 *
 * Any 8+ characters are allowed (no mix of letter kinds needed), except the passwords attackers try first.
 */

const COMMON_WORDS = new Set([
  "password", "passw", "pass", "qwerty", "qwertyuiop", "asdf", "admin", "administrator", "welcome", "letmein",
  "iloveyou", "abc", "abcd", "abcdef", "test", "user", "login", "india", "bharat", "annadata", "kisan", "farmer",
  "vendor",
]);

export type Strength = "empty" | "weak" | "medium" | "strong";

/** '12345678', '87654321', 'abcdefgh', 'qwertyui' style runs. */
function isRun(text: string): boolean {
  if (text.length < 4) return false;
  const steps = new Set<number>();
  for (let i = 1; i < text.length; i++) steps.add(text.charCodeAt(i) - text.charCodeAt(i - 1));
  const counting = steps.size === 1 && (steps.has(1) || steps.has(-1));
  return counting || "qwertyuiopasdfghjklzxcvbnm".includes(text) || "1234567890".includes(text);
}

export function passwordStrength(password: string, email = ""): { strength: Strength; missing: string[] } {
  if (!password) return { strength: "empty", missing: [] };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const lower = password.toLowerCase();
  const missing: string[] = [];
  if (password.length < 8) missing.push("at least 8 characters");
  if (new Set(lower).size < 4) missing.push("more different characters");
  const letters = lower.replace(/[^a-z]/g, "");
  if (COMMON_WORDS.has(letters) || isRun(lower)) missing.push("not a common password");
  else if (/^\d+$/.test(lower)) missing.push("not only numbers (like a phone number or date)");
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) missing.push("not your email name");
  if (missing.length) return { strength: "weak", missing };
  return { strength: password.length >= 12 || kinds >= 3 ? "strong" : "medium", missing: [] };
}
