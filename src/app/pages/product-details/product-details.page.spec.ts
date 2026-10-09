import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Timestamp } from 'firebase/firestore';
import { of } from 'rxjs';
import { Product } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { ProductsService } from '../../services/products.service';
import { ProductDetailsPage } from './product-details.page';

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

describe('ProductDetailsPage', () => {
  let addSpy: ReturnType<typeof vi.fn>;
  let presentSpy: ReturnType<typeof vi.fn>;

  function setup(product: Product | null): ComponentFixture<ProductDetailsPage> {
    addSpy = vi.fn();
    presentSpy = vi.fn(() => Promise.resolve());

    TestBed.configureTestingModule({
      imports: [ProductDetailsPage],
      providers: [
        provideRouter([]),
        { provide: ProductsService, useValue: { watchProduct: () => of(product) } },
        { provide: CartService, useValue: { add: addSpy } },
        {
          provide: ToastController,
          useValue: { create: () => Promise.resolve({ present: presentSpy }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProductDetailsPage);
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should show image, name, description, availability and size prices', () => {
    const fixture = setup(makeProduct());
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/latte.png'
    );
    expect(element.textContent).toContain('House Latte');
    expect(element.textContent).toContain('Smooth espresso with steamed milk.');
    expect(element.textContent).toContain('Available');
    expect(element.textContent).toContain('₱100.00');
    expect(element.textContent).toContain('₱130.00');
    expect(element.textContent).toContain('₱160.00');
  });

  it('should default to the smallest size, Regular sugar and quantity of one', () => {
    const component = setup(makeProduct()).componentInstance;

    expect(component.selectedSize()).toBe('small');
    expect(component.sugar()).toBe('Regular');
    expect(component.quantity()).toBe(1);
    expect(component.unitPrice()).toBe(100);
    expect(component.itemPrice()).toBe(100);
  });

  it('should recalculate the item price when the size changes', () => {
    const component = setup(makeProduct()).componentInstance;

    component.selectSize('large');

    expect(component.unitPrice()).toBe(160);
    expect(component.itemPrice()).toBe(160);
  });

  it('should recalculate the item price when the quantity changes', () => {
    const component = setup(makeProduct()).componentInstance;

    component.increase();
    component.increase();
    expect(component.itemPrice()).toBe(300);

    component.decrease();
    expect(component.itemPrice()).toBe(200);

    component.decrease();
    component.decrease();
    component.decrease();
    expect(component.quantity()).toBe(1);
    expect(component.itemPrice()).toBe(100);
  });

  it('should keep the quantity within the allowed range', () => {
    const component = setup(makeProduct()).componentInstance;

    for (let i = 0; i < 200; i++) {
      component.increase();
    }
    expect(component.quantity()).toBe(99);
  });

  it('should offer only the sugar options configured on the product', () => {
    const fixture = setup(makeProduct({ sugarOptions: ['Regular', 'No Sugar'] }));
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    expect(component.sugarOptions()).toEqual(['No Sugar', 'Regular']);
    expect(element.textContent).not.toContain('Extra Sugar');
  });

  it('should fall back to the default sugar list when none are configured', () => {
    const component = setup(makeProduct({ sugarOptions: [] })).componentInstance;

    expect(component.sugarOptions()).toEqual([
      'No Sugar',
      'Less Sugar',
      'Regular',
      'Extra Sugar',
    ]);
  });

  it('should add the configured item to the cart', async () => {
    const component = setup(makeProduct()).componentInstance;

    component.selectSize('medium');
    component.selectSugar('Less Sugar');
    component.increase();
    await component.addToCart();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith({
      productId: 'p1',
      productName: 'House Latte',
      productImage: 'https://example.com/latte.png',
      size: 'medium',
      sugar: 'Less Sugar',
      quantity: 2,
      unitPrice: 130,
    });
    expect(presentSpy).toHaveBeenCalled();
  });

  it('should not allow adding an unavailable product', async () => {
    const fixture = setup(makeProduct({ available: false }));
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    expect(component.isAvailable()).toBe(false);
    expect(component.canAddToCart()).toBe(false);
    expect(element.textContent).toContain('Sold Out');

    await component.addToCart();
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('should not allow adding when a size has no valid price', () => {
    const component = setup(
      makeProduct({ smallPrice: 0, mediumPrice: 0, largePrice: 0 })
    ).componentInstance;

    expect(component.unitPrice()).toBeNull();
    expect(component.itemPrice()).toBeNull();
    expect(component.canAddToCart()).toBe(false);
  });

  it('should select the first size that has a valid price', () => {
    const component = setup(
      makeProduct({ smallPrice: 0, mediumPrice: 130, largePrice: 160 })
    ).componentInstance;

    expect(component.selectedSize()).toBe('medium');
    expect(component.unitPrice()).toBe(130);
  });

  it('should show a missing state when the product does not exist', () => {
    const fixture = setup(null);
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('missing');
    expect(element.textContent).toContain('Coffee not found');
  });
});
