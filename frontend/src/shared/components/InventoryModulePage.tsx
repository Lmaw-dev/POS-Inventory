import { Suspense, lazy, useEffect, useMemo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { appQueryClient } from '../../query/appQueryClient';
import { SessionProvider } from '@inventory/app/hooks/useSession';
import type { AuthenticatedUser } from '../../auth/types/auth';
import type { Page } from '../App';
import '@inventory/modules/restaurant/restaurantLegacyTheme.css';

const RetailDashboard = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.DashboardView })));
const RetailStockAlerts = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.StockAlertsView })));
const RetailInventory = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.InventoryView })));
const RetailProductsReceived = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.ProductsReceivedView })));
const RetailItemBundling = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.ItemBundlingView })));
const RetailReports = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.ReportsView })));
const RetailUserManagement = lazy(() => import('@inventory/modules/retail/RetailViews').then((m) => ({ default: m.UserManagementView })));
const RetailProductManagement = lazy(() => import('@inventory/modules/retail/ProductManagementView'));
const RetailPurchaseOrders = lazy(() => import('@inventory/modules/retail/PurchaseOrdersView'));
const RetailSalesHistory = lazy(() => import('@inventory/modules/retail/SalesHistoryView'));
const RetailTransfers = lazy(() => import('@inventory/modules/retail/TransfersView'));
const RetailMultilocation = lazy(() => import('@inventory/modules/retail/MultilocationView'));

const RestaurantDashboard = lazy(() => import('@inventory/modules/restaurant/Dashboard').then((m) => ({ default: m.Dashboard })));
const RestaurantStockControl = lazy(() => import('@inventory/modules/restaurant/StockControl').then((m) => ({ default: m.StockControl })));
const RestaurantInventory = lazy(() => import('@inventory/modules/restaurant/Inventory').then((m) => ({ default: m.Inventory })));
const RestaurantProductManagement = lazy(() => import('@inventory/modules/restaurant/ProductManagement').then((m) => ({ default: m.ProductManagement })));
const RestaurantPurchaseOrders = lazy(() => import('@inventory/modules/restaurant/PurchaseOrders').then((m) => ({ default: m.PurchaseOrders })));
const RestaurantGoodsReceived = lazy(() => import('@inventory/modules/restaurant/GoodsReceived').then((m) => ({ default: m.GoodsReceived })));
const RestaurantKitchenOrders = lazy(() => import('@inventory/modules/restaurant/POSKitchenOrders').then((m) => ({ default: m.POSKitchenOrders })));
const RestaurantRecipeBom = lazy(() => import('@inventory/modules/restaurant/RecipeBOM').then((m) => ({ default: m.RecipeBOM })));
const RestaurantTransfers = lazy(() => import('@inventory/modules/restaurant/Transfers').then((m) => ({ default: m.Transfers })));
const RestaurantReports = lazy(() => import('@inventory/modules/restaurant/Reports').then((m) => ({ default: m.Reports })));
const RestaurantMultilocation = lazy(() => import('@inventory/modules/restaurant/MultiLocation').then((m) => ({ default: m.MultiLocation })));
const RestaurantUserManagement = lazy(() => import('@inventory/modules/restaurant/UserManagement').then((m) => ({ default: m.UserManagement })));

type InventoryUser = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Staff';
  status: string;
  businessId: string;
  modules: string[];
  lastLogin: string;
};

const pageTitles: Partial<Record<Page, string>> = {
  'inventory-dashboard': 'Inventory Dashboard',
  'inventory-stock-alerts': 'Stock Alerts',
  'inventory-items': 'Inventory',
  'inventory-product-management': 'Product Management',
  'inventory-purchase-orders': 'Purchase Orders',
  'inventory-products-received': 'Products Received',
  'inventory-pos-kitchen': 'Kitchen Orders',
  'inventory-recipe-bom': 'Recipe & BOM',
  'inventory-item-bundling': 'Item Bundling',
  'inventory-sales-history': 'Sales History',
  'inventory-transfers': 'Transfers',
  'inventory-multilocation': 'Multilocation',
  'inventory-reports': 'Inventory Reports',
  'inventory-user-management': 'Inventory User Management',
};

