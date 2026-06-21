import { useState } from "react";
import { ChefHat, Plus, Search, Edit, Trash2, X, Save, Calculator, Scale, Tag } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "../../app/hooks/useSession";
import { InventoryProduct } from "../lib/inventoryLogic";
import {
  useDeleteRestaurantRecipeMutation,
  useRestaurantInventoryQuery,
  useRestaurantRecipesQuery,
  useSaveRestaurantRecipeMutation,
} from "../lib/restaurant";

type Ingredient = {
  id: string;
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
  description: string;
  imageUrl: string;
  category: string;
  servings: number;
  yieldPercentage: number;
  prepTime: number;
  ingredients: Ingredient[];
  totalCost: number;
  yieldAdjustedCost?: number;
  costPerServing: number;
  targetFoodCost?: number;
  suggestedSellingPrice?: number;
  sellingPrice?: number;
  grossMargin?: number;
  isActive?: boolean;
  modifiers?: RecipeModifier[];
  instructions: string;
};

// Use the actual inventory product structure from the restaurant inventory query.
type InventoryItem = InventoryProduct & { backendId?: string };

const UNIT_OPTIONS = ["kg", "g", "L", "ml", "pcs", "piece", "liter", "bottle", "pack", "box", "dozen"];

const normalizeUnit = (unit: string | undefined) => {
  const normalized = (unit || '').trim().toLowerCase();
  if (normalized === "ltr" || normalized === "litre" || normalized === "liters" || normalized === "liter") return "l";
  if (normalized === "pc" || normalized === "piece" || normalized === "pieces") return "pcs";
  return normalized;
};

const toInventoryQuantity = (quantity: number, recipeUnit: string, inventoryUnit: string) => {
  const from = normalizeUnit(recipeUnit);
  const to = normalizeUnit(inventoryUnit);
  if (from === to) return quantity;
  if (from === "g" && to === "kg") return quantity / 1000;
  if (from === "kg" && to === "g") return quantity * 1000;
  if (from === "ml" && to === "l") return quantity / 1000;
  if (from === "l" && to === "ml") return quantity * 1000;
  if (from === "dozen" && to === "pcs") return quantity * 12;
  if (from === "pcs" && to === "dozen") return quantity / 12;
  return null;
};

