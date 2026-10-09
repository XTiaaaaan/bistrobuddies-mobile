import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe, cart, trash } from 'ionicons/icons';
import { formatPeso } from '../../core/format/price';
import { CartItem, CartItemKey } from '../../models/cart.model';
import { Product, ProductSize } from '../../models/product.model';
import { CartService, MAX_QUANTITY } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';

type SelectChange = { detail: { value: unknown } };

export const SUGAR_OPTIONS = ['No Sugar', 'Less Sugar', 'Regular', 'Extra Sugar'];

/**
 * Availability of a cart line against the live catalog.
 * `checking` means the catalog has not been verified yet, so nothing is blocked.
 */
export type CartItemStatus = 'checking' | 'ok' | 'missing' | 'unavailable' | 'unpriced';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class CartPage implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly productsService = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productsById = signal<Record<string, Product>>({});

  readonly items = this.cartService.items;
  readonly itemCount = this.cartService.itemCount;
  readonly subtotal = this.cartService.subtotal;
  readonly maxQuantity = MAX_QUANTITY;

  /** Catalog state: while loading or after a network error nothing is blocked. */
  readonly productsStatus = signal<'loading' | 'ready' | 'error'>('loading');

  readonly sizes: { value: ProductSize; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];
  readonly sugarOptions = SUGAR_OPTIONS;

  readonly isEmpty = computed(() => this.items().length === 0);

  /** Cart lines that can no longer be ordered (removed, sold out or unpriced). */
  readonly blockedItems = computed(() =>
    this.items().filter((item) => {
      const status = this.itemStatus(item);
      return status !== 'ok' && status !== 'checking';
    })
  );

  readonly hasBlockedItems = computed(() => this.blockedItems().length > 0);

  constructor() {
    addIcons({ alertCircle, cafe, cart, trash });
  }

  ngOnInit(): void {
    this.loadCatalog();
  }

  itemKey(item: CartItemKey): string {
    return `${item.productId}|${item.size}|${item.sugar}`;
  }

  /** Live availability check for one cart line. */
  itemStatus(item: CartItem): CartItemStatus {
    if (this.productsStatus() !== 'ready') {
      return 'checking';
    }

    const product = this.productsById()[item.productId];
    if (!product) {
      return 'missing';
    }
    if (product.available === false) {
      return 'unavailable';
    }
    if (this.priceFor(item.productId, item.size) === null) {
      return 'unpriced';
    }
    return 'ok';
  }

  statusMessage(status: CartItemStatus): string {
    switch (status) {
      case 'missing':
        return 'This drink is no longer on the menu. Remove it to continue.';
      case 'unavailable':
        return 'Sold out right now. Remove it to continue.';
      case 'unpriced':
        return 'This size is not available anymore. Change the size or remove it.';
      default:
        return '';
    }
  }

  /** Warning shown under a cart line, or null when the line can still be ordered. */
  itemWarning(item: CartItem): string | null {
    const status = this.itemStatus(item);
    return status === 'ok' || status === 'checking' ? null : this.statusMessage(status);
  }

  priceFor(productId: string, size: ProductSize): number | null {
    const product = this.productsById()[productId];
    if (!product) {
      return null;
    }

    const price =
      size === 'small'
        ? product.smallPrice
        : size === 'medium'
          ? product.mediumPrice
          : product.largePrice;

    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  }

  priceLabel(productId: string, size: ProductSize): string {
    const price = this.priceFor(productId, size);
    return price === null ? '' : ` ${this.formatPrice(price)}`;
  }

  isSizeDisabled(item: CartItem, size: ProductSize): boolean {
    return this.productsStatus() === 'ready' && this.priceFor(item.productId, size) === null;
  }

  onSizeChange(item: CartItem, event: SelectChange): void {
    const size = event.detail.value as ProductSize;
    if (!size || size === item.size) {
      return;
    }

    const unitPrice = this.priceFor(item.productId, size);
    if (unitPrice === null) {
      return;
    }

    this.cartService.updateItem(item, { size, unitPrice });
  }

  onSugarChange(item: CartItem, event: SelectChange): void {
    const sugar = event.detail.value;
    if (typeof sugar !== 'string' || sugar === item.sugar) {
      return;
    }

    this.cartService.updateItem(item, { sugar });
  }

  increase(item: CartItem): void {
    this.cartService.increase(item);
  }

  decrease(item: CartItem): void {
    this.cartService.decrease(item);
  }

  remove(item: CartItem): void {
    this.cartService.removeItem(item);
  }

  clear(): void {
    this.cartService.clear();
  }

  /** Re-checks the catalog after a network failure. */
  retryCatalog(): void {
    this.loadCatalog();
  }

  private loadCatalog(): void {
    this.productsStatus.set('loading');
    this.productsService
      .watchProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          const map: Record<string, Product> = {};
          for (const product of products) {
            map[product.id] = product;
          }
          this.productsById.set(map);
          this.productsStatus.set('ready');
        },
        error: () => this.productsStatus.set('error'),
      });
  }

  formatPrice(value: number): string {
    return formatPeso(value);
  }
}
