import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { Observable, Subject, of } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';
import { ProductGridComponent } from './product-grid.component';

function makeProduct(overrides: Partial<Product>): Product {
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
    sugarOptions: ['0%', '50%', '100%'],
    available: true,
    createdAt: Timestamp.fromMillis(1000),
    updatedAt: Timestamp.fromMillis(1000),
    ...overrides,
  };
}

describe('ProductGridComponent', () => {
  function setup(watch: () => Observable<Product[]>): ComponentFixture<ProductGridComponent> {
    TestBed.configureTestingModule({
      imports: [ProductGridComponent],
      providers: [
        provideRouter([]),
        { provide: ProductsService, useValue: { watchProducts: vi.fn(watch) } },
      ],
    });
    return TestBed.createComponent(ProductGridComponent);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should start in the loading state', () => {
    const fixture = setup(() => new Subject<Product[]>());
    expect(fixture.componentInstance.status()).toBe('loading');

    fixture.detectChanges();
    expect(fixture.componentInstance.status()).toBe('loading');
    expect(fixture.nativeElement.textContent).toContain('Loading coffee');
  });

  it('should show the empty state when no products exist', () => {
    const fixture = setup(() => of([]));
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('ready');
    expect(fixture.nativeElement.textContent).toContain('No coffee available yet');
  });

  it('should show the error state when Firestore fails and recover on retry', () => {
    const source = new Subject<Product[]>();
    let attempts = 0;
    const fixture = setup(() => (attempts++ === 0 ? source : of([])));

    source.error(new Error('permission denied'));
    fixture.detectChanges();
    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('Could not load the coffee list');

    fixture.componentInstance.retry();
    fixture.detectChanges();
    expect(fixture.componentInstance.status()).toBe('ready');
    expect(fixture.nativeElement.textContent).toContain('No coffee available yet');
  });

  it('should list the newest available products first', () => {
    const fixture = setup(() =>
      of([
        makeProduct({ id: 'old', name: 'Old Brew', createdAt: Timestamp.fromMillis(1000) }),
        makeProduct({ id: 'new', name: 'New Brew', createdAt: Timestamp.fromMillis(5000) }),
        makeProduct({
          id: 'gone',
          name: 'Sold Out Brew',
          available: false,
          createdAt: Timestamp.fromMillis(9000),
        }),
      ])
    );
    fixture.componentRef.setInput('availableOnly', true);
    fixture.detectChanges();

    const products = fixture.componentInstance.products();
    expect(products.map((product) => product.id)).toEqual(['new', 'old']);
    expect(fixture.nativeElement.textContent).toContain('New Brew');
    expect(fixture.nativeElement.textContent).not.toContain('Sold Out Brew');
  });

  it('should honour the product limit', () => {
    const fixture = setup(() =>
      of([
        makeProduct({ id: 'a', createdAt: Timestamp.fromMillis(3000) }),
        makeProduct({ id: 'b', createdAt: Timestamp.fromMillis(2000) }),
        makeProduct({ id: 'c', createdAt: Timestamp.fromMillis(1000) }),
      ])
    );
    fixture.componentRef.setInput('limit', 2);
    fixture.detectChanges();

    expect(fixture.componentInstance.products().length).toBe(2);
  });

  it('should show image, description, availability and starting price', () => {
    const fixture = setup(() => of([makeProduct({})]));
    fixture.detectChanges();

    const card = fixture.nativeElement as HTMLElement;
    expect(card.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/latte.png'
    );
    expect(card.textContent).toContain('House Latte');
    expect(card.textContent).toContain('Smooth espresso with steamed milk.');
    expect(card.textContent).toContain('Available');
    expect(card.textContent).toContain('₱100.00');
  });

  it('should mark unavailable products as sold out', () => {
    const fixture = setup(() => of([makeProduct({ available: false })]));
    fixture.detectChanges();

    const card = fixture.nativeElement as HTMLElement;
    expect(card.textContent).toContain('Sold Out');
    expect(card.querySelector('.badge')?.classList).toContain('badge-out');
  });

  it('should compute the starting price from the lowest size', () => {
    const fixture = setup(() => of([]));
    const product = makeProduct({ smallPrice: 90, mediumPrice: 0, largePrice: 175 });

    expect(fixture.componentInstance.startingPrice(product)).toBe('₱90.00');
    expect(
      fixture.componentInstance.startingPrice(
        makeProduct({ smallPrice: 0, mediumPrice: 0, largePrice: 0 })
      )
    ).toBe('—');
  });
});
