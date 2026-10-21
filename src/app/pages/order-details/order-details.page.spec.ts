import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Order, OrderStatus, RefundStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { OrderApiError, OrdersApiService } from '../../services/orders-api.service';
import { OrdersService } from '../../services/orders.service';
import { OrderDetailsPage } from './order-details.page';

function proofResponse(id = 'order-1', paymentStatus = 'VERIFYING') {
  return {
    id,
    paymentStatus,
    paymentProof: {
      url: 'https://res.cloudinary.com/test-cloud/image/upload/proof.png',
      publicId: 'bistrobuddies/proof',
      mimeType: 'image/png',
      size: 16,
      submittedBy: 'u1',
      submittedAt: '2026-10-20T00:00:00.000Z',
    },
  };
}

function proofFile(): File {
  return new File([new Uint8Array(16)], 'proof.png', { type: 'image/png' });
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customerId: 'u1',
    customerSnapshot: {
      uid: 'u1',
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
      phone: '09171234567',
    },
    addressSnapshot: {
      recipientName: 'Juan dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St, Manila',
    },
    items: [
      {
        productId: 'p1',
        productName: 'House Latte',
        imageUrl: 'https://example.com/latte.png',
        size: 'large',
        sugar: 'No Sugar',
        quantity: 3,
        unitPrice: 160,
        subtotal: 480,
      },
    ],
    subtotal: 480,
    deliveryFee: 40,
    total: 520,
    customerComment: 'Please ring the bell',
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.PENDING,
    orderStatus: OrderStatus.PENDING,
    createdAt: Timestamp.fromMillis(1759900000000),
    updatedAt: Timestamp.fromMillis(1759900000000),
    ...overrides,
  };
}

