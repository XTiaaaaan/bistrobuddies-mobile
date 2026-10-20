import type { Timestamp } from 'firebase/firestore';
import {
  GcashDetails,
  PaymentMethod,
  PaymentProof,
  PaymentStatus,
} from './payment.model';
import { ProductSize } from './product.model';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Refund lifecycle for cancelled orders, mirroring the backend contract
 * exactly (`refund.status` on the order document). Independent of
 * `paymentStatus`, which stays PAID when money is returned.
 *
 * - `NOT_REFUNDED` — default; no refund recorded yet.
 * - `REFUND_PENDING` — an admin opened a refund; the money has not been sent.
 * - `REFUNDED` — an admin confirmed the money was actually returned.
 */
export enum RefundStatus {
  NOT_REFUNDED = 'NOT_REFUNDED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}

/**
 * Customer-visible refund facts, matching the backend's `RefundInfoResponse`.
 * Timestamps arrive as Firestore `Timestamp`s from the realtime listener (or
 * ISO strings from API responses), so both are accepted.
 */
export interface OrderRefund {
  status: RefundStatus;
  /** PHP amount recorded for the refund; null until one was recorded. */
  amount: number | null;
  requestedAt: Timestamp | string | null;
  completedAt: Timestamp | string | null;
}

export interface OrderItem {
  productId: string;
  productName: string;
  imageUrl: string;
  size: ProductSize;
  sugar: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CustomerSnapshot {
  uid: string;
  name: string;
  email: string;
  phone: string;
}

export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  address: string;
  city?: string;
  postalCode?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerSnapshot: CustomerSnapshot;
  /**
   * Optional because older order documents predate an explicit fulfilment
   * field. The current checkout is delivery-only, so a missing value falls
   * back to the presence of a delivery address.
   */
  fulfillmentType?: string | null;
  addressSnapshot: AddressSnapshot;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerComment: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  /**
   * Customer-visible GCash details. Optional because historic orders (and COD
   * orders) have no GCash fields at all.
   */
  gcashDetails?: GcashDetails;
  paymentProof?: PaymentProof | null;
  gcashProof?: PaymentProof | null;
  paymentProofUrl?: string | null;
  proofUrl?: string | null;
  gcashProofUrl?: string | null;
  /**
   * Refund facts recorded by the backend for cancelled, paid orders.
   * Optional/nullable because historic order documents (and non-refunded
   * orders) predate the refund feature entirely.
   */
  refund?: OrderRefund | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type OrderInput = Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;
