# BistroBuddies Mobile (customer app)

Customer-facing ordering app: Ionic 22 + Angular 22 + Capacitor 8.
Runs in the browser (`ng serve`) and is set up for native builds via
`capacitor.config.ts` (no iOS/Android platform folders are generated yet).

## Prerequisites

- Node.js >= 20.12 (developed with Node 24)
- npm >= 10

## Setup

```bash
npm install
```

## Development

```bash
# Terminal 1 — backend API (separate repo: bistrobuddies-backend)
cd ../bistrobuddies-backend && npm install && npm run dev   # listens on :3001

# Terminal 2 — this app
npm start        # ng serve app (default Angular dev server port)
```

## Configuration

| File | Purpose |
| --- | --- |
| `src/environments/environment.ts` | Dev config: `apiBaseUrl: 'http://localhost:3001/api'`, Firebase web config |
| `src/environments/environment.prod.ts` | Prod config: `apiBaseUrl: 'https://your-bistrobuddies-backend.example/api'` (**must be replaced before a production build**), Firebase web config |

The Firebase values in the environment files are the *public* Firebase web
SDK config (safe to commit — they are not secrets). No secrets belong in this
repository.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Dev server (`ng serve app`) |
| `npm run build` | Production build to `www/` |
| `npm run watch` | Dev build in watch mode |
| `npm test` | Unit tests (Vitest via Angular builder, all specs) |
| `npm run lint` | ESLint (`ng lint app`) |

## Data access after separation

- **Checkout** creates orders through the backend: `POST /api/orders`
  (`src/app/services/orders-api.service.ts`). Prices and totals are verified
  server-side; the client never sends trusted prices.
- **Reads** (products, own orders, user profile) still go directly to
  Firestore from the client SDK — unchanged behaviour.
- The previous client-side Firestore *writes* for orders were removed
  (`OrdersService.createOrder` / `updateOrderStatus` /
  `updateOrderPaymentStatus` no longer exist).

See `../integration-docs/` for the API contract and architecture.

## Known issues

- `npm run lint` reports **30 pre-existing errors** inherited from the
  original monolith, all in:
  - `src/app/pages/about/about.page.ts`
  - `src/app/pages/developers/developers.page.html`

  These were failing in the original repository before the separation and are
  intentionally not fixed here (no unrelated changes).

## Not included (was never built)

- PayMongo payment integration (planned, not built)
- Cloudinary / Firebase Storage image upload (products use a text
  `imageUrl` field only)
- Native iOS/Android platform folders (`npx cap add ios|android` when needed)
