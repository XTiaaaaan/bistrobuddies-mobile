import type { Timestamp } from 'firebase/firestore';
import { Order, OrderRefund, OrderStatus, RefundStatus } from '../../models/order.model';
import { PESO_LOCALE } from '../format/price';
import {
  hasCollectedPayment,
  PaymentEvidenceOrder,
} from './payment-evidence';

/**
 * Refund display for the customer app.
 *
 * Everything here is a pure function over the order document. The backend owns
 * the refund lifecycle (admin-only endpoint + Firestore writes); the mobile app
 * only renders whatever `refund.status` the backend has recorded. There is no
 * customer action, so this file deliberately exposes no mutation helpers.
 */

export type RefundState = 'none' | 'pending' | 'completed';

export interface RefundDisplay {
  /** Whether refund info should be rendered at all (only for cancelled orders). */
  show: boolean;
  state: RefundState;
  /** Short pill label, e.g. `Refund pending`. */
  label: string;
  /** CSS classes for the pill, e.g. `badge refund-pending`. */
  badgeClass: string;
  /** Full customer-friendly sentence. */
  message: string;
  /** Formatted peso amount, or null when the backend has not recorded one. */
  amountText: string | null;
  /** Formatted completion date, or null when not yet completed / not recorded. */
  completedText: string | null;
}

const NOT_RECORDED = 'Order cancelled — refund not recorded yet.';
const PENDING = 'Refund pending — the refund has not been marked completed.';
const COMPLETED_FALLBACK = 'Refund completed — the refund has been returned.';

const REFUND_LABELS: Record<RefundState, string> = {
  none: 'Refund not recorded',
  pending: 'Refund pending',
  completed: 'Refund completed',
};

const REFUND_BADGES: Record<RefundState, string> = {
  none: 'badge refund-none',
  pending: 'badge refund-pending',
  completed: 'badge refund-completed',
};

const HIDDEN: RefundDisplay = {
  show: false,
  state: 'none',
  label: '',
  badgeClass: '',
  message: '',
  amountText: null,
  completedText: null,
};

/** The order fields refund visibility is derived from. */
export type RefundVisibilityOrder = Pick<Order, 'orderStatus' | 'refund'> &
  PaymentEvidenceOrder;

/**
 * Refund facts are only shown for cancelled orders with persisted evidence
 * that money was actually collected. Cancellation itself is never treated as
 * payment evidence, so legacy refund fields on an unpaid cancelled COD order
 * stay hidden without rewriting the stored data. Order cancellation status
 * stays separate: this never alters `orderStatus` or `paymentStatus`, it only
 * describes the independent `refund.status` the backend recorded.
 *
 * Missing or unknown refund fields (historic orders) safely fall back to the
 * "not recorded" wording rather than implying a refund happened.
 */
export function refundDisplay(
  order: RefundVisibilityOrder | null | undefined
): RefundDisplay {
  if (!order || order.orderStatus !== OrderStatus.CANCELLED) {
    return HIDDEN;
  }

  if (!hasCollectedPayment(order)) {
    return HIDDEN;
  }

  const refund = normalizeRefund(order.refund);

  if (refund.status === RefundStatus.REFUNDED) {
    return {
      show: true,
      state: 'completed',
      label: REFUND_LABELS.completed,
      badgeClass: REFUND_BADGES.completed,
      message: completedMessage(refund),
      amountText: formatAmount(refund.amount),
      completedText: formatRefundDate(refund.completedAt),
    };
  }

  if (refund.status === RefundStatus.REFUND_PENDING) {
    return {
      show: true,
      state: 'pending',
      label: REFUND_LABELS.pending,
      badgeClass: REFUND_BADGES.pending,
      message: PENDING,
      amountText: formatAmount(refund.amount),
      completedText: null,
    };
  }

  return {
    show: true,
    state: 'none',
    label: REFUND_LABELS.none,
    badgeClass: REFUND_BADGES.none,
    message: NOT_RECORDED,
    amountText: null,
    completedText: null,
  };
}

/**
 * Reads the backend refund sub-document defensively. Anything malformed or
 * missing behaves like `NOT_REFUNDED` so historical orders keep rendering.
 */
function normalizeRefund(raw: OrderRefund | null | undefined): OrderRefund {
  const record: Partial<OrderRefund> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const status =
    record.status === RefundStatus.REFUND_PENDING ||
    record.status === RefundStatus.REFUNDED
      ? record.status
      : RefundStatus.NOT_REFUNDED;

  const amount =
    typeof record.amount === 'number' && Number.isFinite(record.amount)
      ? record.amount
      : null;

  return {
    status,
    amount,
    requestedAt: record.requestedAt ?? null,
    completedAt: record.completedAt ?? null,
  };
}

function completedMessage(refund: OrderRefund): string {
  const amountText = formatAmount(refund.amount);
  const completedText = formatRefundDate(refund.completedAt);
  if (amountText && completedText) {
    return `Refund completed — ${amountText} returned on ${completedText}.`;
  }
  if (amountText) {
    return `Refund completed — ${amountText} returned.`;
  }
  return COMPLETED_FALLBACK;
}

function formatAmount(amount: number | null): string | null {
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }
  return `₱${amount.toLocaleString(PESO_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Accepts a Firestore `Timestamp`, an ISO string, or null. Anything unreadable
 * returns null instead of leaking `Invalid Date` to the customer.
 */
function formatRefundDate(value: Timestamp | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let date: Date;
  if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof (value as Timestamp).toDate === 'function') {
    date = (value as Timestamp).toDate();
  } else {
    return null;
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
