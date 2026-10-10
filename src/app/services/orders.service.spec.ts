import { Timestamp } from 'firebase/firestore';
import { Order } from '../models/order.model';
import { sortOrdersNewestFirst } from './orders.service';

function order(id: string, createdAtMillis: number | null): Order {
  return {
    id,
    customerId: 'u1',
    customerSnapshot: { uid: 'u1', name: '', email: '', phone: '' },
    addressSnapshot: { recipientName: '', phone: '', address: '' },
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    customerComment: '',
    paymentMethod: 'COD' as Order['paymentMethod'],
    paymentStatus: 'PENDING' as Order['paymentStatus'],
    orderStatus: 'PENDING' as Order['orderStatus'],
    createdAt: createdAtMillis === null ? null : Timestamp.fromMillis(createdAtMillis),
    updatedAt: null,
  };
}

describe('sortOrdersNewestFirst', () => {
  it('sorts orders newest first', () => {
    const sorted = sortOrdersNewestFirst([
      order('a', 1000),
      order('c', 3000),
      order('b', 2000),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the input array', () => {
    const input = [order('a', 1000), order('b', 2000)];

    sortOrdersNewestFirst(input);

    expect(input.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('places orders without a timestamp last', () => {
    const sorted = sortOrdersNewestFirst([
      order('missing', null),
      order('older', 1000),
      order('newer', 2000),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['newer', 'older', 'missing']);
  });
});
