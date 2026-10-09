import type { Timestamp } from 'firebase/firestore';

export enum PaymentMethod {
  COD = 'COD',
  ONLINE = 'ONLINE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
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
