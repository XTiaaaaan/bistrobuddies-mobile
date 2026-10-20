import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { PaymentMethod } from '../models/payment.model';
import { AuthService } from './auth.service';
import { OrderApiError, OrdersApiService } from './orders-api.service';

const baseUrl = environment.apiBaseUrl;

/** Lets the awaited ID token resolve so the HTTP request is actually issued. */
function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('OrdersApiService', () => {
  let httpMock: HttpTestingController;
  let service: OrdersApiService;
  let getIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getIdToken = vi.fn(() => Promise.resolve('id-token'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getIdToken } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(OrdersApiService);
  });

  afterEach(() => httpMock.verify());

  it('creates an order with the Bearer token and no client-calculated totals', async () => {
    const promise = service.createOrder({
      items: [{ productId: 'p1', size: 'small', sugar: 'Regular', quantity: 1 }],
      customer: { name: 'Juan', phone: '09171234567' },
      address: { recipientName: 'Juan', phone: '09171234567', address: '123 Rizal' },
      customerComment: '',
      paymentMethod: PaymentMethod.GCASH,
    });
    await flushMicrotasks();

    const request = httpMock.expectOne(`${baseUrl}/orders`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toEqual({
      items: [{ productId: 'p1', size: 'small', sugar: 'Regular', quantity: 1 }],
      customer: { name: 'Juan', phone: '09171234567' },
      address: { recipientName: 'Juan', phone: '09171234567', address: '123 Rizal' },
      customerComment: '',
      paymentMethod: 'GCASH',
    });
    expect(request.request.body.subtotal).toBeUndefined();
    expect(request.request.body.total).toBeUndefined();
    request.flush({
      id: 'order-1',
      subtotal: 100,
      deliveryFee: 0,
      total: 100,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'GCASH',
    });

    await expect(promise).resolves.toMatchObject({ id: 'order-1', total: 100 });
  });

  it('submits GCash details with the Bearer token and only account fields', async () => {
    const promise = service.submitGcashDetails('order-1', {
      accountName: 'Juan dela Cruz',
      accountNumber: '09171234567',
    });
    await flushMicrotasks();

    const request = httpMock.expectOne(`${baseUrl}/orders/order-1/gcash-details`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toEqual({
      accountName: 'Juan dela Cruz',
      accountNumber: '09171234567',
    });
    request.flush({
      id: 'order-1',
      paymentStatus: 'VERIFYING',
      gcashDetails: { accountName: 'Juan dela Cruz', accountNumber: '09171234567' },
    });

    await expect(promise).resolves.toEqual({
      id: 'order-1',
      paymentStatus: 'VERIFYING',
      gcashDetails: { accountName: 'Juan dela Cruz', accountNumber: '09171234567' },
    });
  });

  it('encodes the order id in the GCash endpoint path', async () => {
    const promise = service.submitGcashDetails('order/with space', {
      accountName: 'Juan',
      accountNumber: '09171234567',
    });
    await flushMicrotasks();

    const request = httpMock.expectOne(
      `${baseUrl}/orders/${encodeURIComponent('order/with space')}/gcash-details`
    );
    request.flush({ id: 'order/with space', paymentStatus: 'VERIFYING' });
    await promise;
  });

  it('uploads payment proof as multipart form data with the Bearer token', async () => {
    const file = new File([new Uint8Array(16)], 'gcash-proof.png', {
      type: 'image/png',
    });
    const promise = service.uploadPaymentProof('order-1', file);
    await flushMicrotasks();

    const request = httpMock.expectOne(`${baseUrl}/orders/order-1/payment-proof`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toBeInstanceOf(FormData);
    const uploaded = (request.request.body as FormData).get('file') as File;
    expect(uploaded.name).toBe(file.name);
    expect(uploaded.type).toBe(file.type);
    expect(uploaded.size).toBe(file.size);
    request.flush({
      id: 'order-1',
      paymentStatus: 'VERIFYING',
      paymentProof: {
        url: 'https://res.cloudinary.com/test-cloud/image/upload/proof.png',
        publicId: 'bistrobuddies/proof',
        mimeType: 'image/png',
        size: 16,
        submittedBy: 'u1',
        submittedAt: '2026-10-20T00:00:00.000Z',
      },
    });

    await expect(promise).resolves.toMatchObject({
      id: 'order-1',
      paymentStatus: 'VERIFYING',
      paymentProof: {
        url: 'https://res.cloudinary.com/test-cloud/image/upload/proof.png',
        mimeType: 'image/png',
      },
    });
  });

  it('encodes the order id in the payment proof endpoint path', async () => {
    const file = new File([new Uint8Array(16)], 'proof.png', { type: 'image/png' });
    const promise = service.uploadPaymentProof('order/with space', file);
    await flushMicrotasks();

    const request = httpMock.expectOne(
      `${baseUrl}/orders/${encodeURIComponent('order/with space')}/payment-proof`
    );
    request.flush({
      id: 'order/with space',
      paymentStatus: 'VERIFYING',
      paymentProof: { url: 'https://example.com/proof.png' },
    });
    await promise;
  });

  it('validates payment proof before making any request', async () => {
    const empty = new File([], 'empty.png', { type: 'image/png' });
    await expect(service.uploadPaymentProof('order-1', empty)).rejects.toMatchObject({
      name: 'OrderApiError',
      message: 'The selected image file is empty.',
    });
    httpMock.expectNone(`${baseUrl}/orders/order-1/payment-proof`);
  });

  it('fails proof upload before any request when the customer is signed out', async () => {
    getIdToken.mockResolvedValue(null);
    const file = new File([new Uint8Array(16)], 'proof.png', { type: 'image/png' });

    await expect(service.uploadPaymentProof('order-1', file)).rejects.toMatchObject({
      name: 'OrderApiError',
      status: 401,
    });
    httpMock.expectNone(`${baseUrl}/orders/order-1/payment-proof`);
  });

  it('surfaces the backend message when payment proof is rejected', async () => {
    const file = new File([new Uint8Array(16)], 'proof.png', { type: 'image/png' });
    const promise = service.uploadPaymentProof('order-1', file);
    await flushMicrotasks();

    httpMock
      .expectOne(`${baseUrl}/orders/order-1/payment-proof`)
      .flush(
        { error: { message: 'Invalid image file.' } },
        { status: 400, statusText: 'Bad Request' }
      );

    await expect(promise).rejects.toMatchObject({
      name: 'OrderApiError',
      status: 400,
      message: 'Invalid image file.',
    });
  });

  it('fails before any request when the customer is signed out', async () => {
    getIdToken.mockResolvedValue(null);

    await expect(
      service.submitGcashDetails('order-1', {
        accountName: 'Juan',
        accountNumber: '09171234567',
      })
    ).rejects.toMatchObject({ name: 'OrderApiError', status: 401 });
    httpMock.expectNone(`${baseUrl}/orders/order-1/gcash-details`);
  });

  it('maps a 401 rejection to an OrderApiError with the status code', async () => {
    const promise = service.submitGcashDetails('order-1', {
      accountName: 'Juan',
      accountNumber: '09171234567',
    });
    await flushMicrotasks();

    httpMock
      .expectOne(`${baseUrl}/orders/order-1/gcash-details`)
      .flush(
        { error: { message: 'Authentication is required.' } },
        { status: 401, statusText: 'Unauthorized' }
      );

    const error = await promise.then(
      () => null,
      (reason: unknown) => reason as OrderApiError
    );
    expect(error).toBeInstanceOf(OrderApiError);
    expect(error?.status).toBe(401);
    expect(error?.message).toBe('Authentication is required.');
  });

  it('surfaces a customer-safe message for network and server failures', async () => {
    const promise = service.submitGcashDetails('order-1', {
      accountName: 'Juan',
      accountNumber: '09171234567',
    });
    await flushMicrotasks();
    httpMock
      .expectOne(`${baseUrl}/orders/order-1/gcash-details`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await expect(promise).rejects.toMatchObject({
      status: 0,
      message: 'Could not reach the BistroBuddies server. Please try again later.',
    });
  });

  it('cancels an order on the dedicated endpoint with the Bearer token', async () => {
    const promise = service.cancelOrder('order-1');
    await flushMicrotasks();

    const request = httpMock.expectOne(`${baseUrl}/orders/order-1/cancel`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toEqual({});
    request.flush({
      id: 'order-1',
      orderStatus: 'CANCELLED',
      paymentStatus: 'PENDING',
      total: 100,
    });

    await expect(promise).resolves.toMatchObject({
      id: 'order-1',
      orderStatus: 'CANCELLED',
      paymentStatus: 'PENDING',
    });
  });

  it('encodes the order id in the cancel endpoint path', async () => {
    const promise = service.cancelOrder('order/with space');
    await flushMicrotasks();

    const request = httpMock.expectOne(
      `${baseUrl}/orders/${encodeURIComponent('order/with space')}/cancel`
    );
    request.flush({ id: 'order/with space', orderStatus: 'CANCELLED', paymentStatus: 'PENDING' });
    await promise;
  });

  it('fails cancel before any request when the customer is signed out', async () => {
    getIdToken.mockResolvedValue(null);

    await expect(service.cancelOrder('order-1')).rejects.toMatchObject({
      name: 'OrderApiError',
      status: 401,
    });
    httpMock.expectNone(`${baseUrl}/orders/order-1/cancel`);
  });

  it('maps a 409 cancel rejection to an OrderApiError with the backend message', async () => {
    const promise = service.cancelOrder('order-1');
    await flushMicrotasks();

    httpMock
      .expectOne(`${baseUrl}/orders/order-1/cancel`)
      .flush(
        {
          error: {
            message: 'This order has already been confirmed and can no longer be cancelled.',
          },
        },
        { status: 409, statusText: 'Conflict' }
      );

    const error = await promise.then(
      () => null,
      (reason: unknown) => reason as OrderApiError
    );
    expect(error).toBeInstanceOf(OrderApiError);
    expect(error?.status).toBe(409);
    expect(error?.message).toContain('already been confirmed');
  });
});