describe('OrderDetailsPage', () => {
  let order$: BehaviorSubject<Order | null>;
  let watchSpy: ReturnType<typeof vi.fn>;

  let submitGcashDetails: ReturnType<typeof vi.fn>;
  let cancelOrder: ReturnType<typeof vi.fn>;
  let uploadPaymentProof: ReturnType<typeof vi.fn>;

  function setup(
    uid: string | null = 'u1',
    initialOrder: Order | null = makeOrder(),
    watchFactory?: () => Observable<Order | null>,
    gcashSubmit: ReturnType<typeof vi.fn> = vi.fn(() =>
      Promise.resolve({ id: 'order-1', paymentStatus: 'VERIFYING' })
    ),
    cancelApi: ReturnType<typeof vi.fn> = vi.fn(() =>
      Promise.resolve({
        id: 'order-1',
        orderStatus: 'CANCELLED',
        paymentStatus: 'PENDING',
      })
    ),
    proofUpload: ReturnType<typeof vi.fn> = vi.fn(() => Promise.resolve(proofResponse()))
  ): ComponentFixture<OrderDetailsPage> {
    order$ = new BehaviorSubject<Order | null>(initialOrder);
    watchSpy = vi.fn(() => watchFactory ? watchFactory() : (order$ as Observable<Order | null>));
    submitGcashDetails = gcashSubmit;
    cancelOrder = cancelApi;
    uploadPaymentProof = proofUpload;

    TestBed.configureTestingModule({
      imports: [OrderDetailsPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { uid$: of(uid) } },
        { provide: OrdersService, useValue: { watchOrder: watchSpy } },
        {
          provide: OrdersApiService,
          useValue: { submitGcashDetails, cancelOrder, uploadPaymentProof },
        },
      ],
    });

    const fixture = TestBed.createComponent(OrderDetailsPage);
    fixture.componentRef.setInput('id', 'order-1');
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should watch the requested order for the signed-in customer', () => {
    setup('u1');

    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(watchSpy).toHaveBeenCalledWith('order-1');
  });

  it('should show date, items, sizes, sugar, quantity, totals and payment details', () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.textContent).toContain('Order #order-1');
    expect(element.textContent).toContain('Oct');
    expect(element.textContent).toContain('House Latte');
    expect(element.textContent).toContain('large · No Sugar · x3');
    expect(element.textContent).toContain('₱160.00 each');
    expect(element.textContent).toContain('₱480.00');
    expect(element.textContent).toContain('₱40.00');
    expect(element.textContent).toContain('₱520.00');
    expect(element.textContent).toContain('COD');
    expect(element.textContent).toContain('Payment status');
    expect(element.textContent).toContain('Order status');
    expect(element.textContent).toContain('Pending');
    expect(element.textContent).toContain('Please ring the bell');
    expect(element.querySelector('.st-pending')).toBeTruthy();
    expect(element.querySelector('.pay-pending')).toBeTruthy();
  });

  it('should update order and payment status in real time without a refresh', () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.st-pending')).toBeTruthy();

    order$.next(
      makeOrder({ orderStatus: OrderStatus.READY, paymentStatus: PaymentStatus.PAID })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.textContent).toContain('Ready');
    expect(element.textContent).toContain('Paid');
    expect(element.querySelector('.st-ready')).toBeTruthy();
    expect(element.querySelector('.pay-paid')).toBeTruthy();
    expect(element.querySelector('.st-pending')).toBeNull();
  });

  it('should show On the Way in the live order progress tracker', () => {
    const fixture = setup(
      'u1',
      makeOrder({ orderStatus: OrderStatus.OUT_FOR_DELIVERY })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('[data-testid="order-progress"]')
    ).toBeTruthy();
    expect(element.textContent).toContain('On the Way');
    expect(element.querySelector('.st-out-for-delivery')?.textContent).toContain(
      'On the Way'
    );
    expect(
      element
        .querySelector('[data-status="OUT_FOR_DELIVERY"]')
        ?.getAttribute('data-state')
    ).toBe('current');
  });

  it('should label a completed order as Delivered and keep all stages complete', () => {
    const fixture = setup(
      'u1',
      makeOrder({ orderStatus: OrderStatus.COMPLETED })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.st-completed')?.textContent).toContain(
      'Delivered'
    );
    expect(element.textContent).not.toContain('Completed');
    expect(
      element
        .querySelector('[data-status="COMPLETED"]')
        ?.getAttribute('data-state')
    ).toBe('complete');
    expect(element.textContent).toContain('On the Way');
  });

  it('should not render a redundant Delivery tag in the progress tracker', () => {
    const fixture = setup('u1', makeOrder({ orderStatus: OrderStatus.READY }));
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="order-progress"] .mode')).toBeNull();
    expect(
      element.querySelector('[data-testid="order-progress"]')?.textContent
    ).not.toContain('Delivery');
  });

  it('should show PAID for a delivered COD order from the backend value', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PAID,
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Delivered');
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Paid'
    );
    expect(element.querySelector('.pay-paid')).toBeTruthy();
  });

  it('should leave a delivered GCash order unpaid until the backend verifies it', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.PENDING,
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Delivered');
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Pending'
    );
    expect(element.querySelector('.pay-pending')).toBeTruthy();
    expect(element.querySelector('.pay-paid')).toBeNull();
    expect(element.querySelector('[data-testid="gcash-paid-note"]')).toBeNull();
  });

  it('should handle a legacy order with missing payment fields safely', () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentStatus: undefined as unknown as PaymentStatus })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Pending'
    );
  });

  it('should show a missing state when the order does not exist', () => {
    const fixture = setup('u1', null);
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('missing');
    expect(element.textContent).toContain('Order not found');
  });

  it('should hide orders that belong to another customer', () => {
    const fixture = setup('u1', makeOrder({ customerId: 'someone-else' }));
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('missing');
    expect(fixture.componentInstance.order()).toBeNull();
    expect(element.textContent).toContain('Order not found');
    expect(element.textContent).not.toContain('House Latte');
  });

  it('should show an error state when the realtime listener fails', () => {
    const fixture = setup('u1', null, () =>
      throwError(() => new Error('permission denied'))
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('error');
    expect(element.textContent).toContain('Could not load this order');
  });

  it('should not open a listener when the customer is signed out', () => {
    const fixture = setup(null);
    const element = fixture.nativeElement as HTMLElement;

    expect(watchSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.status()).toBe('signed-out');
    expect(fixture.componentInstance.order()).toBeNull();
    expect(element.textContent).toContain('Please sign in to view this order');
  });

  it('should show the GCash QR and details form for a pending GCash order', () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.PENDING })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.isGcashOrder()).toBe(true);
    expect(fixture.componentInstance.showGcashForm()).toBe(true);
    expect(element.querySelector('[data-testid="gcash-payment-section"]')).toBeTruthy();
    const qr = element.querySelector('.gcash-qr img') as HTMLImageElement | null;
    expect(qr?.getAttribute('src')).toBe('assets/images/gcash-qr.jpg');
    expect(element.querySelector('[data-testid="gcash-amount"]')?.textContent).toContain(
      '₱520.00'
    );
  });

  it('should show a verifying note and no form while GCash is being verified', () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.VERIFYING })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.showGcashForm()).toBe(false);
    expect(element.querySelector('[data-testid="gcash-verifying-note"]')).toBeTruthy();
    expect(element.querySelector('app-gcash-submission-form')).toBeNull();
  });

  it('should require and upload a payment proof for a pending GCash order', async () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.PENDING })
    );
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    expect(component.canUploadProof()).toBe(true);
    expect(component.showProofPicker()).toBe(true);
    expect(element.querySelector('[data-testid="gcash-proof-required-note"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="payment-proof-upload"]')).toBeTruthy();
    expect(
      (
        element.querySelector(
          '[data-testid="upload-proof-button"]'
        ) as HTMLElement & { disabled: boolean }
      ).disabled
    ).toBe(true);

    const file = proofFile();
    component.onProofSelected(file);
    fixture.detectChanges();

    const upload = element.querySelector(
      '[data-testid="upload-proof-button"]'
    ) as HTMLElement & { disabled: boolean };
    expect(upload.disabled).toBe(false);

    await component.uploadProof();
    fixture.detectChanges();

    expect(uploadPaymentProof).toHaveBeenCalledWith('order-1', file);
    expect(component.order()?.paymentStatus).toBe(PaymentStatus.VERIFYING);
    expect(component.order()?.paymentProof?.url).toContain('proof.png');
    expect(component.proofFile()).toBeNull();
    expect(element.querySelector('[data-testid="gcash-proof-preview"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="payment-proof-upload"]')).toBeNull();
  });

  it('should replace an existing GCash payment proof', async () => {
    const fixture = setup(
      'u1',
      makeOrder({
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.REJECTED,
        paymentProof: {
          url: 'https://example.com/old-proof.png',
          mimeType: 'image/png',
          submittedAt: null,
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    expect(component.showProofPicker()).toBe(false);
    expect(element.querySelector('[data-testid="replace-proof-button"]')).toBeTruthy();
    expect(
      (element.querySelector('[data-testid="gcash-proof-preview"] img') as HTMLImageElement)
        .getAttribute('src')
    ).toBe('https://example.com/old-proof.png');

    component.openProofUpload();
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="payment-proof-upload"]')).toBeTruthy();

    component.onProofSelected(proofFile());
    await component.uploadProof();
    fixture.detectChanges();

    expect(uploadPaymentProof).toHaveBeenCalledTimes(1);
    expect(component.order()?.paymentStatus).toBe(PaymentStatus.VERIFYING);
    expect(
      (element.querySelector('[data-testid="gcash-proof-preview"] img') as HTMLImageElement)
        .getAttribute('src')
    ).toContain('proof.png');
    expect(component.proofUploadOpen()).toBe(false);
  });

  it('should show an error and keep the selected file when proof upload fails', async () => {
    const failing = vi.fn(() =>
      Promise.reject(new OrderApiError('The server rejected the request (500).', 500))
    );
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.PENDING }),
      undefined,
      undefined,
      undefined,
      failing
    );
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    const file = proofFile();
    component.onProofSelected(file);
    await component.uploadProof();
    fixture.detectChanges();

    expect(component.proofError()).toBe('The server rejected the request (500).');
    expect(component.proofFile()).toBe(file);
    expect(element.querySelector('[data-testid="gcash-proof-error"]')).toBeTruthy();
  });

  it('should send the customer back to login when proof upload expires the session', async () => {
    const expired = vi.fn(() =>
      Promise.reject(new OrderApiError('Authentication is required.', 401))
    );
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.PENDING }),
      undefined,
      undefined,
      undefined,
      expired
    );
    const router = TestBed.inject(Router);
    const navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(router, 'navigate').mockImplementation(navigate);
    const component = fixture.componentInstance;

    component.onProofSelected(proofFile());
    await component.uploadProof();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: '/my-orders/order-1', reason: 'expired' },
    });
  });

  it('should show a paid note and no form for a paid GCash order', () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.PAID })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="gcash-paid-note"]')).toBeTruthy();
    expect(element.querySelector('app-gcash-submission-form')).toBeNull();
  });

  it('should explain a rejected GCash payment and allow resubmission', async () => {
    const fixture = setup(
      'u1',
      makeOrder({
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.REJECTED,
        gcashDetails: { accountName: 'Juan dela Cruz', accountNumber: '09171234567' },
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="gcash-rejected-note"]')).toBeTruthy();
    expect(element.textContent).toContain('could not be verified');
    expect(element.querySelector('app-gcash-submission-form')).toBeNull();

    fixture.componentInstance.openResubmit();
    fixture.detectChanges();
    expect(element.querySelector('app-gcash-submission-form')).toBeTruthy();

    fixture.componentInstance.onGcashSubmitted({ paymentStatus: 'VERIFYING' });
    fixture.detectChanges();
    expect(fixture.componentInstance.order()?.paymentStatus).toBe(PaymentStatus.VERIFYING);
  });

  it('should update the payment status after a successful GCash resubmission', () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.REJECTED })
    );

    fixture.componentInstance.onGcashSubmitted({ paymentStatus: 'VERIFYING' });

    expect(fixture.componentInstance.order()?.paymentStatus).toBe(PaymentStatus.VERIFYING);
    expect(fixture.componentInstance.gcashVerifying()).toBe(true);
  });

  it('should keep COD orders free of any GCash UI', () => {
    const fixture = setup('u1', makeOrder());
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.isGcashOrder()).toBe(false);
    expect(fixture.componentInstance.canUploadProof()).toBe(false);
    expect(element.querySelector('[data-testid="gcash-payment-section"]')).toBeNull();
    expect(element.querySelector('[data-testid="payment-proof-upload"]')).toBeNull();
    expect(element.querySelector('[data-testid="gcash-proof-preview"]')).toBeNull();
    expect(element.textContent).toContain('COD');
  });

  it('should treat a historic COD order without GCash fields as COD', () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.COD, gcashDetails: undefined })
    );

    expect(fixture.componentInstance.isGcashOrder()).toBe(false);
    expect(fixture.componentInstance.showGcashForm()).toBe(false);
  });

  it('should send GCash submission payload through the injected API service', async () => {
    const fixture = setup(
      'u1',
      makeOrder({ paymentMethod: PaymentMethod.GCASH, paymentStatus: PaymentStatus.PENDING })
    );

    const form = fixture.debugElement.query(
      (node) => node.name === 'app-gcash-submission-form'
    ).componentInstance as {
      setName: (event: unknown) => void;
      setNumber: (event: unknown) => void;
      submit: () => Promise<void>;
    };

    form.setName({ detail: { value: 'Juan dela Cruz' } });
    form.setNumber({ detail: { value: '09171234567' } });
    await form.submit();

    expect(submitGcashDetails).toHaveBeenCalledWith('order-1', {
      accountName: 'Juan dela Cruz',
      accountNumber: '09171234567',
    });
    expect(fixture.componentInstance.order()?.paymentStatus).toBe(PaymentStatus.VERIFYING);
  });

  it('should offer cancellation for an order that is still pending', () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.canCancel()).toBe(true);
    expect(element.querySelector('[data-testid="cancel-order-section"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="cancel-order-button"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="cancel-confirm"]')).toBeNull();
  });

  it('should hide the cancel offer for orders that are no longer pending', () => {
    const fixture = setup('u1', makeOrder({ orderStatus: OrderStatus.CONFIRMED }));
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.canCancel()).toBe(false);
    expect(element.querySelector('[data-testid="cancel-order-section"]')).toBeNull();
  });

  it('should ask for confirmation before cancelling', () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.openCancelConfirm();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="cancel-confirm"]')).toBeTruthy();
    expect(element.textContent).toContain('cannot be undone');
    expect(element.querySelector('[data-testid="confirm-cancel-button"]')).toBeTruthy();

    fixture.componentInstance.closeCancelConfirm();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="cancel-confirm"]')).toBeNull();
    expect(element.querySelector('[data-testid="cancel-order-button"]')).toBeTruthy();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it('should cancel the order and update the status without a refresh', async () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    component.openCancelConfirm();
    await component.confirmCancel();
    fixture.detectChanges();

    expect(cancelOrder).toHaveBeenCalledTimes(1);
    expect(cancelOrder).toHaveBeenCalledWith('order-1');
    expect(component.order()?.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(component.canCancel()).toBe(false);
    expect(component.cancelOpen()).toBe(false);
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
    expect(element.textContent).toContain('Cancelled');
  });

  it('should prevent duplicate cancel requests while one is in flight', async () => {
    let releaseFirst: (() => void) | undefined;
    const slowCancel = vi.fn(
      () =>
        new Promise<{ id: string; orderStatus: string; paymentStatus: string }>((resolve) => {
          releaseFirst = () => resolve({
            id: 'order-1',
            orderStatus: 'CANCELLED',
            paymentStatus: 'PENDING',
          });
        })
    );
    const fixture = setup('u1', makeOrder(), undefined, undefined, slowCancel);
    const component = fixture.componentInstance;

    component.openCancelConfirm();
    const first = component.confirmCancel();
    await component.confirmCancel();

    expect(slowCancel).toHaveBeenCalledTimes(1);
    expect(component.cancelling()).toBe(true);

    releaseFirst?.();
    await first;
    expect(component.cancelling()).toBe(false);
  });

  it('should show the backend message when the order is no longer cancellable', async () => {
    const refused = vi.fn(() =>
      Promise.reject(
        new OrderApiError(
          'This order has already been confirmed and can no longer be cancelled.',
          409
        )
      )
    );
    const fixture = setup('u1', makeOrder(), undefined, undefined, refused);
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    component.openCancelConfirm();
    await component.confirmCancel();
    fixture.detectChanges();

    expect(component.cancelling()).toBe(false);
    expect(component.order()?.orderStatus).toBe(OrderStatus.PENDING);
    expect(element.querySelector('[data-testid="cancel-error"]')).toBeTruthy();
    expect(element.textContent).toContain('already been confirmed');
  });

  it('should show a generic message when cancelling fails without a backend message', async () => {
    const failing = vi.fn(() =>
      Promise.reject(new OrderApiError('', 500))
    );
    const fixture = setup('u1', makeOrder(), undefined, undefined, failing);
    const component = fixture.componentInstance;

    component.openCancelConfirm();
    await component.confirmCancel();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'could not cancel your order'
    );
  });

  it('should send the customer back to login when the cancel session expired', async () => {
    const fixture = setup(
      'u1',
      makeOrder(),
      undefined,
      undefined,
      vi.fn(() => Promise.reject(new OrderApiError('Authentication is required.', 401)))
    );
    const router = TestBed.inject(Router);
    const navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(router, 'navigate').mockImplementation(navigate);
    const component = fixture.componentInstance;

    component.openCancelConfirm();
    await component.confirmCancel();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: '/my-orders/order-1', reason: 'expired' },
    });
    expect(component.cancelOpen()).toBe(false);
    expect(component.cancelError()).toBeNull();
  });

  it('should refresh to the cancelled status pushed by the realtime listener', () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;

    order$.next(makeOrder({ orderStatus: OrderStatus.CANCELLED }));
    fixture.detectChanges();

    expect(fixture.componentInstance.canCancel()).toBe(false);
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
    expect(element.querySelector('[data-testid="cancel-order-section"]')).toBeNull();
  });

  it('should hide the refund section for orders that are not cancelled', () => {
    const fixture = setup('u1', makeOrder({ paymentStatus: PaymentStatus.PAID }));
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="refund-status"]')).toBeNull();
  });

  it('should hide the refund section for a completed order even with historic refund fields', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 520,
          requestedAt: null,
          completedAt: Timestamp.fromMillis(1759900060000),
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="refund-status"]')).toBeNull();
  });

  it('should describe a cancelled paid order with no recorded refund', () => {
    const fixture = setup(
      'u1',
      makeOrder({ orderStatus: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.PAID })
    );
    const element = fixture.nativeElement as HTMLElement;
    const refundSection = element.querySelector('[data-testid="refund-status"]');

    expect(refundSection).toBeTruthy();
    expect(refundSection?.textContent).toContain('Refund not recorded');
    expect(refundSection?.textContent).toContain(
      'refund not recorded yet.'
    );
    expect(element.querySelector('[data-testid="refund-amount"]')).toBeNull();
    expect(element.querySelector('[data-testid="refund-completed-date"]')).toBeNull();
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
    // Cancelled orders hide payment-status badges and labels entirely.
    expect(element.querySelector('.pay-pending')).toBeNull();
    expect(element.querySelector('[data-testid="payment-status"]')).toBeNull();
    expect(element.textContent).not.toContain('Payment status');
  });

  it('should hide a legacy refund on a cancelled unpaid COD order', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
        refund: {
          status: RefundStatus.REFUND_PENDING,
          amount: 520,
          requestedAt: Timestamp.fromMillis(1759900000000),
          completedAt: null,
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="refund-status"]')).toBeNull();
    expect(element.querySelector('[data-testid="refund-amount"]')).toBeNull();
    expect(element.querySelector('[data-testid="refund-completed-date"]')).toBeNull();
    expect(element.textContent).not.toContain('Refund pending');
    expect(element.textContent).not.toContain('Refund not recorded');
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
  });

  it('should hide the refund section for a cancelled COD order with no payment evidence', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="refund-status"]')).toBeNull();
    expect(element.textContent).not.toContain('Refund not recorded');
  });

  it('should describe a cancelled historic order without refund fields as not recorded', () => {
    const fixture = setup(
      'u1',
      makeOrder({ orderStatus: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.PAID })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('[data-testid="refund-status"]')?.textContent
    ).toContain('Order cancelled — refund not recorded yet.');
  });

  it('should show a pending refund with its amount but no completion date', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUND_PENDING,
          amount: 520,
          requestedAt: Timestamp.fromMillis(1759900000000),
          completedAt: null,
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;
    const refundSection = element.querySelector('[data-testid="refund-status"]');

    expect(refundSection?.textContent).toContain('Refund pending');
    expect(refundSection?.textContent).toContain(
      'Refund pending — the refund has not been marked completed.'
    );
    expect(element.querySelector('[data-testid="refund-amount"]')?.textContent).toContain(
      '₱520.00'
    );
    expect(element.querySelector('[data-testid="refund-completed-date"]')).toBeNull();
    // Payment status is hidden for the cancelled order, unchanged in storage.
    expect(element.querySelector('[data-testid="payment-status"]')).toBeNull();
  });

  it('should show a completed refund with amount and completion date', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 520,
          requestedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 8, 12, 0)),
          completedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 9, 8, 30)),
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;
    const refundSection = element.querySelector('[data-testid="refund-status"]');

    expect(refundSection?.textContent).toContain('Refund completed');
    expect(element.querySelector('[data-testid="refund-amount"]')?.textContent).toContain(
      '₱520.00'
    );
    const completedDate = element.querySelector('[data-testid="refund-completed-date"]');
    expect(completedDate?.textContent).toContain('2026');
    expect(completedDate?.textContent).toContain('Oct');
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
    expect(element.querySelector('[data-testid="payment-status"]')).toBeNull();
  });

  it('should preserve GCash account details on a cancelled refunded order', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.PAID,
        gcashDetails: { accountName: 'Juan dela Cruz', accountNumber: '09171234567' },
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 520,
          requestedAt: null,
          completedAt: Timestamp.fromMillis(1759900060000),
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('GCash name');
    expect(element.textContent).toContain('Juan dela Cruz');
    expect(element.textContent).toContain('GCash number');
    expect(element.textContent).toContain('09171234567');
    expect(element.querySelector('[data-testid="refund-status"]')).toBeTruthy();
    // No GCash payment form or payment-status note is offered for a cancelled order.
    expect(element.querySelector('app-gcash-submission-form')).toBeNull();
    expect(element.querySelector('[data-testid="gcash-paid-note"]')).toBeNull();
    expect(element.querySelector('[data-testid="payment-status"]')).toBeNull();
  });

  it('should surface a refund update pushed by the realtime listener without a refresh', () => {
    const fixture = setup(
      'u1',
      makeOrder({ orderStatus: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.PAID })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('[data-testid="refund-status"]')?.textContent
    ).toContain('Order cancelled — refund not recorded yet.');

    order$.next(
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUND_PENDING,
          amount: 520,
          requestedAt: Timestamp.fromMillis(1759900000000),
          completedAt: null,
        },
      })
    );
    fixture.detectChanges();

    expect(
      element.querySelector('[data-testid="refund-status"]')?.textContent
    ).toContain('Refund pending — the refund has not been marked completed.');

    order$.next(
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 520,
          requestedAt: Timestamp.fromMillis(1759900000000),
          completedAt: Timestamp.fromMillis(1759900060000),
        },
      })
    );
    fixture.detectChanges();

    expect(
      element.querySelector('[data-testid="refund-status"]')?.textContent
    ).toContain('Refund completed');
    expect(element.querySelector('[data-testid="refund-amount"]')?.textContent).toContain(
      '₱520.00'
    );
  });

  it('should not show a refund section right after an unpaid COD order is cancelled', async () => {
    const fixture = setup();
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    component.openCancelConfirm();
    await component.confirmCancel();
    fixture.detectChanges();

    expect(component.order()?.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(component.order()?.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(element.querySelector('[data-testid="refund-status"]')).toBeNull();
    expect(element.textContent).not.toContain('refund not recorded yet');
  });

  it('should offer no customer action to change a refund state', () => {
    const fixture = setup(
      'u1',
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUND_PENDING,
          amount: 520,
          requestedAt: null,
          completedAt: null,
        },
      })
    );
    const element = fixture.nativeElement as HTMLElement;
    const refundSection = element.querySelector('[data-testid="refund-status"]');

    expect(refundSection?.querySelector('button')).toBeNull();
    expect(refundSection?.querySelector('ion-button')).toBeNull();
    expect(refundSection?.querySelector('app-gcash-submission-form')).toBeNull();
  });
});
