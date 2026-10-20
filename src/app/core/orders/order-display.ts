import type { Timestamp } from 'firebase/firestore';
import { OrderStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { formatPeso } from '../format/price';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pending',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.READY]: 'Ready',
  [OrderStatus.OUT_FOR_DELIVERY]: 'On the Way',
  [OrderStatus.COMPLETED]: 'Completed',
  [OrderStatus.CANCELLED]: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pending',
  [PaymentStatus.VERIFYING]: 'Verifying payment',
  [PaymentStatus.PAID]: 'Paid',
  [PaymentStatus.REJECTED]: 'Payment rejected',
  [PaymentStatus.FAILED]: 'Failed',
  [PaymentStatus.REFUNDED]: 'Refunded',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.COD]: 'COD',
  [PaymentMethod.GCASH]: 'GCash',
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderStatusClass(status: OrderStatus): string {
  return `badge st-${String(status).toLowerCase().replace(/_/g, '-')}`;
}

/**
 * Accepts a raw status string too, because historic records and backend
 * responses are not guaranteed to match the enum. Unknown values fall back to
 * a human-readable rendering instead of leaking the raw token.
 */
export function paymentStatusLabel(status: PaymentStatus | string | null | undefined): string {
  if (!status) {
    return PAYMENT_STATUS_LABELS[PaymentStatus.PENDING];
  }
  return PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? humanize(status);
}

export function paymentStatusClass(status: PaymentStatus | string | null | undefined): string {
  return `badge pay-${String(status ?? PaymentStatus.PENDING).toLowerCase()}`;
}

export function paymentMethodLabel(method: PaymentMethod | string | null | undefined): string {
  if (!method) {
    return '';
  }
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? humanize(method);
}

/** Turns SCREAMING_SNAKE tokens (e.g. `VERIFYING`) into `Verifying`. */
function humanize(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatOrderDate(timestamp: Timestamp | null | undefined): string {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return '—';
  }

  return timestamp.toDate().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOrderPrice(value: number): string {
  return formatPeso(value);
}
