import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { GCASH_QR_ASSET } from '../../core/payment/gcash';
import { CartItemInput } from '../../models/cart.model';
import { PaymentMethod } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  GcashDetailsRequest,
  OrderApiError,
  OrdersApiService,
} from '../../services/orders-api.service';
import { UsersService } from '../../services/users.service';
import { CheckoutPage } from './checkout.page';

function item(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    productId: 'p1',
    productName: 'House Latte',
    productImage: 'https://example.com/latte.png',
    size: 'small',
    sugar: 'Regular',
    quantity: 2,
    unitPrice: 100,
    ...overrides,
  };
}

function orderResponse(
  id = 'order-1',
  overrides: Partial<CreateOrderResponse> = {}
): CreateOrderResponse {
  return {
    id,
    subtotal: 200,
    deliveryFee: 0,
    total: 200,
    orderStatus: 'PENDING',
    paymentStatus: 'PENDING',
    ...overrides,
  };
}

function proofFile(type = 'image/png'): File {
  return new File([new Uint8Array(16)], 'gcash-proof.png', { type });
}

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

describe('CheckoutPage', () => {
  let alertCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    alertCreate = vi.fn(() =>
      Promise.resolve({ present: vi.fn(() => Promise.resolve()) })
    );
  });

  function setup(
    items: CartItemInput[] = [item()],
    profile: unknown = null,
    createOrder: ReturnType<typeof vi.fn> = vi.fn(() =>
      Promise.resolve(orderResponse())
    ),
    submitGcashDetails: ReturnType<typeof vi.fn> = vi.fn(() =>
      Promise.resolve({
        id: 'order-1',
        paymentStatus: 'VERIFYING',
        gcashDetails: {
          accountName: 'Juan dela Cruz',
          accountNumber: '09171234567',
        },
      })
    ),
    uploadPaymentProof: ReturnType<typeof vi.fn> = vi.fn(() =>
      Promise.resolve(proofResponse())
    )
  ): {
    fixture: ComponentFixture<CheckoutPage>;
    component: CheckoutPage;
    cart: CartService;
    createOrder: ReturnType<typeof vi.fn>;
    submitGcashDetails: ReturnType<typeof vi.fn>;
    uploadPaymentProof: ReturnType<typeof vi.fn>;
    navigate: ReturnType<typeof vi.fn>;
    alertCreate: ReturnType<typeof vi.fn>;
  } {
    TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user$: of({ uid: 'u1', email: 'juan@example.com', displayName: 'Juan dela Cruz' }),
          },
        },
        { provide: UsersService, useValue: { getUser: () => Promise.resolve(profile) } },
        {
          provide: OrdersApiService,
          useValue: { createOrder, submitGcashDetails, uploadPaymentProof },
        },
        {
          provide: ToastController,
          useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) },
        },
        { provide: AlertController, useValue: { create: alertCreate } },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(router, 'navigate').mockImplementation(navigate);

    const cart = TestBed.inject(CartService);
    items.forEach((entry) => cart.add(entry));

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();

    return {
      fixture,
      component: fixture.componentInstance,
      cart,
      createOrder,
      submitGcashDetails,
      uploadPaymentProof,
      navigate,
      alertCreate,
    };
  }

  function fillContact(component: CheckoutPage): void {
    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setPhone({ detail: { value: '09171234567' } });
    component.setAddress({ detail: { value: '123 Rizal St, Manila' } });
  }

  function fillGcash(component: CheckoutPage): void {
    component.onGcashCollect({
      accountName: 'Juan dela Cruz',
      accountNumber: '09171234567',
    });
  }

  function selectProof(component: CheckoutPage, file = proofFile()): void {
    component.onGcashProofSelected(file);
  }

  function selectGcash(component: CheckoutPage): void {
    component.setPaymentMethod({ detail: { value: PaymentMethod.GCASH } });
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should show an empty state when the cart has no items', () => {
    const { fixture, component } = setup([]);

    expect(component.isEmpty()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Your cart is empty');
  });

  it('should review the cart items with subtotal and total', () => {
    const { fixture, component } = setup([
      item({ quantity: 2, unitPrice: 100 }),
      item({ size: 'large', sugar: 'No Sugar', unitPrice: 160, quantity: 1 }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('House Latte');
    expect(element.textContent).toContain('small · Regular · x2');
    expect(element.textContent).toContain('₱200.00');
    expect(component.subtotal()).toBe(360);
    expect(component.total()).toBe(360 + component.deliveryFee);
    expect(element.textContent).toContain('₱360.00');
  });

  it('should show the delivery fee only when it is configured', () => {
    const { fixture, component } = setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(component.deliveryFee).toBe(0);
    expect(element.textContent).not.toContain('Delivery fee');
  });

  it('should require name, phone and address before ordering', () => {
    const { component } = setup();

    component.name.set('');
    component.submitted.set(true);
    expect(component.canSubmit()).toBe(false);
    expect(component.missingName()).toBe(true);
    expect(component.missingPhone()).toBe(true);
    expect(component.missingAddress()).toBe(true);

    fillContact(component);
    expect(component.canSubmit()).toBe(true);
  });

  it('should submit a COD order with customer and address details', async () => {
    const { component, cart, createOrder, navigate } = setup([
      item({ quantity: 2, unitPrice: 100 }),
    ]);

    fillContact(component);
    component.setComment({ detail: { value: 'Please ring the bell' } });
    component.setPaymentMethod({ detail: { value: PaymentMethod.COD } });
    await component.placeOrder();

    expect(createOrder).toHaveBeenCalledTimes(1);
    const request = createOrder.mock.calls[0][0] as CreateOrderRequest;

    expect(request).toEqual({
      items: [{ productId: 'p1', size: 'small', sugar: 'Regular', quantity: 2 }],
      customer: { name: 'Juan dela Cruz', phone: '09171234567' },
      address: {
        recipientName: 'Juan dela Cruz',
        phone: '09171234567',
        address: '123 Rizal St, Manila',
      },
      customerComment: 'Please ring the bell',
      paymentMethod: PaymentMethod.COD,
    });

    expect(cart.items()).toEqual([]);
    expect(component.placedOrder()?.id).toBe('order-1');
    expect(component.confirmation()?.id).toBe('order-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('confirms the order summary with the customer before placing it', async () => {
    const { component, createOrder, alertCreate } = setup([
      item({ quantity: 2, unitPrice: 100 }),
    ]);

    fillContact(component);
    await component.confirmAndPlaceOrder();

    expect(createOrder).not.toHaveBeenCalled();
    expect(alertCreate).toHaveBeenCalledTimes(1);

    const options = alertCreate.mock.calls[0][0] as {
      header: string;
      subHeader: string;
      message: string;
      cssClass: string;
      buttons: { text: string; role?: string; cssClass?: string; handler?: () => void }[];
    };
    expect(options.header).toBe('Place your order?');
    expect(options.subHeader).toContain('2 items');
    expect(options.subHeader).toContain('₱200.00');
    expect(options.message).toContain('Payment: COD');
    expect(options.cssClass).toBe('bb-order-alert');
    expect(options.buttons.map((button) => button.text)).toEqual(['Go Back', 'Place Order']);
    expect(options.buttons[0]).toEqual(
      expect.objectContaining({ role: 'cancel', cssClass: 'bb-order-cancel' })
    );
    expect(options.buttons[1].cssClass).toBe('bb-order-confirm');

    options.buttons.find((button) => button.text === 'Place Order')?.handler?.();
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it('shows the GCash method in the redesigned order confirmation', async () => {
    const { component, alertCreate } = setup();

    fillContact(component);
    selectGcash(component);
    fillGcash(component);
    selectProof(component);
    await component.confirmAndPlaceOrder();

    const options = alertCreate.mock.calls[0][0] as {
      subHeader: string;
      message: string;
    };
    expect(options.subHeader).toContain('Total ₱200.00');
    expect(options.message).toContain('Payment: GCash');
    expect(options.message).toContain('scanning the QR code');
  });

  it('does not place the order when the confirmation is cancelled', async () => {
    const { component, createOrder, alertCreate } = setup();

    fillContact(component);
    await component.confirmAndPlaceOrder();

    const options = alertCreate.mock.calls[0][0] as {
      buttons: { text: string; role?: string; handler?: () => void }[];
    };
    const back = options.buttons.find((button) => button.role === 'cancel');
    expect(back?.handler).toBeUndefined();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('ignores a second placeOrder while one is already in flight', async () => {
    let resolveOrder: (value: CreateOrderResponse) => void = () => {};
    const pending = new Promise<CreateOrderResponse>((resolve) => {
      resolveOrder = resolve;
    });
    const createOrder = vi.fn(() => pending);
    const { component } = setup([item()], null, createOrder);

    fillContact(component);
    const first = component.placeOrder();
    const second = component.placeOrder();

    expect(createOrder).toHaveBeenCalledTimes(1);

    resolveOrder(orderResponse());
    await Promise.all([first, second]);
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it('should show the success screen with the order id and totals after ordering', async () => {
    const { fixture, component } = setup([item({ quantity: 2, unitPrice: 100 })]);

    fillContact(component);
    await component.placeOrder();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="order-success"]')).toBeTruthy();
    expect(element.textContent).toContain('Your Order Is Confirmed!');
    expect(element.querySelector('[data-testid="order-id"]')?.textContent).toContain('order-1');
    expect(element.textContent).toContain('₱200.00');
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Pending'
    );
  });

  it('shows the item summary, total and COD method on the success screen', async () => {
    const { fixture, component } = setup(
      [
        item({ quantity: 2, unitPrice: 100 }),
        item({
          productId: 'p2',
          productName: 'Iced Mocha',
          size: 'large',
          sugar: 'No Sugar',
          quantity: 1,
          unitPrice: 150,
        }),
      ],
      null,
      vi.fn(() =>
        Promise.resolve(orderResponse('order-1', { subtotal: 350, total: 350 }))
      )
    );

    fillContact(component);
    await component.placeOrder();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const summary = element.querySelector('[data-testid="order-summary"]');
    const items = element.querySelectorAll('[data-testid="order-item"]');

    expect(items).toHaveLength(2);
    expect(summary?.textContent).toContain('House Latte');
    expect(summary?.textContent).toContain('small · Regular · x2');
    expect(summary?.textContent).toContain('Iced Mocha');
    expect(summary?.textContent).toContain('large · No Sugar · x1');
    expect(summary?.textContent).toContain('₱200.00');
    expect(summary?.textContent).toContain('₱150.00');

    expect(element.querySelector('[data-testid="payment-method"]')?.textContent).toContain(
      'Cash on Delivery (COD)'
    );
    expect(element.querySelector('[data-testid="cod-status-note"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="order-total"]')?.textContent).toContain(
      '₱350.00'
    );
  });

  it('navigates to tracking and continue shopping from the success screen', async () => {
    const { fixture, component, navigate } = setup();

    fillContact(component);
    await component.placeOrder();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="track-order-button"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="continue-shopping-button"]')).toBeTruthy();

    component.trackOrder();
    expect(navigate).toHaveBeenCalledWith(['/my-orders', 'order-1']);

    component.continueShopping();
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('does not create another order when Place Order is pressed again after success', async () => {
    const { component, createOrder } = setup();

    fillContact(component);
    await component.placeOrder();
    expect(createOrder).toHaveBeenCalledTimes(1);

    await component.placeOrder();
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it('should reject an obviously invalid phone number before ordering', async () => {
    const { component, createOrder } = setup();

    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setAddress({ detail: { value: '123 Rizal St, Manila' } });
    component.setPhone({ detail: { value: '12' } });
    component.submitted.set(true);

    expect(component.invalidPhone()).toBe(true);
    expect(component.canSubmit()).toBe(false);

    await component.placeOrder();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('should offer COD and GCash as the payment options', () => {
    const { component, fixture } = setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(component.paymentMethods.map((method) => method.value)).toEqual([
      PaymentMethod.COD,
      PaymentMethod.GCASH,
    ]);
    expect(element.textContent).toContain('GCash');
    expect(element.textContent).not.toContain('Online Payment');
    expect(component.paymentMethod()).toBe(PaymentMethod.COD);
  });

  it('shows a Terms of Service notice without gating Place Order', () => {
    const { component, fixture } = setup();
    const notice = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="checkout-terms-notice"]'
    );

    expect(notice).toBeTruthy();
    expect(notice?.textContent).toContain('Terms of Service');
    expect(notice?.querySelector('a')?.getAttribute('href')).toBe('/terms');

    // The notice is informational only: it never changes canSubmit().
    fillContact(component);
    expect(component.canSubmit()).toBe(true);
  });

  it('should select the payment method when its row is clicked', () => {
    const { fixture, component } = setup();

    expect(component.paymentMethod()).toBe(PaymentMethod.COD);

    const items = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('ion-item.payment-option')
    );
    expect(items).toHaveLength(2);

    items[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.paymentMethod()).toBe(PaymentMethod.GCASH);
    expect(items[1].classList.contains('selected')).toBe(true);

    items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.paymentMethod()).toBe(PaymentMethod.COD);
  });

  it('should ignore unknown payment method values', () => {
    const { component } = setup();

    component.selectPaymentMethod('BITCOIN');
    expect(component.paymentMethod()).toBe(PaymentMethod.COD);
  });

  it('should require GCash details and a payment proof before placing the order', () => {
    const { fixture, component } = setup();

    fillContact(component);
    selectGcash(component);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.gcashSelected()).toBe(true);
    expect(component.canSubmit()).toBe(false);
    expect(element.querySelector('[data-testid="gcash-collect-panel"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="gcash-required-hint"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="payment-proof-upload"]')).toBeTruthy();

    fillGcash(component);
    expect(component.gcashDetailsValid()).toBe(true);
    expect(component.gcashProofReady()).toBe(false);
    expect(component.canSubmit()).toBe(false);

    selectProof(component);
    expect(component.gcashProofReady()).toBe(true);
    expect(component.canSubmit()).toBe(true);
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="gcash-required-hint"]')).toBeNull();

    component.setPaymentMethod({ detail: { value: PaymentMethod.COD } });
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(true);
    expect(element.querySelector('[data-testid="gcash-collect-panel"]')).toBeNull();
  });

  it('should present the QR code and the amount to pay in the collect panel', () => {
    const { fixture, component } = setup([item({ quantity: 2, unitPrice: 100 })]);

    fillContact(component);
    selectGcash(component);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const qr = element.querySelector('.gcash-qr img') as HTMLImageElement | null;
    expect(qr?.getAttribute('src')).toBe(GCASH_QR_ASSET);
    expect(element.textContent).toContain('Pay the exact total shown below');
    expect(element.querySelector('[data-testid="gcash-amount"]')?.textContent).toContain(
      '₱200.00'
    );
    expect(element.querySelector('[data-testid="gcash-name-error"]')).toBeNull();
    expect(element.querySelector('[data-testid="gcash-number-error"]')).toBeNull();
    expect(element.querySelector('.gcash-form .submit-button')).toBeNull();
  });

  it('should block Place Order until GCash details and proof are complete, then upload both', async () => {
    const validResponse = orderResponse('order-2', {
      paymentMethod: PaymentMethod.GCASH,
    });
    const { component, cart, createOrder, submitGcashDetails, uploadPaymentProof, navigate } =
      setup([item()], null, vi.fn(() => Promise.resolve(validResponse)));

    fillContact(component);
    selectGcash(component);
    await component.placeOrder();

    expect(createOrder).not.toHaveBeenCalled();
    expect(submitGcashDetails).not.toHaveBeenCalled();
    expect(uploadPaymentProof).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    fillGcash(component);
    await component.placeOrder();

    expect(createOrder).not.toHaveBeenCalled();
    expect(uploadPaymentProof).not.toHaveBeenCalled();

    const file = proofFile();
    selectProof(component, file);
    await component.placeOrder();

    expect(createOrder).toHaveBeenCalledTimes(1);
    const request = createOrder.mock.calls[0][0] as CreateOrderRequest;
    expect(request.paymentMethod).toBe(PaymentMethod.GCASH);

    expect(submitGcashDetails).toHaveBeenCalledTimes(1);
    const [orderId, details] = submitGcashDetails.mock.calls[0] as [
      string,
      GcashDetailsRequest,
    ];
    expect(orderId).toBe('order-2');
    expect(details).toEqual({
      accountName: 'Juan dela Cruz',
      accountNumber: '09171234567',
    });

    expect(uploadPaymentProof).toHaveBeenCalledTimes(1);
    expect(uploadPaymentProof.mock.calls[0][0]).toBe('order-2');
    expect(uploadPaymentProof.mock.calls[0][1]).toBe(file);

    expect(navigate).not.toHaveBeenCalled();
    expect(cart.items()).toEqual([]);
    expect(component.isGcashOrder()).toBe(true);
    expect(component.gcashDetailsSubmitted()).toBe(true);
    expect(component.gcashProofUploaded()).toBe(true);
    expect(component.showGcashPaymentPanel()).toBe(false);
  });

  it('retries a failed proof upload on the same order without creating a duplicate', async () => {
    const uploadPaymentProof = vi
      .fn()
      .mockRejectedValueOnce(
        new OrderApiError('The server rejected the request (500).', 500)
      )
      .mockResolvedValue(proofResponse('order-2'));
    const { component, cart, createOrder } = setup(
      [item()],
      null,
      vi.fn(() =>
        Promise.resolve(orderResponse('order-2', { paymentMethod: PaymentMethod.GCASH }))
      ),
      undefined,
      uploadPaymentProof
    );

    fillContact(component);
    selectGcash(component);
    fillGcash(component);
    selectProof(component);
    await component.placeOrder();

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(uploadPaymentProof).toHaveBeenCalledTimes(1);
    expect(component.placedOrder()?.id).toBe('order-2');
    expect(component.gcashProofFailed()).toBe(true);
    expect(component.gcashProofUploaded()).toBe(false);
    expect(component.showGcashPaymentPanel()).toBe(true);
    expect(cart.items()).toEqual([]);

    await component.retryGcashSubmission();

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(uploadPaymentProof).toHaveBeenCalledTimes(2);
    expect(uploadPaymentProof.mock.calls[1][0]).toBe('order-2');
    expect(component.gcashProofUploaded()).toBe(true);
    expect(component.gcashProofFailed()).toBe(false);
    expect(component.showGcashPaymentPanel()).toBe(false);
  });

  it('should show the verifying notice once details are submitted with the order', async () => {
    const { fixture, component } = setup();

    fillContact(component);
    selectGcash(component);
    fillGcash(component);
    selectProof(component);
    await component.placeOrder();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="order-success"]')).toBeTruthy();
    expect(element.textContent).toContain('Your Order Is Confirmed!');
    expect(element.querySelector('[data-testid="payment-method"]')?.textContent).toContain(
      'GCash'
    );
    expect(element.querySelector('[data-testid="gcash-notice"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="gcash-payment-panel"]')).toBeNull();
    expect(element.textContent).toContain('verify');
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Verifying'
    );
    // The order was placed, but the payment is not marked as complete.
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).not.toContain(
      'Paid'
    );
  });

  it('should keep the QR panel with a retry form when details submission fails', async () => {
    const failing = vi.fn(() =>
      Promise.reject(new OrderApiError('The server rejected the request (500).', 500))
    );
    const { fixture, component, cart } = setup(
      [item()],
      null,
      vi.fn(() =>
        Promise.resolve(orderResponse('order-2', { paymentMethod: PaymentMethod.GCASH }))
      ),
      failing
    );

    fillContact(component);
    selectGcash(component);
    fillGcash(component);
    selectProof(component);
    await component.placeOrder();
    fixture.detectChanges();

    expect(component.placedOrder()?.id).toBe('order-2');
    expect(cart.items()).toEqual([]);

    const element = fixture.nativeElement as HTMLElement;
    expect(component.showGcashPaymentPanel()).toBe(true);
    expect(element.querySelector('[data-testid="gcash-payment-panel"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="gcash-submit-error"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Verifying'
    );
  });

  it('should send the customer back to login when details submission expires the session', async () => {
    const expired = vi.fn(() =>
      Promise.reject(new OrderApiError('Authentication is required.', 401))
    );
    const { component, navigate } = setup(
      [item()],
      null,
      vi.fn(() =>
        Promise.resolve(orderResponse('order-2', { paymentMethod: PaymentMethod.GCASH }))
      ),
      expired
    );

    fillContact(component);
    selectGcash(component);
    fillGcash(component);
    selectProof(component);
    await component.placeOrder();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: '/checkout', reason: 'expired' },
    });
  });

  it('should explain a rejected GCash payment instead of showing the form', async () => {
    const { fixture, component } = setup(
      [item()],
      null,
      vi.fn(() =>
        Promise.resolve(orderResponse('order-3', { paymentMethod: PaymentMethod.GCASH }))
      ),
      vi.fn(() => Promise.resolve({ id: 'order-3', paymentStatus: 'REJECTED' })),
      vi.fn(() => Promise.resolve(proofResponse('order-3', 'REJECTED')))
    );

    fillContact(component);
    selectGcash(component);
    fillGcash(component);
    selectProof(component);
    await component.placeOrder();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('could not be verified');
    expect(element.querySelector('[data-testid="gcash-notice"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="gcash-payment-panel"]')).toBeNull();
    expect(element.querySelector('[data-testid="payment-status"]')?.textContent).toContain(
      'Payment rejected'
    );
  });

  it('should keep using COD when the backend omits the confirmed payment method', async () => {
    const { component, fixture } = setup();

    fillContact(component);
    component.setPaymentMethod({ detail: { value: PaymentMethod.COD } });
    await component.placeOrder();

    expect(component.isGcashOrder()).toBe(false);
    expect(component.showGcashPaymentPanel()).toBe(false);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="gcash-collect-panel"]')
    ).toBeNull();
  });

  it('should store an empty comment when the customer leaves it blank', async () => {
    const { component, createOrder } = setup();

    fillContact(component);
    await component.placeOrder();

    const request = createOrder.mock.calls[0][0] as CreateOrderRequest;
    expect(request.customerComment).toBe('');
  });

  it('should keep the cart and show an error when order creation fails', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('permission denied')));
    const { fixture, component, cart, navigate } = setup([item()], null, failing);

    fillContact(component);
    await component.placeOrder();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(failing).toHaveBeenCalledTimes(1);
    expect(cart.items().length).toBe(1);
    expect(component.placedOrder()).toBeNull();
    expect(element.querySelector('[data-testid="order-success"]')).toBeNull();
    expect(component.errorMessage()).toContain('could not place your order');
    expect(component.submitting()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should send the customer back to login when the session expired', async () => {
    const expired = vi.fn(() =>
      Promise.reject(new OrderApiError('Authentication is required.', 401))
    );
    const { component, cart, navigate } = setup([item()], null, expired);

    fillContact(component);
    await component.placeOrder();

    expect(component.errorMessage()).toContain('session has expired');
    expect(cart.items().length).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: '/checkout', reason: 'expired' },
    });
  });

  it('should explain when the backend rejects an unavailable product', async () => {
    const unavailable = vi.fn(() =>
      Promise.reject(
        new OrderApiError('"House Latte" is currently unavailable.', 409)
      )
    );
    const { component, navigate } = setup([item()], null, unavailable);

    fillContact(component);
    await component.placeOrder();

    expect(component.errorMessage()).toContain('currently unavailable');
    expect(component.errorMessage()).toContain('Update your cart to continue.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should not create an order while required fields are missing', async () => {
    const { component, createOrder } = setup();

    component.submitted.set(true);
    component.name.set('Juan dela Cruz');
    await component.placeOrder();

    expect(createOrder).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBeNull();
  });

  it('should prefill the contact details from the customer profile', async () => {
    const { component, fixture } = setup([item()], {
      name: 'Juan dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St, Manila',
    });

    await fixture.whenStable();

    expect(component.name()).toBe('Juan dela Cruz');
    expect(component.phone()).toBe('09171234567');
    expect(component.address()).toBe('123 Rizal St, Manila');
  });

  it('should not overwrite details the customer already typed', async () => {
    const { component, fixture } = setup([item()], {
      name: 'Profile Name',
      phone: '0999',
      address: 'Profile Address',
    });

    component.setPhone({ detail: { value: '09170000000' } });
    await fixture.whenStable();

    expect(component.phone()).toBe('09170000000');
    expect(component.name()).toBe('Juan dela Cruz');
    expect(component.address()).toBe('Profile Address');
  });
});
