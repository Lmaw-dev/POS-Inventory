export type UserRole =
  | 'Admin'
  | 'Manager'
  | 'Staff'
  | 'Cashier'
  | 'KitchenStaff'
  | 'RetailStaff';

export type UserStatus = 'Active' | 'Inactive';

export interface ApiActor {
  id: string;
  name: string;
  email?: string;
}

export interface ApiLocation {
  id: string;
  name: string;
  address: string;
  manager: string;
  phone: string;
  itemCount: number;
  _count?: { items: number };
}

export interface ApiUser extends ApiActor {
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
}

export interface ApiInventoryItem {
  id: string;
  name: string;
  description?: string | null;
  itemType: 'RETAIL_ITEM' | 'INGREDIENT' | 'MENU_ITEM' | 'SUPPLY' | 'BUNDLE';
  sku?: string | null;
  barcode?: string | null;
  category: string;
  targetCustomer?: 'Male' | 'Female' | 'Unisex' | null;
  subcategory?: string | null;
  size?: string | null;
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Damaged' | null;
  quantity: number;
  price: number;
  costPrice?: number | null;
  imageUrl?: string | null;
  unit?: string | null;
  minStock?: number | null;
  maxStock?: number | null;
  reorderPoint?: number | null;
  expiryDate?: string | null;
  storageTemperature?: string | null;
  dateAdded: string;
  locationId: string;
  location?: ApiLocation;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiSupplier {
  id: string;
  name: string;
  module: BusinessModule;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  category?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface ApiPurchaseOrderItem {
  id: string;
  inventoryItemId?: string | null;
  inventoryItem?: ApiInventoryItem | null;
  name: string;
  quantity: number;
  receivedQty: number;
  rejectedQty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ApiPurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId?: string | null;
  supplier?: ApiSupplier | null;
  module: BusinessModule;
  status: PurchaseOrderStatus;
  notes?: string | null;
  paymentMethod?: 'Cash' | 'Bank Transfer' | 'Check' | 'Credit Terms' | null;
  paymentTerms?: string | null;
  expectedDelivery?: string | null;
  rejectionReason?: string | null;
  totalAmount: number;
  createdBy?: ApiActor | null;
  receivedBy?: ApiActor | null;
  receivedAt?: string | null;
  items: ApiPurchaseOrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface ApiGoodsReceiptItem {
  id: string;
  purchaseOrderItemId: string;
  purchaseOrderItem?: ApiPurchaseOrderItem;
  inventoryItemId?: string | null;
  inventoryItem?: ApiInventoryItem | null;
  receivedQty: number;
  rejectedQty: number;
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Damaged' | null;
  notes?: string | null;
}

export interface ApiGoodsReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrder?: ApiPurchaseOrder;
  module: BusinessModule;
  receivedBy?: ApiActor | null;
  notes?: string | null;
  items: ApiGoodsReceiptItem[];
  createdAt: string;
}

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface ApiTransferItem {
  id: string;
  inventoryItemId: string;
  inventoryItem?: ApiInventoryItem;
  quantity: number;
}

export interface ApiTransfer {
  id: string;
  transferNumber: string;
  fromLocationId: string;
  fromLocation?: ApiLocation | null;
  toLocationId: string;
  toLocation?: ApiLocation | null;
  module: BusinessModule;
  status: TransferStatus;
  notes?: string | null;
  createdBy?: ApiActor | null;
  completedAt?: string | null;
  items: ApiTransferItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface ApiStockMovement {
  id: string;
  type:
    | 'STOCK_IN'
    | 'STOCK_OUT'
    | 'ADJUSTMENT'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'SALE'
    | 'RECIPE_CONSUMPTION'
    | 'SPOILAGE'
    | 'EXPIRY'
    | 'VOID_RESTOCK';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unit?: string | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  itemId: string;
  item?: ApiInventoryItem;
  locationId: string;
  location?: ApiLocation;
  module: BusinessModule;
  createdBy?: ApiActor | null;
  createdAt: string;
}

export type SaleStatus = 'COMPLETED' | 'REFUNDED' | 'PARTIAL_REFUND';

export interface ApiSaleItem {
  id: string;
  inventoryItemId: string;
  inventoryItem?: ApiInventoryItem;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ApiSale {
  id: string;
  transactionNumber: string;
  module: BusinessModule;
  locationId: string;
  location?: ApiLocation;
  cashier?: ApiActor | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  customer?: string | null;
  status: SaleStatus;
  refundReason?: string | null;
  items: ApiSaleItem[];
  createdAt: string;
  updatedAt?: string;
}

export type BundleStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'INACTIVE';

export interface ApiBundleItem {
  id: string;
  inventoryItemId: string;
  inventoryItem?: Pick<
    ApiInventoryItem,
    'id' | 'name' | 'price' | 'quantity' | 'category'
  >;
  quantity: number;
}

export interface ApiBundle {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  discount: number;
  price: number;
  status: BundleStatus;
  rejectionReason?: string | null;
  locationId?: string | null;
  location?: Pick<ApiLocation, 'id' | 'name'> | null;
  createdBy?: ApiActor | null;
  approvedBy?: ApiActor | null;
  approvedAt?: string | null;
  items: ApiBundleItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface ApiRecipeIngredient {
  id: string;
  itemId: string;
  item: ApiInventoryItem;
  quantity: number;
  unit?: string | null;
  unitCost?: number | null;
  totalCost?: number | null;
}

export interface ApiRecipe {
  id: string;
  name: string;
  category: string;
  servings: number;
  yieldPercentage: number;
  prepTimeMinutes?: number | null;
  instructions?: string | null;
  targetFoodCost?: number | null;
  sellingPrice?: number | null;
  isActive: boolean;
  imageUrl?: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isNutFree: boolean;
  isHalal: boolean;
  allergenNotes?: string | null;
  menuItemId?: string | null;
  menuItem?: ApiInventoryItem | null;
  ingredients: ApiRecipeIngredient[];
  createdAt: string;
  updatedAt?: string;
}

export type KitchenOrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'VOIDED';

export interface ApiKitchenOrder {
  id: string;
  receiptNo: string;
  quantity: number;
  status: KitchenOrderStatus;
  notes?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  recipeId: string;
  recipe: ApiRecipe;
  locationId?: string | null;
  location?: Pick<ApiLocation, 'id' | 'name'> | null;
  tableId?: string | null;
  table?: { id: string; tableNumber: string } | null;
  saleId?: string | null;
  sale?: { id: string; transactionNumber: string } | null;
  completedBy?: ApiActor | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  module: BusinessModule;
  createdAt?: string;
  updatedAt?: string;
}

export type RestaurantSettingKey =
  | 'CATEGORY_HIERARCHY'
  | 'STORAGE_TEMPERATURE_OPTIONS'
  | 'PRODUCT_MERGE_METADATA';

export interface ApiRestaurantSetting {
  key: RestaurantSettingKey;
  value: unknown;
}

export type DiningTableStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'CLEANING';

export interface ApiDiningTable {
  id: string;
  tableNumber: string;
  capacity: number;
  status: DiningTableStatus;
  floor?: string | null;
  locationId: string;
  location?: Pick<ApiLocation, 'id' | 'name'>;
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export type BusinessModule = 'RETAIL' | 'RESTAURANT';
