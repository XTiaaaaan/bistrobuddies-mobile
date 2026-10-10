import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe } from 'ionicons/icons';
import { formatPeso } from '../../core/format/price';
import { Product, ProductSize } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';

export type ProductGridStatus = 'loading' | 'ready' | 'error';

const SIZE_ORDER: ProductSize[] = ['small', 'medium', 'large'];
const STANDARD_SUGAR_OPTIONS = ['No Sugar', 'Less Sugar', 'Regular', 'Extra Sugar'];

@Component({
  selector: 'app-product-grid',
  templateUrl: './product-grid.component.html',
  styleUrls: ['./product-grid.component.scss'],
  standalone: true,
  imports: [IonButton, IonIcon, IonSpinner, RouterLink],
})
export class ProductGridComponent implements OnInit {
  /** Only show products marked as available. */
  readonly availableOnly = input(false);
  /** Maximum number of products to render. 0 means no limit. */
  readonly limit = input(0);

  readonly products = signal<Product[]>([]);
  readonly status = signal<ProductGridStatus>('loading');
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  private readonly productsService = inject(ProductsService);
  private readonly cartService = inject(CartService);
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ alertCircle, cafe });
  }

  ngOnInit() {
    this.load();
  }

  retry() {
    this.status.set('loading');
    this.load();
  }

  isAvailable(product: Product): boolean {
    return product.available !== false;
  }

  hasImage(product: Product): boolean {
    return Boolean(product.imageUrl) && !this.failedImages().has(product.id);
  }

  onImageError(productId: string): void {
    this.failedImages.update((current) => {
      const next = new Set(current);
      next.add(productId);
      return next;
    });
  }

  startingPrice(product: Product): string {
    const prices = [product.smallPrice, product.mediumPrice, product.largePrice].filter(
      (price): price is number => typeof price === 'number' && Number.isFinite(price) && price > 0
    );

    if (prices.length === 0) {
      return formatPeso(null);
    }

    return formatPeso(Math.min(...prices));
  }

  /** Unit price for a size, or null when the product has no valid price there. */
  priceFor(product: Product, size: ProductSize): number | null {
    const price =
      size === 'small'
        ? product.smallPrice
        : size === 'medium'
          ? product.mediumPrice
          : product.largePrice;
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  }

  /** Smallest size that has a valid price, matching the details page default. */
  defaultSize(product: Product): ProductSize | null {
    return SIZE_ORDER.find((size) => this.priceFor(product, size) !== null) ?? null;
  }

  /**
   * First sugar option the backend will accept for this product (the product
   * document is the source of truth), or null when none is configured.
   */
  defaultSugar(product: Product): string | null {
    const configured = (product.sugarOptions ?? []).filter(
      (option) => typeof option === 'string' && option.trim() !== ''
    );
    if (configured.length === 0) {
      return null;
    }

    const matched = STANDARD_SUGAR_OPTIONS.filter((option) =>
      configured.some((value) => value.toLowerCase() === option.toLowerCase())
    );
    return (matched.length > 0 ? matched : configured)[0] ?? null;
  }

  canQuickAdd(product: Product): boolean {
    return (
      this.isAvailable(product) &&
      this.defaultSize(product) !== null &&
      this.defaultSugar(product) !== null
    );
  }

  async quickAdd(product: Product): Promise<void> {
    const size = this.defaultSize(product);
    const sugar = this.defaultSugar(product);
    if (!this.isAvailable(product) || size === null || sugar === null) {
      return;
    }

    this.cartService.add({
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl ?? '',
      size,
      sugar,
      quantity: 1,
      unitPrice: this.priceFor(product, size) as number,
    });

    const toast = await this.toastController.create({
      message: `${product.name} added to your cart.`,
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  private load() {
    this.productsService
      .watchProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.products.set(this.prepare(items));
          this.status.set('ready');
        },
        error: () => this.status.set('error'),
      });
  }

  private prepare(items: Product[]): Product[] {
    const sorted = [...items].sort((a, b) => this.newestFirst(a, b));
    const filtered = this.availableOnly()
      ? sorted.filter((product) => this.isAvailable(product))
      : sorted;

    const limit = this.limit();
    return limit > 0 ? filtered.slice(0, limit) : filtered;
  }

  private newestFirst(a: Product, b: Product): number {
    const aTime = a.createdAt?.toMillis() ?? 0;
    const bTime = b.createdAt?.toMillis() ?? 0;
    return bTime - aTime;
  }
}
