import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { IS_NATIVE_PLATFORM } from '../core/auth/google-sign-in';
import {
  CAPACITOR_PLATFORM,
  NATIVE_LOCAL_NOTIFICATIONS,
  NATIVE_PUSH_NOTIFICATIONS,
  ORDER_NOTIFICATION_CHANNEL_ID,
} from '../core/notifications/notifications';
import { Order, OrderStatus } from '../models/order.model';
import { AuthService } from './auth.service';
import { NotificationsApiService } from './notifications-api.service';
import { OrdersService } from './orders.service';
import { PushNotificationsService } from './push-notifications.service';

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

type Listener = (value: unknown) => void;

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
    items: [],
    subtotal: 100,
    deliveryFee: 0,
    total: 100,
    customerComment: '',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    orderStatus: OrderStatus.READY,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  } as Order;
}

describe('PushNotificationsService', () => {
  const uid$ = new BehaviorSubject<string | null>(null);
  const pushListeners = new Map<string, Listener>();
  const localListeners = new Map<string, Listener>();

  let push: {
    checkPermissions: ReturnType<typeof vi.fn>;
    requestPermissions: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
  };
  let local: {
    createChannel: ReturnType<typeof vi.fn>;
    schedule: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
  };
  let api: {
    registerDeviceToken: ReturnType<typeof vi.fn>;
    removeDeviceToken: ReturnType<typeof vi.fn>;
  };
  let orders: { getOrder: ReturnType<typeof vi.fn> };
  let router: { url: string; navigate: ReturnType<typeof vi.fn> };
  let isNative: ReturnType<typeof vi.fn>;
  let platform: ReturnType<typeof vi.fn>;

  function setup(): PushNotificationsService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { uid$: uid$.asObservable() } },
        { provide: NotificationsApiService, useValue: api },
        { provide: OrdersService, useValue: orders },
        { provide: Router, useValue: router },
        { provide: IS_NATIVE_PLATFORM, useValue: isNative },
        { provide: CAPACITOR_PLATFORM, useValue: platform },
        { provide: NATIVE_PUSH_NOTIFICATIONS, useValue: push },
        { provide: NATIVE_LOCAL_NOTIFICATIONS, useValue: local },
      ],
    });
    return TestBed.inject(PushNotificationsService);
  }

  beforeEach(() => {
    localStorage.clear();
    pushListeners.clear();
    localListeners.clear();
    uid$.next(null);

    push = {
      checkPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
      requestPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
      register: vi.fn(() => Promise.resolve()),
      addListener: vi.fn((event: string, listener: Listener) => {
        pushListeners.set(event, listener);
        return Promise.resolve({ remove: vi.fn() });
      }),
    };
    local = {
      createChannel: vi.fn(() => Promise.resolve()),
      schedule: vi.fn(() => Promise.resolve()),
      addListener: vi.fn((event: string, listener: Listener) => {
        localListeners.set(event, listener);
        return Promise.resolve({ remove: vi.fn() });
      }),
    };
    api = {
      registerDeviceToken: vi.fn(() => Promise.resolve()),
      removeDeviceToken: vi.fn(() => Promise.resolve()),
    };
    orders = { getOrder: vi.fn(() => Promise.resolve(makeOrder())) };
    router = { url: '/dashboard', navigate: vi.fn(() => Promise.resolve(true)) };
    isNative = vi.fn(() => true);
    platform = vi.fn(() => 'android');
  });

  afterEach(() => TestBed.resetTestingModule());

  it('requests permission only after sign-in, then registers the token', async () => {
    const service = setup();
    service.initialize();

    expect(push.checkPermissions).not.toHaveBeenCalled();
    expect(push.register).not.toHaveBeenCalled();

    uid$.next('u1');
    await flushMicrotasks();

    expect(push.checkPermissions).toHaveBeenCalledTimes(1);
    expect(push.register).toHaveBeenCalledTimes(1);
    expect(local.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: ORDER_NOTIFICATION_CHANNEL_ID })
    );

    pushListeners.get('registration')?.({ value: 'fcm-token' });
    await flushMicrotasks();

    expect(api.registerDeviceToken).toHaveBeenCalledWith(
      'fcm-token',
      'android'
    );
    expect(
      JSON.parse(
        localStorage.getItem('bistrobuddies.push.device-token') ?? '{}'
      )
    ).toEqual({ token: 'fcm-token', uid: 'u1' });
  });

  it('asks for permission when the OS reports a prompt', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'prompt' });
    const service = setup();
    service.initialize();

    uid$.next('u1');
    await flushMicrotasks();

    expect(push.requestPermissions).toHaveBeenCalledTimes(1);
    expect(push.register).toHaveBeenCalledTimes(1);
  });

  it('does not register when permission is denied', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    const service = setup();
    service.initialize();

    uid$.next('u1');
    await flushMicrotasks();

    expect(service.permission()).toBe('denied');
    expect(push.register).not.toHaveBeenCalled();
    expect(api.registerDeviceToken).not.toHaveBeenCalled();
  });

  it('does not re-register the same token for the same customer', async () => {
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('registration')?.({ value: 'fcm-token' });
    await flushMicrotasks();
    pushListeners.get('registration')?.({ value: 'fcm-token' });
    await flushMicrotasks();

    expect(api.registerDeviceToken).toHaveBeenCalledTimes(1);
  });

  it('removes the device token before logout and clears local state', async () => {
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();
    pushListeners.get('registration')?.({ value: 'fcm-token' });
    await flushMicrotasks();

    await service.unregisterCurrentDevice();

    expect(api.removeDeviceToken).toHaveBeenCalledWith('fcm-token');
    expect(
      localStorage.getItem('bistrobuddies.push.device-token')
    ).toBeNull();
  });

  it('shows order updates as local notifications in the foreground', async () => {
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('pushNotificationReceived')?.({
      title: 'On the Way',
      body: 'Your coffee order is on the way!',
      data: {
        type: 'ORDER_STATUS',
        orderId: 'order-1',
        orderStatus: 'OUT_FOR_DELIVERY',
        orderStatusLabel: 'On the Way',
      },
    });
    await flushMicrotasks();

    expect(local.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          title: 'On the Way',
          body: 'Your coffee order is on the way!',
          channelId: ORDER_NOTIFICATION_CHANNEL_ID,
          extra: expect.objectContaining({
            type: 'ORDER_STATUS',
            orderId: 'order-1',
          }),
        }),
      ],
    });
  });

  it('ignores foreground notifications that are not order updates', async () => {
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('pushNotificationReceived')?.({
      title: 'Admin only',
      data: { type: 'ADMIN_NEW_ORDER', orderId: 'order-1' },
    });
    await flushMicrotasks();

    expect(local.schedule).not.toHaveBeenCalled();
  });

  it('opens the order when its notification is tapped', async () => {
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('pushNotificationActionPerformed')?.({
      actionId: 'tap',
      notification: {
        data: { type: 'ORDER_STATUS', orderId: 'order-1' },
      },
    });
    await flushMicrotasks();

    expect(orders.getOrder).toHaveBeenCalledWith('order-1');
    expect(router.navigate).toHaveBeenCalledWith(['/my-orders', 'order-1']);
  });

  it('opens an order from a foreground local notification tap', async () => {
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    localListeners.get('localNotificationActionPerformed')?.({
      actionId: 'tap',
      notification: {
        extra: { type: 'PAYMENT_DECISION', orderId: 'order-1' },
      },
    });
    await flushMicrotasks();

    expect(router.navigate).toHaveBeenCalledWith(['/my-orders', 'order-1']);
  });

  it('opens a cold-start tap once the signed-in customer is restored', async () => {
    const service = setup();
    service.initialize();

    pushListeners.get('pushNotificationActionPerformed')?.({
      actionId: 'tap',
      notification: {
        data: { type: 'ORDER_STATUS', orderId: 'order-1' },
      },
    });
    await flushMicrotasks();
    expect(router.navigate).not.toHaveBeenCalled();

    uid$.next('u1');
    await flushMicrotasks();

    expect(router.navigate).toHaveBeenCalledWith(['/my-orders', 'order-1']);
  });

  it('never opens an order that belongs to another customer', async () => {
    orders.getOrder.mockResolvedValue(makeOrder({ customerId: 'someone-else' }));
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('pushNotificationActionPerformed')?.({
      actionId: 'tap',
      notification: {
        data: { type: 'ORDER_STATUS', orderId: 'order-1' },
      },
    });
    await flushMicrotasks();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('stays unavailable on the web without touching the native plugins', () => {
    isNative.mockReturnValue(false);
    const service = setup();
    service.initialize();
    uid$.next('u1');

    expect(service.permission()).toBe('unavailable');
    expect(push.addListener).not.toHaveBeenCalled();
    expect(push.register).not.toHaveBeenCalled();
    expect(local.addListener).not.toHaveBeenCalled();
  });

  it('keeps working when the order lookup fails on tap', async () => {
    orders.getOrder.mockRejectedValue(new Error('offline'));
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('pushNotificationActionPerformed')?.({
      actionId: 'tap',
      notification: {
        data: { type: 'ORDER_STATUS', orderId: 'order-1' },
      },
    });
    await flushMicrotasks();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('retries a successful token registration after a rejected attempt', async () => {
    api.registerDeviceToken.mockRejectedValueOnce(new Error('network'));
    const service = setup();
    service.initialize();
    uid$.next('u1');
    await flushMicrotasks();

    pushListeners.get('registration')?.({ value: 'fcm-token' });
    await flushMicrotasks();
    expect(localStorage.getItem('bistrobuddies.push.device-token')).toBeNull();

    pushListeners.get('registration')?.({ value: 'fcm-token' });
    await flushMicrotasks();

    expect(api.registerDeviceToken).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('bistrobuddies.push.device-token')).not.toBeNull();
  });

  it('initializes only once', () => {
    const service = setup();
    service.initialize();
    service.initialize();

    expect(push.addListener).toHaveBeenCalledTimes(4);
  });

});
