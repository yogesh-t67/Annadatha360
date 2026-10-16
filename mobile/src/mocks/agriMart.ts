export type ProductCategory = 'seeds' | 'fertilizers' | 'pesticides' | 'equipment';

export interface Product {
  id: string;
  nameKey: string;
  category: ProductCategory;
  price: number;
  originalPrice?: number;
}

/** Placeholder catalog until the Agri Mart API lands (see docs/api). Not live. */
export const mockProducts: Product[] = [
  { id: 'bayer-nativo-500g', nameKey: 'bayerNativo', category: 'pesticides', price: 780, originalPrice: 860 },
  { id: 'iffco-dap-50kg', nameKey: 'iffcoDap', category: 'fertilizers', price: 1350, originalPrice: 1450 },
];

export const dealProductIds = ['bayer-nativo-500g', 'iffco-dap-50kg'];
