import { PaymentStatus } from '../../models/payment.model';
import {
  hasCollectedPayment,
  isCollectedPaymentStatus,
} from './payment-evidence';

describe('payment evidence', () => {
  it('recognizes every persisted status that means money was collected', () => {
    for (const status of [
      'PAID',
      'SUCCEEDED',
      'CAPTURED',
      'COMPLETED',
      'REFUNDED',
      'paid',
    ]) {
      expect(isCollectedPaymentStatus(status)).toBe(true);
    }
  });

  it('does not treat pending, verifying, rejected or arbitrary statuses as collected', () => {
    for (const status of [
      PaymentStatus.PENDING,
      PaymentStatus.VERIFYING,
      PaymentStatus.REJECTED,
      PaymentStatus.FAILED,
      'CANCELLED',
      '',
      null,
      undefined,
    ]) {
      expect(isCollectedPaymentStatus(status)).toBe(false);
    }
  });

  it('reads the persisted payment status first', () => {
    expect(hasCollectedPayment({ paymentStatus: PaymentStatus.PAID })).toBe(
      true
    );
    expect(hasCollectedPayment({ paymentStatus: PaymentStatus.PENDING })).toBe(
      false
    );
  });

  it('accepts legacy gateway statuses stored as raw strings', () => {
    for (const status of [
      'SUCCEEDED',
      'CAPTURED',
      'COMPLETED',
      'REFUNDED',
    ]) {
      expect(
        hasCollectedPayment({
          paymentStatus: status as PaymentStatus,
        })
      ).toBe(true);
    }
  });

  it('uses the payment audit trail when the current status no longer carries the evidence', () => {
    expect(
      hasCollectedPayment({
        paymentStatus: 'CANCELLED' as PaymentStatus,
        paymentAudit: [
          { from: 'PENDING', to: 'VERIFYING' },
          { from: 'VERIFYING', to: 'PAID' },
        ],
      })
    ).toBe(true);
  });

  it('ignores audit entries that never reached a collected status', () => {
    expect(
      hasCollectedPayment({
        paymentStatus: 'CANCELLED' as PaymentStatus,
        paymentAudit: [
          { from: 'PENDING', to: 'VERIFYING' },
          { from: 'VERIFYING', to: 'REJECTED' },
          { from: 'PENDING', to: 'CANCELLED' },
        ],
      })
    ).toBe(false);
  });

  it('handles missing orders and malformed audit data safely', () => {
    expect(hasCollectedPayment(null)).toBe(false);
    expect(hasCollectedPayment(undefined)).toBe(false);
    expect(hasCollectedPayment({})).toBe(false);
    expect(
      hasCollectedPayment({
        paymentStatus: PaymentStatus.PENDING,
        paymentAudit: {} as unknown as never,
      })
    ).toBe(false);
    expect(
      hasCollectedPayment({
        paymentStatus: PaymentStatus.PENDING,
        paymentAudit: [null as unknown as never],
      })
    ).toBe(false);
  });
});
