/** NPCI-ish VPA helpers for UPI deep links. */

const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const PHONE_10_RE = /^[6-9]\d{9}$/;

export function isValidUpiId(upi: string): boolean {
  return UPI_VPA_RE.test(upi.trim());
}

/**
 * Convert a bare 10-digit Indian mobile into `number@upi`, otherwise normalize VPA.
 * Note: `@upi` is a generic handle — prefer a real VPA from Settings when available.
 */
export function toNpciVpa(target: string): string {
  const raw = target.trim();
  const digits = raw.replace(/\D/g, "");
  if (PHONE_10_RE.test(digits) && (raw === digits || raw.replace(/^\+91/, "") === digits)) {
    return `${digits}@upi`;
  }
  return raw.toLowerCase();
}

export function assertPayeeVpa(target: string): string {
  const vpa = toNpciVpa(target);
  if (!isValidUpiId(vpa)) {
    throw new Error("Invalid UPI ID. Use name@bank or a 10-digit mobile.");
  }
  return vpa;
}
