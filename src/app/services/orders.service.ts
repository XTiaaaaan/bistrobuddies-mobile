import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
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
    const ordersQuery = query(
      this.ordersRef(),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    return collectionData$<Order>(ordersQuery);
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
