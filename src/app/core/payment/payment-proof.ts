export const PAYMENT_PROOF_ACCEPTED_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const PAYMENT_PROOF_ACCEPT_ATTR = PAYMENT_PROOF_ACCEPTED_TYPES.join(',');

export const PAYMENT_PROOF_LABELS = 'JPEG, PNG, or WebP';

export const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;

export const PAYMENT_PROOF_MESSAGES = {
  required:
    'Upload a GCash payment proof image showing the transaction/reference number.',
  empty: 'The selected image file is empty.',
  tooLarge: 'The image is larger than the 5 MB upload limit.',
  unsupported: `Only ${PAYMENT_PROOF_LABELS} images can be uploaded.`,
  failed: 'We could not upload your payment proof. Please try again.',
} as const;

export function validatePaymentProof(
  file: File | null | undefined
): string | null {
  if (!file) {
    return PAYMENT_PROOF_MESSAGES.required;
  }
  if (file.size === 0) {
    return PAYMENT_PROOF_MESSAGES.empty;
  }
  if (file.size > MAX_PAYMENT_PROOF_BYTES) {
    return PAYMENT_PROOF_MESSAGES.tooLarge;
  }
  if (file.type && !PAYMENT_PROOF_ACCEPTED_TYPES.includes(file.type)) {
    return PAYMENT_PROOF_MESSAGES.unsupported;
  }
  return null;
}

export function isPaymentProofFile(
  file: File | null | undefined
): file is File {
  return file !== null && file !== undefined && validatePaymentProof(file) === null;
}
