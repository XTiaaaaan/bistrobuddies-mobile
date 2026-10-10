import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { UsersService } from '../../services/users.service';
import { ProfilePage } from './profile.page';

const profileDoc = {
  uid: 'u1',
  name: 'Juan dela Cruz',
  email: 'juan@example.com',
  phone: '09171234567',
  address: '123 Rizal St, Manila',
  role: 'customer',
};

const signedInUser = {
  uid: 'u1',
  email: 'juan@example.com',
  displayName: 'Juan dela Cruz',
  photoURL: null,
};

interface SetupOptions {
  user?: unknown;
  updateUser?: ReturnType<typeof vi.fn>;
  getUser?: () => Promise<typeof profileDoc | null>;
  uploadPhoto?: ReturnType<typeof vi.fn>;
  validate?: (file: File) => string | null;
}

describe('ProfilePage', () => {
  function setup(options: SetupOptions = {}): {
    fixture: ComponentFixture<ProfilePage>;
    component: ProfilePage;
    updateUser: ReturnType<typeof vi.fn>;
    uploadPhoto: ReturnType<typeof vi.fn>;
    validate: (file: File) => string | null;
    setPhotoUrl: ReturnType<typeof vi.fn>;
  } {
    const user = 'user' in options ? options.user : signedInUser;
    const updateUser = options.updateUser ?? vi.fn(() => Promise.resolve());
    const uploadPhoto =
      options.uploadPhoto ??
      vi.fn(() => Promise.resolve('http://localhost:3001/uploads/pic.png'));
    const validate = options.validate ?? (() => null);
    const setPhotoUrl = vi.fn(() => Promise.resolve());
    const getUser = options.getUser ?? (() => Promise.resolve(profileDoc));

    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of(user), setPhotoUrl } },
        { provide: UsersService, useValue: { getUser, updateUser } },
        { provide: ProfileApiService, useValue: { validate, uploadPhoto } },
        {
          provide: ToastController,
          useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, updateUser, uploadPhoto, validate, setPhotoUrl };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads the signed-in customer profile with the phone normalized to 10 digits', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    expect(component.status()).toBe('ready');
    expect(component.name()).toBe('Juan dela Cruz');
    expect(component.phone()).toBe('9171234567');
    expect(component.address()).toBe('123 Rizal St, Manila');
    expect(component.email()).toBe('juan@example.com');
  });

  it('saves the mobile number with the +63 country code and never sends the role', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    component.setPhone({ detail: { value: '9179998888' } });
    component.setAddress({ detail: { value: '456 Bonifacio Ave' } });
    await component.save();

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      phone: '+639179998888',
      address: '456 Bonifacio Ave',
    });
    expect(component.saved()).toBe(true);
    expect(component.saving()).toBe(false);
  });

  it('keeps only digits, accepts a pasted 09 number and enforces the 10-digit limit', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    component.setPhone({ detail: { value: '0917 123-4567' } });
    expect(component.phone()).toBe('9171234567');

    component.setPhone({ detail: { value: '+63 918 555 0101' } });
    expect(component.phone()).toBe('9185550101');

    component.setPhone({ detail: { value: '91712345678901' } });
    expect(component.phone()).toBe('9171234567');
  });

  it('rejects an invalid mobile number until it is fixed', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    component.setPhone({ detail: { value: '8123456789' } });
    expect(component.phoneError()).toBe(
      'Enter a valid mobile number — 10 digits starting with 9 (e.g. 917 123 4567).'
    );
    expect(component.canSave()).toBe(false);

    component.markPhoneTouched();
    expect(component.showPhoneError()).toBe(true);

    component.setPhone({ detail: { value: '9171234567' } });
    expect(component.phoneError()).toBeNull();
    expect(component.showPhoneError()).toBe(false);
    expect(component.canSave()).toBe(true);
  });

  it('allows an empty (optional) mobile number', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    component.setPhone({ detail: { value: '' } });
    expect(component.phoneError()).toBeNull();
    expect(component.canSave()).toBe(true);

    await component.save();
    expect(updateUser).toHaveBeenCalledWith('u1', { phone: '', address: '123 Rizal St, Manila' });
  });

  it('uploads a chosen profile picture and stores its URL in Firestore and Auth', async () => {
    const { fixture, component, updateUser, uploadPhoto, setPhotoUrl } = setup();
    await fixture.whenStable();

    const input = document.createElement('input');
    const file = new File(['image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file] });
    await component.onPhotoSelected({ target: input } as unknown as Event);

    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      photoUrl: 'http://localhost:3001/uploads/pic.png',
    });
    expect(setPhotoUrl).toHaveBeenCalledWith('http://localhost:3001/uploads/pic.png');
    expect(component.photoUrl()).toBe('http://localhost:3001/uploads/pic.png');
    expect(component.photoUploading()).toBe(false);
    expect(component.photoError()).toBeNull();
  });

  it('surfaces a validation message and skips the upload for an unusable file', async () => {
    const { fixture, component, uploadPhoto } = setup({
      validate: () => 'Only JPEG, PNG, or WebP images can be uploaded.',
    });
    await fixture.whenStable();

    const input = document.createElement('input');
    const file = new File(['nope'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    await component.onPhotoSelected({ target: input } as unknown as Event);

    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(component.photoError()).toBe('Only JPEG, PNG, or WebP images can be uploaded.');
    expect(component.photoUrl()).toBeNull();
  });

  it('removes the profile picture so the initials fallback shows again', async () => {
    const { fixture, component, updateUser, setPhotoUrl } = setup();
    await fixture.whenStable();

    const input = document.createElement('input');
    const file = new File(['image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file] });
    await component.onPhotoSelected({ target: input } as unknown as Event);
    expect(component.photoUrl()).not.toBeNull();

    await component.removePhoto();

    expect(updateUser).toHaveBeenCalledWith('u1', { photoUrl: null });
    expect(setPhotoUrl).toHaveBeenCalledWith(null);
    expect(component.photoUrl()).toBeNull();
    expect(component.photoUploading()).toBe(false);
  });

  it('keeps the profile private when the customer is signed out', async () => {
    const { fixture, component } = setup({ user: null });
    await fixture.whenStable();

    expect(component.status()).toBe('signed-out');
    expect(fixture.nativeElement.textContent).toContain(
      'Please sign in to view your profile'
    );
  });

  it('shows an error state when the profile cannot be read', async () => {
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of({ uid: 'u1', email: 'a@b.c' }) } },
        {
          provide: UsersService,
          useValue: {
            getUser: () => Promise.reject(new Error('offline')),
            updateUser: vi.fn(),
          },
        },
        { provide: ProfileApiService, useValue: { validate: () => null, uploadPhoto: vi.fn() } },
        {
          provide: ToastController,
          useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('Could not load your profile');
  });
});
