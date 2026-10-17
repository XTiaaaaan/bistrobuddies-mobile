import { PaymentStatus } from '../../models/payment.model';
import {
  GCASH_QR_ASSET,
  canSubmitGcash,
  isValidGcashAccountName,
  isValidGcashNumber,
  normalizeGcashNumber,
} from './gcash';

describe('gcash helpers', () => {
  it('points at the bundled local QR asset', () => {
    expect(GCASH_QR_ASSET).toBe('assets/images/gcash-qr.jpg');
  });

  it('normalizes spaces, dashes and country code', () => {
    expect(normalizeGcashNumber('0917 123 4567')).toBe('09171234567');
    expect(normalizeGcashNumber('+63-917-123-4567')).toBe('+639171234567');
  });

  it('accepts common Philippine mobile number formats', () => {
    expect(isValidGcashNumber('09171234567')).toBe(true);
    expect(isValidGcashNumber('0917 123 4567')).toBe(true);
    expect(isValidGcashNumber('+63 917 123 4567')).toBe(true);
    expect(isValidGcashNumber('9171234567')).toBe(true);
  });

  it('rejects numbers that are not Philippine mobiles', () => {
    expect(isValidGcashNumber('12345')).toBe(false);
    expect(isValidGcashNumber('091712345')).toBe(false);
    expect(isValidGcashNumber('1234567890123')).toBe(false);
    expect(isValidGcashNumber('')).toBe(false);
  });

  it('requires a plausible account name', () => {
    expect(isValidGcashAccountName('Juan dela Cruz')).toBe(true);
    expect(isValidGcashAccountName('J')).toBe(false);
    expect(isValidGcashAccountName('   ')).toBe(false);
  });

  it('allows submission for pending and rejected payments only', () => {
    expect(canSubmitGcash(PaymentStatus.PENDING)).toBe(true);
    expect(canSubmitGcash(PaymentStatus.REJECTED)).toBe(true);
    expect(canSubmitGcash(PaymentStatus.VERIFYING)).toBe(false);
    expect(canSubmitGcash(PaymentStatus.PAID)).toBe(false);
    expect(canSubmitGcash(undefined)).toBe(false);
  });
});
