import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Order, OrderStatus } from '../../models/order.model';
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

  it('should show an error state when the realtime listener fails', () => {
    const fixture = setup('u1', [], () =>
      throwError(() => new Error('permission denied'))
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('error');
    expect(element.textContent).toContain('Could not load your orders');
  });

  it('should not query orders when the customer is signed out', () => {
    const fixture = setup(null, []);
    const element = fixture.nativeElement as HTMLElement;

    expect(watchedCustomers).toEqual([]);
    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.componentInstance.orders()).toEqual([]);
    expect(element.textContent).toContain('Could not load your orders');
  });
});
