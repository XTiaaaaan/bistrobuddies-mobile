import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe } from 'ionicons/icons';
import { HeaderCartButtonComponent } from '../../components/header-cart-button/header-cart-button.component';
import { formatPeso } from '../../core/format/price';
import { Product, ProductSize } from '../../models/product.model';
import { CartFlyService } from '../../services/cart-fly.service';
import { CartService } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';

export type ProductDetailsStatus = 'loading' | 'ready' | 'missing' | 'error';

export interface SizeOption {
  key: ProductSize;
  label: string;
  price: number | null;
}

const SUGAR_OPTIONS = ['No Sugar', 'Less Sugar', 'Regular', 'Extra Sugar'];
const MAX_QUANTITY = 99;

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.page.html',
  styleUrls: ['./product-details.page.scss'],
  standalone: true,
  imports: [
    HeaderCartButtonComponent,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class ProductDetailsPage implements OnInit {
  readonly id = input.required<string>();

  readonly status = signal<ProductDetailsStatus>('loading');
  readonly product = signal<Product | null>(null);
  readonly selectedSize = signal<ProductSize>('small');
  readonly sugar = signal<string>('Regular');
  readonly quantity = signal(1);
  readonly imageFailed = signal(false);
  /** Locked while an add (and its flight animation) is in progress. */
  readonly adding = signal(false);

  private readonly productsService = inject(ProductsService);
  private readonly cartService = inject(CartService);
  private readonly cartFly = inject(CartFlyService);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly sizeOptions = computed<SizeOption[]>(() => {
    const product = this.product();
    if (!product) {
      return [];
    }

    return [
      { key: 'small', label: 'Small', price: this.validPrice(product.smallPrice) },
      { key: 'medium', label: 'Medium', price: this.validPrice(product.mediumPrice) },
      { key: 'large', label: 'Large', price: this.validPrice(product.largePrice) },
    ];
  });

  readonly sugarOptions = computed<string[]>(() => {
    const configured = this.product()?.sugarOptions;
    if (!configured || configured.length === 0) {
      return [...SUGAR_OPTIONS];
    }

    const normalized = configured.map((option) => option.trim()).filter((option) => option !== '');
    if (normalized.length === 0) {
      return [...SUGAR_OPTIONS];
    }

    // Prefer the standard order, but never drop a product's own options: the
    // backend only accepts sugar values stored on the product document.
    const matched = SUGAR_OPTIONS.filter((option) =>
      normalized.some((value) => value.toLowerCase() === option.toLowerCase())
    );
    return matched.length > 0 ? matched : normalized;
  });

  readonly unitPrice = computed<number | null>(
    () => this.sizeOptions().find((option) => option.key === this.selectedSize())?.price ?? null
  );

  readonly itemPrice = computed<number | null>(() => {
    const unitPrice = this.unitPrice();
    return unitPrice === null ? null : unitPrice * this.quantity();
  });

  readonly isAvailable = computed(() => this.product()?.available !== false);

  readonly canAddToCart = computed(
    () =>
      this.status() === 'ready' &&
      this.isAvailable() &&
      this.unitPrice() !== null &&
      this.quantity() > 0 &&
      !this.adding()
  );

  constructor() {
    addIcons({ alertCircle, cafe });
  }

  ngOnInit(): void {
    this.productsService
      .watchProduct(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.product.set(product);
          this.imageFailed.set(false);
          this.status.set(product ? 'ready' : 'missing');
          if (product) {
            this.ensureSelection();
          }
        },
        error: () => this.status.set('error'),
      });
  }

  hasImage(product: Product): boolean {
    return Boolean(product.imageUrl?.trim()) && !this.imageFailed();
  }

  onImageError(): void {
    this.imageFailed.set(true);
  }

  selectSize(size: ProductSize): void {
    const option = this.sizeOptions().find((item) => item.key === size);
    if (option && option.price !== null) {
      this.selectedSize.set(size);
    }
  }

  selectSugar(sugar: string): void {
    if (this.sugarOptions().includes(sugar)) {
      this.sugar.set(sugar);
    }
  }

  increase(): void {
    this.quantity.update((value) => Math.min(value + 1, MAX_QUANTITY));
  }

  decrease(): void {
    this.quantity.update((value) => Math.max(value - 1, 1));
  }

  sizeLabel(): string {
    return this.sizeOptions().find((option) => option.key === this.selectedSize())?.label ?? '';
  }

  formatPrice(value: number | null): string {
    return formatPeso(value);
  }

  async addToCart(): Promise<void> {
    const product = this.product();
    const unitPrice = this.unitPrice();
    if (this.adding() || !product || unitPrice === null || !this.isAvailable()) {
      return;
    }

    this.adding.set(true);
    try {
      this.cartService.add({
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl ?? '',
        size: this.selectedSize(),
        sugar: this.sugar(),
        quantity: this.quantity(),
        unitPrice,
      });

      const image = this.elementRef.nativeElement.querySelector('.product-media img');
      await this.cartFly.flyToCart(image);

      const toast = await this.toastController.create({
        message: `${product.name} (${this.sizeLabel()}) added to your cart.`,
        duration: 2000,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } finally {
      this.adding.set(false);
    }
  }

  async buyNow(): Promise<void> {
    if (!this.canAddToCart()) {
      return;
    }

    await this.addToCart();
    await this.router.navigate(['/checkout']);
  }

  private ensureSelection(): void {
    const selected = this.sizeOptions().find(
      (option) => option.key === this.selectedSize() && option.price !== null
    );
    if (!selected) {
      const fallback = this.sizeOptions().find((option) => option.price !== null);
      if (fallback) {
        this.selectedSize.set(fallback.key);
      }
    }

    const sugars = this.sugarOptions();
    if (!sugars.includes(this.sugar())) {
      this.sugar.set(sugars[0] ?? SUGAR_OPTIONS[2]);
    }
  }

  private validPrice(price: number | null | undefined): number | null {
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  }
}
