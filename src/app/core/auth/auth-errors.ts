const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/too-many-requests':
    'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'Network error. Please check your connection and try again.',
  'auth/popup-blocked':
    'The sign-in pop-up was blocked. Please allow pop-ups for this site.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/operation-not-allowed':
    'This sign-in method is not enabled. Please contact support.',
  'auth/unauthorized-domain':
    'This domain is not authorized for sign-in in the Firebase console.',
  'permission-denied':
    'Your account is signed in, but some data could not be saved. Please try again later.',
};

export class ProfileSyncError extends Error {
  constructor(readonly reason: unknown) {
    super('Failed to create or update the Firestore user profile.');
    this.name = 'ProfileSyncError';
  }
}

/**
 * Raised when the native Google flow finishes without the ID token needed to
 * sign in to the Firebase JS SDK. The message is safe to show to the user.
 */
export class GoogleSignInError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
    this.name = 'GoogleSignInError';
  }
}

/** Extra context so native errors never fall back to popup troubleshooting. */
export interface AuthErrorContext {
  /** True when the failure came from the native Google flow (Android/iOS). */
  nativeGoogle?: boolean;
}

const CANCELLED_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/cancelled',
  'auth/canceled',
  'cancelled',
  'canceled',
]);

const NATIVE_GOOGLE_MESSAGES = {
  cancelled: 'Google sign-in was cancelled.',
  noAccount:
    'No Google account is available on this device. Add a Google account in Android settings and try again.',
  notConfigured:
    'Google sign-in is not set up correctly for this app. Please contact support.',
  generic: 'Google sign-in could not be completed. Please try again.',
};

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return '';
}

function isCancellation(code: string, message: string): boolean {
  return CANCELLED_CODES.has(code) || /cancel/i.test(message);
}

function nativeGoogleErrorMessage(code: string, message: string): string {
  if (isCancellation(code, message)) {
    return NATIVE_GOOGLE_MESSAGES.cancelled;
  }
  if (/no credentials?|no google account|no account/i.test(message)) {
    return NATIVE_GOOGLE_MESSAGES.noAccount;
  }
  if (/network|connection|internet|timeout|unavailable/i.test(message)) {
    return AUTH_ERROR_MESSAGES['auth/network-request-failed'];
  }
  if (
    /configuration|not configured|developer error|api key|client id|provider/i.test(
      message
    )
  ) {
    return NATIVE_GOOGLE_MESSAGES.notConfigured;
  }

  return AUTH_ERROR_MESSAGES[code] ?? NATIVE_GOOGLE_MESSAGES.generic;
}

export function authErrorMessage(
  error: unknown,
  context: AuthErrorContext = {}
): string {
  if (error instanceof GoogleSignInError) {
    return error.userMessage;
  }

  if (error instanceof ProfileSyncError) {
    console.error('User profile sync failed', error.reason);
    return 'Your account exists, but your profile could not be saved. Please log in again and retry.';
  }

  const code = errorCode(error);

  if (context.nativeGoogle) {
    return nativeGoogleErrorMessage(code, errorMessage(error));
  }

  const message = AUTH_ERROR_MESSAGES[code];
  if (message) {
    return message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
