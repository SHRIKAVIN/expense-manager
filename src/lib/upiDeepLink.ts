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
}

/**
 * Build a UPI deep link for payment initiation (P2P transfers).
 *
 * Format: upi://pay?pa=...&pn=...&tn=...&am=...&cu=INR
 *
 * Note: tr (transaction reference) is for MERCHANT payments only, not P2P.
 * For P2P transfers between individuals, we use the simpler format.
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
 * // => "upi://pay?pa=shrikavin%40okaxis&pn=Sylvia&tn=Dinner%20reimbursement&am=500.00&cu=INR"
 */
export function buildUpiDeepLink(params: UpiPaymentParams): string {
  // Truncate per NPCI specs
  const payeeName = params.payeeName.substring(0, 60);
  const transactionNote = params.transactionNote.substring(0, 80);

  // URL-encode the address and text fields, but NOT the amount (critical for iOS)
  const pa = encodeURIComponent(params.upiId);
  const pn = encodeURIComponent(payeeName);
  const tn = encodeURIComponent(transactionNote);

  // Amount must be numeric, never URL-encoded. Fixed to 2 decimal places.
  const am = params.amount.toFixed(2);

  // Standard P2P UPI format (no tr parameter needed for person-to-person transfers)
  return `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&am=${am}&cu=INR`;
}
