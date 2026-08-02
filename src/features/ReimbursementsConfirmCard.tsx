import { useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { SwipeDeck } from "@/components/SwipeDeck";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import type { ReimbursementRequest } from "@/lib/types";

export function ReimbursementsConfirmCard({ currency }: { currency: string }) {
  const { reimbursementsToConfirm, confirmReimbursement, rejectReimbursementPaid, can } =
    useAppData();
  const { show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    amountLabel: string;
    detail: string;
  } | null>(null);
  const confirmingRef = useRef(false);

  if (reimbursementsToConfirm.length === 0 && !celebration) return null;

  const totalPending = reimbursementsToConfirm.reduce((sum, req) => sum + req.amount, 0);

  const confirmMany = async (toConfirm: ReimbursementRequest[]) => {
    if (confirmingRef.current || toConfirm.length === 0) return;

    const stillPending = reimbursementsToConfirm.filter((r) =>
      toConfirm.some((t) => t.id === r.id),
    );
    if (stillPending.length === 0) {
      show("Those reimbursements are no longer pending");
      return;
    }

    confirmingRef.current = true;
    setBusyId(stillPending.length > 1 ? "all" : stillPending[0]!.id);
    try {
      for (const req of stillPending) {
        await confirmReimbursement(req.id);
      }
      const total = stillPending.reduce((s, r) => s + r.amount, 0);
      const name = stillPending[0]?.payerName ?? "partner";
      setCelebration({
        amountLabel: formatCurrency(total, currency),
        detail:
          stillPending.length > 1
            ? `Confirmed ${stillPending.length} refunds — expenses moved to ${name}`
            : `Expense moved to ${name}'s account`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not confirm reimbursement");
    } finally {
      confirmingRef.current = false;
      setBusyId(null);
    }
  };

  const handleReject = async (id: string, payerName: string) => {
    setBusyId(id);
    try {
      await rejectReimbursementPaid(id);
      show(`${payerName} will be asked to pay again`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not update reimbursement");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {reimbursementsToConfirm.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-confirm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-tagline text-ink">Confirm reimbursement</p>
              <p className="text-caption text-ink-muted-48 mt-1">
                {reimbursementsToConfirm.length > 1
                  ? "Swipe to browse · confirm only if you received the money"
                  : "Confirm only if you received the money — the expense will move to their account"}
              </p>
            </div>
            {reimbursementsToConfirm.length > 1 && (
              <p className="text-body-strong text-primary tabular-nums shrink-0 pt-0.5">
                {formatCurrency(totalPending, currency)}
              </p>
            )}
          </div>

          {reimbursementsToConfirm.length > 1 && can.writeExpenses && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-primary/25 bg-primary/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-caption-strong text-ink">Received everything</p>
                <p className="text-caption text-ink-muted-48 mt-0.5">
                  {reimbursementsToConfirm.length} refunds ·{" "}
                  {formatCurrency(totalPending, currency)}
                </p>
              </div>
              <Button
                variant="primary"
                className="shrink-0 px-4 py-2"
                disabled={busyId === "all"}
                data-testid="reimbursement-receive-all"
                onClick={() => void confirmMany([...reimbursementsToConfirm])}
              >
                {busyId === "all" ? "Confirming…" : "Received All"}
              </Button>
            </div>
          )}

          <SwipeDeck
            items={reimbursementsToConfirm}
            getKey={(req) => req.id}
            label="Reimbursements to confirm"
          >
            {(req) => (
              <div
                className="flex h-full flex-col gap-3 rounded-md border border-hairline bg-canvas-parchment px-4 py-4 sm:flex-row sm:items-center"
                data-testid={`reimbursement-confirm-${req.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong text-ink truncate">{req.merchant}</p>
                  <p className="text-caption text-ink-muted-48 mt-0.5">
                    {req.payerName} says paid
                  </p>
                  <p className="text-tagline text-primary tabular-nums mt-1">
                    {formatCurrency(req.amount, currency)}
                  </p>
                </div>
                {can.writeExpenses && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      className="px-4 py-2"
                      disabled={busyId === req.id || busyId === "all"}
                      data-testid={`reimbursement-reject-${req.id}`}
                      onClick={() => void handleReject(req.id, req.payerName)}
                    >
                      Not yet
                    </Button>
                    <Button
                      variant="primary"
                      className="px-4 py-2"
                      disabled={busyId === req.id || busyId === "all"}
                      data-testid={`reimbursement-confirm-yes-${req.id}`}
                      onClick={() => void confirmMany([req])}
                    >
                      {busyId === req.id ? "Confirming…" : "Yes, received"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SwipeDeck>
        </Card>
      ) : null}
      <SuccessOverlay
        open={Boolean(celebration)}
        amountLabel={celebration?.amountLabel ?? ""}
        detail={celebration?.detail}
        variant="reimbursement_received"
        onClose={() => setCelebration(null)}
      />
    </>
  );
}
