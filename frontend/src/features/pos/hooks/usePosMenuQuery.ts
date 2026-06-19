import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';

export type PosMenuIngredient = {
  id?: number;
  ingredient_id?: number;
  product_ingredient_id?: number;
  name: string;
  quantity: number;
  unit: string;
  quantity_available?: number;
  is_available?: boolean;
  is_required?: boolean;
  is_removable?: boolean;
  alternatives?: unknown[];
};

export type PosMenuProduct = {
  id: number;
  variant_id?: number;
  store_id: number;
  store_type: 'RESTAURANT' | 'RETAIL_STORE';
  category_id?: number | null;
  category_name?: string | null;
  name: string;
  description?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  sku?: string | null;
  barcode?: string | null;
  size?: string | null;
  color?: string | null;
  unit?: string | null;
  stock_quantity?: number | string | null;
  low_stock_limit?: number | string | null;
  available_quantity?: number | string | null;
  is_available?: boolean;
  is_active?: boolean;
  ingredients?: PosMenuIngredient[];
};

export function usePosMenuQuery(userId?: number | string | null) {
  return useQuery({
    queryKey: ['pos-menu', userId],
    enabled: Boolean(userId),
    queryFn: () => apiClient<PosMenuProduct[]>(`/pos/menu?user_id=${userId}`),
  });
}

export function useProductRecipeQuery(userId?: number | string | null, productId?: number | string | null) {
  return useQuery({
    queryKey: ['pos-product-recipe', userId, productId],
    enabled: Boolean(userId && productId),
    queryFn: () => apiClient(`/products/${productId}/recipe?user_id=${userId}`),
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: unknown) => apiClient('/pos/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    onSuccess: (_data, payload: any) => {
      void queryClient.invalidateQueries({ queryKey: ['pos-menu', payload?.user_id] });
    },
  });
}

export const useCompletePaymentMutation = useCreateOrderMutation;
