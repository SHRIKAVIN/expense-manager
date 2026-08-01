/** Provider-agnostic payment types (UPI now; Razorpay/etc. later). */

export type PaymentProviderId = "upi" | "razorpay" | "cashfree" | "stripe" | "juspay";

export interface CreatePaymentInput {
  payeeUpi: string;
  payeeName: string;
  amount: number;
  currency?: string;
  note?: string;
  /** Soft hint — browsers cannot reliably force a specific UPI app. */
  preferredApp?:
    | "gpay"
    | "phonepe"
    | "paytm"
    | "bhim"
    | "whatsapp"
    | "supermoney"
    | "generic";
}

export interface PaymentIntent {
  providerId: PaymentProviderId;
  /** Launch URL (e.g. upi://pay?…). */
  uri: string;
  amount: number;
  currency: string;
  payeeName: string;
  payeeUpi: string;
  note?: string;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  createIntent(input: CreatePaymentInput): Promise<PaymentIntent>;
  launch(intent: PaymentIntent): Promise<void>;
}