const formatMoney = (value: number) => `₱${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;

const calculateRecipeYieldAdjustedCost = (recipe: Recipe) => {
  return recipe.yieldAdjustedCost ?? recipe.totalCost / Math.max((recipe.yieldPercentage || 100) / 100, 0.01);
};

const calculateRecipeGrossMarginPercent = (recipe: Recipe) => {
  const sellingPrice = recipe.sellingPrice ?? recipe.suggestedSellingPrice ?? 0;
  return sellingPrice > 0 ? ((sellingPrice - recipe.costPerServing) / sellingPrice) * 100 : 0;
};

export function RecipeBOM() {
  const { currentUser } = useSession();
  const canManageRecipes = currentUser?.role === "Admin" || currentUser?.role === "Manager";
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [newRecipe, setNewRecipe] = useState({
    name: "",
    description: "",
    imageUrl: "",
    category: "",
    servings: "",
    yieldPercentage: "100",
    targetFoodCost: "35",
    sellingPrice: "",
    isActive: true,
    prepTime: "",
    instructions: "",
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [modifiers, setModifiers] = useState<RecipeModifier[]>([]);
  const [modifierIngredientId, setModifierIngredientId] = useState("");
  const [modifierName, setModifierName] = useState("");
  const [currentIngredient, setCurrentIngredient] = useState({
    productId: "",
    name: "",
    quantity: "",
    unit: "kg",
    inventoryUnit: "",
    unitCost: "",
  });

  const { data: inventoryItems = [] } = useRestaurantInventoryQuery<InventoryItem[]>();

  // Only show products that are actually in stock.
  const availableInventoryItems = inventoryItems.filter(item => item.stock > 0);

  // Extract unique categories from inventory
  const availableCategories = Array.from(new Set(inventoryItems.map(item => item.category))).sort();

  const { data: recipes = [] } = useRestaurantRecipesQuery();
  const saveRecipe = useSaveRestaurantRecipeMutation();
  const removeRecipe = useDeleteRestaurantRecipeMutation();
  const findInventoryItem = (productId?: number | string) =>
    inventoryItems.find((item) =>
      String(item.id) === String(productId) ||
      item.backendId === productId,
    );

  const categories = ["all", "Appetizer", "Main Course", "Dessert", "Beverage"];

  // Filter inventory items based on selected categories
  const filteredInventoryItems = selectedCategories.length === 0
    ? availableInventoryItems
    : availableInventoryItems.filter(item => selectedCategories.includes(item.category));

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = (recipe.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (recipe.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || recipe.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAddIngredient = () => {
    if (currentIngredient.productId && currentIngredient.quantity && currentIngredient.unitCost) {
      const selectedItem = inventoryItems.find(item =>
        currentIngredient.productId
          ? item.id === Number(currentIngredient.productId)
          : item.name === currentIngredient.name
      );
      if (!selectedItem) {
        toast.error("Please select a valid inventory item");
        return;
      }

      const quantity = parseFloat(currentIngredient.quantity);
      const unitCost = parseFloat(currentIngredient.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error("Ingredient quantity must be greater than zero");
        return;
      }

      const inventoryQuantity = toInventoryQuantity(quantity, currentIngredient.unit, selectedItem.unit);
      if (inventoryQuantity === null) {
        toast.error(`Cannot convert ${currentIngredient.unit} to inventory unit ${selectedItem.unit}. Please choose a compatible unit.`);
        return;
      }

      if (inventoryQuantity > selectedItem.stock) {
        toast.warning(`This recipe needs ${inventoryQuantity.toFixed(2)} ${selectedItem.unit}, but only ${selectedItem.stock.toFixed(2)} ${selectedItem.unit} is in stock.`);
      }

      const totalCost = inventoryQuantity * unitCost;

      const newIngredient: Ingredient = {
        id: `ING-${Date.now()}`,
        productId: selectedItem.id,
        productSku: selectedItem.sku,
        name: selectedItem.name,
        quantity: quantity,
        unit: currentIngredient.unit,
        inventoryQuantity,
        inventoryUnit: selectedItem.unit,
        unitCost: unitCost,
        totalCost: totalCost,
      };

      const existingIngredient = ingredients.find(ing =>
        ing.productId === selectedItem.id &&
        normalizeUnit(ing.unit) === normalizeUnit(newIngredient.unit)
      );

      setIngredients(existingIngredient
        ? ingredients.map(ing => ing.id === existingIngredient.id
          ? {
              ...ing,
              quantity: ing.quantity + newIngredient.quantity,
              inventoryQuantity: (ing.inventoryQuantity || 0) + (newIngredient.inventoryQuantity || 0),
              totalCost: ing.totalCost + newIngredient.totalCost,
            }
          : ing
        )
        : [...ingredients, newIngredient]
      );
      setCurrentIngredient({
        productId: "",
        name: "",
        quantity: "",
        unit: "kg",
        inventoryUnit: "",
        unitCost: "",
      });
    }
  };

  const handleRemoveIngredient = (id: string) => {
    const removed = ingredients.find(ing => ing.id === id);
    setIngredients(ingredients.filter(ing => ing.id !== id));
    if (removed) {
      setModifiers(modifiers.filter(modifier => modifier.productId !== removed.productId));
    }
  };

  const handleModifierIngredientChange = (ingredientId: string) => {
    setModifierIngredientId(ingredientId);
    const ingredient = ingredients.find((item) => item.id === ingredientId);
    setModifierName(ingredient ? `No ${ingredient.name}` : "");
  };

  const handleAddModifier = () => {
    const ingredient = ingredients.find((item) => item.id === modifierIngredientId);
    if (!ingredient) {
      toast.error("Please select an ingredient for the modifier");
      return;
    }
    if (!modifierName.trim()) {
      toast.error("Modifier name is required");
      return;
    }
    if (modifiers.some((modifier) => modifier.productId === ingredient.productId)) {
      toast.error("A remove modifier already exists for this ingredient");
      return;
    }

    setModifiers([
      ...modifiers,
      {
        id: `MOD-${Date.now()}`,
        name: modifierName.trim(),
        type: "remove",
        productId: ingredient.productId,
        itemName: ingredient.name,
      },
    ]);
    setModifierIngredientId("");
    setModifierName("");
  };

  const handleRemoveModifier = (id: string) => {
    setModifiers(modifiers.filter((modifier) => modifier.id !== id));
  };

  const calculateTotalCost = () => {
    return ingredients.reduce((sum, ing) => sum + ing.totalCost, 0);
  };

  const calculateYieldAdjustedCost = () => {
    const yieldPercentage = Number(newRecipe.yieldPercentage) || 100;
    return calculateTotalCost() / Math.max(yieldPercentage / 100, 0.01);
  };

  const calculateCostPerServing = () => {
    const servings = Number(newRecipe.servings) || 0;
    return servings > 0 ? calculateYieldAdjustedCost() / servings : 0;
  };

  const calculateSuggestedSellingPrice = () => {
    const targetFoodCost = Number(newRecipe.targetFoodCost) || 0;
    return targetFoodCost > 0 ? calculateCostPerServing() / (targetFoodCost / 100) : 0;
  };

  const calculateMenuSellingPrice = () => {
    const manualPrice = Number(newRecipe.sellingPrice);
    return Number.isFinite(manualPrice) && manualPrice > 0 ? manualPrice : calculateSuggestedSellingPrice();
  };

  const calculateGrossMargin = () => {
    return calculateMenuSellingPrice() - calculateCostPerServing();
  };

  const calculateGrossMarginPercent = () => {
    const menuSellingPrice = calculateMenuSellingPrice();
    return menuSellingPrice > 0 ? (calculateGrossMargin() / menuSellingPrice) * 100 : 0;
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageRecipes) {
      toast.error("Only admin or manager users can create or edit recipes and pricing.");
      return;
    }

    if (ingredients.length === 0) {
      toast.error("Please add at least one ingredient");
      return;
    }

    const servings = parseInt(newRecipe.servings);
    const yieldPercentage = Number(newRecipe.yieldPercentage);
    const targetFoodCost = Number(newRecipe.targetFoodCost) || 0;
    const sellingPriceInput = Number(newRecipe.sellingPrice);
    const prepTime = parseInt(newRecipe.prepTime);

    if (!Number.isFinite(servings) || servings <= 0) {
      toast.error("Servings must be greater than zero");
      return;
    }
    if (!Number.isFinite(yieldPercentage) || yieldPercentage <= 0 || yieldPercentage > 100) {
      toast.error("Yield percentage must be between 1 and 100");
      return;
    }
    if (!Number.isFinite(targetFoodCost) || targetFoodCost <= 0 || targetFoodCost > 100) {
      toast.error("Target food cost percentage must be between 1 and 100");
      return;
    }
    if (newRecipe.sellingPrice && (!Number.isFinite(sellingPriceInput) || sellingPriceInput <= 0)) {
      toast.error("Menu selling price must be greater than zero when entered");
      return;
    }
    if (!Number.isFinite(prepTime) || prepTime < 0) {
      toast.error("Prep time cannot be negative");
      return;
    }

    const totalCost = calculateTotalCost();
    const yieldAdjustedCost = calculateYieldAdjustedCost();
    const costPerServing = yieldAdjustedCost / servings;
    const suggestedSellingPrice = targetFoodCost > 0 ? costPerServing / (targetFoodCost / 100) : 0;
    const sellingPrice = newRecipe.sellingPrice ? sellingPriceInput : suggestedSellingPrice;
    const grossMargin = sellingPrice > 0 ? sellingPrice - costPerServing : 0;

    const recipeToAdd: Recipe = {
      id: editingRecipe?.id || `RCP-${String(recipes.length + 1).padStart(3, '0')}`,
      name: newRecipe.name,
      description: newRecipe.description,
      imageUrl: newRecipe.imageUrl,
      category: newRecipe.category,
      servings: servings,
      yieldPercentage,
      targetFoodCost,
      prepTime,
      ingredients: ingredients,
      totalCost: totalCost,
      yieldAdjustedCost,
      costPerServing: costPerServing,
      suggestedSellingPrice,
      sellingPrice,
      grossMargin,
      isActive: newRecipe.isActive,
      modifiers,
      instructions: newRecipe.instructions,
    };

    try {
      await saveRecipe.mutateAsync({
        id: editingRecipe?.id,
        data: {
          name: recipeToAdd.name,
          description: recipeToAdd.description,
          imageUrl: recipeToAdd.imageUrl,
          category: recipeToAdd.category,
          servings: recipeToAdd.servings,
          yieldPercentage: recipeToAdd.yieldPercentage,
          prepTimeMinutes: recipeToAdd.prepTime,
          instructions: recipeToAdd.instructions,
          targetFoodCost: recipeToAdd.targetFoodCost,
          sellingPrice: recipeToAdd.sellingPrice,
          isActive: recipeToAdd.isActive,
          modifiers: modifiers.map((modifier) => {
            const inventoryItem = findInventoryItem(modifier.productId ?? modifier.itemId);
            if (!inventoryItem?.backendId) {
              throw new Error(`Inventory link is missing for modifier ${modifier.name}`);
            }
            return {
              id: modifier.id,
              name: modifier.name,
              type: modifier.type,
              itemId: inventoryItem.backendId,
              itemName: modifier.itemName,
            };
          }),
          ingredients: recipeToAdd.ingredients.map((ingredient) => {
            const inventoryItem = findInventoryItem(ingredient.productId ?? ingredient.itemBackendId);
            if (!inventoryItem?.backendId) {
              throw new Error(`Inventory link is missing for ${ingredient.name}`);
            }
            return {
              itemId: inventoryItem.backendId,
              quantity: ingredient.inventoryQuantity ?? ingredient.quantity,
              unit: ingredient.inventoryUnit ?? ingredient.unit,
              unitCost: ingredient.unitCost,
            };
          }),
        },
      });
      setShowCreateModal(false);
      setEditingRecipe(null);
      setNewRecipe({
      name: "",
      description: "",
      imageUrl: "",
      category: "",
      servings: "",
      yieldPercentage: "100",
      targetFoodCost: "35",
      sellingPrice: "",
      isActive: true,
      prepTime: "",
      instructions: "",
      });
      setIngredients([]);
      setModifiers([]);
      setModifierIngredientId("");
      setModifierName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save recipe");
    }
  };

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setScaleMultiplier(1);
    setShowViewModal(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    if (!canManageRecipes) {
      toast.error("Only admin or manager users can edit recipes and pricing.");
      return;
    }

    setEditingRecipe(recipe);
    setNewRecipe({
      name: recipe.name,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      category: recipe.category,
      servings: recipe.servings.toString(),
      yieldPercentage: recipe.yieldPercentage.toString(),
      targetFoodCost: (recipe.targetFoodCost || 35).toString(),
      sellingPrice: (recipe.sellingPrice ?? recipe.suggestedSellingPrice ?? "").toString(),
      isActive: recipe.isActive ?? true,
      prepTime: recipe.prepTime.toString(),
      instructions: recipe.instructions,
    });
    setIngredients(recipe.ingredients);
    setModifiers(recipe.modifiers ?? []);
    setModifierIngredientId("");
    setModifierName("");
    setSelectedCategories([]);
    setShowCreateModal(true);
  };

  const handleDeleteRecipe = (id: string) => {
    if (!canManageRecipes) {
      toast.error("Only admin or manager users can delete recipes.");
      return;
    }
    setPendingDeleteId(id);
  };

  const confirmDeleteRecipe = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await removeRecipe.mutateAsync(id);
      toast.success("Recipe deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete recipe");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target instanceof HTMLInputElement && e.target.type === "checkbox"
      ? e.target.checked
      : e.target.value;

    setNewRecipe({
      ...newRecipe,
      [e.target.name]: value,
    });
  };

  const handleIngredientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // If selecting an ingredient from dropdown, auto-fill unit cost and unit
    if (name === "name" && value) {
      const selectedItem = inventoryItems.find(item => item.id === Number(value));
      if (selectedItem) {
        setCurrentIngredient({
          ...currentIngredient,
          productId: selectedItem.id.toString(),
          name: selectedItem.name,
          unit: selectedItem.unit,
          inventoryUnit: selectedItem.unit,
          unitCost: selectedItem.price.toString(),
        });
        return;
      }
    }

    setCurrentIngredient({
      ...currentIngredient,
      [name]: value,
    });
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setEditingRecipe(null);
    setSelectedCategories([]);
    setIngredients([]);
    setModifiers([]);
    setModifierIngredientId("");
    setModifierName("");
    setCurrentIngredient({
      productId: "",
      name: "",
      quantity: "",
      unit: "kg",
      inventoryUnit: "",
      unitCost: "",
    });
    setNewRecipe({
      name: "",
      description: "",
      imageUrl: "",
      category: "",
      servings: "",
      yieldPercentage: "100",
      targetFoodCost: "35",
      sellingPrice: "",
      isActive: true,
      prepTime: "",
      instructions: "",
    });
  };

  const getScaledQuantity = (quantity: number) => {
    return (quantity * scaleMultiplier).toFixed(2);
  };

  const getScaledCost = (cost: number) => {
    return (cost * scaleMultiplier).toFixed(2);
  };

  const stats = [
    { label: "Total Recipes", value: recipes.length, color: "text-blue-600" },
    { label: "Active Menu Items", value: recipes.filter(r => r.isActive ?? true).length, color: "text-purple-600" },
    { label: "Avg Cost/Serving", value: formatMoney(recipes.length ? recipes.reduce((sum, r) => sum + r.costPerServing, 0) / recipes.length : 0), color: "text-green-600" },
    { label: "Avg Menu Price", value: formatMoney(recipes.length ? recipes.reduce((sum, r) => sum + (r.sellingPrice ?? r.suggestedSellingPrice ?? 0), 0) / recipes.length : 0), color: "text-orange-600" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Recipe & BOM</h1>
          <p className="text-muted-foreground">
            {canManageRecipes
              ? "Manage recipes, ingredient costs, and menu pricing"
              : "View recipe costs, menu prices, and scaling"}
          </p>
        </div>
        {canManageRecipes && (
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 md:mt-0 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Recipe
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-card rounded-2xl p-6 shadow-sm border border-border">
            <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search recipes by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer min-w-[200px]"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "all" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <div key={recipe.id} className="bg-card rounded-2xl p-6 shadow-sm border border-border hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {recipe.imageUrl ? (
                  <img src={recipe.imageUrl} alt={recipe.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                    <ChefHat className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-foreground">{recipe.name}</h3>
                  <p className="text-xs text-muted-foreground">{recipe.id}</p>
                </div>
              </div>
            </div>

            {recipe.description && <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{recipe.description}</p>}

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium text-foreground">{recipe.category}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Servings:</span>
                <span className="font-medium text-foreground">{recipe.servings}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prep Time:</span>
                <span className="font-medium text-foreground">{recipe.prepTime} min</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Yield:</span>
                <span className="font-medium text-foreground">{recipe.yieldPercentage}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ingredients:</span>
                <span className="font-medium text-foreground">{recipe.ingredients.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Menu Status:</span>
                <span className={`font-medium ${(recipe.isActive ?? true) ? "text-green-600" : "text-muted-foreground"}`}>
                  {(recipe.isActive ?? true) ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Raw Cost</p>
                  <p className="text-lg font-bold text-primary">{formatMoney(recipe.totalCost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Cost/Serving</p>
                  <p className="text-lg font-bold text-green-600">{formatMoney(recipe.costPerServing)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Yield-Adjusted</p>
                  <p className="text-sm font-semibold text-foreground">{formatMoney(calculateRecipeYieldAdjustedCost(recipe))}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Menu Price</p>
                  <p className="text-sm font-semibold text-foreground">{formatMoney(recipe.sellingPrice ?? recipe.suggestedSellingPrice ?? 0)}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleViewRecipe(recipe)}
                className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                View & Scale
              </button>
              {canManageRecipes && (
                <>
                  <button
                    onClick={() => handleEditRecipe(recipe)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                    title="Edit recipe and pricing"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRecipe(recipe.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    title="Delete recipe"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">{editingRecipe ? "Edit Recipe" : "Create New Recipe"}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="p-6 space-y-6">
              {/* Category Selection for Filtering Ingredients */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Select Ingredient Categories</h3>
                </div>
                <p className="text-xs text-blue-700 mb-3">Select one or more categories to filter available ingredients</p>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        selectedCategories.includes(cat)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-blue-900 border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {selectedCategories.length > 0 && (
                  <div className="mt-3 text-xs text-blue-700">
                    <strong>{filteredInventoryItems.length}</strong> ingredients available from selected categories
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm mb-2 text-foreground font-medium">
                    Recipe Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={newRecipe.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm mb-2 text-foreground font-medium">
                    Category *
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={newRecipe.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select category</option>
                    <option value="Appetizer">Appetizer</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Beverage">Beverage</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label htmlFor="description" className="block text-sm mb-2 text-foreground font-medium">Menu Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={newRecipe.description}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Describe this dish for customers and staff..."
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="imageUrl" className="block text-sm mb-2 text-foreground font-medium">Recipe Picture</label>
                  <input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    value={newRecipe.imageUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/dish.jpg"
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setNewRecipe(current => ({ ...current, imageUrl: String(reader.result ?? '') }));
                      reader.readAsDataURL(file);
                    }}
                    className="mt-2 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary"
                  />
                  {newRecipe.imageUrl && <img src={newRecipe.imageUrl} alt="Recipe preview" className="mt-3 h-40 w-full rounded-xl border border-border object-cover" />}
                </div>

                <div>
                  <label htmlFor="servings" className="block text-sm mb-2 text-foreground font-medium">
                    Servings *
                  </label>
                  <input
                    id="servings"
                    name="servings"
                    type="number"
                    min="1"
                    value={newRecipe.servings}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="yieldPercentage" className="block text-sm mb-2 text-foreground font-medium">
                    Yield Percentage *
                  </label>
                  <input
                    id="yieldPercentage"
                    name="yieldPercentage"
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    value={newRecipe.yieldPercentage}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="targetFoodCost" className="block text-sm mb-2 text-foreground font-medium">
                    Target Food Cost % *
                  </label>
                  <input
                    id="targetFoodCost"
                    name="targetFoodCost"
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    value={newRecipe.targetFoodCost}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Used to compute the suggested price from current ingredient cost.</p>
                </div>

                <div>
                  <label htmlFor="sellingPrice" className="block text-sm mb-2 text-foreground font-medium">
                    Menu Selling Price
                  </label>
                  <input
                    id="sellingPrice"
                    name="sellingPrice"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={newRecipe.sellingPrice}
                    onChange={handleInputChange}
                    placeholder={formatMoney(calculateSuggestedSellingPrice())}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Leave blank to use the suggested price; edit this when the client wants a different menu price.</p>
                </div>

                <div>
                  <label htmlFor="prepTime" className="block text-sm mb-2 text-foreground font-medium">
                    Prep Time (minutes) *
                  </label>
                  <input
                    id="prepTime"
                    name="prepTime"
                    type="number"
                    min="0"
                    value={newRecipe.prepTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    required
                  />
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
                  <input
                    name="isActive"
                    type="checkbox"
                    checked={newRecipe.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 accent-primary"
                  />
                  Active in POS menu
                </label>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Add Ingredients</h3>
                <p className="mb-4 text-xs text-muted-foreground">
                  Ingredient unit cost is pulled from inventory so recipe cost follows the latest item unit cost.
                </p>

                <div className="grid grid-cols-5 gap-3 mb-4">
                  <div className="col-span-2">
                    <label htmlFor="ingredientName" className="block text-xs mb-1 text-foreground">
                      Ingredient Name
                    </label>
                    <select
                      id="ingredientName"
                      name="name"
                      value={currentIngredient.productId}
                      onChange={handleIngredientInputChange}
                      className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select ingredient...</option>
                      {filteredInventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.sku}) - {item.stock} {item.unit} on hand
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quantity" className="block text-xs mb-1 text-foreground">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={currentIngredient.quantity}
                      onChange={handleIngredientInputChange}
                      className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="unit" className="block text-xs mb-1 text-foreground">
                      Recipe Unit
                    </label>
                    <select
                      id="unit"
                      name="unit"
                      value={currentIngredient.unit}
                      onChange={handleIngredientInputChange}
                      className="w-full px-3 py-2 text-sm bg-muted/50 border border-input rounded-lg focus:outline-none"
                    >
                      {UNIT_OPTIONS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    {currentIngredient.inventoryUnit && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Inventory unit: {currentIngredient.inventoryUnit}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="unitCost" className="block text-xs mb-1 text-foreground">
                      Inventory Unit Cost <span className="text-muted-foreground font-normal">(auto)</span>
                    </label>
                    <input
                      id="unitCost"
                      name="unitCost"
                      type="number"
                      step="0.01"
                      value={currentIngredient.unitCost}
                      onChange={handleIngredientInputChange}
                      className="w-full px-3 py-2 text-sm bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      readOnly
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-4"
                >
                  <Plus className="w-4 h-4" />
                  Add Ingredient
                </button>

                {ingredients.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Ingredients ({ingredients.length})</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {ingredients.map((ing) => (
                        <div key={ing.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{ing.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {ing.quantity} {ing.unit} = {(ing.inventoryQuantity ?? ing.quantity).toFixed(2)} {ing.inventoryUnit || ing.unit} x {formatMoney(ing.unitCost)} = {formatMoney(ing.totalCost)}
                            </p>
                            {ing.productSku && <p className="text-[10px] text-muted-foreground">SKU: {ing.productSku}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(ing.id)}
                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground">Total Cost:</span>
                        <span className="text-xl font-bold text-primary">{formatMoney(calculateTotalCost())}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Menu Modifiers</h3>
                    <p className="text-xs text-muted-foreground">Set the modifier choices that staff can use for this menu item in POS.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {modifiers.length} option{modifiers.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label htmlFor="modifierIngredient" className="block text-xs mb-1 text-foreground">
                      BOM Ingredient
                    </label>
                    <select
                      id="modifierIngredient"
                      value={modifierIngredientId}
                      onChange={(event) => handleModifierIngredientChange(event.target.value)}
                      className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    >
                      <option value="">Select ingredient</option>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="modifierName" className="block text-xs mb-1 text-foreground">
                      POS Label
                    </label>
                    <input
                      id="modifierName"
                      value={modifierName}
                      onChange={(event) => setModifierName(event.target.value)}
                      placeholder="No cheese"
                      className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddModifier}
                    disabled={ingredients.length === 0}
                    className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {modifiers.length === 0 ? (
                    <p className="rounded-lg bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
                      No modifiers configured for this menu item
                    </p>
                  ) : (
                    modifiers.map((modifier) => (
                      <div key={modifier.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{modifier.name}</p>
                          <p className="text-xs text-muted-foreground">Removes {modifier.itemName || "selected ingredient"} from stock deduction</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveModifier(modifier.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100"
                          title="Remove modifier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Raw ingredient cost</p>
                  <p className="text-lg font-bold text-foreground">{formatMoney(calculateTotalCost())}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Yield-adjusted cost</p>
                  <p className="text-lg font-bold text-primary">{formatMoney(calculateYieldAdjustedCost())}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cost per serving</p>
                  <p className="text-lg font-bold text-green-600">{formatMoney(calculateCostPerServing())}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target food cost</p>
                  <p className="text-sm font-semibold text-foreground">{Number(newRecipe.targetFoodCost) || 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suggested menu price</p>
                  <p className="text-sm font-semibold text-foreground">{formatMoney(calculateSuggestedSellingPrice())}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Final menu price</p>
                  <p className="text-sm font-semibold text-foreground">{formatMoney(calculateMenuSellingPrice())}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross margin</p>
                  <p className="text-sm font-semibold text-foreground">{formatMoney(calculateGrossMargin())} ({calculateGrossMarginPercent().toFixed(1)}%)</p>
                </div>
              </div>

              <div>
                <label htmlFor="instructions" className="block text-sm mb-2 text-foreground font-medium">
                  Instructions
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={newRecipe.instructions}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 text-sm bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                  placeholder="Enter cooking instructions..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {editingRecipe ? "Save Recipe" : "Create Recipe"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View & Scale Recipe Modal */}
      {showViewModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedRecipe.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedRecipe.id} - {selectedRecipe.category}</p>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedRecipe.imageUrl && <img src={selectedRecipe.imageUrl} alt={selectedRecipe.name} className="h-56 w-full rounded-xl object-cover" />}
              {selectedRecipe.description && <p className="text-sm text-muted-foreground">{selectedRecipe.description}</p>}
              {/* Scale Controls */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Recipe Scaling</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setScaleMultiplier(Math.max(0.5, scaleMultiplier - 0.5))}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-xl font-bold text-blue-900 min-w-[60px] text-center">
                      {scaleMultiplier}x
                    </span>
                    <button
                      onClick={() => setScaleMultiplier(scaleMultiplier + 0.5)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">Servings: {selectedRecipe.servings} x {scaleMultiplier} = <strong>{selectedRecipe.servings * scaleMultiplier}</strong></span>
                  <span className="text-blue-700">Yield-adjusted cost: <strong>{formatMoney(calculateRecipeYieldAdjustedCost(selectedRecipe) * scaleMultiplier)}</strong></span>
                </div>
              </div>

              {/* Recipe Info */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Prep Time</p>
                  <p className="text-lg font-bold text-foreground">{selectedRecipe.prepTime} min</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Yield %</p>
                  <p className="text-lg font-bold text-foreground">{selectedRecipe.yieldPercentage}%</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Cost/Serving</p>
                  <p className="text-lg font-bold text-green-600">{formatMoney(selectedRecipe.costPerServing)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Ingredients</p>
                  <p className="text-lg font-bold text-foreground">{selectedRecipe.ingredients.length}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Menu Price</p>
                  <p className="text-lg font-bold text-foreground">{formatMoney(selectedRecipe.sellingPrice ?? selectedRecipe.suggestedSellingPrice ?? 0)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Target Food Cost</p>
                  <p className="text-lg font-bold text-foreground">{selectedRecipe.targetFoodCost || 0}%</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Gross Margin</p>
                  <p className="text-lg font-bold text-foreground">{calculateRecipeGrossMarginPercent(selectedRecipe).toFixed(1)}%</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">POS Status</p>
                  <p className={`text-lg font-bold ${(selectedRecipe.isActive ?? true) ? "text-green-600" : "text-muted-foreground"}`}>{(selectedRecipe.isActive ?? true) ? "Active" : "Inactive"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Menu Modifiers</h3>
                <div className="bg-muted/30 rounded-xl p-4">
                  {selectedRecipe.modifiers?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.modifiers.map((modifier) => (
                        <span key={modifier.id} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          {modifier.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No menu modifiers configured</p>
                  )}
                </div>
              </div>

              {/* Ingredients Table */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Bill of Materials (Scaled)</h3>
                <div className="bg-muted/30 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Ingredient</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Quantity</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Inventory Qty</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Unit Cost</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedRecipe.ingredients.map((ing) => (
                        <tr key={ing.id}>
                          <td className="px-4 py-3 text-foreground">{ing.name}</td>
                          <td className="px-4 py-3 text-right text-foreground">
                            {getScaledQuantity(ing.quantity)} {ing.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-foreground">
                            {getScaledQuantity(ing.inventoryQuantity ?? ing.quantity)} {ing.inventoryUnit || ing.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-foreground">{formatMoney(ing.unitCost)}</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">
                            {formatMoney(Number(getScaledCost(ing.totalCost)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50 border-t border-border">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-semibold text-foreground">
                          Raw ingredient total:
                        </td>
                        <td className="px-4 py-3 text-right text-xl font-bold text-primary">
                          {formatMoney(Number(getScaledCost(selectedRecipe.totalCost)))}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-semibold text-foreground">
                          Yield-adjusted total:
                        </td>
                        <td className="px-4 py-3 text-right text-xl font-bold text-green-600">
                          {formatMoney(calculateRecipeYieldAdjustedCost(selectedRecipe) * scaleMultiplier)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Instructions */}
              {selectedRecipe.instructions && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Instructions</h3>
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-sm text-foreground whitespace-pre-line">{selectedRecipe.instructions}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recipe Confirmation Modal */}
      {pendingDeleteId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-sm">
            <div className="p-6 border-b border-border flex items-center gap-3">
              <Trash2 className="w-6 h-6 text-red-600 flex-shrink-0" />
              <h2 className="text-lg font-bold text-foreground">Delete Recipe</h2>
            </div>
            <div className="p-6">
              <p className="text-foreground mb-1">Are you sure you want to delete this recipe?</p>
              <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteRecipe}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="px-4 py-2 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
