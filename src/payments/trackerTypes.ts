/**
 * Shared payment tracker types.
 *
 * SECURITY: Never put bank webhook secrets, service-role keys, or settlement
 * signing material in the PWA bundle. The client may only:
 *   - create a PENDING txn (authenticated)
 *   - poll status for txns it owns
 * Bank callbacks must hit the server with a shared secret / mTLS.
 */

export type UpiCheckoutApp = "supermoney" | "gpay" | "phonepe" | "paytm";

export type UpiPaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface CreatePaymentRequest {
  /** Reimbursement request id (API name: expenseId). */
  expenseId: string;
  /** Optional extra reimbursement ids settled in the same UPI intent. */
  relatedExpenseIds?: string[];
  amount: number;
  currency?: string;
  payeeVpa: string;
  payeeName?: string;
  note?: string;
  preferredApp?: UpiCheckoutApp;
}

export interface CreatePaymentResponse {
  transactionId: string;
  amount: number;
  currency: string;
  payeeVpa: string;
  payeeName: string;
  note: string;
  status: UpiPaymentStatus;
  /** Safe to embed in UPI `tr=` only — not a secret, but do not treat as proof of payment. */
  createdAt: string;
}

export interface PaymentStatusResponse {
  transactionId: string;
  expenseId: string;
  amount: number;
  currency: string;
  status: UpiPaymentStatus;
  paidAt: string | null;
  updatedAt: string;
}

export interface BankUpiCallbackBody {
  merchant_tran_id: string;
  amount: number | string;
  currency?: string;
  bank_reference?: string;
  status?: string;
}
