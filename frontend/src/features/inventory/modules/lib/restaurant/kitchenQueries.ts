import type {
  ApiKitchenOrder,
  ApiRecipe,
} from '../../../app/api/domainTypes';
import {
  completeKitchenOrder,
  createRecipe,
  deleteRecipe,
  updateRecipe,
  voidKitchenOrder,
} from '../../../app/api/client';
import {
  domainQueryKeys,
  useDomainMutation,
  useKitchenOrdersQuery,
  useRecipesQuery,
} from '../domainQueries';

const parseOrderModifiers = (notes?: string | null) => {
  const modifierText = notes?.match(/Modifiers:\s*([^|]+)/i)?.[1]?.trim();
  return modifierText ? modifierText.split(',').map((item) => item.trim()).filter(Boolean) : [];
};

export function useRestaurantRecipesQuery() {
  return useRecipesQuery(undefined, {
    select: (recipes) =>
      recipes.map((recipe: ApiRecipe) => {
        const ingredients = (recipe.ingredients ?? []).map((ingredient) => ({
          id: ingredient.id,
          productId: ingredient.itemId,
          backendItemId: ingredient.itemId,
          productSku: ingredient.item?.sku ?? undefined,
          name: ingredient.item?.name ?? 'Ingredient',
          quantity: ingredient.quantity,
          unit: ingredient.unit ?? ingredient.item?.unit ?? 'pcs',
          inventoryQuantity: ingredient.quantity,
          inventoryUnit: ingredient.item?.unit ?? ingredient.unit ?? 'pcs',
          unitCost: ingredient.unitCost ?? ingredient.item?.price ?? 0,
          totalCost:
            (ingredient.unitCost ?? ingredient.item?.price ?? 0) *
            ingredient.quantity,
        }));
        const totalCost = ingredients.reduce(
          (sum, ingredient) => sum + ingredient.totalCost,
          0,
        );
        return {
          id: recipe.id,
          backendId: recipe.id,
          name: recipe.name,
          description: recipe.menuItem?.description ?? '',
          imageUrl: recipe.imageUrl ?? recipe.menuItem?.imageUrl ?? '',
          category: recipe.category,
          servings: recipe.servings,
          yieldPercentage: recipe.yieldPercentage ?? 100,
          prepTime: recipe.prepTimeMinutes ?? 0,
          ingredients,
          totalCost,
          yieldAdjustedCost: totalCost,
          costPerServing: totalCost / Math.max(recipe.servings ?? 1, 1),
          targetFoodCost: recipe.targetFoodCost ?? 35,
          suggestedSellingPrice: recipe.sellingPrice ?? 0,
          sellingPrice: recipe.sellingPrice ?? 0,
          grossMargin: 0,
          isActive: recipe.isActive,
          modifiers: Array.isArray((recipe as any).modifiers)
            ? (recipe as any).modifiers.map((modifier: any) => ({
                id: modifier.id,
                name: modifier.name,
                type: modifier.type ?? 'remove',
                itemId: modifier.itemId,
                itemName: modifier.itemName ?? '',
                productId: modifier.itemId,
              }))
            : [],
          instructions: recipe.instructions ?? '',
        };
      }),
  });
}

export function useRestaurantKitchenOrdersQuery() {
  return useKitchenOrdersQuery(undefined, {
    select: (orders) =>
      orders.map((order: ApiKitchenOrder) => ({
        id: order.id,
        receiptNo: order.receiptNo,
        recipeId: order.recipeId,
        recipeName: order.recipe?.name ?? 'Recipe',
        quantity: order.quantity,
        status: order.status.toLowerCase(),
        orderedAt: order.createdAt,
        completedBy: order.completedBy?.email ?? 'shared-backend',
        notes: order.notes ?? '',
        modifiers: parseOrderModifiers(order.notes),
        voidReason: order.voidReason,
        voidedAt: order.voidedAt,
      })),
  });
}

export function useCreateRestaurantRecipeMutation() {
  return useDomainMutation(createRecipe, [domainQueryKeys.recipes]);
}

export function useUpdateRestaurantRecipeMutation() {
  return useDomainMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateRecipe(id, data),
    [domainQueryKeys.recipes],
  );
}

export function useDeleteRestaurantRecipeMutation() {
  return useDomainMutation(deleteRecipe, [domainQueryKeys.recipes]);
}

export function useSaveRestaurantRecipeMutation() {
  return useDomainMutation(
    ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? updateRecipe(id, data) : createRecipe(data),
    [domainQueryKeys.recipes],
  );
}

export function useCompleteRestaurantKitchenOrderMutation() {
  return useDomainMutation(completeKitchenOrder, [
    domainQueryKeys.kitchenOrders,
    domainQueryKeys.inventory,
  ]);
}

export function useVoidRestaurantKitchenOrderMutation() {
  return useDomainMutation(
    ({ id, reason }: { id: string; reason: string }) =>
      voidKitchenOrder(id, reason),
    [
      domainQueryKeys.kitchenOrders,
      domainQueryKeys.inventory,
      domainQueryKeys.stockMovements,
    ],
  );
}
