import type { Timestamp } from 'firebase/firestore';

export type ProductSize = 'small' | 'medium' | 'large';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  cloudinaryPublicId: string;
  smallPrice: number;
  mediumPrice: number;
  largePrice: number;
  sugarOptions: string[];
  available: boolean;
  /** Canonical PHP list price reported by the backend (derived from the tiers). */
  price?: number;
  /** Always `PHP`; present only when the backend supplies it. */
  currency?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
