import {
  GoogleSignInError,
  ProfileSyncError,
  authErrorMessage,
} from './auth-errors';

describe('authErrorMessage', () => {
  it('should explain a failed profile save', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const message = authErrorMessage(
      new ProfileSyncError({ code: 'permission-denied' })
    );

    expect(message).toContain('profile could not be saved');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('should map Firestore permission errors', () => {
    expect(authErrorMessage({ code: 'permission-denied' })).toContain(
      'could not be saved'
    );
  });

  it('should map known Firebase auth error codes', () => {
    expect(authErrorMessage({ code: 'auth/invalid-email' })).toContain(
      'valid email'
    );
    expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toContain(
      'already exists'
    );
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toContain(
      'Incorrect email or password'
    );
  });

  it('should fall back to the error message', () => {
    expect(authErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('should fall back to a generic message', () => {
    expect(authErrorMessage('unknown')).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('should surface a native Google ID token failure clearly', () => {
    expect(
      authErrorMessage(
        new GoogleSignInError('Google sign-in did not return an ID token.')
      )
    ).toBe('Google sign-in did not return an ID token.');
  });

  describe('native Google errors', () => {
    const native = { nativeGoogle: true };

    it('should map Credential Manager cancellation without an error code', () => {
      const message = authErrorMessage(
        new Error('The flow has been canceled.'),
        native
      );

      expect(message).toBe('Google sign-in was cancelled.');
    });

    it('should map a missing Google account', () => {
      const message = authErrorMessage(
        new Error('No credentials available on this device.'),
        native
      );

      expect(message).toContain('No Google account');
    });

    it('should never show popup troubleshooting for unknown native errors', () => {
      const message = authErrorMessage(new Error('Something exploded'), native);

      expect(message).toBe('Google sign-in could not be completed. Please try again.');
      expect(message.toLowerCase()).not.toContain('pop-up');
    });

    it('should still map Firebase error codes thrown after the native flow', () => {
      expect(
        authErrorMessage({ code: 'auth/operation-not-allowed' }, native)
      ).toContain('not enabled');
    });
  });
});
