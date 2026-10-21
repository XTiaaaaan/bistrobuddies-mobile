import { Timestamp } from 'firebase/firestore';
import {
  Order,
  OrderStatus,
  PaymentAuditEntry,
  RefundStatus,
} from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { refundDisplay } from './refund-display';

function cancelledOrder(
  refund: Order['refund'],
  overrides: Partial<
    Pick<Order, 'paymentMethod' | 'paymentStatus' | 'paymentAudit'>
  > = {}
): Pick<
  Order,
  'orderStatus' | 'refund' | 'paymentMethod' | 'paymentStatus' | 'paymentAudit'
> {
  return {
    orderStatus: OrderStatus.CANCELLED,
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.PAID,
    refund,
    ...overrides,
  };
}

describe('refundDisplay', () => {
  it('should be hidden for orders that are not cancelled', () => {
    const display = refundDisplay({
      orderStatus: OrderStatus.PENDING,
      refund: {
        status: RefundStatus.REFUNDED,
        amount: 260,
        requestedAt: null,
        completedAt: null,
      },
    });

    expect(display.show).toBe(false);
    expect(display.message).toBe('');
    expect(display.amountText).toBeNull();
    expect(display.completedText).toBeNull();
  });

  it('should be hidden when the order is missing', () => {
    expect(refundDisplay(null).show).toBe(false);
    expect(refundDisplay(undefined).show).toBe(false);
  });

  it('should treat a cancelled historic order without refund fields as not recorded', () => {
    const display = refundDisplay(cancelledOrder(undefined));

    expect(display.show).toBe(true);
    expect(display.state).toBe('none');
    expect(display.label).toBe('Refund not recorded');
    expect(display.badgeClass).toBe('badge refund-none');
    expect(display.message).toBe('Order cancelled — refund not recorded yet.');
    expect(display.amountText).toBeNull();
    expect(display.completedText).toBeNull();
  });

  it('should treat an explicit NOT_REFUNDED status as not recorded', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.NOT_REFUNDED,
        amount: null,
        requestedAt: null,
        completedAt: null,
      })
    );

    expect(display.state).toBe('none');
    expect(display.message).toBe('Order cancelled — refund not recorded yet.');
  });

  it('should treat a null refund object as not recorded', () => {
    expect(refundDisplay(cancelledOrder(null)).state).toBe('none');
  });

  it('should treat an unknown refund status as not recorded instead of guessing', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: 'SOMETHING_NEW' as RefundStatus,
        amount: null,
        requestedAt: null,
        completedAt: null,
      })
    );

    expect(display.state).toBe('none');
    expect(display.message).toBe('Order cancelled — refund not recorded yet.');
  });

  it('should describe a pending refund without implying it completed', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUND_PENDING,
        amount: 520,
        requestedAt: Timestamp.fromMillis(1759900000000),
        completedAt: null,
      })
    );

    expect(display.show).toBe(true);
    expect(display.state).toBe('pending');
    expect(display.label).toBe('Refund pending');
    expect(display.badgeClass).toBe('badge refund-pending');
    expect(display.message).toBe(
      'Refund pending — the refund has not been marked completed.'
    );
    expect(display.amountText).toBe('₱520.00');
    expect(display.completedText).toBeNull();
  });

  it('should show amount and completion date for a completed refund', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUNDED,
        amount: 520,
        requestedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 8, 12, 0)),
        completedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 9, 8, 30)),
      })
    );

    expect(display.state).toBe('completed');
    expect(display.label).toBe('Refund completed');
    expect(display.badgeClass).toBe('badge refund-completed');
    expect(display.message).toContain('Refund completed');
    expect(display.message).toContain('₱520.00');
    expect(display.amountText).toBe('₱520.00');
    expect(display.completedText).toContain('2026');
    expect(display.completedText).toContain('Oct');
  });

  it('should accept ISO-string dates from API responses', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUNDED,
        amount: 260,
        requestedAt: '2026-10-08T12:00:00.000Z',
        completedAt: '2026-10-09T08:30:00.000Z',
      })
    );

    expect(display.state).toBe('completed');
    expect(display.completedText).toContain('2026');
    expect(display.completedText).toContain('Oct');
  });

  it('should format a fractional peso amount', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUNDED,
        amount: 1234.5,
        requestedAt: null,
        completedAt: Timestamp.fromMillis(1759900060000),
      })
    );

    expect(display.amountText).toBe('₱1,234.50');
    expect(display.message).toContain('₱1,234.50');
  });

  it('should stay completed but omit the amount when none was recorded', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUNDED,
        amount: null,
        requestedAt: null,
        completedAt: Timestamp.fromMillis(1759900060000),
      })
    );

    expect(display.state).toBe('completed');
    expect(display.amountText).toBeNull();
    expect(display.message).toContain('Refund completed');
    expect(display.message).not.toContain('₱');
    expect(display.completedText).toContain('Oct');
  });

  it('should fall back to a plain completed sentence when amount and date are missing', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUNDED,
        amount: null,
        requestedAt: null,
        completedAt: null,
      })
    );

    expect(display.state).toBe('completed');
    expect(display.message).toBe(
      'Refund completed — the refund has been returned.'
    );
    expect(display.amountText).toBeNull();
    expect(display.completedText).toBeNull();
  });

  it('should tolerate malformed amount and date values', () => {
    const display = refundDisplay(
      cancelledOrder({
        status: RefundStatus.REFUNDED,
        amount: Number.NaN,
        requestedAt: null,
        completedAt: 'not-a-date',
      })
    );

    expect(display.state).toBe('completed');
    expect(display.amountText).toBeNull();
    expect(display.completedText).toBeNull();
    expect(display.message).toBe(
      'Refund completed — the refund has been returned.'
    );
  });

  it('should hide a legacy refund on a cancelled unpaid COD order', () => {
    const display = refundDisplay(
      cancelledOrder(
        {
          status: RefundStatus.REFUND_PENDING,
          amount: 260,
          requestedAt: Timestamp.fromMillis(1759900000000),
          completedAt: null,
        },
        {
          paymentMethod: PaymentMethod.COD,
          paymentStatus: PaymentStatus.PENDING,
        }
      )
    );

    expect(display.show).toBe(false);
    expect(display.state).toBe('none');
    expect(display.label).toBe('');
    expect(display.message).toBe('');
    expect(display.amountText).toBeNull();
    expect(display.completedText).toBeNull();
  });

  it('should hide the refund section for a cancelled COD order with no payment evidence', () => {
    const display = refundDisplay(
      cancelledOrder(undefined, {
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
      })
    );

    expect(display.show).toBe(false);
  });

  it('should preserve refund information for a cancelled COD order with persisted PAID status', () => {
    const display = refundDisplay(
      cancelledOrder(
        {
          status: RefundStatus.REFUND_PENDING,
          amount: 260,
          requestedAt: null,
          completedAt: null,
        },
        {
          paymentMethod: PaymentMethod.COD,
          paymentStatus: PaymentStatus.PAID,
        }
      )
    );

    expect(display.show).toBe(true);
    expect(display.state).toBe('pending');
    expect(display.amountText).toContain('260.00');
  });

  it('should preserve refund information for a paid GCash order', () => {
    const display = refundDisplay(
      cancelledOrder(
        {
          status: RefundStatus.REFUNDED,
          amount: 520,
          requestedAt: null,
          completedAt: Timestamp.fromMillis(1759900060000),
        },
        {
          paymentMethod: PaymentMethod.GCASH,
          paymentStatus: PaymentStatus.PAID,
        }
      )
    );

    expect(display.show).toBe(true);
    expect(display.state).toBe('completed');
    expect(display.amountText).toContain('520.00');
  });

  it('should accept payment history as evidence when the current status is not PAID', () => {
    const audit: PaymentAuditEntry[] = [
      { from: 'PENDING', to: 'VERIFYING' },
      { from: 'VERIFYING', to: 'PAID' },
    ];
    const display = refundDisplay(
      cancelledOrder(
        {
          status: RefundStatus.REFUND_PENDING,
          amount: 260,
          requestedAt: null,
          completedAt: null,
        },
        {
          paymentMethod: PaymentMethod.COD,
          paymentStatus: 'CANCELLED' as PaymentStatus,
          paymentAudit: audit,
        }
      )
    );

    expect(display.show).toBe(true);
    expect(display.state).toBe('pending');
  });

  it('should not infer payment from the cancelled order status alone', () => {
    const display = refundDisplay(
      cancelledOrder(
        {
          status: RefundStatus.REFUNDED,
          amount: 260,
          requestedAt: null,
          completedAt: null,
        },
        {
          paymentMethod: PaymentMethod.COD,
          paymentStatus: 'CANCELLED' as PaymentStatus,
          paymentAudit: [
            {
              from: 'PENDING',
              to: 'CANCELLED',
              actorUid: 'admin-1',
              actorRole: 'admin',
            },
          ],
        }
      )
    );

    expect(display.show).toBe(false);
  });

  it('should not mutate the stored payment or refund fields', () => {
    const refund = {
      status: RefundStatus.REFUND_PENDING,
      amount: 260,
      requestedAt: Timestamp.fromMillis(1759900000000),
      completedAt: null,
    };
    const paymentAudit: PaymentAuditEntry[] = [
      { from: 'PENDING', to: 'PAID', actorUid: 'admin-1', actorRole: 'admin' },
    ];
    const order = cancelledOrder(refund, {
      paymentMethod: PaymentMethod.COD,
      paymentStatus: PaymentStatus.PAID,
      paymentAudit,
    });

    refundDisplay(order);

    expect(order.refund).toEqual({
      status: RefundStatus.REFUND_PENDING,
      amount: 260,
      requestedAt: Timestamp.fromMillis(1759900000000),
      completedAt: null,
    });
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);
    expect(order.paymentAudit).toEqual(paymentAudit);
    expect(order.paymentAudit).toBe(paymentAudit);
    expect(order.refund).toBe(refund);
  });
});
