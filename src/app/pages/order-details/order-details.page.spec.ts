import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Order, OrderStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';
import { OrderDetailsPage } from './order-details.page';

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

  function setup(
    uid: string | null = 'u1',
    initialOrder: Order | null = makeOrder(),
    watchFactory?: () => Observable<Order | null>
  ): ComponentFixture<OrderDetailsPage> {
    order$ = new BehaviorSubject<Order | null>(initialOrder);
    watchSpy = vi.fn(() => watchFactory ? watchFactory() : (order$ as Observable<Order | null>));

    TestBed.configureTestingModule({
      imports: [OrderDetailsPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { uid$: of(uid) } },
        { provide: OrdersService, useValue: { watchOrder: watchSpy } },
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

    expect(watchSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.componentInstance.order()).toBeNull();
  });
});
