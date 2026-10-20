import type { Timestamp } from 'firebase/firestore';

/**
 * Payment methods accepted by the backend.
 *
 * `COD` (cash on delivery) and `GCASH` are the live options. Historic orders
 * may still store the removed legacy `ONLINE` value; presentation code falls
 * back to a generic label for it and it is no longer offered at checkout.
 */
export enum PaymentMethod {
  COD = 'COD',
  GCASH = 'GCASH',
}

/**
 * Customer-visible payment statuses.
 *
 * `PENDING` orders await payment; `VERIFYING` GCash submissions are waiting
 * for an admin to confirm the transaction; `PAID`/`REJECTED` are the admin
 * decisions. `FAILED`/`REFUNDED` are retained for historic records.
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  VERIFYING = 'VERIFYING',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/** Customer-entered GCash account details, as returned by the backend. */
export interface GcashDetails {
  accountName: string;
  accountNumber: string;
}

export interface PaymentProof {
  url: string;
  publicId?: string;
  mimeType?: string;
  size?: number;
  submittedBy?: string;
  submittedAt?: Timestamp | string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerReference: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type PaymentInput = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;
