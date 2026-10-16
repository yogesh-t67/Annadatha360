import { create } from 'zustand';

export interface CartLine {
  productId: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
}

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  addItem: (productId) =>
    set((state) => {
      const existing = state.lines.find((line) => line.productId === productId);
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line
          ),
        };
      }
      return { lines: [...state.lines, { productId, quantity: 1 }] };
    }),
  removeItem: (productId) => set((state) => ({ lines: state.lines.filter((line) => line.productId !== productId) })),
  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => line.productId !== productId)
          : state.lines.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    })),
}));
