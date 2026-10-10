import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductsService, fromPayload } from './products.service';

const baseUrl = environment.apiBaseUrl;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'House Latte',
    description: 'Smooth espresso with steamed milk.',
    category: 'hot',
    imageUrl: 'https://example.com/latte.png',
    price: 130,
    currency: 'PHP',
    available: true,
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    smallPrice: 100,
    mediumPrice: 130,
    largePrice: 160,
    sugarOptions: ['No Sugar', 'Regular'],
    cloudinaryPublicId: '',
    ...overrides,
  };
}

describe('ProductsService', () => {
  let httpMock: HttpTestingController;
  let service: ProductsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProductsService);
  });

  afterEach(() => httpMock.verify());

  it('loads the public catalog without an auth header', async () => {
    const promise = firstValueFrom(service.watchProducts());

    const request = httpMock.expectOne(`${baseUrl}/products`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ products: [payload()] });

    const products = await promise;
    expect(products).toHaveLength(1);

    const product = products[0];
    expect(product.id).toBe('p1');
    expect(product.name).toBe('House Latte');
    expect(product.category).toBe('hot');
    expect(product.description).toContain('Smooth espresso');
    expect(product.imageUrl).toBe('https://example.com/latte.png');
    expect(product.smallPrice).toBe(100);
    expect(product.mediumPrice).toBe(130);
    expect(product.largePrice).toBe(160);
    expect(product.available).toBe(true);
    expect(product.sugarOptions).toEqual(['No Sugar', 'Regular']);
    expect(product.createdAt?.toMillis()).toBe(Date.parse('2026-01-02T03:04:05.000Z'));
  });

  it('treats a missing, non-finite or zero price as 0 so no bad price renders', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({
      products: [payload({ smallPrice: null, mediumPrice: -5, largePrice: 0 })],
    });

    const [product] = await promise;
    expect(product.smallPrice).toBe(0);
    expect(product.mediumPrice).toBe(0);
    expect(product.largePrice).toBe(0);
  });

  it('marks a product with available === false as unavailable', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({
      products: [payload({ available: false })],
    });

    const [product] = await promise;
    expect(product.available).toBe(false);
  });

  it('returns an empty catalog when the payload is malformed', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({} as never);
    expect(await promise).toEqual([]);
  });

  it('loads one product by id', async () => {
    const promise = firstValueFrom(service.watchProduct('p1'));

    const request = httpMock.expectOne(`${baseUrl}/products/p1`);
    expect(request.request.method).toBe('GET');
    request.flush(payload());

    const product = await promise;
    expect(product?.name).toBe('House Latte');
  });

  it('returns null when the product does not exist', async () => {
    const promise = firstValueFrom(service.watchProduct('gone'));

    httpMock
      .expectOne(`${baseUrl}/products/gone`)
      .flush({ error: { code: 'product_not_found', message: 'nope' } }, { status: 404, statusText: 'Not Found' });

    expect(await promise).toBeNull();
  });

  it('propagates network failures so the UI can show an error state', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock
      .expectOne(`${baseUrl}/products`)
      .flush('offline', { status: 0, statusText: 'Network Error' });

    await expect(promise).rejects.toBeTruthy();
  });

  it('maps a backend payload onto the Product model', () => {
    const product = fromPayload(payload({ createdAt: null, updatedAt: null }));

    expect(product.createdAt).toBeNull();
    expect(product.updatedAt).toBeNull();
    expect(product.price).toBe(130);
    expect(product.currency).toBe('PHP');
    expect(product.available).toBe(true);
  });

  it('keeps an absolute uploaded image URL untouched', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({
      products: [payload({ imageUrl: 'http://localhost:3001/uploads/a.jpg' })],
    });

    const [product] = await promise;
    expect(product.imageUrl).toBe('http://localhost:3001/uploads/a.jpg');
  });

  it('resolves a backend-relative upload path to the backend origin, not the API path', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({
      products: [payload({ imageUrl: '/uploads/a.jpg' })],
    });

    const [product] = await promise;
    expect(product.imageUrl).toBe(`${new URL(baseUrl).origin}/uploads/a.jpg`);
    expect(product.imageUrl).not.toContain('/api/uploads');
  });

  it('maps a missing image URL to an empty string so the fallback renders', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({
      products: [payload({ imageUrl: '' })],
    });

    const [product] = await promise;
    expect(product.imageUrl).toBe('');
  });

  it('keeps the standard size prices distinct', async () => {
    const promise = firstValueFrom(service.watchProducts());

    httpMock.expectOne(`${baseUrl}/products`).flush({
      products: [
        payload({ smallPrice: 100, mediumPrice: 120, largePrice: 150, price: 120 }),
      ],
    });

    const [product] = await promise;
    expect(product.smallPrice).toBe(100);
    expect(product.mediumPrice).toBe(120);
    expect(product.largePrice).toBe(150);
    expect(product.price).toBe(120);
  });

  it('never turns a legacy flat price into three size prices', () => {
    const product = fromPayload(
      payload({ price: 100, smallPrice: null, mediumPrice: null, largePrice: null })
    );

    expect(product.price).toBe(100);
    expect(product.smallPrice).toBe(0);
    expect(product.mediumPrice).toBe(0);
    expect(product.largePrice).toBe(0);
  });
});
