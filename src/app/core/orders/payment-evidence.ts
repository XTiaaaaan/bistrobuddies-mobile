import type { Order } from '../../models/order.model';

/**
 * Persisted payment statuses that mean money was actually collected. Legacy
 * gateway values are included so historical paid orders keep their evidence.
 */
export const COLLECTED_PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  'PAID',
  'SUCCEEDED',
  'CAPTURED',
  'COMPLETED',
  'REFUNDED',
]);

/** Whether a persisted payment status means money was collected. */
export function isCollectedPaymentStatus(status: unknown): boolean {
  return COLLECTED_PAYMENT_STATUSES.has(String(status ?? '').toUpperCase());
}

/**
 * Payment evidence stored on the order: the current `paymentStatus` or any
 * `paymentAudit[].to` entry. Cancellation and fulfilment status are never
 * treated as evidence that money was collected.
 */
export type PaymentEvidenceOrder = Partial<
  Pick<Order, 'paymentStatus' | 'paymentAudit'>
>;

/** Whether the order has a persisted record of collected money. */
export function hasCollectedPayment(
  order: PaymentEvidenceOrder | null | undefined
): boolean {
  if (!order) {
    return false;
  }
  if (isCollectedPaymentStatus(order.paymentStatus)) {
    return true;
  }
  return (
    Array.isArray(order.paymentAudit) &&
    order.paymentAudit.some((entry) => isCollectedPaymentStatus(entry?.to))
  );
}
