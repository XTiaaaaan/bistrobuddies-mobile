import { Injectable } from '@angular/core';

/** Header cart button shared by the browsing pages (class used by the flight target lookup). */
export const CART_ANCHOR_SELECTOR = '.cart-anchor';

const FLY_DURATION_MS = 480;
/** Safety net so a hung `animation.finished` can never leave the service busy. */
const FLY_TIMEOUT_MS = FLY_DURATION_MS + 250;
const BADGE_BOUNCE_MS = 500;

/** Viewport corner used when the header cart button is not rendered (still gives feedback). */
const FALLBACK_TARGET_SIZE = 40;
const FALLBACK_TARGET_INSET = 16;
const FALLBACK_TARGET_TOP = 8;

type RectLike = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

/**
 * Finds the product image to fly for an add-to-cart interaction.
 * Accepts the clicked element (looks up the nearest card) or the image itself.
 */
export function resolveFlyImage(source?: Event | Element | null): HTMLImageElement | null {
  if (!source) {
    return null;
  }

  if (source instanceof Element) {
    return source instanceof HTMLImageElement ? source : source.querySelector('img');
  }

  const current = source.currentTarget as Element | null;
  if (!current) {
    return null;
  }

  const scope =
    current.closest('.product-card') ?? current.closest('.card') ?? current.parentElement;
  return scope?.querySelector('.product-media img') ?? scope?.querySelector('img') ?? null;
}

/**
 * Lightweight "add to cart" flight: a clone of the product image arcs toward
 * the header cart button, then the cart badge pulses. The animation is purely
 * decorative — cart state is already updated by CartService before this runs.
 */
@Injectable({ providedIn: 'root' })
export class CartFlyService {
  /** True while a flight is in progress; extra taps are ignored, not queued. */
  private flying = false;

  async flyToCart(source?: Element | null): Promise<void> {
    const image = toImage(source);
    if (!image || this.flying || prefersReducedMotion() || typeof image.animate !== 'function') {
      return;
    }

    const from = image.getBoundingClientRect();
    if (from.width === 0 || from.height === 0) {
      return;
    }

    // Ionic keeps previous pages mounted (hidden) in the router outlet, so a
    // plain querySelector can hit a zero-size leftover from another page.
    // Always target the cart button that is actually visible right now.
    const anchor = findVisibleAnchor();
    const to: RectLike = anchor ? anchor.getBoundingClientRect() : fallbackCartRect();

    const clone = buildClone(image, from);
    // Animate through the source element's WAAPI method: `cloneNode` copies
    // the element but not instance properties, and the prototype method is
    // identical for both nodes in a real browser.
    const animate = resolveAnimate(image, clone);
    if (!animate) {
      clone.remove();
      return;
    }

    this.flying = true;
    try {
      const animation = animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          {
            transform: `translate(${(to.left - from.left) * 0.45}px, ${
              (to.top - from.top) * 0.45 - 56
            }px) scale(0.55)`,
            opacity: 0.95,
            offset: 0.55,
          },
          {
            transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(0.1)`,
            opacity: 0.35,
          },
        ],
        { duration: FLY_DURATION_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
      );
      await withTimeout(animation.finished, FLY_TIMEOUT_MS);
    } catch {
      // A cancelled or timed-out animation (page hidden, navigation) is not an error.
    } finally {
      clone.remove();
      this.flying = false;
    }

    this.pulseBadge();
  }

  /** Re-triggers the badge bounce so the customer sees the cart update. */
  private pulseBadge(): void {
    const badge = findVisibleAnchor()?.querySelector('.cart-badge');
    if (!(badge instanceof HTMLElement)) {
      return;
    }

    badge.classList.remove('is-bouncing');
    void badge.offsetWidth;
    badge.classList.add('is-bouncing');
    setTimeout(() => badge.classList.remove('is-bouncing'), BADGE_BOUNCE_MS);
  }
}

function toImage(source?: Element | null): HTMLImageElement | null {
  if (!source) {
    return null;
  }
  return source instanceof HTMLImageElement ? source : source.querySelector('img');
}

/** The on-screen cart button, skipping zero-size leftovers from hidden pages. */
function findVisibleAnchor(): Element | null {
  for (const candidate of document.querySelectorAll(CART_ANCHOR_SELECTOR)) {
    const rect = candidate.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return candidate;
    }
  }
  return null;
}

/** Top-right viewport corner, matching where the header cart button sits. */
function fallbackCartRect(): RectLike {
  const width =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
  return {
    left: Math.max(width - FALLBACK_TARGET_SIZE - FALLBACK_TARGET_INSET, 0),
    top: FALLBACK_TARGET_TOP,
    width: FALLBACK_TARGET_SIZE,
    height: FALLBACK_TARGET_SIZE,
  };
}

type AnimateFn = (frames: Keyframe[], options?: KeyframeAnimationOptions) => Animation;

function resolveAnimate(image: HTMLImageElement, clone: Element): AnimateFn | null {
  if (typeof clone.animate === 'function') {
    return clone.animate.bind(clone) as AnimateFn;
  }
  if (typeof image.animate === 'function') {
    return image.animate.bind(clone) as AnimateFn;
  }
  return null;
}

function buildClone(image: HTMLImageElement, from: DOMRect): HTMLElement {
  // A not-yet-loaded image would fly as an invisible ghost; a solid placeholder
  // keeps the feedback visible on slow connections.
  if (!image.complete || image.naturalWidth === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'bb-fly-clone bb-fly-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeAt(placeholder, from);
    document.body.appendChild(placeholder);
    return placeholder;
  }

  const clone = image.cloneNode(false) as HTMLImageElement;
  clone.className = 'bb-fly-clone';
  clone.removeAttribute('loading');
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  placeAt(clone, from);
  document.body.appendChild(clone);
  return clone;
}

function placeAt(element: HTMLElement, from: DOMRect): void {
  element.style.left = `${from.left}px`;
  element.style.top = `${from.top}px`;
  element.style.width = `${from.width}px`;
  element.style.height = `${from.height}px`;
}

/** Resolves when the animation settles, or rejects after a hard timeout. */
function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('flight timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
