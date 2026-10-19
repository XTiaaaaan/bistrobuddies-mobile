import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  DocumentReference,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FIREBASE_FIRESTORE } from '../core/firebase/firebase';
import { docData$ } from '../core/firebase/firestore.helpers';
import { User, UserInput } from '../models/user.model';

/** A successful `updateUser` call, replayed to in-app listeners immediately. */
export interface UserUpdateEvent {
  uid: string;
  patch: Partial<User>;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly db = inject(FIREBASE_FIRESTORE);
  private readonly updates = new Subject<UserUpdateEvent>();

  /**
   * Emits after every successful profile write. Surfaces such as the side menu
   * listen to this as well as `watchUser` so they update even when Firestore's
   * snapshot listener is slow to report the local write.
   */
  readonly updates$ = this.updates.asObservable();

  private userRef(uid: string): DocumentReference {
    return doc(this.db, 'users', uid);
  }

  getUser(uid: string): Promise<User | null> {
    return getDoc(this.userRef(uid)).then((snapshot) =>
      snapshot.exists() ? (snapshot.data() as User) : null
    );
  }

  watchUser(uid: string): Observable<User | null> {
    return docData$<User>(this.userRef(uid));
  }

  createUser(input: UserInput): Promise<void> {
    return setDoc(this.userRef(input.uid), {
      ...input,
      role: input.role ?? 'customer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateUser(uid: string, patch: Partial<User>): Promise<void> {
    await updateDoc(this.userRef(uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    this.updates.next({ uid, patch });
  }
}
