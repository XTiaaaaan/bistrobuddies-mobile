import { Injectable, computed, signal } from '@angular/core';
import {
  CartItem,
  CartItemInput,
  CartItemKey,
  CartItemPatch,
  sameCartKey,
} from '../models/cart.model';

export const MAX_QUANTITY = 99;
const MIN_QUANTITY = 1;

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSignal = signal<CartItem[]>([]);

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
  }

  increase(key: CartItemKey): void {
    this.changeQuantity(key, (quantity) => Math.min(quantity + 1, MAX_QUANTITY));
  }

  decrease(key: CartItemKey): void {
    this.changeQuantity(key, (quantity) => Math.max(quantity - 1, MIN_QUANTITY));
  }

  removeItem(key: CartItemKey): void {
    this.itemsSignal.update((items) => items.filter((item) => !sameCartKey(item, key)));
  }

  clear(): void {
    this.itemsSignal.set([]);
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
  }

  private indexOf(items: CartItem[], key: CartItemKey): number {
    return items.findIndex((item) => sameCartKey(item, key));
  }
}

function clamp(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QUANTITY;
  }
  return Math.min(Math.max(Math.trunc(quantity), MIN_QUANTITY), MAX_QUANTITY);
}
