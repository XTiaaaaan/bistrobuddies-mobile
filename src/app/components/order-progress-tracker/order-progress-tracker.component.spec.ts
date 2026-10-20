import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Order, OrderStatus } from '../../models/order.model';
import { OrderProgressTrackerComponent } from './order-progress-tracker.component';

type ProgressOrder = Pick<
  Order,
  'orderStatus' | 'fulfillmentType' | 'addressSnapshot'
>;

function makeOrder(
  orderStatus: OrderStatus,
  overrides: Partial<ProgressOrder> = {}
): Order {
  return {
    orderStatus,
    fulfillmentType: null,
    addressSnapshot: {
      recipientName: 'Juan dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St, Manila',
    },
    ...overrides,
  } as Order;
}

describe('OrderProgressTrackerComponent', () => {
  function setup(order: Order): ComponentFixture<OrderProgressTrackerComponent> {
    TestBed.configureTestingModule({
      imports: [OrderProgressTrackerComponent],
    });
    const fixture = TestBed.createComponent(OrderProgressTrackerComponent);
    fixture.componentRef.setInput('order', order);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders every delivery stage and highlights On the Way', () => {
    const fixture = setup(makeOrder(OrderStatus.OUT_FOR_DELIVERY));
    const element = fixture.nativeElement as HTMLElement;
    const steps = element.querySelectorAll('[data-testid="order-progress"] li');

    expect(steps).toHaveLength(5);
    expect(element.textContent).toContain('On the Way');
    expect(
      element.querySelector('[data-status="OUT_FOR_DELIVERY"]')?.getAttribute(
        'data-state'
      )
    ).toBe('current');
    expect(
      element.querySelectorAll('[data-state="complete"]')
    ).toHaveLength(3);
    expect(element.textContent).toContain('Current');
  });

  it('renders four stages for pickup and omits On the Way', () => {
    const fixture = setup(
      makeOrder(OrderStatus.READY, { fulfillmentType: 'PICKUP' })
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelectorAll('[data-testid="order-progress"] li')
    ).toHaveLength(4);
    expect(element.textContent).not.toContain('On the Way');
    expect(element.textContent).toContain('Pickup');
    expect(
      element.querySelector('[data-status="READY"]')?.getAttribute('data-state')
    ).toBe('current');
  });

  it('shows a cancellation notice instead of stages', () => {
    const fixture = setup(makeOrder(OrderStatus.CANCELLED));
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('[data-testid="order-progress-cancelled"]')
    ).toBeTruthy();
    expect(element.querySelectorAll('[data-testid="order-progress"] li')).toHaveLength(
      0
    );
  });

  it('explains that a pending order is waiting for confirmation', () => {
    const fixture = setup(makeOrder(OrderStatus.PENDING));
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('[data-testid="order-progress-pending"]')
    ).toBeTruthy();
    expect(element.querySelectorAll('[data-state="current"]')).toHaveLength(0);
  });

  it('shows an unknown-status notice without breaking', () => {
    const fixture = setup(makeOrder('WAITING_FOR_COURIER' as OrderStatus));
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('[data-testid="order-progress-unknown"]')
    ).toBeTruthy();
    expect(element.querySelectorAll('[data-testid="order-progress"] li')).toHaveLength(
      0
    );
  });
});