export function InventoryModulePage({
  currentPage,
  currentUser,
  showHeader = false,
}: {
  currentPage: Page;
  currentUser: AuthenticatedUser | null;
  showHeader?: boolean;
}) {
  const inventoryUser = useMemo(() => toInventoryUser(currentUser), [currentUser]);
  const isRestaurant = currentUser?.store_type === 'RESTAURANT';

  useEffect(() => {
    window.__POS_INVENTORY_USER__ = inventoryUser;
    window.__POS_STORE_TYPE__ = currentUser?.store_type ?? null;
    return () => {
      window.__POS_INVENTORY_USER__ = null;
      window.__POS_STORE_TYPE__ = null;
    };
  }, [currentUser?.store_type, inventoryUser]);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      toast.error(detail?.message || 'Inventory request failed');
    };

    window.addEventListener('api-error', handleApiError);
    window.addEventListener('restaurant-sync-error', handleApiError);
    return () => {
      window.removeEventListener('api-error', handleApiError);
      window.removeEventListener('restaurant-sync-error', handleApiError);
    };
  }, []);

  if (typeof window !== 'undefined') {
    window.__POS_INVENTORY_USER__ = inventoryUser;
    window.__POS_STORE_TYPE__ = currentUser?.store_type ?? null;
  }

  return (
    <QueryClientProvider client={appQueryClient}>
      <SessionProvider key={inventoryUser?.id ?? 'guest'}>
        <div className={`h-screen flex-1 overflow-hidden bg-[#f8fafb] ${isRestaurant ? 'restaurant-legacy' : ''}`}>
          <div className="flex h-full flex-col overflow-hidden">
            {showHeader && (
              <div className="border-b border-white/10 bg-[#005656] px-6 py-4">
                <h1 className="text-xl font-semibold text-white">{pageTitles[currentPage] ?? 'Inventory'}</h1>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading inventory...</div>}>
                {isRestaurant ? renderRestaurantPage(currentPage, currentUser) : renderRetailPage(currentPage, inventoryUser)}
              </Suspense>
            </div>
          </div>
        </div>
      </SessionProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

function toInventoryUser(user: AuthenticatedUser | null): InventoryUser | null {
  if (!user) return null;

  return {
    id: String(user.id),
    name: user.full_name,
    email: user.email,
    role: user.role === 'ADMIN' ? 'Admin' : user.staff_type === 'MANAGER' ? 'Manager' : 'Staff',
    status: 'Active',
    businessId: String(user.store_id ?? user.id),
    modules: user.store_type === 'RESTAURANT' ? ['RESTAURANT'] : ['RETAIL'],
    lastLogin: new Date().toISOString(),
  };
}

function renderRetailPage(page: Page, currentUser: InventoryUser | null): ReactNode {
  switch (page) {
    case 'inventory-stock-alerts':
      return <RetailStockAlerts />;
    case 'inventory-items':
      return <RetailInventory />;
    case 'inventory-product-management':
      return <RetailProductManagement currentUser={currentUser} />;
    case 'inventory-purchase-orders':
      return <RetailPurchaseOrders currentUser={currentUser} />;
    case 'inventory-products-received':
      return <RetailProductsReceived />;
    case 'inventory-item-bundling':
      return <RetailItemBundling currentUser={currentUser} />;
    case 'inventory-sales-history':
      return <RetailSalesHistory currentUser={currentUser} />;
    case 'inventory-transfers':
      return <RetailTransfers currentUser={currentUser} />;
    case 'inventory-multilocation':
      return <RetailMultilocation />;
    case 'inventory-reports':
      return <RetailReports />;
    case 'inventory-user-management':
      return <RetailUserManagement currentUser={currentUser} />;
    default:
      return <RetailDashboard />;
  }
}

function renderRestaurantPage(page: Page, currentUser: AuthenticatedUser | null): ReactNode {
  switch (page) {
    case 'inventory-stock-alerts':
      return <RestaurantStockControl />;
    case 'inventory-items':
      return <RestaurantInventory />;
    case 'inventory-product-management':
      return <RestaurantProductManagement />;
    case 'inventory-purchase-orders':
      return <RestaurantPurchaseOrders />;
    case 'inventory-products-received':
      return <RestaurantGoodsReceived />;
    case 'inventory-pos-kitchen':
      return <RestaurantKitchenOrders posUserId={currentUser?.id ?? null} />;
    case 'inventory-recipe-bom':
      return <RestaurantRecipeBom />;
    case 'inventory-transfers':
      return <RestaurantTransfers />;
    case 'inventory-multilocation':
      return <RestaurantMultilocation />;
    case 'inventory-reports':
      return <RestaurantReports />;
    case 'inventory-user-management':
      return <RestaurantUserManagement />;
    default:
      return <RestaurantDashboard />;
  }
}
