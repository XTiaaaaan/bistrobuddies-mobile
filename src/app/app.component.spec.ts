import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Router, RouterLink, provideRouter } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  provideIonicAngular,
} from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';

describe('AppComponent', () => {
  const authState$ = new BehaviorSubject(false);
  const userState$ = new BehaviorSubject<{ uid: string } | null>(null);

  beforeEach(async () => {
    authState$.next(false);
    userState$.next(null);
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterLink,
        IonApp,
        IonMenu,
        IonHeader,
        IonContent,
        IonList,
        IonMenuToggle,
        IonItem,
        IonIcon,
        IonLabel,
        IonFooter,
        IonRouterOutlet,
      ],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated$: authState$.asObservable(),
            user$: userState$.asObservable(),
            logout: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: UsersService, useValue: { watchUser: () => of({ name: 'Juan dela Cruz', phone: '09171234567' }) } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have the full menu', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.nativeElement;
    const menuItems = app.querySelectorAll('ion-label');
    expect(menuItems.length).toEqual(9);
    expect(menuItems[0].innerHTML).toContain('Dashboard');
    expect(menuItems[1].innerHTML).toContain('Buy Coffee');
    expect(menuItems[2].innerHTML).toContain('Cart');
    expect(menuItems[3].innerHTML).toContain('My Orders');
    expect(menuItems[4].innerHTML).toContain('Company History');
    expect(menuItems[5].innerHTML).toContain('About Our Products');
    expect(menuItems[6].innerHTML).toContain('About the App');
    expect(menuItems[7].innerHTML).toContain('Contact Us');
    expect(menuItems[8].innerHTML).toContain('Developers');
  });

  it('should show a sign-in prompt when the customer has no profile', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.profile-card');
    expect(card.textContent).toContain('Sign in');
    expect(card.textContent).not.toContain('undefined');
  });

  it('should show the profile name and phone when they are available', async () => {
    userState$.next({ uid: 'u1' });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.profile-card');
    expect(card.textContent).toContain('Juan dela Cruz');
    expect(card.textContent).toContain('09171234567');
  });

  it('should show the log in action when the customer is signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.logout-bar span');
    expect(label.textContent).toContain('Log In');
  });

  it('should switch to the log out action after the customer signs in', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    authState$.next(true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.logout-bar span');
    expect(label.textContent).toContain('Log Out');
  });

  it('should have urls', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((el) => el.injector.get(RouterLink));
    expect(links.length).toEqual(9);
    expect(router.serializeUrl(links[0].urlTree!)).toEqual('/dashboard');
    expect(router.serializeUrl(links[1].urlTree!)).toEqual('/products');
    expect(router.serializeUrl(links[2].urlTree!)).toEqual('/cart');
    expect(router.serializeUrl(links[3].urlTree!)).toEqual('/my-orders');
    expect(router.serializeUrl(links[4].urlTree!)).toEqual('/company-history');
    expect(router.serializeUrl(links[5].urlTree!)).toEqual('/about-products');
    expect(router.serializeUrl(links[6].urlTree!)).toEqual('/about');
    expect(router.serializeUrl(links[7].urlTree!)).toEqual('/contact-us');
    expect(router.serializeUrl(links[8].urlTree!)).toEqual('/developers');
  });
});