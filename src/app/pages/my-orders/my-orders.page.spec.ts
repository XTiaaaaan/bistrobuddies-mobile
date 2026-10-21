import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Order, OrderStatus, RefundStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';
import { MyOrdersPage } from './my-orders.page';

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
        imageUrl: '',
        size: 'medium',
        sugar: 'Less Sugar',
        quantity: 2,
        unitPrice: 130,
        subtotal: 260,
      },
    ],
    subtotal: 260,
    deliveryFee: 0,
    total: 260,
    customerComment: '',
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.PENDING,
    orderStatus: OrderStatus.PENDING,
    createdAt: Timestamp.fromMillis(1759900000000),
    updatedAt: Timestamp.fromMillis(1759900000000),
    ...overrides,
  };
}

describe('MyOrdersPage', () => {
  let orders$: BehaviorSubject<Order[]>;
  let watchedCustomers: string[];

  function setup(
    uid: string | null = 'u1',
    initialOrders: Order[] = [],
    watchFactory?: (customerId: string) => Observable<Order[]>
  ): ComponentFixture<MyOrdersPage> {
    orders$ = new BehaviorSubject<Order[]>(initialOrders);
    watchedCustomers = [];

    TestBed.configureTestingModule({
      imports: [MyOrdersPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { uid$: of(uid) } },
        {
          provide: OrdersService,
          useValue: {
            watchCustomerOrders: (customerId: string) => {
              watchedCustomers.push(customerId);
              return watchFactory
                ? watchFactory(customerId)
                : (orders$ as Observable<Order[]>);
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(MyOrdersPage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should watch only the signed-in customer orders', () => {
    setup('u1', []);

    expect(watchedCustomers).toEqual(['u1']);
  });

  it('should show an empty state when the customer has no orders', () => {
    const fixture = setup('u1', []);
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('empty');
    expect(element.textContent).toContain('No orders yet');
  });

  it('should render order date, items, sizes, sugar, quantity, total and statuses', () => {
    const fixture = setup('u1', [makeOrder()]);
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.textContent).toContain('Order #order-1');
    expect(element.textContent).toContain('Oct');
    expect(element.textContent).toContain('House Latte');
    expect(element.textContent).toContain('medium · Less Sugar · x2');
    expect(element.textContent).toContain('₱260.00');
    expect(element.textContent).toContain('COD');
    expect(element.textContent).toContain('Pending');
    expect(element.querySelector('.st-pending')).toBeTruthy();
    expect(element.querySelector('.pay-pending')).toBeTruthy();
  });

  it('should update the order status in real time without a refresh', () => {
    const fixture = setup('u1', [makeOrder()]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.st-pending')).toBeTruthy();

    orders$.next([
      makeOrder({ orderStatus: OrderStatus.PREPARING, paymentStatus: PaymentStatus.PAID }),
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.textContent).toContain('Preparing');
    expect(element.textContent).toContain('Paid');
    expect(element.querySelector('.st-preparing')).toBeTruthy();
    expect(element.querySelector('.pay-paid')).toBeTruthy();
    expect(element.querySelector('.st-pending')).toBeNull();
  });

  it('should render the customer-facing labels for every order status', () => {
    const fixture = setup('u1', [
      makeOrder({ id: 'confirmed', orderStatus: OrderStatus.CONFIRMED }),
      makeOrder({ id: 'preparing', orderStatus: OrderStatus.PREPARING }),
      makeOrder({ id: 'ready', orderStatus: OrderStatus.READY }),
      makeOrder({ id: 'on-the-way', orderStatus: OrderStatus.OUT_FOR_DELIVERY }),
      makeOrder({ id: 'delivered', orderStatus: OrderStatus.COMPLETED }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Confirmed');
    expect(element.textContent).toContain('Preparing');
    expect(element.textContent).toContain('Ready');
    expect(element.textContent).toContain('On the Way');
    expect(element.textContent).toContain('Delivered');
    expect(element.textContent).not.toContain('Completed');
  });

  it('should not render a redundant Delivery tag on order cards', () => {
    const fixture = setup('u1', [makeOrder()]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).not.toContain('Delivery');
  });

  it('should show the backend PAID status for a delivered COD order without changing it', () => {
    const fixture = setup('u1', [
      makeOrder({
        orderStatus: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PAID,
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Delivered');
    expect(element.textContent).toContain('Paid');
    expect(element.querySelector('.pay-paid')).toBeTruthy();
  });

  it('should leave a delivered GCash order unpaid until the backend verifies it', () => {
    const fixture = setup('u1', [
      makeOrder({
        orderStatus: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.PENDING,
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Delivered');
    expect(element.textContent).toContain('Pending');
    expect(element.querySelector('.pay-pending')).toBeTruthy();
    expect(element.querySelector('.pay-paid')).toBeNull();
  });

  it('should handle a legacy order with missing payment status safely', () => {
    const fixture = setup('u1', [
      makeOrder({ paymentStatus: undefined as unknown as PaymentStatus }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.querySelector('.pay-pending')).toBeTruthy();
    expect(element.textContent).toContain('Pending');
  });

  it('should render a GCash verifying payment status with an understandable label', () => {
    const fixture = setup('u1', [
      makeOrder({
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.VERIFYING,
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('GCash');
    expect(element.textContent).toContain('Verifying payment');
    expect(element.querySelector('.pay-verifying')).toBeTruthy();
  });

  it('should render a rejected GCash payment status', () => {
    const fixture = setup('u1', [
      makeOrder({
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.REJECTED,
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Payment rejected');
    expect(element.querySelector('.pay-rejected')).toBeTruthy();
  });

  it('should hide refund status for orders that are not cancelled', () => {
    const fixture = setup('u1', [makeOrder()]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="order-refund-status"]')).toBeNull();
  });

  it('should hide refund status for a completed order even with historic refund fields', () => {
    const fixture = setup('u1', [
      makeOrder({
        orderStatus: OrderStatus.COMPLETED,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 260,
          requestedAt: null,
          completedAt: Timestamp.fromMillis(1759900060000),
        },
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="order-refund-status"]')).toBeNull();
  });

  it('should show a cancelled order with no recorded refund', () => {
    const fixture = setup('u1', [
      makeOrder({ orderStatus: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.PENDING }),
    ]);
    const element = fixture.nativeElement as HTMLElement;
    const refundRow = element.querySelector('[data-testid="order-refund-status"]');

    expect(refundRow).toBeTruthy();
    expect(refundRow?.textContent).toContain('Refund not recorded');
    expect(refundRow?.textContent).toContain('Order cancelled — refund not recorded yet.');
    expect(element.querySelector('.refund-none')).toBeTruthy();
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
    // Payment status badges are hidden for cancelled orders.
    expect(element.querySelector('.pay-pending')).toBeNull();
    expect(element.querySelector('.pay-paid')).toBeNull();
    expect(element.querySelector('.pay-verifying')).toBeNull();
  });

  it('should show a cancelled historic order without refund fields as not recorded', () => {
    const fixture = setup('u1', [
      makeOrder({ orderStatus: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.PAID }),
    ]);
    const element = fixture.nativeElement as HTMLElement;
    const refundRow = element.querySelector('[data-testid="order-refund-status"]');

    expect(refundRow?.textContent).toContain('Order cancelled — refund not recorded yet.');
  });

  it('should show a pending refund without claiming it completed', () => {
    const fixture = setup('u1', [
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUND_PENDING,
          amount: 260,
          requestedAt: Timestamp.fromMillis(1759900000000),
          completedAt: null,
        },
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;
    const refundRow = element.querySelector('[data-testid="order-refund-status"]');

    expect(refundRow?.textContent).toContain('Refund pending');
    expect(refundRow?.textContent).toContain(
      'Refund pending — the refund has not been marked completed.'
    );
    expect(element.querySelector('.refund-pending')).toBeTruthy();
    expect(element.querySelector('.refund-completed')).toBeNull();
  });

  it('should show a completed refund with amount and date', () => {
    const fixture = setup('u1', [
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 260,
          requestedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 8, 12, 0)),
          completedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 9, 8, 30)),
        },
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;
    const refundRow = element.querySelector('[data-testid="order-refund-status"]');

    expect(refundRow?.textContent).toContain('Refund completed');
    expect(refundRow?.textContent).toContain('₱260.00');
    expect(refundRow?.textContent).toContain('returned on');
    expect(element.querySelector('.refund-completed')).toBeTruthy();
  });

  it('should keep the GCash method but hide payment status on a cancelled refunded order', () => {
    const fixture = setup('u1', [
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.GCASH,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 260,
          requestedAt: null,
          completedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 8, 12, 0)),
        },
      }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    // The payment method stays useful, but the stored payment status is hidden.
    expect(element.textContent).toContain('GCash');
    expect(element.querySelector('.pay-paid')).toBeNull();
    expect(element.textContent).not.toContain('Paid');
    expect(element.querySelector('.st-cancelled')).toBeTruthy();
    expect(element.querySelector('[data-testid="order-refund-status"]')).toBeTruthy();
  });

  it('should surface a refund status pushed in real time without a refresh', () => {
    const fixture = setup('u1', [makeOrder({ orderStatus: OrderStatus.CANCELLED })]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="order-refund-status"]')?.textContent).toContain(
      'Order cancelled — refund not recorded yet.'
    );

    orders$.next([
      makeOrder({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PAID,
        refund: {
          status: RefundStatus.REFUNDED,
          amount: 260,
          requestedAt: null,
          completedAt: Timestamp.fromMillis(1759900060000),
        },
      }),
    ]);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="order-refund-status"]')?.textContent).toContain(
      'Refund completed'
    );
    expect(element.querySelector('.refund-completed')).toBeTruthy();
  });

  it('should show an error state when the realtime listener fails', () => {
    const fixture = setup('u1', [], () =>
      throwError(() => new Error('permission denied'))
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('error');
    expect(element.textContent).toContain('Could not load your orders');
  });

  it('should ask the customer to sign in when the session is gone', () => {
    const fixture = setup(null, []);
    const element = fixture.nativeElement as HTMLElement;

    expect(watchedCustomers).toEqual([]);
    expect(fixture.componentInstance.status()).toBe('signed-out');
    expect(fixture.componentInstance.orders()).toEqual([]);
    expect(element.textContent).toContain('Please sign in to see your orders');
  });

  it('should re-subscribe to the order stream and close the spinner on pull-to-refresh', async () => {
    const fixture = setup('u1', [makeOrder()]);
    const complete = vi.fn(() => Promise.resolve());

    await fixture.componentInstance.onRefresh({ target: { complete } });
    fixture.detectChanges();

    expect(watchedCustomers).toEqual(['u1', 'u1']);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.status()).toBe('ready');
    expect(fixture.nativeElement.textContent).toContain('Order #order-1');
  });
});
