import { Injectable, computed, signal } from '@angular/core';
import {
  CartItem,
  CartItemInput,
  CartItemKey,
  CartItemPatch,
  sameCartKey,
} from '../models/cart.model';
import { ProductSize } from '../models/product.model';

export const MAX_QUANTITY = 99;
const MIN_QUANTITY = 1;

/** Versioned storage key so incompatible cart payloads are ignored on upgrade. */
export const CART_STORAGE_KEY = 'bistrobuddies.cart.v1';

const SIZES: ProductSize[] = ['small', 'medium', 'large'];

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSignal = signal<CartItem[]>(loadStoredCart());

  readonly items = this.itemsSignal.asReadonly();
  readonly itemCount = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.quantity, 0)
  );
  readonly subtotal = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.itemSubtotal, 0)
  );

  add(input: CartItemInput): void {
    const quantity = clamp(input.quantity);
    const item: CartItem = { ...input, quantity, itemSubtotal: input.unitPrice * quantity };

    this.itemsSignal.update((items) => {
      const index = this.indexOf(items, item);
      if (index === -1) {
        return [...items, item];
      }

      const updated = [...items];
      const existing = updated[index];
      const mergedQuantity = clamp(existing.quantity + item.quantity);
      updated[index] = {
        ...existing,
        quantity: mergedQuantity,
        itemSubtotal: existing.unitPrice * mergedQuantity,
      };
      return updated;
    });
    this.persist();
  }

  updateItem(key: CartItemKey, patch: CartItemPatch): void {
    this.itemsSignal.update((items) => {
      const index = this.indexOf(items, key);
      if (index === -1) {
        return items;
      }

      const current = items[index];
      const next: CartItem = {
        productId: current.productId,
        productName: current.productName,
        productImage: current.productImage,
        size: patch.size ?? current.size,
        sugar: patch.sugar ?? current.sugar,
        quantity: clamp(patch.quantity ?? current.quantity),
        unitPrice: patch.unitPrice ?? current.unitPrice,
        itemSubtotal: 0,
      };
      next.itemSubtotal = next.unitPrice * next.quantity;

      const updated = [...items];
      const duplicate = updated.findIndex((item, i) => i !== index && sameCartKey(item, next));

      if (duplicate === -1) {
        updated[index] = next;
        return updated;
      }

      const target = updated[duplicate];
      const quantity = clamp(target.quantity + next.quantity);
      updated[duplicate] = {
        ...target,
        quantity,
        itemSubtotal: target.unitPrice * quantity,
      };
      updated.splice(index, 1);
      return updated;
    });
    this.persist();
  }

  increase(key: CartItemKey): void {
    this.changeQuantity(key, (quantity) => Math.min(quantity + 1, MAX_QUANTITY));
  }

  decrease(key: CartItemKey): void {
    this.changeQuantity(key, (quantity) => Math.max(quantity - 1, MIN_QUANTITY));
  }

  removeItem(key: CartItemKey): void {
    this.itemsSignal.update((items) => items.filter((item) => !sameCartKey(item, key)));
    this.persist();
  }

  clear(): void {
    this.itemsSignal.set([]);
    this.persist();
  }

  private changeQuantity(key: CartItemKey, nextQuantity: (quantity: number) => number): void {
    this.itemsSignal.update((items) => {
      const index = this.indexOf(items, key);
      if (index === -1) {
        return items;
      }

      const updated = [...items];
      const item = updated[index];
      const quantity = nextQuantity(item.quantity);
      updated[index] = { ...item, quantity, itemSubtotal: item.unitPrice * quantity };
      return updated;
    });
    this.persist();
  }

  private indexOf(items: CartItem[], key: CartItemKey): number {
    return items.findIndex((item) => sameCartKey(item, key));
  }

  /** Mirrors the cart to localStorage so it survives a reload. */
  private persist(): void {
    const storage = getStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(this.itemsSignal()));
    } catch {
      // Storage can be full or blocked (private mode); the in-memory cart still works.
    }
  }
}

function clamp(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QUANTITY;
  }
  return Math.min(Math.max(Math.trunc(quantity), MIN_QUANTITY), MAX_QUANTITY);
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function loadStoredCart(): CartItem[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(CART_STORAGE_KEY);
  } catch {
    return [];
  }

  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map(sanitizeStoredItem)
    .filter((item): item is CartItem => item !== null);
}

/**
 * Rebuilds one stored cart line. Prices are display-only snapshots and are
 * never trusted for checkout; invalid lines are dropped rather than guessed
 * so the cart never shows a fabricated price.
 */
function sanitizeStoredItem(entry: unknown): CartItem | null {
  if (entry === null || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productId = typeof record['productId'] === 'string' ? record['productId'] : '';
  const size = record['size'];
  const unitPrice = record['unitPrice'];

  if (
    productId === '' ||
    !SIZES.includes(size as ProductSize) ||
    typeof unitPrice !== 'number' ||
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0
  ) {
    return null;
  }

  const quantity = clamp(typeof record['quantity'] === 'number' ? record['quantity'] : MIN_QUANTITY);

  return {
    productId,
    productName: typeof record['productName'] === 'string' ? record['productName'] : '',
    productImage: typeof record['productImage'] === 'string' ? record['productImage'] : '',
    size: size as ProductSize,
    sugar: typeof record['sugar'] === 'string' ? record['sugar'] : '',
    quantity,
    unitPrice,
    itemSubtotal: unitPrice * quantity,
  };
}
