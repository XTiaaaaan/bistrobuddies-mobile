import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Timestamp,
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { FIREBASE_FIRESTORE } from '../core/firebase/firebase';
import { collectionData$, docData$ } from '../core/firebase/firestore.helpers';
import { Order } from '../models/order.model';

/**
 * Read-only Firestore access to orders.
 *
 * Order creation and status/payment-status changes are privileged operations
 * that go through the BistroBuddies backend API (see OrdersApiService); the
 * Firestore security rules remain in place as defense in depth.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly db = inject(FIREBASE_FIRESTORE);

  private ordersRef(): CollectionReference<DocumentData> {
    return collection(this.db, 'orders');
  }

  private orderRef(orderId: string): DocumentReference {
    return doc(this.db, 'orders', orderId);
  }

  watchOrders(): Observable<Order[]> {
    const ordersQuery = query(this.ordersRef(), orderBy('createdAt', 'desc'));
    return collectionData$<Order>(ordersQuery);
  }

  watchCustomerOrders(customerId: string): Observable<Order[]> {
    // Equality-only query: it uses Firestore's automatic single-field index, so
    // order history keeps working without the `customerId + createdAt`
    // composite index being deployed. Newest-first ordering is applied here.
    const ordersQuery = query(
      this.ordersRef(),
      where('customerId', '==', customerId)
    );
    return collectionData$<Order>(ordersQuery).pipe(map(sortOrdersNewestFirst));
  }

  watchOrder(orderId: string): Observable<Order | null> {
    return docData$<Order>(this.orderRef(orderId));
  }

  getOrder(orderId: string): Promise<Order | null> {
    return getDoc(this.orderRef(orderId)).then((snapshot) =>
      snapshot.exists() ? (snapshot.data() as Order) : null
    );
  }
}

/** Sorts orders newest-first; orders without a timestamp sink to the bottom. */
export function sortOrdersNewestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
}

function timestampMillis(value: Timestamp | null | undefined): number {
  return value && typeof value.toMillis === 'function' ? value.toMillis() : 0;
}
