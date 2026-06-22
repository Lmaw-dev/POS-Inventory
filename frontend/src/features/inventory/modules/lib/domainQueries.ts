import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  getBundles,
  getGoodsReceipts,
  getInventory,
  getKitchenOrders,
  getLocations,
  getPurchaseOrders,
  getRecipes,
  getRestaurantSettings,
  getSales,
  getStockMovements,
  getSuppliers,
  getTransfers,
  getUsers,
  type KitchenOrderStatus,
} from '../../app/api/client';
import type {
  ApiBundle,
  ApiGoodsReceipt,
  ApiInventoryItem,
  ApiKitchenOrder,
  ApiLocation,
  ApiPurchaseOrder,
  ApiRecipe,
  ApiSale,
  ApiStockMovement,
  ApiSupplier,
  ApiTransfer,
  ApiUser,
  BusinessModule,
} from '../../app/api/domainTypes';

export const domainQueryKeys = {
  inventory: ['inventory'] as const,
  locations: ['locations'] as const,
  users: ['users'] as const,
  purchaseOrders: ['purchase-orders'] as const,
  goodsReceipts: ['goods-receipts'] as const,
  suppliers: ['suppliers'] as const,
  transfers: ['transfers'] as const,
  adjustments: ['adjustments'] as const,
  stockMovements: ['stock-movements'] as const,
  sales: ['sales'] as const,
  bundles: ['bundles'] as const,
  recipes: ['recipes'] as const,
  kitchenOrders: ['kitchen-orders'] as const,
  restaurantSettings: ['restaurant-settings'] as const,
};

const domainInvalidationDependencies = new Map<string, QueryKey[]>([
  ['inventory', [
    domainQueryKeys.stockMovements,
    domainQueryKeys.transfers,
    domainQueryKeys.bundles,
    domainQueryKeys.purchaseOrders,
    domainQueryKeys.goodsReceipts,
  ]],
  ['locations', [
    domainQueryKeys.inventory,
    domainQueryKeys.transfers,
    domainQueryKeys.sales,
    domainQueryKeys.bundles,
  ]],
  ['purchase-orders', [
    domainQueryKeys.goodsReceipts,
    domainQueryKeys.inventory,
    domainQueryKeys.stockMovements,
  ]],
  ['goods-receipts', [
    domainQueryKeys.purchaseOrders,
    domainQueryKeys.inventory,
    domainQueryKeys.stockMovements,
  ]],
  ['suppliers', [domainQueryKeys.purchaseOrders]],
  ['transfers', [domainQueryKeys.inventory, domainQueryKeys.stockMovements]],
  ['adjustments', [domainQueryKeys.inventory, domainQueryKeys.stockMovements]],
  ['stock-movements', [domainQueryKeys.inventory]],
  ['sales', [domainQueryKeys.inventory, domainQueryKeys.stockMovements]],
  ['bundles', [domainQueryKeys.inventory]],
  ['recipes', [domainQueryKeys.kitchenOrders, ['pos-menu']]],
  ['kitchen-orders', [
    domainQueryKeys.inventory,
    domainQueryKeys.stockMovements,
    domainQueryKeys.sales,
  ]],
]);

function expandInvalidationKeys(queryKeys: QueryKey[]) {
  const expanded = queryKeys.flatMap((queryKey) => [
    queryKey,
    ...(domainInvalidationDependencies.get(String(queryKey[0])) ?? []),
  ]);
  return Array.from(
    new Map(expanded.map((queryKey) => [JSON.stringify(queryKey), queryKey])).values(),
  );
}

type SelectOptions<TQueryFnData, TData> = Pick<
  UseQueryOptions<TQueryFnData, Error, TData>,
  'enabled' | 'select'
>;

export function useInventoryQuery<TData = ApiInventoryItem[]>(
  params?: { search?: string; itemType?: string },
  options?: SelectOptions<ApiInventoryItem[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.inventory, params ?? {}],
    queryFn: () => getInventory(params),
    ...options,
  });
}

