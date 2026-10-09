import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
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

describe('ProfilePage', () => {
  function setup(
    user: unknown = { uid: 'u1', email: 'juan@example.com', displayName: 'Juan dela Cruz', photoURL: null },
    updateUser = vi.fn(() => Promise.resolve())
  ): {
    fixture: ComponentFixture<ProfilePage>;
    component: ProfilePage;
    updateUser: ReturnType<typeof vi.fn>;
  } {
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of(user) } },
        {
          provide: UsersService,
          useValue: { getUser: () => Promise.resolve(profileDoc), updateUser },
        },
        {
          provide: ToastController,
          useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, updateUser };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads the signed-in customer profile', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    expect(component.status()).toBe('ready');
    expect(component.name()).toBe('Juan dela Cruz');
    expect(component.phone()).toBe('09171234567');
    expect(component.address()).toBe('123 Rizal St, Manila');
    expect(component.email()).toBe('juan@example.com');
  });

  it('saves only the contact details and never sends the role', async () => {
    const { fixture, component, updateUser } = setup();
    await fixture.whenStable();

    component.setPhone({ detail: { value: '09999999999' } });
    component.setAddress({ detail: { value: '456 Bonifacio Ave' } });
    await component.save();

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      phone: '09999999999',
      address: '456 Bonifacio Ave',
    });
    expect(component.saved()).toBe(true);
    expect(component.saving()).toBe(false);
  });

  it('keeps the cart flow private when the customer is signed out', async () => {
    const { fixture, component } = setup(null);
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
