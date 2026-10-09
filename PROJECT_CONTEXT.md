# PROJECT_CONTEXT.md — BistroBuddies Mobile (customer app)

> Generated from a read-only audit of the existing repository. No application code, Firebase settings,
> or data were changed. Secrets are intentionally not reproduced in this file.

---

## 1. What this repository is

The **customer-facing ordering app**. Runs in a browser via `ng serve` and is intended to be packaged
with Capacitor for Android. It talks to the backend for privileged writes and reads Firestore directly
for everything else.

| Attribute | Verified value |
|---|---|
| Framework | Angular **22.0.1** (standalone-only, esbuild `@angular/build:application`) |
| UI | Ionic `@ionic/angular` **9.0.3** + `ionicons` 8 |
| Native | Capacitor `@capacitor/core` **8.5.1** (+ cli, app, haptics, keyboard, status-bar) |
| Firebase | raw modular `firebase` JS SDK **12.19.0** (NOT `@angular/fire`) |
| Tests | Vitest 4.1.11 + jsdom via `@angular/build:unit-test` |
| Package manager | npm (`package-lock.json` lockfileVersion 3) |
| Output | `www/` (Capacitor web dir) |
| Firebase project | `bistrobuddies-4f179` (`src/environments/environment.ts:18`) |
| Git | 1 commit (`e047662 Initial commit: BistroBuddies mobile app`), tree clean, remote `github.com/XTiaaaaan/bistrobuddies-mobile` |

**Not present (verified):** no `android/` or `ios/` platform folders, no `resources/` folder,
no `vercel.json`, no wildcard route, no `@media` queries anywhere in `src/`.

---

## 2. Entry points and routes

- `src/main.ts` → `bootstrapApplication(AppComponent, appConfig)`
- `src/app/app.config.ts` → router (`withComponentInputBinding`, `withPreloading(PreloadAllModules)`),
  `IonicRouteStrategy`, `provideHttpClient()`, Firebase DI providers
- **`src/app/app.routes.ts`** is the only route table; all lazy routes use `loadComponent`.

| Path | Guard | Component |
|---|---|---|
| `''` | — | redirect → `dashboard` |
| `login`, `register`, `forgot-password` | **none (public)** | auth pages |
| `dashboard` | `canMatch: [authGuard]` | DashboardPage |
| `products` | `canMatch: [authGuard]` | ProductsPage |
| `products/:id` | `canMatch: [authGuard]` | ProductDetailsPage |
| `cart` | `canMatch: [authGuard]` | CartPage |
| `checkout` | `canMatch: [authGuard]` | CheckoutPage |
| `my-orders`, `my-orders/:id` | `canMatch: [authGuard]` | MyOrders / OrderDetails |
| `about`, `developers` | **none (public)** | static pages |

There is only **one** guard in the app: `authGuard` (`src/app/core/auth/auth.guard.ts:6-22`), a `CanMatchFn`
that redirects unauthenticated users to `/login?redirect=<url>`. Post-login redirect is open-redirect-safe
(`src/app/core/auth/auth-redirect.ts:1-6`). **No admin guard, no role checks — admin is not a concern here.**

---

## 3. Responsibilities (what this app owns)

| Area | Implementation |
|---|---|
| Auth | Firebase Auth: email/password register (`auth.service.ts:72`), login (`:91`), Google popup (`:107`), password reset (`:122`), logout (`:118`). Profile synced to Firestore `users/{uid}` with `role: 'customer'` (`:126-168`) |
| Product browsing | Live Firestore reads of `products` — `products.service.ts:36-52` (**read-only by design**) |
| Cart | **In-memory Angular signals only** — `services/cart.service.ts`. Keyed by `productId+size+sugar`, qty clamped 1–99. **Lost on reload** (no localStorage) |
| Checkout | `pages/checkout/checkout.page.ts:170-231` → `OrdersApiService.createOrder()` → `POST {apiBaseUrl}/orders` with `Authorization: Bearer <firebase id token>` |
| Order history | Live Firestore reads scoped to `customerId == uid` — `orders.service.ts:42-49`; detail page does a client-side ownership check (`order-details.page.ts:92-96`) |
| Payments | **None.** `services/payments.service.ts` is dead code; `PaymentMethod.ONLINE` is only a radio value sent to the backend |

**This app never writes products or orders to Firestore** (that was removed; writes go through the backend).

---

## 4. API contract used by this app

Base URL: `environment.apiBaseUrl`

| Env file | Value |
|---|---|
| `src/environments/environment.ts:14` (dev) | `http://localhost:3001/api` |
| `src/environments/environment.prod.ts:12` (prod) | `https://your-bistrobuddies-backend.example/api` — **⚠️ unresolved placeholder** |

