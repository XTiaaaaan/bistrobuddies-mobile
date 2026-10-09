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
import { cafe, cart, trash } from 'ionicons/icons';
import { CartItem, CartItemKey } from '../../models/cart.model';
import { Product, ProductSize } from '../../models/product.model';
import { CartService, MAX_QUANTITY } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';

type SelectChange = { detail: { value: unknown } };

export const SUGAR_OPTIONS = ['No Sugar', 'Less Sugar', 'Regular', 'Extra Sugar'];

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
  private readonly productsLoaded = signal(false);
  private readonly productsById = signal<Record<string, Product>>({});

  readonly items = this.cartService.items;
  readonly itemCount = this.cartService.itemCount;
  readonly subtotal = this.cartService.subtotal;
  readonly maxQuantity = MAX_QUANTITY;

  readonly sizes: { value: ProductSize; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];
  readonly sugarOptions = SUGAR_OPTIONS;

  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    addIcons({ cafe, cart, trash });
  }

  ngOnInit(): void {
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
          this.productsLoaded.set(true);
        },
        error: () => this.productsLoaded.set(true),
      });
  }

  itemKey(item: CartItemKey): string {
    return `${item.productId}|${item.size}|${item.sugar}`;
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
    return this.productsLoaded() && this.priceFor(item.productId, size) === null;
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

  formatPrice(value: number): string {
    return `₱${value.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
