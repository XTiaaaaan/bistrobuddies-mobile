import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Observable, Subject, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { UsersService } from '../../services/users.service';
import { ProfilePage } from './profile.page';

const profileDoc = {
  uid: 'u1',
  name: 'Juan dela Cruz',
  firstName: 'Juan',
  lastName: 'dela Cruz',
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

/** Any shape the Firestore user document may have (legacy docs lack name parts). */
type ProfileDoc = Partial<typeof profileDoc> & Record<string, unknown>;

interface SetupOptions {
  user?: unknown;
  updateUser?: ReturnType<typeof vi.fn>;
  getUser?: () => Promise<ProfileDoc | null>;
  watchUser?: () => Observable<ProfileDoc | null>;
  uploadPhoto?: ReturnType<typeof vi.fn>;
  validate?: (file: File) => string | null;
}

type UserUpdate = { uid: string; patch: Record<string, unknown> };

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function selectedFile(file: File): Event {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', { value: [file] });
  return { target: input } as unknown as Event;
}

describe('ProfilePage', () => {
  function setup(options: SetupOptions = {}): {
    fixture: ComponentFixture<ProfilePage>;
    component: ProfilePage;
    updateUser: ReturnType<typeof vi.fn>;
    uploadPhoto: ReturnType<typeof vi.fn>;
    validate: (file: File) => string | null;
    setPhotoUrl: ReturnType<typeof vi.fn>;
    setDisplayName: ReturnType<typeof vi.fn>;
    updates$: Subject<UserUpdate>;
    watchUser: () => Observable<ProfileDoc | null>;
  } {
    const user = 'user' in options ? options.user : signedInUser;
    const updateUser = options.updateUser ?? vi.fn(() => Promise.resolve());
    const uploadPhoto =
      options.uploadPhoto ??
      vi.fn(() => Promise.resolve('http://localhost:3001/uploads/pic.png'));
    const validate = options.validate ?? (() => null);
    const setPhotoUrl = vi.fn(() => Promise.resolve());
    const setDisplayName = vi.fn(() => Promise.resolve());
    const getUser = options.getUser ?? (() => Promise.resolve(profileDoc));
    const watchUser = options.watchUser ?? (() => of<ProfileDoc | null>(profileDoc));
    const updates$ = new Subject<UserUpdate>();

    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of(user), setPhotoUrl, setDisplayName } },
        { provide: UsersService, useValue: { getUser, updateUser, watchUser, updates$ } },
        { provide: ProfileApiService, useValue: { validate, uploadPhoto } },
        {
          provide: ToastController,
          useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      updateUser,
      uploadPhoto,
      validate,
      setPhotoUrl,
      setDisplayName,
      updates$,
      watchUser,
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads the signed-in customer profile with the name split into first and last parts', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    expect(component.status()).toBe('ready');
    expect(component.firstName()).toBe('Juan');
    expect(component.lastName()).toBe('dela Cruz');
    expect(component.name()).toBe('Juan dela Cruz');
    expect(component.phone()).toBe('9171234567');
    expect(component.address()).toBe('123 Rizal St, Manila');
    expect(component.email()).toBe('juan@example.com');
  });

  it('splits a legacy single-field name so both inputs stay editable', async () => {
    const { fixture, component } = setup({
      getUser: () =>
        Promise.resolve({
          uid: 'u1',
          name: 'Maria Clara Santos',
          email: 'maria@example.com',
          phone: '',
          address: '',
          role: 'customer',
        }),
    });
    await fixture.whenStable();

    expect(component.firstName()).toBe('Maria');
    expect(component.lastName()).toBe('Clara Santos');
    expect(component.name()).toBe('Maria Clara Santos');
  });

  it('saves the first and last name with the contact details and never sends the role', async () => {
    const { fixture, component, updateUser, setDisplayName } = setup();
    await fixture.whenStable();

    component.setFirstName({ detail: { value: 'Juanito' } });
    component.setLastName({ detail: { value: 'Dela Cruz' } });
    component.setPhone({ detail: { value: '9179998888' } });
    component.setAddress({ detail: { value: '456 Bonifacio Ave' } });
    await component.save();

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      firstName: 'Juanito',
      lastName: 'Dela Cruz',
      name: 'Juanito Dela Cruz',
      phone: '+639179998888',
      address: '456 Bonifacio Ave',
    });
    expect(setDisplayName).toHaveBeenCalledWith('Juanito Dela Cruz');
    expect(component.saved()).toBe(true);
    expect(component.saving()).toBe(false);
  });

  it('trims surrounding whitespace around both names before saving', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    component.setFirstName({ detail: { value: '  Ana  ' } });
    component.setLastName({ detail: { value: '  Reyes ' } });
    await component.save();

    expect(updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ firstName: 'Ana', lastName: 'Reyes', name: 'Ana Reyes' })
    );
  });

  it('rejects an empty first or last name and saves nothing', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    component.setFirstName({ detail: { value: '   ' } });
    expect(component.firstNameError()).toBe('First name is required.');
    expect(component.canSave()).toBe(false);

    await component.save();
    expect(updateUser).not.toHaveBeenCalled();
    expect(component.saved()).toBe(false);

    component.setFirstName({ detail: { value: 'Juan' } });
    component.setLastName({ detail: { value: '' } });
    expect(component.lastNameError()).toBe('Last name is required.');
    expect(component.canSave()).toBe(false);

    await component.save();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows the updated names when the profile page is reopened', async () => {
    let stored: Record<string, unknown> = { ...profileDoc };
    const updateUser = vi.fn((uid: string, patch: Record<string, unknown>) => {
      stored = { ...stored, ...patch };
      return Promise.resolve();
    });
    const getUser = vi.fn(() => Promise.resolve({ ...stored } as ProfileDoc));

    const first = setup({ updateUser, getUser });
    await first.fixture.whenStable();
    first.component.setFirstName({ detail: { value: 'Juanito' } });
    first.component.setLastName({ detail: { value: 'Dela Cruz' } });
    await first.component.save();
    first.fixture.destroy();
    TestBed.resetTestingModule();

    // A fresh page instance reads the persisted document again.
    const second = setup({ updateUser, getUser });
    await second.fixture.whenStable();

    expect(second.component.firstName()).toBe('Juanito');
    expect(second.component.lastName()).toBe('Dela Cruz');
    expect(second.component.name()).toBe('Juanito Dela Cruz');
  });

  it('only ever updates the signed-in customer document', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    component.setFirstName({ detail: { value: 'Juanito' } });
    await component.save();

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser.mock.calls[0][0]).toBe('u1');
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
    expect(updateUser).toHaveBeenCalledWith('u1', {
      firstName: 'Juan',
      lastName: 'dela Cruz',
      name: 'Juan dela Cruz',
      phone: '',
      address: '123 Rizal St, Manila',
    });
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

  it('uses the same live profile subscription as the side menu for the photo', async () => {
    const liveDoc$ = new Subject<ProfileDoc | null>();
    const { fixture, component } = setup({ watchUser: () => liveDoc$ });
    await fixture.whenStable();

    expect(component.photoUrl()).toBeNull();

    liveDoc$.next({
      ...profileDoc,
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/v2/me.png',
    });
    fixture.detectChanges();

    expect(component.photoUrl()).toBe(
      'https://res.cloudinary.com/demo/image/upload/v2/me.png'
    );
  });

  it('applies a local profile write to the photo without waiting for a snapshot', async () => {
    const { fixture, component, updates$ } = setup();
    await fixture.whenStable();

    updates$.next({
      uid: 'u1',
      patch: { photoUrl: 'https://res.cloudinary.com/demo/image/upload/v3/me.png' },
    });
    fixture.detectChanges();

    expect(component.photoUrl()).toBe(
      'https://res.cloudinary.com/demo/image/upload/v3/me.png'
    );
  });

  it('keeps the saved photo when the upload fails', async () => {
    const savedPhoto = 'http://localhost:3001/uploads/old.png';
    const doc = { ...profileDoc, photoUrl: savedPhoto };
    const updateUser = vi.fn(() => Promise.resolve());
    const uploadPhoto = vi.fn(() => Promise.reject(new Error('Backend unavailable')));
    const { fixture, component } = setup({
      getUser: () => Promise.resolve(doc),
      watchUser: () => of<ProfileDoc | null>(doc),
      updateUser,
      uploadPhoto,
    });
    await fixture.whenStable();
    expect(component.photoUrl()).toBe(savedPhoto);

    const file = new File(['image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    await component.onPhotoSelected(selectedFile(file));

    expect(component.photoUrl()).toBe(savedPhoto);
    expect(updateUser).not.toHaveBeenCalled();
    expect(component.photoError()).toBe('Backend unavailable');
    expect(component.photoUploading()).toBe(false);
  });

  it('restores the saved photo when the Firestore write fails after uploading', async () => {
    const savedPhoto = 'http://localhost:3001/uploads/old.png';
    const doc = { ...profileDoc, photoUrl: savedPhoto };
    const updateUser = vi.fn(() => Promise.reject(new Error('offline')));
    const { fixture, component } = setup({
      getUser: () => Promise.resolve(doc),
      watchUser: () => of<ProfileDoc | null>(doc),
      updateUser,
      uploadPhoto: vi.fn(() => Promise.resolve('http://localhost:3001/uploads/new.png')),
    });
    await fixture.whenStable();

    const file = new File(['image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    await component.onPhotoSelected(selectedFile(file));

    expect(component.photoUrl()).toBe(savedPhoto);
    expect(component.photoError()).toContain('could not save it to your profile');
    expect(component.photoUploading()).toBe(false);
  });

  it('shows the new photo before persistence finishes and ignores duplicate selections', async () => {
    let finishUpload!: (url: string) => void;
    let finishUpdate!: () => void;
    const uploadPhoto = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishUpload = resolve;
        })
    );
    const updateUser = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUpdate = resolve;
        })
    );
    const { fixture, component } = setup({ uploadPhoto, updateUser });
    await fixture.whenStable();

    const firstFile = new File(['one'], 'one.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['two'], 'two.jpg', { type: 'image/jpeg' });
    const firstUpload = component.onPhotoSelected(selectedFile(firstFile));
    await flushMicrotasks();
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(component.photoUploading()).toBe(true);

    finishUpload('http://localhost:3001/uploads/new.png');
    await flushMicrotasks();
    expect(component.photoUrl()).toBe('http://localhost:3001/uploads/new.png');
    expect(component.photoUploading()).toBe(true);

    const duplicate = component.onPhotoSelected(selectedFile(secondFile));
    await flushMicrotasks();
    expect(uploadPhoto).toHaveBeenCalledTimes(1);

    finishUpdate();
    await Promise.all([firstUpload, duplicate]);

    expect(component.photoUploading()).toBe(false);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      photoUrl: 'http://localhost:3001/uploads/new.png',
    });
  });

  it('only patches the photo so the other profile fields are preserved', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    const file = new File(['image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    await component.onPhotoSelected(selectedFile(file));

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      photoUrl: 'http://localhost:3001/uploads/pic.png',
    });
  });

  it('cache-busts a reused photo URL without storing the token', async () => {
    const reusedUrl = 'http://localhost:3001/uploads/pic.png';
    const doc = { ...profileDoc, photoUrl: reusedUrl };
    const { fixture, component, updateUser } = setup({
      getUser: () => Promise.resolve(doc),
      watchUser: () => of<ProfileDoc | null>(doc),
      uploadPhoto: vi.fn(() => Promise.resolve(reusedUrl)),
    });
    await fixture.whenStable();
    expect(component.photoUrl()).toBe(reusedUrl);

    const file = new File(['image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    await component.onPhotoSelected(selectedFile(file));

    expect(component.photoUrl()).toContain(`${reusedUrl}?v=`);
    expect(component.photoUrl()).not.toBe(reusedUrl);
    expect(updateUser).toHaveBeenCalledWith('u1', { photoUrl: reusedUrl });
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

  it('shows the first and last name fields with their validation messages', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    component.setFirstName({ detail: { value: '' } });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('First name');
    expect(element.textContent).toContain('Last name');
    expect(element.textContent).toContain('First name is required.');
    expect(element.textContent).toContain('Save Changes');
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
        {
          provide: AuthService,
          useValue: {
            user$: of({ uid: 'u1', email: 'a@b.c' }),
            setDisplayName: vi.fn(() => Promise.resolve()),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getUser: () => Promise.reject(new Error('offline')),
            updateUser: vi.fn(),
            watchUser: () => of<ProfileDoc | null>(null),
            updates$: new Subject<UserUpdate>(),
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
