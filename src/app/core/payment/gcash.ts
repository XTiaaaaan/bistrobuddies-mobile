import { PaymentStatus } from '../../models/payment.model';

/**
 * Bundled QR image the customer scans to pay via GCash.
 *
 * The file is a fixed local asset that ships with the app — it is never
 * uploaded to or managed by the backend/admin site. It lives at
 * `src/assets/images/gcash-qr.jpg` and is copied to `assets/images/` by the
 * Angular build. If the file is missing the QR only fails to render; the rest
 * of the flow still works.
 */
export const GCASH_QR_ASSET = 'assets/images/gcash-qr.jpg';

/** Friendly messages shown for GCash submission outcomes. */
export const GCASH_MESSAGES = {
  scanning: 'Scan the QR code with your GCash app.',
  exactAmount: 'Pay the exact total shown below.',
  verifying:
    'We have your GCash details. Our team will verify your payment shortly.',
  rejected:
    'Your payment could not be verified. Please check your GCash payment and submit your details again.',
  submitted: 'Details submitted. We are verifying your payment.',
  submissionFailed: 'We could not submit your GCash details. Please try again.',
  proofRequired:
    'Upload a screenshot or photo showing the GCash transaction/reference number.',
  proofFailed: 'We could not upload your payment proof. Please try again.',
  proofSubmitted: 'Payment proof uploaded. We are verifying your payment.',
} as const;

/** Shown when the backend rejects the Bearer token during GCash submission. */
export const GCASH_SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again to submit your payment details.';

/**
 * A Philippine mobile number, loosely formatted: 09XXXXXXXXX, 9XXXXXXXXX,
 * +639XXXXXXXXX or with spaces/dashes. Kept permissive on purpose — the
 * backend remains the authority on validity.
 */
const PH_MOBILE_PATTERN = /^(?:\+?63|0)?9\d{9}$/;

/** Strips spaces, dashes, parentheses and dots so the number can be checked. */
export function normalizeGcashNumber(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

export function isValidGcashNumber(value: string): boolean {
  return PH_MOBILE_PATTERN.test(normalizeGcashNumber(value.trim()));
}

export function isValidGcashAccountName(value: string): boolean {
  const name = value.trim();
  return name.length >= 2 && name.length <= 80;
}

/**
 * Whether the customer may (re)submit GCash details for the given payment
 * status. Resubmission is allowed while the order is still awaiting payment
 * and after a rejection; VERIFYING/PAID orders are locked until an admin acts.
 */
export function canSubmitGcash(status: PaymentStatus | string | null | undefined): boolean {
  return status === PaymentStatus.PENDING || status === PaymentStatus.REJECTED;
}
