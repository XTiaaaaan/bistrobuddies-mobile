import {
  MAX_PAYMENT_PROOF_BYTES,
  PAYMENT_PROOF_MESSAGES,
  isPaymentProofFile,
  validatePaymentProof,
} from './payment-proof';

function proofFile(type = 'image/png', size = 16): File {
  return new File([new Uint8Array(size)], 'proof.png', { type });
}

describe('payment proof validation', () => {
  it('requires a selected image', () => {
    expect(validatePaymentProof(null)).toBe(PAYMENT_PROOF_MESSAGES.required);
    expect(validatePaymentProof(undefined)).toBe(PAYMENT_PROOF_MESSAGES.required);
  });

  it('rejects empty, oversized, and unsupported files', () => {
    expect(validatePaymentProof(proofFile('image/png', 0))).toBe(
      PAYMENT_PROOF_MESSAGES.empty
    );
    expect(
      validatePaymentProof(proofFile('image/png', MAX_PAYMENT_PROOF_BYTES + 1))
    ).toBe(PAYMENT_PROOF_MESSAGES.tooLarge);
    expect(validatePaymentProof(proofFile('image/gif'))).toBe(
      PAYMENT_PROOF_MESSAGES.unsupported
    );
  });

  it('accepts JPEG, PNG, and WebP images up to the limit', () => {
    expect(validatePaymentProof(proofFile('image/jpeg'))).toBeNull();
    expect(validatePaymentProof(proofFile('image/png'))).toBeNull();
    expect(validatePaymentProof(proofFile('image/webp'))).toBeNull();
    expect(
      validatePaymentProof(proofFile('image/png', MAX_PAYMENT_PROOF_BYTES))
    ).toBeNull();
  });

  it('narrows valid files with isPaymentProofFile', () => {
    expect(isPaymentProofFile(proofFile('image/png'))).toBe(true);
    expect(isPaymentProofFile(proofFile('image/gif'))).toBe(false);
    expect(isPaymentProofFile(null)).toBe(false);
  });
});
