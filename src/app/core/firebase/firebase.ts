import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>(
  'bistrobuddies.firebase.app'
);
export const FIREBASE_AUTH = new InjectionToken<Auth>(
  'bistrobuddies.firebase.auth'
);
export const FIREBASE_FIRESTORE = new InjectionToken<Firestore>(
  'bistrobuddies.firebase.firestore'
);

function createFirebaseApp(): FirebaseApp {
  return initializeApp(environment.firebase);
}

function createAuth(app: FirebaseApp): Auth {
  if (!Capacitor.isNativePlatform()) {
    return getAuth(app);
  }

  // Native builds run the app from a WebView where the default persistence is
  // in-memory, which would drop the session on every cold start. Persist to
  // IndexedDB instead so the signed-in user survives restarts.
  try {
    return initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    });
  } catch {
    // `initializeAuth` throws if auth was already initialized for this app
    // (for example during a hot reload); reuse the existing instance.
    return getAuth(app);
  }
}

function createFirestore(app: FirebaseApp): Firestore {
  return getFirestore(app);
}

export const firebaseProviders = [
  { provide: FIREBASE_APP, useFactory: createFirebaseApp },
  { provide: FIREBASE_AUTH, useFactory: createAuth, deps: [FIREBASE_APP] },
  {
    provide: FIREBASE_FIRESTORE,
    useFactory: createFirestore,
    deps: [FIREBASE_APP],
  },
];
