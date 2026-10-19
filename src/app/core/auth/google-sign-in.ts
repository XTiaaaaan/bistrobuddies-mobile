import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  FirebaseAuthentication,
  SignInResult,
  SignInWithGoogleOptions,
} from '@capacitor-firebase/authentication';
import {
  Auth,
  GoogleAuthProvider,
  UserCredential,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';

/**
 * Injectable seams for the Google sign-in flows. The default factories wire the
 * real Capacitor plugin and Firebase JS SDK; tests override the tokens so the
 * native/browser branches can be exercised without touching network code.
 */

/** True when the app is running inside a native Capacitor shell. */
export const IS_NATIVE_PLATFORM = new InjectionToken<() => boolean>(
  'bistrobuddies.platform.is-native',
  { factory: () => () => Capacitor.isNativePlatform() }
);

/** Opens the native Google account picker and returns the OAuth credential. */
export const NATIVE_GOOGLE_SIGN_IN = new InjectionToken<
  (options: SignInWithGoogleOptions) => Promise<SignInResult>
>('bistrobuddies.google.native-sign-in', {
  factory: () => (options) => FirebaseAuthentication.signInWithGoogle(options),
});

/** Runs the browser popup flow through the Firebase JS SDK. */
export const GOOGLE_POPUP_SIGN_IN = new InjectionToken<
  (auth: Auth) => Promise<UserCredential>
>('bistrobuddies.google.popup-sign-in', {
  factory: () => (auth) => signInWithPopup(auth, new GoogleAuthProvider()),
});

/** Exchanges a native Google ID token for a Firebase session via the JS SDK. */
export const GOOGLE_CREDENTIAL_SIGN_IN = new InjectionToken<
  (auth: Auth, idToken: string) => Promise<UserCredential>
>('bistrobuddies.google.credential-sign-in', {
  factory: () => (auth, idToken) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken)),
});
