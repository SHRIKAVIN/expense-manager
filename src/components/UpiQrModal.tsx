import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/Button";
import { formatCurrency } from "@/lib/format";

export interface UpiQrModalProps {
  open: boolean;
  /** Full `upi://pay?…` URI to encode. */
  upiUri: string;
  upiId: string;
  payeeName: string;
  amount: number;
  currency: string;
  onClose: () => void;
}

/**
 * QR fail-safe for when the UPI app switch doesn't happen or gets declined.
 * Scanning a QR is a first-class UPI flow that works with personal VPAs, so
 * this is the path that completes when an intent launch won't.
 */
export function UpiQrModal({
  open,
  upiUri,
  upiId,
  payeeName,
  amount,
  currency,
  onClose,
}: UpiQrModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !upiUri) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(upiUri, { width: 320, errorCorrectionLevel: "M", margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, upiUri]);

  if (!open) return null;

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the id is on screen either way */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-surface-pearl rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
        <div>
          <p className="text-body-strong text-ink">Scan to pay {payeeName}</p>
          <p className="text-caption text-ink-muted-48 mt-1">
            Open any UPI app and scan this code, or copy the ID below.
          </p>
        </div>

        <div className="flex justify-center">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`UPI QR code to pay ${formatCurrency(amount, currency)} to ${payeeName}`}
              className="w-56 h-56 rounded-md bg-white p-2"
              data-testid="upi-qr-image"
            />
          ) : (
            <div className="w-56 h-56 rounded-md border border-hairline flex items-center justify-center">
              <p className="text-caption text-ink-muted-48">Generating…</p>
            </div>
          )}
        </div>

        <div className="bg-surface-pearl-high rounded-md p-4 border border-primary/25">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body text-ink">To: {payeeName}</p>
            <p className="text-body-strong text-primary tabular-nums">
              {formatCurrency(amount, currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyUpiId()}
            className="flex w-full items-center justify-between gap-2 mt-3 pt-3 border-t border-hairline text-left"
            data-testid="upi-qr-copy-id"
          >
            <span className="text-caption text-ink truncate">{upiId}</span>
            <span className="text-caption-strong text-primary shrink-0">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        </div>

        <Button variant="secondary" onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    </div>
  );
}
