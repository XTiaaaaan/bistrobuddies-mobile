import {
  ORDER_NOTIFICATION_CHANNEL_ID,
  orderNotificationChannel,
  orderNotificationId,
  parseOrderNotificationData,
} from './notifications';

describe('notification payload helpers', () => {
  it('parses an order status notification from FCM string data', () => {
    expect(
      parseOrderNotificationData({
        type: 'ORDER_STATUS',
        orderId: ' order-1 ',
        orderStatus: 'OUT_FOR_DELIVERY',
        orderStatusLabel: 'On the Way',
      })
    ).toEqual({
      type: 'ORDER_STATUS',
      orderId: 'order-1',
      orderStatus: 'OUT_FOR_DELIVERY',
      orderStatusLabel: 'On the Way',
    });
  });

  it('parses a payment decision notification', () => {
    expect(
      parseOrderNotificationData({
        type: 'PAYMENT_DECISION',
        orderId: 'order-1',
        paymentStatus: 'PAID',
      })
    ).toEqual({
      type: 'PAYMENT_DECISION',
      orderId: 'order-1',
      paymentStatus: 'PAID',
    });
  });

  it('rejects malformed or unrelated payloads', () => {
    expect(parseOrderNotificationData(null)).toBeNull();
    expect(parseOrderNotificationData('ORDER_STATUS')).toBeNull();
    expect(parseOrderNotificationData({ type: 'ADMIN_NEW_ORDER', orderId: 'o1' })).toBeNull();
    expect(parseOrderNotificationData({ type: 'ORDER_STATUS' })).toBeNull();
    expect(parseOrderNotificationData({ orderId: 'o1' })).toBeNull();
  });

  it('uses the order channel declared in the Android manifest', () => {
    const channel = orderNotificationChannel();

    expect(channel.id).toBe(ORDER_NOTIFICATION_CHANNEL_ID);
    expect(channel.importance).toBe(5);
    expect(channel.sound).toBe('default');
  });

  it('assigns a stable positive id per status update', () => {
    const data = {
      type: 'ORDER_STATUS' as const,
      orderId: 'order-1',
      orderStatus: 'READY',
    };
    const first = orderNotificationId(data);
    const second = orderNotificationId({ ...data });

    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(2147483648);
    expect(
      orderNotificationId({ ...data, orderStatus: 'COMPLETED' })
    ).not.toBe(first);
  });
});
