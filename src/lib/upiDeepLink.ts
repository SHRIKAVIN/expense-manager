/**
 * UPI Deep Link Builder
 *
 * Constructs correct upi://pay?... URLs for Android and iOS.
 * Critical: amount (am) must NOT be URL-encoded — this is why iOS fails with "exceeding limit".
 * Also critical: tr (transaction reference) is MANDATORY for all UPI apps.
 */

export interface UpiPaymentParams {
  /** Payee UPI address, e.g. "shrikavin@okaxis" */
  upiId: string;
  /** Payee name, displayed in UPI app (max 60 chars per NPCI spec) */
  payeeName: string;
  /** Transaction note/description (max 80 chars) */
  transactionNote: string;
  /** Amount in rupees, e.g. 500.00 */
  amount: number;
  /** Unique transaction reference ID (mandatory per NPCI). Auto-generated if not provided. */
  transactionId?: string;
}

/**
 * Generate a unique transaction reference ID.
 * Format: timestamp + random = ensures uniqueness across multiple payments
 */
function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `TXN${timestamp}${random}`.substring(0, 35); // Max 35 chars per NPCI spec
}

/**
 * Build a UPI deep link for payment initiation.
 *
 * Format: upi://pay?pa=...&pn=...&tn=...&am=...&tr=...&cu=INR
 *
 * Supports multiple UPI app schemes:
 * - upi://pay? (generic, works with all UPI apps)
 * - gpay://upi/pay? (Google Pay specific, but upi:// fallback works too)
 * - phonepe://upi/pay? (PhonePe specific, but upi:// fallback works too)
 *
 * @param params - Payment parameters
 * @returns Complete UPI deep link URL
 *
 * @example
 * buildUpiDeepLink({
 *   upiId: 'shrikavin@okaxis',
 *   payeeName: 'Sylvia',
 *   transactionNote: 'Dinner reimbursement',
 *   amount: 500
 * })
 * // => "upi://pay?pa=shrikavin%40okaxis&pn=Sylvia&tn=Dinner%20reimbursement&am=500.00&tr=TXN1234567890abc&cu=INR"
 */
export function buildUpiDeepLink(params: UpiPaymentParams): string {
  // Truncate per NPCI specs
  const payeeName = params.payeeName.substring(0, 60);
  const transactionNote = params.transactionNote.substring(0, 80);
  const transactionId = params.transactionId || generateTransactionId();

  // URL-encode the address and text fields, but NOT the amount (critical for iOS)
  const pa = encodeURIComponent(params.upiId);
  const pn = encodeURIComponent(payeeName);
  const tn = encodeURIComponent(transactionNote);

  // Amount must be numeric, never URL-encoded. Fixed to 2 decimal places.
  const am = params.amount.toFixed(2);

  // Transaction reference (tr) is MANDATORY per NPCI spec
  // Do NOT URL-encode the transaction ID
  const tr = transactionId;

  // Use generic upi://pay? (works with all UPI apps: PhonePe, GPay, WhatsApp, Paytm, BHIM)
  return `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&am=${am}&tr=${tr}&cu=INR`;
}
