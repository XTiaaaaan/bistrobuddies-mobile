import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe } from 'ionicons/icons';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';

export type ProductGridStatus = 'loading' | 'ready' | 'error';

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

  private readonly productsService = inject(ProductsService);
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

  startingPrice(product: Product): string {
    const prices = [product.smallPrice, product.mediumPrice, product.largePrice].filter(
      (price): price is number => typeof price === 'number' && Number.isFinite(price) && price > 0
    );

    if (prices.length === 0) {
      return '—';
    }

    const lowest = Math.min(...prices);
    return `₱${lowest.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
