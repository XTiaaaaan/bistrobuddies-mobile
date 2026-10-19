import { TestBed } from '@angular/core/testing';
import {
  GOOGLE_CREDENTIAL_SIGN_IN,
  GOOGLE_POPUP_SIGN_IN,
  IS_NATIVE_PLATFORM,
  NATIVE_GOOGLE_SIGN_IN,
} from '../core/auth/google-sign-in';
import { FIREBASE_AUTH } from '../core/firebase/firebase';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';

describe('AuthService Google sign-in', () => {
  const fakeUser = {
    uid: 'u1',
    displayName: 'Juan dela Cruz',
    email: 'juan@example.com',
    photoURL: null,
  };
  const fakeAuth = { currentUser: null } as never;

  let service: AuthService;
  let isNative: ReturnType<typeof vi.fn>;
  let nativeSignIn: ReturnType<typeof vi.fn>;
  let popupSignIn: ReturnType<typeof vi.fn>;
  let credentialSignIn: ReturnType<typeof vi.fn>;
  let usersStub: {
    getUser: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    isNative = vi.fn().mockReturnValue(false);
    nativeSignIn = vi.fn();
    popupSignIn = vi.fn();
    credentialSignIn = vi.fn();

    usersStub = {
      getUser: vi.fn().mockResolvedValue({
        uid: 'u1',
        name: 'Juan dela Cruz',
        email: 'juan@example.com',
        role: 'customer',
      }),
      createUser: vi.fn().mockResolvedValue(undefined),
      updateUser: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: FIREBASE_AUTH, useValue: fakeAuth },
        { provide: UsersService, useValue: usersStub },
        { provide: IS_NATIVE_PLATFORM, useValue: isNative },
        { provide: NATIVE_GOOGLE_SIGN_IN, useValue: nativeSignIn },
        { provide: GOOGLE_POPUP_SIGN_IN, useValue: popupSignIn },
        { provide: GOOGLE_CREDENTIAL_SIGN_IN, useValue: credentialSignIn },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('should keep the popup flow in the browser', async () => {
    popupSignIn.mockResolvedValue({ user: fakeUser });

    const user = await service.loginWithGoogle();

    expect(user).toBe(fakeUser);
    expect(popupSignIn).toHaveBeenCalledWith(fakeAuth);
    expect(nativeSignIn).not.toHaveBeenCalled();
    expect(credentialSignIn).not.toHaveBeenCalled();
    expect(usersStub.updateUser).toHaveBeenCalledWith('u1', {
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
    });
  });

  it('should use the native picker and Firebase JS SDK on device', async () => {
    isNative.mockReturnValue(true);
    nativeSignIn.mockResolvedValue({
      user: null,
      credential: { idToken: 'google-id-token', providerId: 'google.com' },
      additionalUserInfo: null,
    });
    credentialSignIn.mockResolvedValue({ user: fakeUser });

    const user = await service.loginWithGoogle();

    expect(user).toBe(fakeUser);
    expect(nativeSignIn).toHaveBeenCalledWith({ skipNativeAuth: true });
    expect(credentialSignIn).toHaveBeenCalledWith(fakeAuth, 'google-id-token');
    expect(popupSignIn).not.toHaveBeenCalled();
    expect(usersStub.updateUser).toHaveBeenCalled();
  });

  it('should fail clearly when the native flow returns no ID token', async () => {
    isNative.mockReturnValue(true);
    nativeSignIn.mockResolvedValue({
      user: null,
      credential: null,
      additionalUserInfo: null,
    });

    await expect(service.loginWithGoogle()).rejects.toThrow(
      'did not return an ID token'
    );
    expect(credentialSignIn).not.toHaveBeenCalled();
    expect(usersStub.getUser).not.toHaveBeenCalled();
  });
});
