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
import { BehaviorSubject } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';

describe('AppComponent', () => {
  const authState$ = new BehaviorSubject(false);

  beforeEach(async () => {
    authState$.next(false);
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
            logout: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have six menu pages', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.nativeElement;
    const menuItems = app.querySelectorAll('ion-label');
    expect(menuItems.length).toEqual(6);
    expect(menuItems[0].innerHTML).toContain('Dashboard');
    expect(menuItems[1].innerHTML).toContain('Buy Coffee');
    expect(menuItems[2].innerHTML).toContain('Cart');
    expect(menuItems[3].innerHTML).toContain('My Orders');
    expect(menuItems[4].innerHTML).toContain('About the App');
    expect(menuItems[5].innerHTML).toContain('Developers');
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
    expect(links.length).toEqual(6);
    expect(router.serializeUrl(links[0].urlTree!)).toEqual('/dashboard');
    expect(router.serializeUrl(links[1].urlTree!)).toEqual('/products');
    expect(router.serializeUrl(links[2].urlTree!)).toEqual('/cart');
    expect(router.serializeUrl(links[3].urlTree!)).toEqual('/my-orders');
    expect(router.serializeUrl(links[4].urlTree!)).toEqual('/about');
    expect(router.serializeUrl(links[5].urlTree!)).toEqual('/developers');
  });
});