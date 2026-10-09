import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  collection,
  doc,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { FIREBASE_FIRESTORE } from '../core/firebase/firebase';
import { collectionData$, docData$ } from '../core/firebase/firestore.helpers';
import { Payment } from '../models/payment.model';

/**
 * Read-only Firestore access to payment records.
 *
 * Payment creation and status changes are privileged operations reserved for
 * the backend (server-side PayMongo integration is planned, not yet
 * implemented). Firestore security rules remain in place as defense in depth.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly db = inject(FIREBASE_FIRESTORE);

  private paymentsRef(): CollectionReference<DocumentData> {
    return collection(this.db, 'payments');
  }

  private paymentRef(paymentId: string): DocumentReference {
    return doc(this.db, 'payments', paymentId);
  }

  watchPayment(paymentId: string): Observable<Payment | null> {
    return docData$<Payment>(this.paymentRef(paymentId));
  }

  watchOrderPayments(orderId: string): Observable<Payment[]> {
    const paymentsQuery = query(
      this.paymentsRef(),
      where('orderId', '==', orderId)
    );
    return collectionData$<Payment>(paymentsQuery);
  }

  getPayment(paymentId: string): Promise<Payment | null> {
    return getDoc(this.paymentRef(paymentId)).then((snapshot) =>
      snapshot.exists() ? (snapshot.data() as Payment) : null
    );
  }
}