**The only HTTP call in the entire app:**

```
POST {apiBaseUrl}/orders
Authorization: Bearer <Firebase ID token>
```
Request (`orders-api.service.ts:10-29`) — **no prices sent**:
```jsonc
{ "items": [{ "productId", "size", "sugar", "quantity" }],
  "customer": { "name", "phone" },
  "address": { "recipientName", "phone", "address", "city?", "postalCode?" },
  "customerComment", "paymentMethod": "COD" | "ONLINE" }
```
Response (`:32-39`): `{ id, subtotal, deliveryFee, total, orderStatus, paymentStatus }`.
Errors are mapped to `OrderApiError` with HTTP status (`:84-108`).

Everything else is direct Firestore: reads of `products`, `orders`, `payments` (unused), and
read/**write** of `users/{uid}` (`users.service.ts:33-47`).

---

## 5. Data models (`src/app/models/`)

### product.model.ts
```ts
type ProductSize = 'small' | 'medium' | 'large';
interface Product {
  id, name, description, category, imageUrl, cloudinaryPublicId: string;
  smallPrice: number; mediumPrice: number; largePrice: number;   // PHP
  sugarOptions: string[]; available: boolean;
  createdAt: Timestamp | null; updatedAt: Timestamp | null;
}
```
- **Price: three PHP numbers (size tiers), single currency.** Displayed as `₱` via `toLocaleString('en-PH', …)`.
- Availability field is **`available: boolean`**; image field is **`imageUrl`**.

### order.model.ts
`OrderStatus` enum (PENDING/CONFIRMED/PREPARING/READY/COMPLETED/CANCELLED), `OrderItem` (with
`unitPrice`/`subtotal` snapshots), `CustomerSnapshot`, `AddressSnapshot`, `Order` with
`subtotal/deliveryFee/total`, `paymentMethod`, `paymentStatus`.

### payment.model.ts
`PaymentMethod { COD, ONLINE }`, `PaymentStatus { PENDING, PAID, FAILED, REFUNDED }`, `Payment` (unused).

### user.model.ts / cart.model.ts
`UserRole = 'customer' | 'admin'`; `User{uid,name,email,phone,address,role,...}`.
`CartItem{productId,productName,productImage,size,sugar,quantity,unitPrice,itemSubtotal}`.

---

## 6. Firebase configuration

Both files under `src/environments/`, swapped by `angular.json` `fileReplacements` for production.

| Key | Dev (`environment.ts`) | Prod (`environment.prod.ts`) |
|---|---|---|
| `production` | `false` | `true` |
| `deliveryFee` | `0` (PHP, display only) | `0` |
| `apiBaseUrl` | `http://localhost:3001/api` | placeholder — **must be replaced** |
| `firebase.apiKey` | present (public web SDK key — value not reproduced here) | same |
| `firebase.authDomain` | `bistrobuddies-4f179.firebaseapp.com` | same |
| `firebase.projectId` | **`bistrobuddies-4f179`** | same |
| `firebase.storageBucket` | `bistrobuddies-4f179.firebasestorage.app` | same |
| `firebase.messagingSenderId` / `appId` | present (identifiers, not secrets) | same |

The Firebase web config is public-by-design and safe to bundle; **security comes from Firestore rules,
not from hiding these values**. There are no other env files, and no secrets are stored in this repo.

---

## 7. Build / test / lint commands (executed during this audit)

| Script | Command | Result |
|---|---|---|
| `npm start` | `ng serve app` | dev server on :4200 (not started in audit) |
| `npm run build` | `ng build app` | **PASS (exit 0)** → `www/`, 1.62 MB initial / 335 kB transfer, 27 lazy chunks |
| `npm test` | `ng test app` | **PASS — 18 files, 99/99 tests** |
| `npm run lint` | `ng lint app` | **FAIL — 30 errors, 0 warnings** (pre-existing, see below) |
| `npm run watch` | `ng build app --watch --configuration development` | — |

Lint failures are exactly the documented pre-existing set (`README.md:62-70`):
- `src/app/pages/about/about.page.ts:35` — empty lifecycle method (1 error)
- `src/app/pages/developers/developers.page.html` — 29 × `prefer-control-flow` (`ngIf`/`ngForOf`)

Both builds/tests also emit a non-fatal Browserslist "unsupported browsers" warning (legacy targets).

---

## 8. Security requirements (must hold for any future change)

1. **No secrets in this repo.** Firebase web config only; never add PayMongo keys, service accounts, or
   backend credentials to `src/environments/`.
2. **Never send prices from the client.** Checkout request contains only `productId/size/sugar/quantity`;
   totals come back from the server (`orders-api.service.ts:9,31-39`). Client-side totals are display-only.
3. **Order writes go through the backend only.** Do not reintroduce direct Firestore `create`/`update`
   of `orders` — Firestore rules cannot verify unit prices.
4. **Auth token hygiene:** fetch the ID token per request, never persist it (`auth.service.ts:59-70`).
5. ⚠️ **Privilege-escalation surface:** `UsersService.updateUser(uid, patch: Partial<User>)`
   (`users.service.ts:42-47`) is typed to allow `role`. Current rules
   (`firestore.rules` in the backend repo, lines 33-37) preserve `role` on self-update, so a customer
   cannot self-promote — but any future client code must never send `role`.
6. ⚠️ `OrdersService.watchOrders()` reads the **entire** `orders` collection with no `customerId` filter
   (`orders.service.ts:37-40`). Currently unused dead code — delete or scope it before wiring it up.
7. ⚠️ `environment.prod.ts` placeholder API host would send Bearer tokens to a domain the team does not
   control — replace before any production build.
8. Google sign-in uses `signInWithPopup` (`auth.service.ts:109`), which is often blocked inside a native
   Capacitor WebView; add a redirect fallback before shipping Android.

---

## 9. Remaining work (requirement status)

| Requirement | Status | Evidence / what is missing |
|---|---|---|
| Public product browsing before login | ❌ **MISSING** | `products`, `products/:id`, `dashboard` all carry `canMatch: [authGuard]` (`app.routes.ts:29,35,41`) and `''` redirects to guarded `dashboard`. A guest only reaches login/register/forgot-password/about/developers. **Also blocked server-side:** backend `firestore.rules` requires `isSignedIn()` for `products` read, and there is no public `GET /api/products` — so removing the guard alone is not enough |
| Login and registration | ✅ **WORKS** | `auth.service.ts:72,91,107,122` + auth pages + profile sync |
| Product list | ✅ **WORKS** (after login) | `products.page` + `components/product-grid` |
| Cart | ✅ **WORKS** (not persisted across restarts) | `services/cart.service.ts`, `pages/cart` |
| Checkout | ✅ **WORKS** | `pages/checkout/checkout.page.ts:170-231` |
| COD | ✅ **WORKS** | `PaymentMethod.COD`, default radio (`checkout.page.ts:86`) |
| Order history | ✅ **WORKS** | `my-orders.page.ts:63-90`, `order-details.page.ts:65-101` |
| PayMongo (client side) | ❌ **MISSING** | Zero PayMongo code; `ONLINE` is only a stored enum value. `payments.service.ts` is dead code |
| Responsive UI | ⚠️ **PARTIAL** | Fluid auto-fill grid (`product-grid.component.scss:55`), capped 520 px columns, Ionic flex utils — but **zero `@media` breakpoints** in `src/` |
| App icon / splash | ❌ **MISSING** | Only a browser favicon (`src/assets/icon/favicon.png`). `capacitor.config.ts` has no icon/splash keys, no `resources/` folder, no `@capacitor/splash-screen` config. `index.html:6` title is still "Ionic App" |
| Android packaging | ⚠️ **PARTIAL** | Capacitor configured (`webDir: 'www'`, cli 8.5.1, `ionic.config.json` integrations) but **no `android/` folder**, and `appId: 'io.ionic.starter'` is the untouched starter ID (`capacitor.config.ts:4`) — must change before Play Store submission |
| Vercel deployment readiness | ⚠️ **PARTIAL** | Production build succeeds and outputs static `www/`, but **no `vercel.json`/SPA rewrite** and the prod `apiBaseUrl` is a placeholder |
| Backend used for privileged ops | ✅ **WORKS** | Order creation is the only HTTP call and it is server-priced |

---

## 10. Product price note (single PHP price decision)

Prices are **three PHP numbers per product** (`smallPrice`/`mediumPrice`/`largePrice`) — single currency,
size-tiered. Collapsing to one price is **unsafe** here: the size selector, cart re-pricing
(`cart.page.ts:92-129`), and checkout totals all depend on per-size pricing, and the backend
`PRICE_FIELDS` map plus validation require all three. **Keep the current schema** (see the backend repo's
`PROJECT_CONTEXT.md` §10 for the full dependency list and migration analysis). Old orders are unaffected
because order items snapshot `unitPrice`/`subtotal` at purchase time. **No migration performed.**

---

## 11. Related repositories

| Repo | Role |
|---|---|
| `../bistrobuddies-backend` | Trusted API on `:3001` — owns pricing, admin auth, order creation |
| `../bistrobuddies-admin` | Separate admin-only site — product CRUD, order management UI (planned) |

⚠️ `README.md` references `../integration-docs/` — **that directory does not exist** in `D:\bistrobuddies`.
