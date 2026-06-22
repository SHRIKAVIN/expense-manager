import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { useAuth } from "@/auth/AuthProvider";
import { WalletIcon } from "@/lib/icons";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: "Owner", label: "Owner", blurb: "Full access — manage everything." },
  { value: "Member", label: "Member", blurb: "Add & edit expenses, view budgets." },
  { value: "Viewer", label: "Viewer", blurb: "Read-only dashboards & insights." },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD"];

export function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [role, setRole] = useState<Role>("Owner");
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup({ email, passcode, displayName, role, currency });
      } else {
        await login(email, passcode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      {/* Inner min-h-full wrapper centers the card when it fits and lets the
          top scroll into view when the form is taller than the viewport. */}
      <div className="min-h-full flex items-center justify-center px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-14 w-14 rounded-md bg-primary text-on-primary flex items-center justify-center mb-5">
            <WalletIcon size={28} />
          </div>
          <h1 className="text-display-md text-ink">Expense Manager</h1>
          <p className="text-lead-airy text-ink-muted-48 mt-2">
            {mode === "signup" ? "Create your private workspace." : "Welcome back."}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {mode === "signup" && (
            <TextField
              label="Name"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Passcode"
            type="password"
            placeholder="At least 4 characters"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />

          {mode === "signup" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-caption-strong text-ink-muted-80">Role</span>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <Chip key={r.value} selected={role === r.value} onClick={() => setRole(r.value)}>
                      {r.label}
                    </Chip>
                  ))}
                </div>
                <p className="text-caption text-ink-muted-48">
                  {ROLES.find((r) => r.value === role)?.blurb}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-caption-strong text-ink-muted-80">Currency</span>
                <div className="flex flex-wrap gap-2">
                  {CURRENCIES.map((c) => (
                    <Chip key={c} selected={currency === c} onClick={() => setCurrency(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="text-caption text-ink-muted-48">{error}</p>}

          <Button variant="primary" fullWidth onClick={submit} disabled={busy}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
            className="text-body text-primary outline-none"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
