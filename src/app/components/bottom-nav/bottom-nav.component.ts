import { DestroyRef, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cafeOutline,
  cafeSharp,
  cartOutline,
  cartSharp,
  homeOutline,
  homeSharp,
  receiptOutline,
  receiptSharp,
} from 'ionicons/icons';
import { CartService } from '../../services/cart.service';

export type BottomNavTab = 'home' | 'products' | 'cart' | 'my-orders';

export interface BottomNavItem {
  key: BottomNavTab;
  label: string;
  url: string;
  icon: string;
}

/**
 * Prefixes where the fixed bottom bar would fight a focused flow: the auth
 * screens, checkout (which also hosts order success and the GCash submission
 * panel), product details (sticky add-to-cart CTA), and order details (cancel
 * + GCash payment submission).
 */
const HIDDEN_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/checkout',
  '/products/',
  '/my-orders/',
];

/** Whether the shared bottom navigation should be on screen for a router URL. */
export function isBottomNavVisible(url: string): boolean {
  const path = url.split('?')[0];
  return !HIDDEN_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function tabFor(url: string): BottomNavTab | null {
  if (url.startsWith('/dashboard')) {
    return 'home';
  }
  if (url.startsWith('/products')) {
    return 'products';
  }
  if (url.startsWith('/cart')) {
    return 'cart';
  }
  if (url.startsWith('/my-orders')) {
    return 'my-orders';
  }
  return null;
}

/**
 * App-level bottom navigation: Home, Products, Cart and My Orders. Rendered
 * once in AppComponent, so pages never duplicate it; `isBottomNavVisible`
 * drives where it (and the content padding that keeps scroll areas clear of
 * it) appears.
 */
@Component({
  selector: 'app-bottom-nav',
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
  standalone: true,
  imports: [RouterLink, IonIcon],
})
export class BottomNavComponent {
  readonly items: readonly BottomNavItem[] = [
    { key: 'home', label: 'Home', url: '/dashboard', icon: 'home' },
    { key: 'products', label: 'Products', url: '/products', icon: 'cafe' },
    { key: 'cart', label: 'Cart', url: '/cart', icon: 'cart' },
    { key: 'my-orders', label: 'My Orders', url: '/my-orders', icon: 'receipt' },
  ];

  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cartCount = computed(() => this.cartService.itemCount());
  readonly activeTab = signal<BottomNavTab | null>(null);

  constructor() {
    addIcons({
      homeOutline,
      homeSharp,
      cafeOutline,
      cafeSharp,
      cartOutline,
      cartSharp,
      receiptOutline,
      receiptSharp,
    });

    this.activeTab.set(tabFor(this.router.url));
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.activeTab.set(tabFor(event.urlAfterRedirects));
        }
      });
  }

  /** Accessible cart name that carries the live item count. */
  cartLinkLabel(): string | null {
    const count = this.cartCount();
    return count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : null;
  }
}
