import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CartItemInput } from '../../models/cart.model';
import { Product } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';
import { CartPage } from './cart.page';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'House Latte',
    description: 'Smooth espresso with steamed milk.',
    category: 'hot',
    imageUrl: 'https://example.com/latte.png',
    cloudinaryPublicId: 'latte',
    smallPrice: 100,
    mediumPrice: 130,
    largePrice: 160,
    sugarOptions: ['No Sugar', 'Less Sugar', 'Regular', 'Extra Sugar'],
    available: true,
    createdAt: Timestamp.fromMillis(1000),
    updatedAt: Timestamp.fromMillis(1000),
    ...overrides,
  };
}

function item(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    productId: 'p1',
    productName: 'House Latte',
    productImage: 'https://example.com/latte.png',
    size: 'small',
    sugar: 'Regular',
    quantity: 1,
    unitPrice: 100,
    ...overrides,
  };
}

describe('CartPage', () => {
  beforeEach(() => localStorage.clear());

  function setup(
    items: CartItemInput[] = [],
    products: Product[] = [makeProduct()],
    products$?: Observable<Product[]>
  ): { fixture: ComponentFixture<CartPage>; component: CartPage; cart: CartService } {
    TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        provideRouter([]),
        { provide: ProductsService, useValue: { watchProducts: () => products$ ?? of(products) } },
      ],
    });

    const cart = TestBed.inject(CartService);
    items.forEach((entry) => cart.add(entry));

    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, cart };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should show an empty state when the cart has no items', () => {
    const { fixture, component } = setup();

    expect(component.isEmpty()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Your cart is empty');
  });

  it('should list cart items with quantity and item subtotal', () => {
    const { fixture } = setup([
      item({ quantity: 2, unitPrice: 100 }),
      item({ size: 'large', unitPrice: 160, sugar: 'No Sugar' }),
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('House Latte');
    expect(element.textContent).toContain('₱100.00 each');
    expect(element.textContent).toContain('₱200.00');
    expect(element.textContent).toContain('₱160.00');
  });

  it('should show the item count and cart subtotal', () => {
    const { fixture, component } = setup([
      item({ quantity: 2, unitPrice: 100 }),
      item({ size: 'large', unitPrice: 160, sugar: 'No Sugar' }),
    ]);

    expect(component.itemCount()).toBe(3);
    expect(component.subtotal()).toBe(360);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('₱360.00');
  });

  it('should increase and decrease quantity from the page controls', () => {
    const { fixture, component } = setup([item()]);

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('.qty-btn');
    (buttons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.itemCount()).toBe(2);

    (buttons[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.itemCount()).toBe(1);
    expect(component.subtotal()).toBe(100);
  });

  it('should remove an item from the page', () => {
    const { fixture, component, cart } = setup([item()]);

    component.remove(component.items()[0]);
    fixture.detectChanges();

    expect(cart.items()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Your cart is empty');
  });

  it('should clear the whole cart from the page', () => {
    const { fixture, component } = setup([
      item({ quantity: 2 }),
      item({ size: 'large', unitPrice: 160, sugar: 'No Sugar' }),
    ]);

    component.clear();
    fixture.detectChanges();

    expect(component.isEmpty()).toBe(true);
    expect(component.itemCount()).toBe(0);
    expect(component.subtotal()).toBe(0);
  });

  it('should reprice an item when the size changes', () => {
    const { component } = setup([item({ size: 'small', unitPrice: 100 })]);

    component.onSizeChange(component.items()[0], { detail: { value: 'large' } });

    expect(component.items()[0].size).toBe('large');
    expect(component.items()[0].unitPrice).toBe(160);
    expect(component.items()[0].itemSubtotal).toBe(160);
    expect(component.subtotal()).toBe(160);
  });

  it('should keep the current price when the product data is unavailable', () => {
    const { component } = setup([item()], []);

    component.onSizeChange(component.items()[0], { detail: { value: 'large' } });

    expect(component.items()[0].size).toBe('small');
    expect(component.items()[0].unitPrice).toBe(100);
  });

  it('should edit the sugar level of an item', () => {
    const { component } = setup([item()]);

    component.onSugarChange(component.items()[0], { detail: { value: 'Less Sugar' } });

    expect(component.items()[0].sugar).toBe('Less Sugar');
    expect(component.items()[0].quantity).toBe(1);
  });

  it('should offer the product-specific sugar options for an item', () => {
    const { component } = setup(
      [item({ sugar: '0%' })],
      [makeProduct({ sugarOptions: ['0%', '50%', '100%'] })]
    );

    expect(component.sugarOptionsFor(component.items()[0])).toEqual(['0%', '50%', '100%']);
  });

  it('should keep the item sugar selectable when it is not in the product options', () => {
    const { component } = setup(
      [item({ sugar: 'Legacy Sugar' })],
      [makeProduct({ sugarOptions: ['No Sugar', 'Regular'] })]
    );

    expect(component.sugarOptionsFor(component.items()[0])).toContain('Legacy Sugar');
  });

  it('should mark sizes without a price as disabled once products load', () => {
    const { component } = setup([item()], [
      makeProduct({ smallPrice: 100, mediumPrice: 0, largePrice: 160 }),
    ]);

    expect(component.isSizeDisabled(component.items()[0], 'small')).toBe(false);
    expect(component.isSizeDisabled(component.items()[0], 'medium')).toBe(true);
    expect(component.isSizeDisabled(component.items()[0], 'large')).toBe(false);
    expect(component.priceLabel('p1', 'medium')).toBe('');
    expect(component.priceLabel('p1', 'large')).toContain('₱160.00');
  });

  it('blocks checkout when a product left the menu', () => {
    const { fixture, component } = setup([item()], []);

    expect(component.itemStatus(component.items()[0])).toBe('missing');
    expect(component.hasBlockedItems()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'can no longer be ordered'
    );
  });

  it('blocks checkout when a product is sold out', () => {
    const { component } = setup([item()], [makeProduct({ available: false })]);

    expect(component.itemStatus(component.items()[0])).toBe('unavailable');
    expect(component.hasBlockedItems()).toBe(true);
    expect(component.itemWarning(component.items()[0])).toContain('Sold out');
  });

  it('blocks checkout when the size has no price any more', () => {
    const { component } = setup(
      [item({ size: 'large', unitPrice: 160 })],
      [makeProduct({ smallPrice: 100, mediumPrice: 130, largePrice: 0 })]
    );

    expect(component.itemStatus(component.items()[0])).toBe('unpriced');
    expect(component.hasBlockedItems()).toBe(true);
  });

  it('does not block checkout while the catalog is still loading', () => {
    const { component } = setup([item()], [], new Subject<Product[]>());

    expect(component.productsStatus()).toBe('loading');
    expect(component.itemStatus(component.items()[0])).toBe('checking');
    expect(component.hasBlockedItems()).toBe(false);
  });

  it('keeps checkout usable when the catalog cannot be verified', () => {
    const { fixture, component } = setup(
      [item()],
      [],
      throwError(() => new Error('offline'))
    );

    expect(component.productsStatus()).toBe('error');
    expect(component.hasBlockedItems()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not verify availability'
    );
  });

  it('clears the warning once a blocked item is removed', () => {
    const { component, cart } = setup([item()], []);

    expect(component.hasBlockedItems()).toBe(true);

    component.remove(component.items()[0]);
    expect(cart.items()).toEqual([]);
    expect(component.hasBlockedItems()).toBe(false);
  });
});
