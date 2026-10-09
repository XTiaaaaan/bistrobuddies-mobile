import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
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
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  homeSharp,
  listOutline,
  listSharp,
  cartOutline,
  cartSharp,
  receiptOutline,
  receiptSharp,
  informationCircleOutline,
  informationCircleSharp,
  peopleOutline,
  peopleSharp,
  logInOutline,
  logInSharp,
  logOutOutline,
  logOutSharp,
  chevronForwardOutline,
  chevronForwardSharp,
  timeOutline,
  timeSharp,
  cafeOutline,
  cafeSharp,
  callOutline,
  callSharp,
} from 'ionicons/icons';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';

/** Customer summary shown at the top of the side menu. */
export interface MenuProfile {
  name: string;
  phone: string;
  photoUrl: string | null;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
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
})
export class AppComponent implements OnInit {
  protected readonly appPages = [
    { title: 'Dashboard', url: '/dashboard', icon: 'home' },
    { title: 'Buy Coffee', url: '/products', icon: 'list' },
    { title: 'Cart', url: '/cart', icon: 'cart' },
    { title: 'My Orders', url: '/my-orders', icon: 'receipt' },
    { title: 'Company History', url: '/company-history', icon: 'time' },
    { title: 'About Our Products', url: '/about-products', icon: 'cafe' },
    { title: 'About the App', url: '/about', icon: 'information-circle' },
    { title: 'Contact Us', url: '/contact-us', icon: 'call' },
    { title: 'Developers', url: '/developers', icon: 'people' },
  ];

  protected readonly selectedIndex = signal(0);
  protected readonly signedIn = signal(false);
  /** Profile summary for the signed-in customer; null while signed out. */
  protected readonly profile = signal<MenuProfile | null>(null);

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({
      homeOutline,
      homeSharp,
      listOutline,
      listSharp,
      cartOutline,
      cartSharp,
      receiptOutline,
      receiptSharp,
      informationCircleOutline,
      informationCircleSharp,
      peopleOutline,
      peopleSharp,
      logInOutline,
      logInSharp,
      logOutOutline,
      logOutSharp,
      chevronForwardOutline,
      chevronForwardSharp,
      timeOutline,
      timeSharp,
      cafeOutline,
      cafeSharp,
      callOutline,
      callSharp,
    });
  }

  ngOnInit() {
    this.auth.isAuthenticated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((signedIn) => this.signedIn.set(signedIn));

    this.auth.user$
      .pipe(
        distinctUntilChanged((a, b) => a?.uid === b?.uid),
        switchMap((user) => {
          if (!user) {
            return of<MenuProfile | null>(null);
          }
          return this.users.watchUser(user.uid).pipe(
            map((doc) => toMenuProfile(user, doc)),
            catchError(() => of(toMenuProfile(user, null)))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((profile) => this.profile.set(profile));

    this.updateSelected(this.router.url);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateSelected(event.urlAfterRedirects);
      }
    });
  }

  /** Initials shown when the customer has no profile photo. */
  initials(): string {
    const name = this.profile()?.name ?? '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '';
    }
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  /** Opens the private profile page, or the login screen for guests. */
  openProfile(): void {
    if (this.signedIn()) {
      void this.router.navigate(['/profile']);
      return;
    }
    void this.router.navigate(['/login'], { queryParams: { redirect: '/profile' } });
  }

  private updateSelected(url: string) {
    const index = this.appPages.findIndex((page) =>
      url.startsWith(page.url)
    );
    this.selectedIndex.set(index >= 0 ? index : 0);
  }

  async onLogout() {
    if (!this.signedIn()) {
      await this.router.navigate(['/login']);
      return;
    }

    try {
      await this.auth.logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
    await this.router.navigate(['/login']);
  }
}

function toMenuProfile(
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null },
  doc: { name?: string; phone?: string } | null
): MenuProfile {
  const name = (doc?.name ?? user.displayName ?? user.email?.split('@')[0] ?? '').trim();
  return {
    name: name || 'Your account',
    phone: doc?.phone?.trim() ?? '',
    photoUrl: user.photoURL ?? null,
  };
}
