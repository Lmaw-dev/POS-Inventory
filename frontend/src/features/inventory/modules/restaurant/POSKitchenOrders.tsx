import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, ClipboardList, PackageMinus, ReceiptText, RotateCcw, Search, XCircle } from "lucide-react";
import { getApiBaseUrl } from "../../../../auth/services/auth";
import { InventoryProduct } from "../lib/inventoryLogic";
import {
  useCompleteRestaurantKitchenOrderMutation,
  useRestaurantInventoryQuery,
  useRestaurantKitchenOrdersQuery,
  useRestaurantRecipesQuery,
  useVoidRestaurantKitchenOrderMutation,
} from "../lib/restaurant";

type Ingredient = {
  id: string;
  backendItemId?: string;
  itemBackendId?: string;
  productId?: number | string;
  productSku?: string;
  name: string;
  quantity: number;
  unit: string;
  inventoryQuantity?: number;
  inventoryUnit?: string;
  unitCost: number;
  totalCost: number;
};

type RecipeModifier = {
  id: string;
  name: string;
  type: "remove";
  itemId?: string;
  itemName?: string;
  productId?: number | string;
};

type Recipe = {
  id: string;
  name: string;
  category: string;
  servings: number;
  isActive?: boolean;
  modifiers?: RecipeModifier[];
  ingredients: Ingredient[];
};

type POSOrder = {
  id: string;
  receiptNo: string;
  recipeId: string;
  recipeName: string;
  quantity: number;
  modifiers?: string[];
  status: "completed" | "voided" | "pending" | "preparing" | "ready";
  orderedAt: string;
  completedBy: string;
  notes: string;
  voidReason?: string;
  voidedAt?: string;
};

type CompletedPosReceipt = {
  id: number | string;
  order_number?: string;
  receipt_id?: string;
  customer_name?: string | null;
  items?: Array<{ product_name?: string; quantity?: number | string; unit_price?: number | string; line_total?: number | string }>;
  subtotal?: number | string;
  discount_amount?: number | string;
  tax_amount?: number | string;
  service_charge?: number | string;
  total_amount?: number | string;
  amount_paid?: number | string | null;
  change_amount?: number | string | null;
  created_at?: string;
  completed_at?: string | null;
  cashier_name?: string | null;
  payment_status?: string;
  order_status?: string;
};

type ReceiptHistoryRow = {
  id: string;
  receiptNo: string;
  itemName: string;
  quantity: number;
  customer?: string | null;
  staff?: string | null;
  status: string;
  total?: number;
  legacyOrder?: POSOrder;
};

const normalizeName = (value: string | undefined) => (value || '').trim().toLowerCase();
const money = (value: unknown) => `PHP ${Number(value ?? 0).toFixed(2)}`;

const reportSyncError = (error: unknown) => {
  window.dispatchEvent(
    new CustomEvent("restaurant-sync-error", {
      detail: {
        key: "pos.orders",
        message: error instanceof Error ? error.message : String(error),
      },
    }),
  );
};

