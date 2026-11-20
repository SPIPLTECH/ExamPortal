interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = checks.filter((c) => c.met).length;
  const strengthLabel =
    metCount === 0
      ? ""
      : metCount <= 2
        ? "Weak"
        : metCount <= 4
          ? "Medium"
          : "Strong";
  const strengthColor =
    metCount <= 2
      ? "bg-red-500"
      : metCount <= 4
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="mt-2 space-y-2">
      {password.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${strengthColor}`}
              style={{ width: `${(metCount / 5) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{strengthLabel}</span>
        </div>
      )}
      <div className="space-y-1">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={check.met ? "text-green-500" : "text-gray-400"}>
              {check.met ? "\u2713" : "\u25CB"}
            </span>
            <span className={check.met ? "text-green-600" : "text-gray-500"}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
