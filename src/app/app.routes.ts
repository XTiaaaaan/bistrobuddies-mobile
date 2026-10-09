import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.page').then(
        (m) => m.ForgotPasswordPage
      ),
  },
  // Public storefront: guests browse the real catalog before signing in.
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/products/products.page').then((m) => m.ProductsPage),
  },
  {
    path: 'products/:id',
    loadComponent: () =>
      import('./pages/product-details/product-details.page').then(
        (m) => m.ProductDetailsPage
      ),
  },
  // The cart is browsable by guests; checkout itself requires an account.
  {
    path: 'cart',
    loadComponent: () =>
      import('./pages/cart/cart.page').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./pages/checkout/checkout.page').then((m) => m.CheckoutPage),
  },
  {
    path: 'my-orders',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./pages/my-orders/my-orders.page').then((m) => m.MyOrdersPage),
  },
  {
    path: 'my-orders/:id',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./pages/order-details/order-details.page').then(
        (m) => m.OrderDetailsPage
      ),
  },
  {
    path: 'profile',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./pages/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.page').then((m) => m.AboutPage),
  },
  {
    path: 'company-history',
    loadComponent: () =>
      import('./pages/company-history/company-history.page').then(
        (m) => m.CompanyHistoryPage
      ),
  },
  {
    path: 'about-products',
    loadComponent: () =>
      import('./pages/about-products/about-products.page').then(
        (m) => m.AboutProductsPage
      ),
  },
  {
    path: 'contact-us',
    loadComponent: () =>
      import('./pages/contact-us/contact-us.page').then((m) => m.ContactUsPage),
  },
  {
    path: 'developers',
    loadComponent: () =>
      import('./pages/developers/developers.page').then((m) => m.DevelopersPage),
  },
];
