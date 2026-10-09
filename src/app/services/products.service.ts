import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Timestamp } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { Product } from '../models/product.model';

/**
 * Product payload returned by the BistroBuddies backend catalog endpoints
 * (`GET /api/products` and `GET /api/products/:id`).
 *
 * Both endpoints are public: no authentication is required, so guests can
 * browse the storefront before signing in. Prices stay size-tiered PHP values
 * because the size selector and cart re-pricing depend on them.
 */
export interface ProductApiPayload {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  /** Canonical PHP list price derived from the size tiers. */
  price?: number | null;
  currency?: string;
  available: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  smallPrice?: number | null;
  mediumPrice?: number | null;
  largePrice?: number | null;
  sugarOptions?: string[];
  cloudinaryPublicId?: string;
}

/**
 * Read-only catalog access backed by the trusted backend API.
 *
 * Products are never written from this app: creation, updates and deletion are
 * admin operations that also go through the backend API, which verifies
 * administrator privileges server-side. Firestore security rules remain in
 * place as defense in depth.
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = environment.apiBaseUrl;

  /** Full catalog, newest first. Public endpoint — works before login. */
  watchProducts(): Observable<Product[]> {
    return this.http
      .get<{ products?: ProductApiPayload[] }>(`${this.baseUrl}/products`)
      .pipe(
        map((body) =>
          Array.isArray(body?.products)
            ? body.products.map((payload) => fromPayload(payload))
            : []
        )
      );
  }

  /** One catalog product, or null when the product does not exist (404). */
  watchProduct(productId: string): Observable<Product | null> {
    return this.http
      .get<ProductApiPayload>(`${this.baseUrl}/products/${encodeURIComponent(productId)}`)
      .pipe(
        map((payload) => fromPayload(payload)),
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404
            ? of(null)
            : throwError(() => error)
        )
      );
  }
}

/** Maps a backend payload onto the app's Product model. */
export function fromPayload(payload: ProductApiPayload): Product {
  return {
    id: payload.id,
    name: payload.name ?? '',
    description: payload.description ?? '',
    category: payload.category ?? '',
    imageUrl: payload.imageUrl ?? '',
    cloudinaryPublicId: payload.cloudinaryPublicId ?? '',
    smallPrice: price(payload.smallPrice),
    mediumPrice: price(payload.mediumPrice),
    largePrice: price(payload.largePrice),
    price: payload.price === undefined || payload.price === null ? undefined : price(payload.price),
    currency: payload.currency,
    sugarOptions: Array.isArray(payload.sugarOptions) ? payload.sugarOptions : [],
    available: payload.available !== false,
    createdAt: toTimestamp(payload.createdAt),
    updatedAt: toTimestamp(payload.updatedAt),
  };
}

function price(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function toTimestamp(value: string | null | undefined): Timestamp | null {
  if (!value) {
    return null;
  }

  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : Timestamp.fromMillis(millis);
}
