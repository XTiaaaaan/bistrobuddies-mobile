import { Order, OrderStatus } from '../../models/order.model';
import {
  buildOrderProgress,
  resolveFulfillmentType,
} from './order-progress';

type ProgressOrder = Pick<
  Order,
  'orderStatus' | 'fulfillmentType' | 'addressSnapshot'
>;

function makeOrder(
  orderStatus: OrderStatus,
  overrides: Partial<ProgressOrder> = {}
): ProgressOrder {
  return {
    orderStatus,
    fulfillmentType: null,
    addressSnapshot: {
      recipientName: 'Juan dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St, Manila',
    },
    ...overrides,
  };
}

describe('buildOrderProgress', () => {
  it('shows the full delivery sequence including On the Way', () => {
    const progress = buildOrderProgress(
      makeOrder(OrderStatus.OUT_FOR_DELIVERY)
    );

    expect(progress.fulfillmentType).toBe('DELIVERY');
    expect(progress.stages.map((stage) => stage.status)).toEqual([
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.COMPLETED,
    ]);
    expect(progress.stages.map((stage) => stage.label)).toContain('On the Way');
    expect(progress.current).toBe(OrderStatus.OUT_FOR_DELIVERY);
    expect(progress.stages.map((stage) => stage.state)).toEqual([
      'complete',
      'complete',
      'complete',
      'current',
      'upcoming',
    ]);
  });

  it.each([
    [OrderStatus.CONFIRMED, 0],
    [OrderStatus.PREPARING, 1],
    [OrderStatus.READY, 2],
    [OrderStatus.OUT_FOR_DELIVERY, 3],
  ])('marks %s as the current delivery stage', (status, index) => {
    const progress = buildOrderProgress(makeOrder(status));

    expect(progress.current).toBe(status);
    expect(progress.stages[index]?.state).toBe('current');
    expect(
      progress.stages.slice(0, index).every((stage) => stage.state === 'complete')
    ).toBe(true);
    expect(
      progress.stages
        .slice(index + 1)
        .every((stage) => stage.state === 'upcoming')
    ).toBe(true);
  });

  it('marks every stage complete for a completed delivery order', () => {
    const progress = buildOrderProgress(makeOrder(OrderStatus.COMPLETED));

    expect(progress.current).toBe(OrderStatus.COMPLETED);
    expect(progress.stages.every((stage) => stage.state === 'complete')).toBe(
      true
    );
  });

  it('skips On the Way for pickup orders', () => {
    const progress = buildOrderProgress(
      makeOrder(OrderStatus.READY, { fulfillmentType: 'PICKUP' })
    );

    expect(progress.fulfillmentType).toBe('PICKUP');
    expect(progress.stages.map((stage) => stage.status)).toEqual([
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.COMPLETED,
    ]);
    expect(progress.stages.map((stage) => stage.status)).not.toContain(
      OrderStatus.OUT_FOR_DELIVERY
    );
    expect(progress.current).toBe(OrderStatus.READY);
    expect(progress.stages[2]?.state).toBe('current');
  });

  it('never shows On the Way for a pickup status sequence', () => {
    const progress = buildOrderProgress(
      makeOrder(OrderStatus.COMPLETED, { fulfillmentType: 'PICKUP' })
    );

    expect(progress.stages).toHaveLength(4);
    expect(progress.stages.every((stage) => stage.state === 'complete')).toBe(
      true
    );
  });

  it('keeps an unconfirmed order pending with no active stage', () => {
    const progress = buildOrderProgress(makeOrder(OrderStatus.PENDING));

    expect(progress.pending).toBe(true);
    expect(progress.unknown).toBe(false);
    expect(progress.current).toBeNull();
    expect(progress.stages.every((stage) => stage.state === 'upcoming')).toBe(
      true
    );
  });

  it('handles cancelled orders without inventing a stage', () => {
    const progress = buildOrderProgress(makeOrder(OrderStatus.CANCELLED));

    expect(progress.cancelled).toBe(true);
    expect(progress.stages).toEqual([]);
    expect(progress.current).toBeNull();
  });

  it('flags statuses this app does not recognise', () => {
    const progress = buildOrderProgress(
      makeOrder('WAITING_FOR_COURIER' as OrderStatus)
    );

    expect(progress.unknown).toBe(true);
    expect(progress.current).toBeNull();
    expect(progress.stages.every((stage) => stage.state === 'upcoming')).toBe(
      true
    );
  });

  it('treats On the Way as delivery even without an address snapshot', () => {
    const progress = buildOrderProgress(
      makeOrder(OrderStatus.OUT_FOR_DELIVERY, {
        addressSnapshot: {
          recipientName: '',
          phone: '',
          address: '',
        },
      })
    );

    expect(progress.fulfillmentType).toBe('DELIVERY');
    expect(progress.stages.map((stage) => stage.status)).toContain(
      OrderStatus.OUT_FOR_DELIVERY
    );
  });
});

describe('resolveFulfillmentType', () => {
  it('prefers an explicit fulfilment type over the address fallback', () => {
    expect(
      resolveFulfillmentType(
        makeOrder(OrderStatus.CONFIRMED, { fulfillmentType: 'pickup' })
      )
    ).toBe('PICKUP');
    expect(
      resolveFulfillmentType(
        makeOrder(OrderStatus.CONFIRMED, { fulfillmentType: 'self-collect' })
      )
    ).toBe('PICKUP');
  });

  it('falls back to delivery for historic orders with an address', () => {
    expect(resolveFulfillmentType(makeOrder(OrderStatus.CONFIRMED))).toBe(
      'DELIVERY'
    );
  });

  it('falls back to pickup when there is no address', () => {
    expect(
      resolveFulfillmentType(
        makeOrder(OrderStatus.CONFIRMED, {
          addressSnapshot: { recipientName: '', phone: '', address: '  ' },
        })
      )
    ).toBe('PICKUP');
  });
});
