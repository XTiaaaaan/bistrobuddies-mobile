import { environment } from '../../../environments/environment';

const ABSOLUTE_URL = /^(https?:|data:|blob:)/i;
const PROTOCOL_RELATIVE_URL = /^\/\//;
const LEADING_SLASHES = /^\/+/;
const CLOUDINARY_DELIVERY_HOST = /res\.cloudinary\.com\//i;
const CLOUDINARY_HTTP = /^http:\/\//i;

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
 * - Absolute `https://res.cloudinary.com/...` delivery URLs are returned
 *   directly and are never prefixed with the backend URL. Plain
 *   `http://res.cloudinary.com/...` URLs are upgraded to `https://` so they
 *   stay valid on secure origins, and scheme-less Cloudinary hosts
 *   (`res.cloudinary.com/...` or `//res.cloudinary.com/...`) are normalized
 *   to `https://...`. No product-catalog rebuild is needed: the stored
 *   `imageUrl` string is reused as-is.
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
    if (CLOUDINARY_DELIVERY_HOST.test(raw)) {
      if (PROTOCOL_RELATIVE_URL.test(raw)) {
        return `https:${raw}`;
      }
      return CLOUDINARY_HTTP.test(raw) ? raw.replace(CLOUDINARY_HTTP, 'https://') : raw;
    }
    return raw;
  }

  if (CLOUDINARY_DELIVERY_HOST.test(raw)) {
    const path = raw.replace(LEADING_SLASHES, '');
    return `https://${path}`;
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