export function POSKitchenOrders({ posUserId }: { posUserId?: number | string | null } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidingOrderId, setVoidingOrderId] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [excludedIngredientIds, setExcludedIngredientIds] = useState<Set<string>>(new Set());
  const [completedReceipts, setCompletedReceipts] = useState<CompletedPosReceipt[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);

  const { data: orderRecords = [] } = useRestaurantKitchenOrdersQuery();
  const orders = orderRecords as POSOrder[];
  const { data: recipeRecords = [] } = useRestaurantRecipesQuery();
  const recipes = recipeRecords as Recipe[];
  const activeRecipes = recipes.filter((recipe) => recipe.isActive ?? true);
  const { data: inventory = [] } = useRestaurantInventoryQuery<(InventoryProduct & { backendId?: string })[]>();
  const completeKitchenOrder = useCompleteRestaurantKitchenOrderMutation();
  const voidKitchenOrder = useVoidRestaurantKitchenOrderMutation();

  useEffect(() => {
    if (!posUserId) {
      setCompletedReceipts([]);
      return;
    }

    const controller = new AbortController();
    setIsLoadingReceipts(true);

    fetch(`${getApiBaseUrl()}/admin/pos/orders?user_id=${encodeURIComponent(String(posUserId))}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "Unable to load completed POS receipts.");
        }
        return response.json();
      })
      .then((rows: CompletedPosReceipt[]) => {
        setCompletedReceipts(
          rows.filter((order) => order.payment_status === "PAID" || order.order_status === "COMPLETED"),
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        reportSyncError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingReceipts(false);
        }
      });

    return () => controller.abort();
  }, [posUserId]);

  const selectedRecipe = activeRecipes.find((recipe) => recipe.id === recipeId);

  const ingredientPreview = useMemo(() => {
    const orderQty = Number(quantity) || 0;
    if (!selectedRecipe || orderQty <= 0) return [];

    return selectedRecipe.ingredients.map((ingredient) => {
      const product = inventory.find((item) =>
        ingredient.backendItemId
          ? item.backendId === ingredient.backendItemId
          : ingredient.productId
            ? String(item.id) === String(ingredient.productId) || item.backendId === ingredient.productId
            : normalizeName(item.name) === normalizeName(ingredient.name)
      );
      const servingFactor = orderQty / Math.max(selectedRecipe.servings || 1, 1);
      const required = (ingredient.inventoryQuantity ?? ingredient.quantity) * servingFactor;
      const deductionUnit = ingredient.inventoryUnit || ingredient.unit;
      const unitMatches = product ? (product.unit || deductionUnit) === deductionUnit : false;

      return {
        ...ingredient,
        required,
        deductionUnit,
        product,
        unitMatches,
        hasEnoughStock: Boolean(product && unitMatches && product.stock >= required),
      };
    });
  }, [inventory, quantity, selectedRecipe]);

  const posReceiptRows: ReceiptHistoryRow[] = useMemo(() => (
    completedReceipts.flatMap((receipt) => {
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      if (items.length === 0) {
        return [{
          id: `pos-${receipt.id}`,
          receiptNo: receipt.receipt_id || receipt.order_number || String(receipt.id),
          itemName: "POS order",
          quantity: 0,
          customer: receipt.customer_name || "Walk-in Customer",
          staff: receipt.cashier_name || "Staff",
          status: receipt.payment_status === "PAID" ? "completed" : String(receipt.order_status || "completed").toLowerCase(),
          total: Number(receipt.total_amount ?? 0),
        }];
      }

      return items.map((item, index) => ({
        id: `pos-${receipt.id}-${index}`,
        receiptNo: receipt.receipt_id || receipt.order_number || String(receipt.id),
        itemName: item.product_name || "POS item",
        quantity: Number(item.quantity ?? 0),
        customer: receipt.customer_name || "Walk-in Customer",
        staff: receipt.cashier_name || "Staff",
        status: receipt.payment_status === "PAID" ? "completed" : String(receipt.order_status || "completed").toLowerCase(),
        total: Number(item.line_total ?? Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)),
      }));
    })
  ), [completedReceipts]);

  const legacyKitchenRows: ReceiptHistoryRow[] = useMemo(() => (
    orders.map((order) => ({
      id: order.id,
      receiptNo: order.receiptNo,
      itemName: order.recipeName,
      quantity: order.quantity,
      customer: order.modifiers?.length ? order.modifiers.join(", ") : "-",
      staff: order.completedBy,
      status: order.status,
      legacyOrder: order,
    }))
  ), [orders]);

  const historyRows = posReceiptRows.length > 0 ? posReceiptRows : legacyKitchenRows;
  const filteredHistoryRows = historyRows.filter((row) => {
    const query = searchQuery.toLowerCase();
    return (
      (row.receiptNo || '').toLowerCase().includes(query) ||
      (row.itemName || '').toLowerCase().includes(query) ||
      (row.customer || '').toLowerCase().includes(query) ||
      (row.staff || '').toLowerCase().includes(query) ||
      (row.status || '').toLowerCase().includes(query)
    );
  });

  const selectedIngredientPreview = ingredientPreview.filter((item) => !excludedIngredientIds.has(item.id));
  const menuModifierOptions = (selectedRecipe?.modifiers ?? [])
    .map((modifier) => {
      const ingredient = ingredientPreview.find((item) =>
        (modifier.itemId && (item.backendItemId === modifier.itemId || item.itemBackendId === modifier.itemId)) ||
        (modifier.productId && item.productId === modifier.productId)
      );
      return ingredient ? { ...modifier, ingredientId: ingredient.id } : null;
    })
    .filter((modifier): modifier is RecipeModifier & { ingredientId: string } => Boolean(modifier));
  const selectedModifiers = menuModifierOptions
    .filter((modifier) => excludedIngredientIds.has(modifier.ingredientId))
    .map((modifier) => modifier.name);

  const canCompleteOrder = Boolean(
    receiptNo.trim() &&
      selectedRecipe &&
      Number(quantity) > 0 &&
      selectedIngredientPreview.length > 0 &&
      selectedIngredientPreview.every((item) => item.product && item.unitMatches && item.hasEnoughStock)
  );

  const handleRecipeChange = (nextRecipeId: string) => {
    setRecipeId(nextRecipeId);
    setExcludedIngredientIds(new Set());
  };

  const toggleIngredientIncluded = (ingredientId: string) => {
    const nextExcluded = new Set(excludedIngredientIds);
    if (nextExcluded.has(ingredientId)) {
      nextExcluded.delete(ingredientId);
    } else {
      nextExcluded.add(ingredientId);
    }
    setExcludedIngredientIds(nextExcluded);
  };

  const completeOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRecipe || !canCompleteOrder || isCompleting) return;

    const orderQty = Number(quantity) || 1;
    const orderNotes = selectedModifiers.length
      ? [notes, `Modifiers: ${selectedModifiers.join(", ")}`].filter(Boolean).join(" | ")
      : notes;

    setIsCompleting(true);
    try {
      await completeKitchenOrder.mutateAsync({
        receiptNo: receiptNo.trim(),
        recipeId: selectedRecipe.id,
        quantity: orderQty,
        notes: orderNotes,
        excludedIngredientIds: Array.from(excludedIngredientIds),
      });
      setReceiptNo("");
      setRecipeId("");
      setExcludedIngredientIds(new Set());
      setQuantity("1");
      setNotes("");
    } catch (error) {
      reportSyncError(error);
    } finally {
      setIsCompleting(false);
    }
  };

  const voidOrder = async (order: POSOrder) => {
    if (!voidReason.trim() || isVoiding) return;

    setIsVoiding(true);
    try {
      await voidKitchenOrder.mutateAsync({ id: order.id, reason: voidReason.trim() });
      setVoidingOrderId("");
      setVoidReason("");
    } catch (error) {
      reportSyncError(error);
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">POS / Kitchen Orders</h1>
        <p className="text-muted-foreground">Record kitchen receipts and deduct ingredients from inventory via Recipe &amp; BOM.</p>
      </div>

      <div className="mb-6 rounded-xl border border-accent/50 bg-accent/10 p-4 text-primary">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <ReceiptText className="h-5 w-5" />
          Separate from Goods Received
        </div>
        <p className="text-sm opacity-80">Use this for completed kitchen receipts. Ingredients are auto-deducted based on Recipe &amp; BOM. Supplier deliveries belong in Goods Received.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={completeOrder} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PackageMinus className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Complete Kitchen Receipt</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-foreground">POS / Kitchen Receipt No.</label>
              <input value={receiptNo} onChange={(event) => setReceiptNo(event.target.value)} className="w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary" required />
            </div>

            <div>
              <label className="mb-1 block text-xs text-foreground">Menu Item / Recipe</label>
              <select value={recipeId} onChange={(event) => handleRecipeChange(event.target.value)} className="w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary" required>
                <option value="">Select recipe</option>
                {activeRecipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-foreground">Quantity Ordered</label>
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary" required />
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-xs text-foreground">Menu Modifiers</label>
                {selectedModifiers.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                    {selectedModifiers.length} selected
                  </span>
                )}
              </div>
              {!selectedRecipe ? (
                <p className="text-xs text-muted-foreground">Select a menu item to view available modifiers.</p>
              ) : menuModifierOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No modifiers configured for this menu item in Recipe &amp; BOM.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {menuModifierOptions.map((modifier) => {
                    const isExcluded = excludedIngredientIds.has(modifier.ingredientId);
                    return (
                      <label key={modifier.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${isExcluded ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20 text-foreground"}`}>
                        <input
                          type="checkbox"
                          checked={isExcluded}
                          onChange={() => toggleIngredientIncluded(modifier.ingredientId)}
                          className="h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
                        />
                        {modifier.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-foreground">Notes</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border p-3">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Ingredient Deduction Preview</h3>
            {ingredientPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select a recipe to preview stock deductions.</p>
            ) : (
              <div className="space-y-2">
                {ingredientPreview.map((item) => {
                  const isIncluded = !excludedIngredientIds.has(item.id);

                  return (
                  <div key={item.id} className={`flex items-center justify-between gap-3 rounded p-2 text-sm ${isIncluded ? "bg-muted/40" : "bg-muted/20 opacity-70"}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => toggleIngredientIncluded(item.id)}
                        className="mt-1 h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
                        aria-label={`Include ${item.name} in stock deduction`}
                      />
                      <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isIncluded ? "Deduct" : "Skipped"} {item.required} {item.deductionUnit} | Stock {item.product?.stock ?? "missing"} {item.product?.unit || ""}
                      </p>
                      </div>
                    </div>
                    {!isIncluded ? (
                      <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">Skipped</span>
                    ) : item.hasEnoughStock ? (
                      <CheckCircle className="h-5 w-5" style={{ color: "#008967" }} />
                    ) : (
                      <AlertTriangle className="h-5 w-5" style={{ color: "#DC2626" }} />
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <button type="submit" disabled={!canCompleteOrder || isCompleting} className="mt-5 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {isCompleting ? "Completing..." : "Complete Receipt"}
          </button>
        </form>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">POS Order Receipt History</h2>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search receipts..." className="w-full rounded-lg border border-input bg-input-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Receipt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground">POS Item</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Customer / Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHistoryRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm font-medium text-primary">{row.receiptNo}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{row.itemName}</td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">{row.quantity}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{row.customer || "-"}</div>
                      <div>{row.staff || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium"
                        style={
                          row.status === "completed"
                            ? { borderColor: "#008967", backgroundColor: "#D1F2E8", color: "#007A5E" }
                            : { borderColor: "#FCA5A5", backgroundColor: "#FEE2E2", color: "#991B1B" }
                        }
                      >
                        {row.status === "completed" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                      {row.legacyOrder ? (
                        row.legacyOrder.status === "completed" ? (
                          <button type="button" onClick={() => setVoidingOrderId(row.legacyOrder!.id)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">
                          <RotateCcw className="h-3 w-3" />
                          Void
                          </button>
                        ) : row.legacyOrder.status === "voided" ? (
                          <span className="text-xs text-muted-foreground">{row.legacyOrder.voidReason}</span>
                        ) : "-"
                      ) : (
                        money(row.total)
                      )}
                    </td>
                  </tr>
                ))}
                {filteredHistoryRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {isLoadingReceipts ? "Loading POS order receipts..." : "No POS order receipts yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {voidingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Void Kitchen Receipt</h2>
            <p className="mt-2 text-sm text-muted-foreground">Voiding will restore the deducted ingredients and record a reversal movement.</p>
            <textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Required void reason" className="mt-4 min-h-24 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => { setVoidingOrderId(""); setVoidReason(""); }} className="flex-1 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">Cancel</button>
              <button type="button" onClick={() => voidOrder(orders.find((order) => order.id === voidingOrderId)!)} disabled={!voidReason.trim() || isVoiding} className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                {isVoiding ? "Voiding..." : "Void & Restore Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
