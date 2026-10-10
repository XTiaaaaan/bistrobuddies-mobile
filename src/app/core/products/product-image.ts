import { environment } from '../../../environments/environment';

const ABSOLUTE_URL = /^(https?:|data:|blob:)/i;
const PROTOCOL_RELATIVE_URL = /^\/\//;
const LEADING_SLASHES = /^\/+/;

function apiOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return '';
  }
}

/**
 * Turns the `imageUrl` reported by the backend into a URL the app can render.
 *
 * - Absolute `http(s)` URLs (e.g. `http://localhost:3001/uploads/x.jpg`) are
 *   returned untouched: they already point at the server that hosts the file,
 *   so they must never be rewritten or prefixed with the API base URL.
 * - Backend-relative upload paths (`/uploads/x.jpg`) are resolved against the
 *   backend origin, never against `apiBaseUrl` (which carries the `/api`
 *   suffix) or against the app origin.
 * - Legacy asset-relative paths (`assets/products/x.png`) stay on the bundled
 *   copy in `src/assets` but become root-relative so they keep resolving from
 *   nested routes such as `/products/:id`.
 * - Missing or blank values collapse to `''` so callers render their fallback.
 */
export function resolveProductImageUrl(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') {
    return '';
  }

  if (ABSOLUTE_URL.test(raw) || PROTOCOL_RELATIVE_URL.test(raw)) {
    return raw;
  }

  const path = raw.replace(LEADING_SLASHES, '');

  if (path.toLowerCase().startsWith('uploads/')) {
    const origin = apiOrigin(environment.apiBaseUrl);
    return origin === '' ? raw : `${origin}/${path}`;
  }

  if (path.startsWith('assets/')) {
    return `/${path}`;
  }

  return raw;
}
