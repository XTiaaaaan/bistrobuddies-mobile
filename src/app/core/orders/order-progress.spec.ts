import { Order, OrderStatus } from '../../models/order.model';
import { buildOrderProgress } from './order-progress';

type ProgressOrder = Pick<Order, 'orderStatus'>;

function makeOrder(
  orderStatus: OrderStatus,
  overrides: Partial<ProgressOrder> = {}
): ProgressOrder {
  return {
    orderStatus,
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
    expect(progress.stages.map((stage) => stage.label)).toEqual([
      'Confirmed',
      'Preparing',
      'Ready',
      'On the Way',
      'Delivered',
    ]);
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

  it('never treats READY as a delivered order', () => {
    const progress = buildOrderProgress(makeOrder(OrderStatus.READY));

    expect(progress.current).toBe(OrderStatus.READY);
    expect(progress.stages[2]?.label).toBe('Ready');
    expect(progress.stages[2]?.state).toBe('current');
    expect(progress.stages[3]?.state).toBe('upcoming');
    expect(progress.stages[4]?.state).toBe('upcoming');
    expect(progress.stages[4]?.label).toBe('Delivered');
  });

  it('marks every stage complete and labels the last stage Delivered for a completed order', () => {
    const progress = buildOrderProgress(makeOrder(OrderStatus.COMPLETED));

    expect(progress.current).toBe(OrderStatus.COMPLETED);
    expect(progress.stages[4]?.label).toBe('Delivered');
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
});
