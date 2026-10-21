import { Timestamp } from 'firebase/firestore';
import { OrderStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import {
  formatOrderDate,
  formatOrderPrice,
  orderStatusClass,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusClass,
  paymentStatusLabel,
  showPaymentStatus,
} from './order-display';

describe('order display helpers', () => {
  it('should label and class every order status', () => {
    expect(orderStatusLabel(OrderStatus.PENDING)).toBe('Pending');
    expect(orderStatusLabel(OrderStatus.CONFIRMED)).toBe('Confirmed');
    expect(orderStatusLabel(OrderStatus.PREPARING)).toBe('Preparing');
    expect(orderStatusLabel(OrderStatus.READY)).toBe('Ready');
    expect(orderStatusLabel(OrderStatus.OUT_FOR_DELIVERY)).toBe('On the Way');
    expect(orderStatusLabel(OrderStatus.COMPLETED)).toBe('Delivered');
    expect(orderStatusLabel(OrderStatus.CANCELLED)).toBe('Cancelled');

    expect(orderStatusClass(OrderStatus.PREPARING)).toBe('badge st-preparing');
    expect(orderStatusClass(OrderStatus.OUT_FOR_DELIVERY)).toBe(
      'badge st-out-for-delivery'
    );
    expect(orderStatusClass(OrderStatus.CANCELLED)).toBe('badge st-cancelled');
  });

  it('should label and class every payment status', () => {
    expect(paymentStatusLabel(PaymentStatus.PENDING)).toBe('Pending');
    expect(paymentStatusLabel(PaymentStatus.VERIFYING)).toBe('Verifying payment');
    expect(paymentStatusLabel(PaymentStatus.PAID)).toBe('Paid');
    expect(paymentStatusLabel(PaymentStatus.REJECTED)).toBe('Payment rejected');
    expect(paymentStatusLabel(PaymentStatus.FAILED)).toBe('Failed');
    expect(paymentStatusLabel(PaymentStatus.REFUNDED)).toBe('Refunded');

    expect(paymentStatusClass(PaymentStatus.VERIFYING)).toBe('badge pay-verifying');
    expect(paymentStatusClass(PaymentStatus.REJECTED)).toBe('badge pay-rejected');
    expect(paymentStatusClass(PaymentStatus.PAID)).toBe('badge pay-paid');
    expect(paymentStatusClass(PaymentStatus.FAILED)).toBe('badge pay-failed');
  });

  it('should fall back to a readable label for unknown statuses', () => {
    expect(paymentStatusLabel('SOMETHING_NEW')).toBe('Something new');
    expect(paymentStatusLabel(undefined)).toBe('Pending');
    expect(orderStatusLabel('WAITING_FOR_COURIER')).toBe(
      'Waiting for courier'
    );
    expect(orderStatusLabel(undefined)).toBe('');
    expect(orderStatusLabel('COMPLETED')).toBe('Delivered');
  });

  it('should hide payment status only for cancelled orders', () => {
    expect(showPaymentStatus({ orderStatus: OrderStatus.CONFIRMED })).toBe(true);
    expect(showPaymentStatus({ orderStatus: OrderStatus.COMPLETED })).toBe(true);
    expect(showPaymentStatus({ orderStatus: OrderStatus.CANCELLED })).toBe(false);
    expect(showPaymentStatus(null)).toBe(false);
    expect(showPaymentStatus(undefined)).toBe(false);
  });

  it('should label payment methods, keeping legacy ONLINE orders readable', () => {
    expect(paymentMethodLabel(PaymentMethod.COD)).toBe('COD');
    expect(paymentMethodLabel(PaymentMethod.GCASH)).toBe('GCash');
    expect(paymentMethodLabel('ONLINE')).toBe('Online');
  });

  it('should format a Firestore timestamp as a readable date', () => {
    const timestamp = Timestamp.fromMillis(Date.UTC(2026, 9, 8, 12, 0));
    const formatted = formatOrderDate(timestamp);

    expect(formatted).toContain('2026');
    expect(formatted).toContain('Oct');
    expect(formatted).toContain('8');
  });

  it('should show a placeholder while the server timestamp is missing', () => {
    expect(formatOrderDate(null)).toBe('—');
    expect(formatOrderDate(undefined)).toBe('—');
  });

  it('should format prices in pesos', () => {
    expect(formatOrderPrice(200)).toBe('₱200.00');
    expect(formatOrderPrice(1234.5)).toBe('₱1,234.50');
  });
});
