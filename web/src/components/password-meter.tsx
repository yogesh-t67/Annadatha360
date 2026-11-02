import clsx from "clsx";

import { passwordStrength } from "@/lib/password";

const LEVELS = {
  weak: { label: "Weak (not allowed)", bars: 1, cls: "bg-danger", text: "text-danger" },
  medium: { label: "Medium", bars: 2, cls: "bg-warning", text: "text-warning" },
  strong: { label: "Strong", bars: 3, cls: "bg-success", text: "text-success" },
};

/** Live strength meter under a new-password field. */
export function PasswordMeter({ password, email }: { password: string; email?: string }) {
  const { strength, missing } = passwordStrength(password, email);
  if (strength === "empty") {
    return <p className="text-sm text-muted">At least 8 characters. A short phrase you can remember works well.</p>;
  }
  const level = LEVELS[strength];
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={clsx("h-1.5 flex-1 rounded-full", i <= level.bars ? level.cls : "bg-line")} />
        ))}
      </div>
      <p className={clsx("text-sm font-medium", level.text)}>{level.label}</p>
      {missing.length > 0 && <p className="text-sm text-muted">Needs: {missing.join("; ")}.</p>}
    </div>
  );
}

export function isAllowed(password: string, email?: string) {
  const { strength } = passwordStrength(password, email);
  return strength === "medium" || strength === "strong";
}
