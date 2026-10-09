import { ProductSize } from './product.model';

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string;
  size: ProductSize;
  sugar: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
}

export type CartItemInput = Omit<CartItem, 'itemSubtotal'>;

/** A cart line is identified by product + size + sugar. */
export interface CartItemKey {
  productId: string;
  size: ProductSize;
  sugar: string;
}

export type CartItemPatch = Partial<Pick<CartItem, 'size' | 'sugar' | 'quantity' | 'unitPrice'>>;

export function sameCartKey(a: CartItemKey, b: CartItemKey): boolean {
  return a.productId === b.productId && a.size === b.size && a.sugar === b.sugar;
}
