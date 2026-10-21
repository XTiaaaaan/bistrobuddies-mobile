import { resolveProductImageUrl } from '../products/product-image';

/**
 * Resolves a stored profile-picture value into something an `<img>` can render.
 * Reuses the product-image resolver so backend-relative upload paths, legacy
 * asset paths and Cloudinary URLs all behave exactly like other images in the
 * app. Returns `null` (instead of `''`) so callers can render their fallback.
 */
export function resolveProfilePhotoUrl(
  value: string | null | undefined
): string | null {
  return resolveProductImageUrl(value) || null;
}

/**
 * Adds a one-off cache-busting query parameter to an already-resolved photo
 * URL. This is only used when a successful upload returns the *same* URL as
 * the one currently displayed (Cloudinary normally returns a new URL for every
 * upload), so the WebView cannot keep showing the cached old bytes.
 *
 * The parameter is never persisted to Firestore and is never appended by data
 * URLs or blob URLs, whose query strings are not cache keys.
 */
export function cacheBustProfilePhotoUrl(
  url: string,
  token: string | number
): string {
  if (!url || /^(data|blob):/i.test(url)) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(String(token))}`;
}
