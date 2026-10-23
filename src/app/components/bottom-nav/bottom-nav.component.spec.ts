import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { CartService } from '../../services/cart.service';
import {
  BottomNavComponent,
  isBottomNavVisible,
} from './bottom-nav.component';

@Component({ template: '' })
class StubPageComponent {}

describe('BottomNavComponent', () => {
  const cartCount = signal(0);

  beforeEach(async () => {
    cartCount.set(0);

    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubPageComponent },
          { path: 'products', component: StubPageComponent },
          { path: 'cart', component: StubPageComponent },
          { path: 'my-orders', component: StubPageComponent },
        ]),
        provideIonicAngular(),
        { provide: CartService, useValue: { itemCount: cartCount } },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should show the four destinations', () => {
    const fixture = createFixture();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.bb-nav-label')
    ).map((label) => (label as HTMLElement).textContent?.trim());

    expect(labels).toEqual(['Home', 'Products', 'Cart', 'My Orders']);
  });

  it('should link to the dashboard, products, cart and my orders', () => {
    const fixture = createFixture();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a.bb-nav-item')
    ) as HTMLAnchorElement[];

    expect(links.length).toEqual(4);
    expect(links[0].getAttribute('href')).toBe('/dashboard');
    expect(links[1].getAttribute('href')).toBe('/products');
    expect(links[2].getAttribute('href')).toBe('/cart');
    expect(links[3].getAttribute('href')).toBe('/my-orders');
  });

  it('should mark the destination for the current route as active', async () => {
    const fixture = createFixture();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/products');
    fixture.detectChanges();

    let links = Array.from(
      fixture.nativeElement.querySelectorAll('a.bb-nav-item')
    ) as HTMLAnchorElement[];

    expect(links[0].classList.contains('is-active')).toBe(false);
    expect(links[1].classList.contains('is-active')).toBe(true);
    expect(links[1].getAttribute('aria-current')).toBe('page');

    await router.navigateByUrl('/my-orders');
    fixture.detectChanges();

    links = Array.from(
      fixture.nativeElement.querySelectorAll('a.bb-nav-item')
    ) as HTMLAnchorElement[];

    expect(links[3].classList.contains('is-active')).toBe(true);
    expect(links[3].getAttribute('aria-current')).toBe('page');
  });

  it('should hide the cart badge when the cart is empty', () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.querySelector('.cart-badge')).toBeNull();
  });

  it('should show the live cart count and clamp it at 99+', () => {
    cartCount.set(3);
    const fixture = createFixture();

    expect(
      fixture.nativeElement.querySelector('.cart-badge').textContent.trim()
    ).toBe('3');

    cartCount.set(150);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.cart-badge').textContent.trim()
    ).toBe('99+');
  });

  it('should name the cart link with its item count', () => {
    cartCount.set(1);
    const fixture = createFixture();
    const cartLink = fixture.nativeElement.querySelectorAll(
      'a.bb-nav-item'
    )[2] as HTMLAnchorElement;

    expect(cartLink.getAttribute('aria-label')).toBe('Cart, 1 item');

    cartCount.set(4);
    fixture.detectChanges();

    expect(cartLink.getAttribute('aria-label')).toBe('Cart, 4 items');
  });

  describe('isBottomNavVisible', () => {
    it('should hide the bar on auth, checkout and detail flows', () => {
      [
        '/login',
        '/register',
        '/forgot-password',
        '/checkout',
        '/checkout?step=payment',
        '/products/abc123',
        '/my-orders/order-1',
      ].forEach((url) => {
        expect(isBottomNavVisible(url), url).toBe(false);
      });
    });

    it('should show the bar on the main tabs and information pages', () => {
      [
        '/',
        '/dashboard',
        '/products',
        '/cart',
        '/my-orders',
        '/my-messages',
        '/profile',
        '/about',
        '/terms',
      ].forEach((url) => {
        expect(isBottomNavVisible(url), url).toBe(true);
      });
    });
  });
});
