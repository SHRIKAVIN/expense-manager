import { UPI_CHECKOUT_APPS, type UpiCheckoutApp } from "@/payments/upiCheckoutLinks";
import type { CheckoutPhase } from "@/payments/useUpiVerifiedCheckout";

type Props = {
  disabled?: boolean;
  phase: CheckoutPhase;
  onSelect: (app: UpiCheckoutApp) => void;
};

/** App-icon deep-link checkout grid (iOS / PWA). */
export function UpiCheckoutIcons({ disabled, phase, onSelect }: Props) {
  const busy = phase === "creating" || phase === "launching" || phase === "verifying";

  return (
    <div className="relative" data-testid="upi-checkout-icons">
      {(busy || phase === "awaiting_return") && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-canvas/80 backdrop-blur-[2px]"
          data-testid="upi-checkout-mask"
        >
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-caption text-ink-muted-48 text-center px-4">
            {phase === "creating"
              ? "Registering payment…"
              : phase === "verifying"
                ? "Confirming with bank…"
                : "Opening UPI app…"}
          </p>
        </div>
      )}

      <p className="text-caption-strong text-ink mb-3">Choose a UPI app</p>
      <div className="grid grid-cols-4 gap-3">
        {UPI_CHECKOUT_APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            data-testid={`upi-app-${app.id}`}
            disabled={disabled || busy}
            className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-canvas px-2 py-3 active:scale-95 transition-transform disabled:opacity-50"
            onClick={() => onSelect(app.id)}
          >
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white border border-hairline">
              <img
                src={app.logo}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-contain p-1"
                draggable={false}
              />
            </span>
            <span className="text-caption text-ink text-center leading-tight">{app.shortLabel}</span>
          </button>
        ))}
      </div>
      <p className="text-caption text-ink-muted-48 mt-4 text-center">
        Opens the app on your phone. If it isn&apos;t installed, you&apos;ll be sent to the App Store.
      </p>
    </div>
  );
}
