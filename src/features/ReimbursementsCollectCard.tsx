import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { notifyPartnerPaymentRequested } from "@/lib/partnerNotify";
import { PaymentService } from "@/payments/PaymentService";
import type { ReimbursementRequest } from "@/lib/types";

export function ReimbursementsCollectCard({ currency }: { currency: string }) {
  const { user } = useAuth();
  const { reimbursementsAwaitingCollection, can } = useAppData();
  const { show } = useToast();
  const [active, setActive] = useState<ReimbursementRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [collectUri, setCollectUri] = useState<string | null>(null);

  if (reimbursementsAwaitingCollection.length === 0 && !active) return null;

  const ownUpi = user?.upiId?.trim();

  const openRequest = async (req: ReimbursementRequest) => {
    if (!user) return;
    if (!ownUpi) {
      show("Add your UPI ID in Settings first");
      return;
    }
    try {
      const intent = await PaymentService.createIntent({
        payeeUpi: ownUpi,
        payeeName: user.displayName || user.email,
        amount: req.amount,
        currency,
        note: `Settle ${req.merchant}`,
      });
      setCollectUri(intent.uri);
      setActive(req);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not build payment link");
    }
  };

  const notify = async () => {
    if (!user || !active) return;
    setBusy(true);
    try {
      await notifyPartnerPaymentRequested(user, active);
      show("Payment request sent to your partner");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not notify partner");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!collectUri) return;
    try {
      await navigator.clipboard.writeText(collectUri);
      show("UPI link copied");
    } catch {
      show("Could not copy — long-press to select the link");
    }
  };

  const shareLink = async () => {
    if (!collectUri || !active) return;
    const text = `Please pay ${formatCurrency(active.amount, currency)} for ${active.merchant} via UPI:\n${collectUri}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Payment request", text });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    await copyLink();
  };

  return (
    <>
      {reimbursementsAwaitingCollection.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-collect">
          <div>
            <p className="text-tagline text-ink">Waiting to be paid</p>
            <p className="text-caption text-ink-muted-48 mt-1">
              Request Payment notifies your partner and lets you share a UPI collect link.
            </p>
            {!ownUpi && (
              <p className="text-caption text-ink-muted-48 mt-1">
                Add your UPI ID in Settings to enable Request Payment.
              </p>
            )}
          </div>
          {reimbursementsAwaitingCollection.map((req) => (
            <div
              key={req.id}
              className="flex flex-col gap-2 rounded-md border border-hairline bg-canvas-parchment px-4 py-3 sm:flex-row sm:items-center"
              data-testid={`reimbursement-collect-${req.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-strong text-ink truncate">{req.merchant}</p>
                <p className="text-caption text-ink-muted-48">
                  {req.payerName} owes · {formatCurrency(req.amount, currency)}
                </p>
              </div>
              {can.writeExpenses && (
                <Button
                  variant="secondary"
                  className="shrink-0 px-4 py-2"
                  disabled={!ownUpi}
                  data-testid={`reimbursement-request-payment-${req.id}`}
                  onClick={() => void openRequest(req)}
                >
                  Request Payment
                </Button>
              )}
            </div>
          ))}
        </Card>
      ) : null}

      <Sheet
        open={Boolean(active)}
        onClose={() => {
          setActive(null);
          setCollectUri(null);
        }}
        title="Request Payment"
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              disabled={busy}
              onClick={() => void notify()}
              data-testid="request-payment-notify"
            >
              Notify partner
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => void copyLink()}>
                Copy link
              </Button>
              <Button variant="secondary" fullWidth onClick={() => void shareLink()}>
                Share
              </Button>
            </div>
          </div>
        }
      >
        {active && (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink">
              Collect {formatCurrency(active.amount, currency)} for {active.merchant} using your UPI
              ID.
            </p>
            {collectUri && (
              <p className="text-caption text-ink-muted-48 break-all select-all">{collectUri}</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
