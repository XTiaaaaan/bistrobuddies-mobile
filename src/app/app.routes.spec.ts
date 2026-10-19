import { authGuard } from './core/auth/auth.guard';
import { routes } from './app.routes';

function routeFor(path: string) {
  return routes.find((route) => route.path === path);
}

describe('app routes', () => {
  it('serves the storefront to guests before login', () => {
    expect(routeFor('dashboard')?.canMatch).toBeUndefined();
    expect(routeFor('products')?.canMatch).toBeUndefined();
    expect(routeFor('products/:id')?.canMatch).toBeUndefined();
    expect(routeFor('about')?.canMatch).toBeUndefined();
    expect(routeFor('company-history')?.canMatch).toBeUndefined();
    expect(routeFor('about-products')?.canMatch).toBeUndefined();
    expect(routeFor('contact-us')?.canMatch).toBeUndefined();
    expect(routeFor('developers')?.canMatch).toBeUndefined();
  });

  it('serves the Terms of Service page to guests', () => {
    const route = routeFor('terms');
    expect(route).toBeTruthy();
    expect(route?.canMatch).toBeUndefined();
    expect(typeof route?.loadComponent).toBe('function');
  });

  it('keeps ordering and account pages behind the auth guard', () => {
    expect(routeFor('cart')?.canMatch).toEqual([authGuard]);
    expect(routeFor('checkout')?.canMatch).toEqual([authGuard]);
    expect(routeFor('my-orders')?.canMatch).toEqual([authGuard]);
    expect(routeFor('my-orders/:id')?.canMatch).toEqual([authGuard]);
    expect(routeFor('my-messages')?.canMatch).toEqual([authGuard]);
    expect(routeFor('profile')?.canMatch).toEqual([authGuard]);
  });

  it('keeps the auth pages public', () => {
    expect(routeFor('login')?.canMatch).toBeUndefined();
    expect(routeFor('register')?.canMatch).toBeUndefined();
    expect(routeFor('forgot-password')?.canMatch).toBeUndefined();
  });
});
