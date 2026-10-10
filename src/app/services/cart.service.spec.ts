import { TestBed } from '@angular/core/testing';
import { CartItemInput } from '../models/cart.model';
import { CART_STORAGE_KEY, CartService, MAX_QUANTITY } from './cart.service';

function item(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    productId: 'p1',
    productName: 'House Latte',
    productImage: 'latte.png',
    size: 'small',
    sugar: 'Regular',
    quantity: 1,
    unitPrice: 100,
    ...overrides,
  };
}

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should start with an empty cart', () => {
    expect(service.items()).toEqual([]);
    expect(service.itemCount()).toBe(0);
    expect(service.subtotal()).toBe(0);
  });

  it('should add an item and compute the item subtotal', () => {
    service.add(item({ quantity: 2, unitPrice: 130, size: 'medium' }));

    expect(service.items().length).toBe(1);
    expect(service.items()[0]).toEqual({
      productId: 'p1',
      productName: 'House Latte',
      productImage: 'latte.png',
      size: 'medium',
      sugar: 'Regular',
      quantity: 2,
      unitPrice: 130,
      itemSubtotal: 260,
    });
    expect(service.itemCount()).toBe(2);
    expect(service.subtotal()).toBe(260);
  });

  it('should merge items with the same product, size and sugar', () => {
    service.add(item());
    service.add(item());

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(2);
    expect(service.items()[0].itemSubtotal).toBe(200);
  });

  it('should treat different size or sugar combinations as separate items', () => {
    service.add(item({ size: 'small' }));
    service.add(item({ size: 'large', unitPrice: 160 }));
    service.add(item({ size: 'small', sugar: 'No Sugar' }));

    expect(service.items().length).toBe(3);
    expect(service.subtotal()).toBe(100 + 160 + 100);
  });

  it('should edit an existing item', () => {
    service.add(item({ quantity: 2 }));

    service.updateItem(item(), { quantity: 5, unitPrice: 120 });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(5);
    expect(service.items()[0].unitPrice).toBe(120);
    expect(service.items()[0].itemSubtotal).toBe(600);
    expect(service.subtotal()).toBe(600);
  });

  it('should edit an item into a different size and reprice it', () => {
    service.add(item({ size: 'small', unitPrice: 100 }));

    service.updateItem(item(), { size: 'large', unitPrice: 160 });

    expect(service.items()[0].size).toBe('large');
    expect(service.items()[0].unitPrice).toBe(160);
    expect(service.items()[0].itemSubtotal).toBe(160);
  });

  it('should merge an edit that collides with another cart line', () => {
    service.add(item({ size: 'small', quantity: 1 }));
    service.add(item({ size: 'large', unitPrice: 160, quantity: 2 }));

    service.updateItem(item({ size: 'small' }), { size: 'large', unitPrice: 160 });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].size).toBe('large');
    expect(service.items()[0].quantity).toBe(3);
    expect(service.items()[0].itemSubtotal).toBe(480);
  });

  it('should increase and decrease quantity with bounds', () => {
    service.add(item());

    service.increase(item());
    expect(service.items()[0].quantity).toBe(2);
    expect(service.items()[0].itemSubtotal).toBe(200);

    service.decrease(item());
    service.decrease(item());
    expect(service.items()[0].quantity).toBe(1);
    expect(service.items()[0].itemSubtotal).toBe(100);

    for (let i = 0; i < MAX_QUANTITY + 5; i++) {
      service.increase(item());
    }
    expect(service.items()[0].quantity).toBe(MAX_QUANTITY);
  });

  it('should remove only the matching cart line', () => {
    service.add(item({ size: 'small' }));
    service.add(item({ size: 'large', unitPrice: 160 }));

    service.removeItem(item({ size: 'small' }));

    expect(service.items().length).toBe(1);
    expect(service.items()[0].size).toBe('large');
    expect(service.subtotal()).toBe(160);
  });

  it('should ignore operations on unknown cart lines', () => {
    service.add(item());

    service.updateItem(item({ sugar: 'Extra Sugar' }), { quantity: 3 });
    service.increase(item({ size: 'large' }));
    service.removeItem(item({ sugar: 'Less Sugar' }));

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(1);
    expect(service.items()[0].sugar).toBe('Regular');
  });

  it('should clear the cart', () => {
    service.add(item());
    service.add(item({ size: 'large', unitPrice: 160 }));

    service.clear();

    expect(service.items()).toEqual([]);
    expect(service.itemCount()).toBe(0);
    expect(service.subtotal()).toBe(0);
  });

  it('should persist the cart and restore it in a new instance', () => {
    service.add(item({ quantity: 2, unitPrice: 130, size: 'medium' }));
    service.add(item({ size: 'large', unitPrice: 160, sugar: 'No Sugar' }));

    const restored = new CartService();

    expect(restored.items().length).toBe(2);
    expect(restored.itemCount()).toBe(3);
    expect(restored.subtotal()).toBe(420);
    expect(restored.items()[0]).toEqual({
      productId: 'p1',
      productName: 'House Latte',
      productImage: 'latte.png',
      size: 'medium',
      sugar: 'Regular',
      quantity: 2,
      unitPrice: 130,
      itemSubtotal: 260,
    });
  });

  it('should ignore stored payloads that are not valid JSON', () => {
    localStorage.setItem(CART_STORAGE_KEY, 'not-json{');

    expect(new CartService().items()).toEqual([]);
  });

  it('should drop stored lines with a missing or invalid price', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        item({ unitPrice: 0 }),
        { ...item({ size: 'large' }), unitPrice: 'free' },
      ])
    );

    expect(new CartService().items()).toEqual([]);
  });

  it('should recompute the subtotal from quantity instead of trusting stored totals', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([{ ...item({ quantity: 3, unitPrice: 100 }), itemSubtotal: 999999 }])
    );

    const restored = new CartService();
    expect(restored.items()[0].itemSubtotal).toBe(300);
    expect(restored.subtotal()).toBe(300);
  });

  it('should empty the stored cart when cleared', () => {
    service.add(item());
    service.clear();

    expect(new CartService().items()).toEqual([]);
  });
});
