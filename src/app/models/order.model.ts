import type { Timestamp } from 'firebase/firestore';
import { PaymentMethod, PaymentStatus } from './payment.model';
import { ProductSize } from './product.model';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
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
  addressSnapshot: AddressSnapshot;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerComment: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type OrderInput = Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;