export function useLocationsQuery<TData = ApiLocation[]>(
  options?: SelectOptions<ApiLocation[], TData>,
) {
  return useQuery({
    queryKey: domainQueryKeys.locations,
    queryFn: getLocations,
    ...options,
  });
}

export function useUsersQuery<TData = ApiUser[]>(
  options?: SelectOptions<ApiUser[], TData>,
) {
  return useQuery({
    queryKey: domainQueryKeys.users,
    queryFn: getUsers,
    ...options,
  });
}

export function usePurchaseOrdersQuery<TData = ApiPurchaseOrder[]>(
  params?: { module?: BusinessModule; status?: string; supplierId?: string },
  options?: SelectOptions<ApiPurchaseOrder[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.purchaseOrders, params ?? {}],
    queryFn: () => getPurchaseOrders(params),
    ...options,
  });
}

export function useGoodsReceiptsQuery<TData = ApiGoodsReceipt[]>(
  params?: { module?: BusinessModule; purchaseOrderId?: string },
  options?: SelectOptions<ApiGoodsReceipt[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.goodsReceipts, params ?? {}],
    queryFn: () => getGoodsReceipts(params),
    ...options,
  });
}

export function useSuppliersQuery<TData = ApiSupplier[]>(
  params?: { module?: BusinessModule; isActive?: boolean },
  options?: SelectOptions<ApiSupplier[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.suppliers, params ?? {}],
    queryFn: () => getSuppliers(params),
    ...options,
  });
}

export function useTransfersQuery<TData = ApiTransfer[]>(
  params?: {
    module?: BusinessModule;
    status?: string;
    fromLocationId?: string;
    toLocationId?: string;
  },
  options?: SelectOptions<ApiTransfer[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.transfers, params ?? {}],
    queryFn: () => getTransfers(params),
    ...options,
  });
}

export function useStockMovementsQuery<TData = ApiStockMovement[]>(
  params?: {
    module?: BusinessModule;
    itemId?: string;
    locationId?: string;
    type?: string;
    referenceType?: string;
    referenceId?: string;
  },
  options?: SelectOptions<ApiStockMovement[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.stockMovements, params ?? {}],
    queryFn: () => getStockMovements(params),
    ...options,
  });
}

export function useSalesQuery<TData = ApiSale[]>(
  params?: {
    module?: BusinessModule;
    locationId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  },
  options?: SelectOptions<ApiSale[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.sales, params ?? {}],
    queryFn: () => getSales(params),
    ...options,
  });
}

export function useBundlesQuery<TData = ApiBundle[]>(
  params?: { status?: string },
  options?: SelectOptions<ApiBundle[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.bundles, params ?? {}],
    queryFn: () => getBundles(params),
    ...options,
  });
}

export function useRecipesQuery<TData = ApiRecipe[]>(
  params?: { active?: boolean },
  options?: SelectOptions<ApiRecipe[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.recipes, params ?? {}],
    queryFn: () => getRecipes(params),
    ...options,
  });
}

export function useKitchenOrdersQuery<TData = ApiKitchenOrder[]>(
  params?: { status?: KitchenOrderStatus },
  options?: SelectOptions<ApiKitchenOrder[], TData>,
) {
  return useQuery({
    queryKey: [...domainQueryKeys.kitchenOrders, params ?? {}],
    queryFn: () => getKitchenOrders(params),
    ...options,
  });
}

export function useRestaurantSettingsQuery<TData = Awaited<ReturnType<typeof getRestaurantSettings>>>(
  options?: SelectOptions<Awaited<ReturnType<typeof getRestaurantSettings>>, TData>,
) {
  return useQuery({
    queryKey: domainQueryKeys.restaurantSettings,
    queryFn: getRestaurantSettings,
    ...options,
  });
}

export function useDomainMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKeys: QueryKey[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all(
        expandInvalidationKeys(invalidateKeys).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

export function useInvalidateDomains() {
  const queryClient = useQueryClient();
  return (...queryKeys: QueryKey[]) =>
    Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
