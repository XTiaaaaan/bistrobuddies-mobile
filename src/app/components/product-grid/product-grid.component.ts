import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe, closeCircle, search } from 'ionicons/icons';
import { formatPeso } from '../../core/format/price';
import { Product, ProductSize } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';

export type ProductGridStatus = 'loading' | 'ready' | 'error';

const SIZE_ORDER: ProductSize[] = ['small', 'medium', 'large'];
const STANDARD_SUGAR_OPTIONS = ['No Sugar', 'Less Sugar', 'Regular', 'Extra Sugar'];
const SKELETON_ROWS = [0, 1, 2, 3];

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
  /** Show the search + category tools above the grid (catalog page only). */
  readonly filterable = input(false);

  /** Skeleton placeholders shown while the catalog loads. */
  readonly skeletonRows = SKELETON_ROWS;

  /** Free-text query and category applied on top of the loaded catalog. */
  readonly query = signal('');
  readonly category = signal('');

  readonly status = signal<ProductGridStatus>('loading');
  /** Full list as loaded (sorted, availability and limit applied). */
  readonly catalog = signal<Product[]>([]);
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  /** Visible grid: catalog narrowed by the active search / category tools. */
  readonly products = computed(() => this.applyFilter(this.catalog()));

  /** Categories available in the loaded catalog, alphabetically ordered. */
  readonly categories = computed(() => {
    const values = new Set<string>();
    for (const product of this.catalog()) {
      const category = product.category?.trim();
      if (category) {
        values.add(category);
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  });

  /** True when the empty result is caused by the search or a category pick. */
  readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.category() !== ''
  );

  private readonly productsService = inject(ProductsService);
  private readonly cartService = inject(CartService);
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ alertCircle, cafe, closeCircle, search });
  }

  ngOnInit() {
    this.load();
  }

  retry() {
    this.status.set('loading');
    this.load();
  }

  onQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.query.set(value);
  }

  clearQuery(): void {
    this.query.set('');
  }

  setCategory(category: string): void {
    this.category.set(category);
  }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
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
          this.catalog.set(this.prepare(items));
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

  /** Narrows the loaded catalog by the active search text and category. */
  private applyFilter(products: Product[]): Product[] {
    const query = this.query().trim().toLowerCase();
    const category = this.category();
    if (query === '' && category === '') {
      return products;
    }

    return products.filter((product) => {
      if (category !== '' && (product.category ?? '') !== category) {
        return false;
      }
      if (query === '') {
        return true;
      }
      const haystack = `${product.name} ${product.description} ${product.category ?? ''}`;
      return haystack.toLowerCase().includes(query);
    });
  }

  private newestFirst(a: Product, b: Product): number {
    const aTime = a.createdAt?.toMillis() ?? 0;
    const bTime = b.createdAt?.toMillis() ?? 0;
    return bTime - aTime;
  }
}
