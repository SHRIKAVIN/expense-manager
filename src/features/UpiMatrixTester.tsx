/**
 * Throwaway diagnostic for UPI deep links. Mounted at /dev.
 *
 * Two previous attempts at UPI payments each changed one variable, shipped, and were
 * reverted within hours — never testing a matrix. This fires any combination of
 * app scheme x parameter set x launch method on a real device and records the outcome.
 *
 * The distinction that matters, and that neither previous attempt captured:
 *
 *   "Declined"      -> the app opened and refused. PSP risk policy. Not fixable here.
 *   "Didn't open"   -> the scheme is wrong. Fixable.
 *
 * Delete this file once a working variant is established (or once it is established
 * that none exists).
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthProvider";
import { getReimbursementPartner } from "@/auth/quickSwitch";
import { fetchPartnerPaymentInfo } from "@/payments/settlementsApi";
import { mobilePlatform } from "@/lib/platform";
import {
  DEFAULT_VARIANT,
  UPI_APP_LABELS,
  buildUpiUrl,
  describeVariant,
  generateTransactionId,
  launchUpi,
  type UpiApp,
  type UpiLaunchMethod,
  type UpiVariant,
} from "@/payments/upiLink";

type Outcome = "worked" | "declined" | "no-open";

interface Pending {
  variant: UpiVariant;
  url: string;
  at: number;
}

interface Result {
  variant: string;
  url: string;
  outcome: Outcome;
  at: number;
}

const PENDING_KEY = "upi-matrix-pending";
const RESULTS_KEY = "upi-matrix-results";
const INPUTS_KEY = "upi-matrix-inputs";

const APPS: UpiApp[] = ["gpay", "phonepe", "phonepe_upi", "paytm", "bhim", "generic"];
const LAUNCHES: UpiLaunchMethod[] = ["location", "open", "anchor"];

const OUTCOME_LABELS: Record<Outcome, string> = {
  worked: "Worked",
  declined: "Declined",
  "no-open": "Didn't open",
};

/** Two taps per test: pick a preset, hit Launch. */
const PRESETS: { label: string; variant: Partial<UpiVariant> }[] = [
  { label: "GPay full", variant: { app: "gpay" } },
  { label: "GPay no-amount", variant: { app: "gpay", includeAmount: false } },
  { label: "GPay bare", variant: { app: "gpay", includeTr: false, includeTn: false } },
  { label: "PhonePe full", variant: { app: "phonepe" } },
  { label: "PhonePe /upi/pay", variant: { app: "phonepe_upi" } },
  { label: "PhonePe no-amount", variant: { app: "phonepe", includeAmount: false } },
  { label: "Generic full", variant: { app: "generic" } },
  { label: "Generic +mc +mode", variant: { app: "generic", includeMc: true, includeMode: true } },
  { label: "BHIM full", variant: { app: "bhim" } },
  { label: "Paytm full", variant: { app: "paytm" } },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function UpiMatrixTester() {
  const { show } = useToast();
  const { user } = useAuth();
  const [vpa, setVpa] = useState("");
  const [amount, setAmount] = useState("1");
  const [variant, setVariant] = useState<UpiVariant>(DEFAULT_VARIANT);
  const [pending, setPending] = useState<Pending | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  // Restore inputs, pending launch and results. Pending must come from storage:
  // iOS routinely tears the page down during an app switch.
  useEffect(() => {
    const saved = readJson<{ vpa?: string; amount?: string }>(INPUTS_KEY, {});
    if (saved.vpa) setVpa(saved.vpa);
    if (saved.amount) setAmount(saved.amount);
    setPending(readJson<Pending | null>(PENDING_KEY, null));
    setResults(readJson<Result[]>(RESULTS_KEY, []));
  }, []);

  // Prefill the payee from the reimbursement partner, if they have a VPA set.
  useEffect(() => {
    if (!user?.email) return;
    const partnerEmail = getReimbursementPartner(user.email)?.email;
    if (!partnerEmail) return;
    let cancelled = false;
    void fetchPartnerPaymentInfo(partnerEmail).then((info) => {
      if (cancelled || !info?.upiId) return;
      setVpa((current) => current || info.upiId!);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const ready = vpa.trim().length > 2 && amountValid;

  const url = ready
    ? buildUpiUrl(
        {
          upiId: vpa.trim(),
          payeeName: "Test Payee",
          transactionNote: "UPI matrix test",
          amount: amountNum,
          transactionId: generateTransactionId(),
        },
        variant,
      )
    : "";

  // Synchronous by design — see the gesture rule in upiLink.ts. localStorage writes
  // are sync, so recording the attempt first does not break the user gesture.
  const launch = () => {
    if (!ready) return;
    writeJson(INPUTS_KEY, { vpa: vpa.trim(), amount });
    const record: Pending = { variant, url, at: Date.now() };
    writeJson(PENDING_KEY, record);
    setPending(record);
    launchUpi(url, variant.launch);
  };

  const record = (outcome: Outcome) => {
    if (!pending) return;
    const next: Result[] = [
      { variant: describeVariant(pending.variant), url: pending.url, outcome, at: Date.now() },
      ...results,
    ];
    setResults(next);
    writeJson(RESULTS_KEY, next);
    localStorage.removeItem(PENDING_KEY);
    setPending(null);
  };

  const copyResults = () => {
    const text = results
      .map((r) => `${OUTCOME_LABELS[r.outcome].padEnd(11)} | ${r.variant}\n              ${r.url}`)
      .join("\n");
    void navigator.clipboard
      .writeText(text || "(no results)")
      .then(() => show("Results copied"))
      .catch(() => show("Could not copy"));
  };

  const clearResults = () => {
    setResults([]);
    localStorage.removeItem(RESULTS_KEY);
    localStorage.removeItem(PENDING_KEY);
    setPending(null);
  };

  const set = (patch: Partial<UpiVariant>) => setVariant((v) => ({ ...v, ...patch }));
  const toggle = (key: keyof UpiVariant) =>
    setVariant((v) => ({ ...v, [key]: !v[key] }) as UpiVariant);

  return (
    <Card data-testid="upi-matrix">
      <p className="text-tagline text-ink mb-1">UPI deep-link matrix</p>
      <p className="text-caption text-ink-muted-48 mb-4">
        Platform: <span className="text-ink">{mobilePlatform()}</span> · test with ₹1 against a
        real VPA. Record whether the app <em>declined</em> or never <em>opened</em> — they mean
        very different things.
      </p>

      {pending && (
        <div className="mb-4 rounded-md border border-primary/25 bg-primary/10 px-4 py-3">
          <p className="text-caption-strong text-ink">What happened?</p>
          <p className="text-caption text-ink-muted-48 mt-0.5 break-all">
            {describeVariant(pending.variant)}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
              <Button
                key={o}
                variant="secondary"
                className="px-3 py-1.5"
                data-testid={`upi-matrix-outcome-${o}`}
                onClick={() => record(o)}
              >
                {OUTCOME_LABELS[o]}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <TextField
          label="Payee VPA"
          value={vpa}
          onChange={(e) => setVpa(e.target.value)}
          placeholder="someone@okaxis"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-testid="upi-matrix-vpa"
        />
        <TextField
          label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          data-testid="upi-matrix-amount"
          error={amount.trim() && !amountValid ? "Enter a positive number" : undefined}
        />

        <div>
          <p className="text-caption-strong text-ink-muted-80 mb-2">Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip
                key={p.label}
                onClick={() => setVariant({ ...DEFAULT_VARIANT, ...p.variant })}
                selected={false}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-caption-strong text-ink-muted-80 mb-2">App scheme</p>
          <div className="flex flex-wrap gap-2">
            {APPS.map((a) => (
              <Chip key={a} selected={variant.app === a} onClick={() => set({ app: a })}>
                {UPI_APP_LABELS[a]}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-caption-strong text-ink-muted-80 mb-2">Parameters</p>
          <div className="flex flex-wrap gap-2">
            <Chip selected={variant.includeAmount} onClick={() => toggle("includeAmount")}>
              am
            </Chip>
            <Chip selected={variant.includeTr} onClick={() => toggle("includeTr")}>
              tr
            </Chip>
            <Chip selected={variant.includeTn} onClick={() => toggle("includeTn")}>
              tn
            </Chip>
            <Chip selected={variant.includeMc} onClick={() => toggle("includeMc")}>
              mc
            </Chip>
            <Chip selected={variant.includeMode} onClick={() => toggle("includeMode")}>
              mode=04
            </Chip>
          </div>
        </div>

        <div>
          <p className="text-caption-strong text-ink-muted-80 mb-2">Launch method</p>
          <div className="flex flex-wrap gap-2">
            {LAUNCHES.map((l) => (
              <Chip key={l} selected={variant.launch === l} onClick={() => set({ launch: l })}>
                {l}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-hairline bg-canvas-parchment px-3 py-2">
          <p className="text-fine-print text-ink-muted-48 mb-1">URL</p>
          <p className="text-fine-print text-ink break-all font-mono">
            {url || "Enter a VPA and amount"}
          </p>
        </div>

        <Button
          variant="primary"
          fullWidth
          disabled={!ready}
          data-testid="upi-matrix-launch"
          onClick={launch}
        >
          Launch {UPI_APP_LABELS[variant.app]}
        </Button>

        {results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-caption-strong text-ink-muted-80">Results ({results.length})</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="px-3 py-1.5" onClick={copyResults}>
                  Copy
                </Button>
                <Button variant="secondary" className="px-3 py-1.5" onClick={clearResults}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {results.map((r) => (
                <div
                  key={r.at}
                  className="rounded-md border border-hairline px-3 py-2 flex items-start gap-2"
                >
                  <span className="text-caption-strong text-ink shrink-0">
                    {r.outcome === "worked" ? "✓" : r.outcome === "declined" ? "✗" : "—"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-caption text-ink break-all">{r.variant}</p>
                    <p className="text-fine-print text-ink-muted-48">
                      {OUTCOME_LABELS[r.outcome]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
