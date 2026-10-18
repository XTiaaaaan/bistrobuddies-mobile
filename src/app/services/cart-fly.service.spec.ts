import { CartFlyService, resolveFlyImage } from './cart-fly.service';

function rect(partial: Partial<DOMRect> = {}): DOMRect {
  return {
    left: 0,
    top: 0,
    width: 80,
    height: 80,
    right: 80,
    bottom: 80,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...partial,
  };
}

function makeImage(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = 'https://example.com/latte.png';
  document.body.appendChild(img);
  return img;
}

function makeCartAnchor(): { anchor: HTMLDivElement; badge: HTMLSpanElement } {
  const anchor = document.createElement('div');
  anchor.className = 'cart-anchor';
  anchor.getBoundingClientRect = () => rect({ left: 320, top: 8, width: 20, height: 20 });
  const badge = document.createElement('span');
  badge.className = 'cart-badge';
  badge.textContent = '1';
  anchor.appendChild(badge);
  document.body.appendChild(anchor);
  return { anchor, badge };
}

describe('CartFlyService', () => {
  let service: CartFlyService;

  beforeEach(() => {
    service = new CartFlyService();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves without animating when no source is given', async () => {
    makeCartAnchor();

    await service.flyToCart(null);

    expect(document.querySelector('.bb-fly-clone')).toBeNull();
  });

  it('resolves without animating when the Web Animations API is unavailable', async () => {
    const img = makeImage();
    img.getBoundingClientRect = () => rect();
    makeCartAnchor();

    await service.flyToCart(img);

    expect(document.querySelector('.bb-fly-clone')).toBeNull();
  });

  it('flies toward the viewport corner when no cart button is rendered', async () => {
    const img = makeImage();
    img.getBoundingClientRect = () => rect({ left: 20, top: 120 });
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    Object.defineProperty(img, 'animate', { value: animate });

    const flight = service.flyToCart(img);

    expect(document.querySelector('.bb-fly-clone')).not.toBeNull();
    await flight;
    expect(document.querySelector('.bb-fly-clone')).toBeNull();
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('targets the visible cart button when a hidden page left an earlier one in the DOM', async () => {
    // Ionic keeps previous pages mounted (hidden, zero-size) in the router outlet.
    const hiddenAnchor = document.createElement('div');
    hiddenAnchor.className = 'cart-anchor';
    const hiddenBadge = document.createElement('span');
    hiddenBadge.className = 'cart-badge';
    hiddenAnchor.appendChild(hiddenBadge);
    document.body.appendChild(hiddenAnchor);

    const img = makeImage();
    img.getBoundingClientRect = () => rect({ left: 20, top: 120 });
    const { badge } = makeCartAnchor();

    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    Object.defineProperty(img, 'animate', { value: animate });

    const flight = service.flyToCart(img);

    expect(document.querySelector('.bb-fly-clone')).not.toBeNull();
    await flight;

    expect(badge.classList.contains('is-bouncing')).toBe(true);
    expect(hiddenBadge.classList.contains('is-bouncing')).toBe(false);
  });

  it('flies a solid placeholder when the product image has not loaded yet', async () => {
    const img = document.createElement('img');
    img.getBoundingClientRect = () => rect({ left: 20, top: 120 });
    document.body.appendChild(img);
    makeCartAnchor();
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    Object.defineProperty(img, 'animate', { value: animate });

    const flight = service.flyToCart(img);

    const placeholder = document.querySelector('.bb-fly-placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.classList.contains('bb-fly-clone')).toBe(true);
    await flight;
    expect(document.querySelector('.bb-fly-placeholder')).toBeNull();
  });

  it('cleans up and resets even when the animation never finishes', async () => {
    vi.useFakeTimers();
    try {
      const img = makeImage();
      img.getBoundingClientRect = () => rect();
      makeCartAnchor();
      const animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel: vi.fn() }));
      Object.defineProperty(img, 'animate', { value: animate });

      const flight = service.flyToCart(img);
      expect(document.querySelector('.bb-fly-clone')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(800);
      await flight;

      expect(document.querySelector('.bb-fly-clone')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flies a clone toward the cart button, then cleans up and pulses the badge', async () => {
    const img = makeImage();
    img.getBoundingClientRect = () => rect({ left: 20, top: 120 });
    const { badge } = makeCartAnchor();

    let finishFlight: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      finishFlight = resolve;
    });
    const animate = vi.fn(() => ({ finished, cancel: vi.fn() }));
    Object.defineProperty(img, 'animate', { value: animate });

    const flight = service.flyToCart(img);

    const clone = document.querySelector('.bb-fly-clone');
    expect(clone).not.toBeNull();
    expect(clone?.getAttribute('aria-hidden')).toBe('true');
    expect(animate).toHaveBeenCalledTimes(1);

    finishFlight();
    await flight;

    expect(document.querySelector('.bb-fly-clone')).toBeNull();
    expect(badge.classList.contains('is-bouncing')).toBe(true);
  });

  it('ignores a second flight while one is already animating', async () => {
    const img = makeImage();
    img.getBoundingClientRect = () => rect();
    makeCartAnchor();

    let finishFlight: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      finishFlight = resolve;
    });
    const animate = vi.fn(() => ({ finished, cancel: vi.fn() }));
    Object.defineProperty(img, 'animate', { value: animate });

    const first = service.flyToCart(img);
    await service.flyToCart(img);

    expect(animate).toHaveBeenCalledTimes(1);

    finishFlight();
    await first;
  });
});

describe('resolveFlyImage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no source is given', () => {
    expect(resolveFlyImage(null)).toBeNull();
    expect(resolveFlyImage(undefined)).toBeNull();
  });

  it('returns the element itself when it is an image', () => {
    const img = document.createElement('img');
    expect(resolveFlyImage(img)).toBe(img);
  });

  it('finds the image inside a non-image element', () => {
    const wrap = document.createElement('div');
    const img = document.createElement('img');
    wrap.appendChild(img);

    expect(resolveFlyImage(wrap)).toBe(img);
  });

  it('finds the card image from a clicked control', () => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const media = document.createElement('div');
    media.className = 'product-media';
    const img = document.createElement('img');
    media.appendChild(img);
    const button = document.createElement('button');
    card.append(media, button);
    document.body.appendChild(card);

    const event = new MouseEvent('click');
    Object.defineProperty(event, 'currentTarget', { value: button });

    expect(resolveFlyImage(event)).toBe(img);
  });

  it('returns null when the click event has no current target', () => {
    const event = new MouseEvent('click');
    expect(resolveFlyImage(event)).toBeNull();
  });
});
