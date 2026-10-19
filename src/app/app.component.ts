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
import { resolveProductImageUrl } from './core/products/product-image';
import { AuthService } from './services/auth.service';
import { CartService } from './services/cart.service';
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

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly cartService = inject(CartService);
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
      .subscribe((profile) => this.profile.set(profile));

    // Firestore snapshot listeners can lag behind a local write (or be
    // unavailable offline), so apply successful profile writes directly. This
    // is what makes an uploaded photo appear in the menu without a restart.
    this.users.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ uid, patch }) => {
        this.profile.update((current) => {
          if (!current || current.uid !== uid) {
            return current;
          }
          return {
            ...current,
            name: patch.name?.trim() || current.name,
            phone: patch.phone !== undefined ? patch.phone.trim() : current.phone,
            photoUrl:
              'photoUrl' in patch
                ? resolveProductImageUrl(patch.photoUrl) || null
                : current.photoUrl,
          };
        });
      });

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
    ? resolveProductImageUrl(doc.photoUrl) || null
    : resolveProductImageUrl(user.photoURL) || null;
  return {
    uid: user.uid,
    name: name || 'Your account',
    phone: doc?.phone?.trim() ?? '',
    photoUrl,
  };
}
