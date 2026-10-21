import {
  Component,
  DestroyRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  MenuController,
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
  mailOutline,
  mailSharp,
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
  documentTextOutline,
  documentTextSharp,
} from 'ionicons/icons';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { SignInPromptService } from './core/auth/sign-in-prompt.service';
import {
  cacheBustProfilePhotoUrl,
  resolveProfilePhotoUrl,
} from './core/profile/profile-photo';
import { AuthService } from './services/auth.service';
import { CartService } from './services/cart.service';
import { PushNotificationsService } from './services/push-notifications.service';
import { UsersService } from './services/users.service';

/** Auth screens hide the side menu so the branding stands alone. */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

/** Customer summary shown at the top of the side menu. */
export interface MenuProfile {
  uid: string;
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
    { title: 'My Messages', url: '/my-messages', icon: 'mail' },
    { title: 'Company History', url: '/company-history', icon: 'time' },
    { title: 'About Our Products', url: '/about-products', icon: 'cafe' },
    { title: 'About the App', url: '/about', icon: 'information-circle' },
    { title: 'Contact Us', url: '/contact-us', icon: 'call' },
    { title: 'Terms of Service', url: '/terms', icon: 'document-text' },
    { title: 'Developers', url: '/developers', icon: 'people' },
  ];

  protected readonly selectedIndex = signal(0);
  protected readonly signedIn = signal(false);
  protected readonly showMenu = signal(true);
  /** Profile summary for the signed-in customer; null while signed out. */
  protected readonly profile = signal<MenuProfile | null>(null);

  /** Canonical photo URL, without the one-off cache-busting token. */
  private photoSource: string | null = null;
  private photoToken = 0;

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly cartService = inject(CartService);
  private readonly pushNotifications = inject(PushNotificationsService);
  private readonly menuController = inject(MenuController);
  private readonly signInPrompt = inject(SignInPromptService);
  private readonly destroyRef = inject(DestroyRef);

  /** Live cart counter shown next to the Cart entry in the side menu. */
  readonly cartCount = computed(() => this.cartService.itemCount());

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
      mailOutline,
      mailSharp,
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
      documentTextOutline,
      documentTextSharp,
    });

    // Keep the branded splash on screen for 2s, then reveal the app; the
    // inline fallback in index.html covers the case where bootstrapping
    // never happens.
    afterNextRender(() => window.setTimeout(() => this.dismissSplash(), 2000));
  }

  private dismissSplash(): void {
    const splash = document.getElementById('bb-splash');
    if (!splash) {
      return;
    }
    splash.classList.add('is-hidden');
    window.setTimeout(() => splash.remove(), 400);
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
      .subscribe((profile) => this.setProfile(profile));

    // Firestore snapshot listeners can lag behind a local write (or be
    // unavailable offline), so apply successful profile writes directly. This
    // is what makes an uploaded photo appear in the menu without a restart.
    this.users.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ uid, patch }) => {
        const current = this.profile();
        if (!current || current.uid !== uid) {
          return;
        }
        const next: MenuProfile = {
          ...current,
          name: patch.name?.trim() || current.name,
          phone: patch.phone !== undefined ? patch.phone.trim() : current.phone,
        };
        if ('photoUrl' in patch) {
          next.photoUrl = this.photoForDisplay(
            resolveProfilePhotoUrl(patch.photoUrl),
            true
          );
        }
        this.profile.set(next);
      });

    this.updateSelected(this.router.url);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateSelected(event.urlAfterRedirects);
      }
    });
  }

  /** Applies a profile snapshot without re-busting an unchanged photo URL. */
  private setProfile(next: MenuProfile | null): void {
    if (!next) {
      this.photoSource = null;
      this.profile.set(null);
      return;
    }
    this.profile.set({
      ...next,
      photoUrl: this.photoForDisplay(next.photoUrl, false),
    });
  }

  /**
   * Returns the URL to render for a profile photo. A new URL is used as-is;
   * an unchanged URL is kept (or, after a successful write, refreshed with a
   * one-off cache token) so snapshots cannot repeatedly append parameters.
   */
  private photoForDisplay(
    nextSource: string | null,
    refreshIfSame: boolean
  ): string | null {
    if (!nextSource) {
      this.photoSource = null;
      return null;
    }

    const sameSource = this.photoSource === nextSource;
    this.photoSource = nextSource;
    if (!sameSource) {
      return nextSource;
    }
    if (!refreshIfSame) {
      return this.profile()?.photoUrl ?? nextSource;
    }

    this.photoToken += 1;
    return cacheBustProfilePhotoUrl(
      nextSource,
      `${Date.now()}-${this.photoToken}`
    );
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

  /** Opens the private profile page, prompting guests to sign in first. */
  async openProfile(): Promise<void> {
    await this.menuController.close();
    if (!(await this.signInPrompt.requireSignIn('/profile'))) {
      return;
    }
    await this.router.navigate(['/profile']);
  }

  private updateSelected(url: string) {
    const index = this.appPages.findIndex((page) =>
      url.startsWith(page.url)
    );
    this.selectedIndex.set(index >= 0 ? index : 0);
    this.showMenu.set(!AUTH_ROUTES.some((route) => url.startsWith(route)));
  }

  async onLogout() {
    await this.menuController.close();

    if (!this.signedIn()) {
      await this.router.navigate(['/login']);
      return;
    }

    try {
      // Remove the FCM token while the Firebase session can still authorize
      // the request; sign-out clears the ID token.
      await this.pushNotifications.unregisterCurrentDevice();
      await this.auth.logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
    await this.router.navigate(['/login']);
  }
}

function toMenuProfile(
  user: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  },
  doc: { name?: string; phone?: string; photoUrl?: string | null } | null
): MenuProfile {
  const name = (doc?.name ?? user.displayName ?? user.email?.split('@')[0] ?? '').trim();
  // Firestore is the source of truth: `watchUser` re-emits as soon as the
  // profile page saves a new photo, so the menu updates without a reload.
  // A stored `photoUrl` (including an explicit null after removal) wins; Auth's
  // `photoURL` is only a fallback for older docs that never had the field.
  const hasStoredPhoto = doc !== null && 'photoUrl' in doc;
  const photoUrl = hasStoredPhoto
    ? resolveProfilePhotoUrl(doc.photoUrl)
    : resolveProfilePhotoUrl(user.photoURL);
  return {
    uid: user.uid,
    name: name || 'Your account',
    phone: doc?.phone?.trim() ?? '',
    photoUrl,
  };
}
