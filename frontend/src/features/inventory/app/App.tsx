import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Receipt,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import logoImage from '../imports/ims-logo.png';
import LoginPage from './components/LoginPage';
import { RestaurantLayout } from '../modules/restaurant/RestaurantLayout';
import { useSession } from './hooks/useSession';
import { useViewNavigation, type ViewType } from './hooks/useViewNavigation';
import { useRetailInventoryQuery } from '../modules/lib/retail';

const TransfersView = lazy(() => import('../modules/retail/TransfersView'));
const MultilocationView = lazy(() => import('../modules/retail/MultilocationView'));
const PurchaseOrdersView = lazy(() => import('../modules/retail/PurchaseOrdersView'));
const ProductManagementView = lazy(() => import('../modules/retail/ProductManagementView'));
const POSView = lazy(() => import('../modules/retail/POSView'));
const SalesHistoryView = lazy(() => import('../modules/retail/SalesHistoryView'));
const StockAdjustmentsView = lazy(() => import('../modules/retail/StockAdjustmentsView'));
const DashboardView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.DashboardView })));
const StockAlertsView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.StockAlertsView })));
const InventoryView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.InventoryView })));
const ProductsReceivedView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.ProductsReceivedView })));
const ItemBundlingView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.ItemBundlingView })));
const ReportsView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.ReportsView })));
const UserManagementView = lazy(() => import('../modules/retail/RetailViews').then(m => ({ default: m.UserManagementView })));
const RestaurantDashboard = lazy(() => import('../modules/restaurant/Dashboard').then(m => ({ default: m.Dashboard })));
const RestaurantStockControl = lazy(() => import('../modules/restaurant/StockControl').then(m => ({ default: m.StockControl })));
const RestaurantInventory = lazy(() => import('../modules/restaurant/Inventory').then(m => ({ default: m.Inventory })));
const RestaurantProductManagement = lazy(() => import('../modules/restaurant/ProductManagement').then(m => ({ default: m.ProductManagement })));
const RestaurantPurchaseOrders = lazy(() => import('../modules/restaurant/PurchaseOrders').then(m => ({ default: m.PurchaseOrders })));
const RestaurantGoodsReceived = lazy(() => import('../modules/restaurant/GoodsReceived').then(m => ({ default: m.GoodsReceived })));
const RestaurantPOSKitchenOrders = lazy(() => import('../modules/restaurant/POSKitchenOrders').then(m => ({ default: m.POSKitchenOrders })));
const RestaurantRecipeBOM = lazy(() => import('../modules/restaurant/RecipeBOM').then(m => ({ default: m.RecipeBOM })));
const RestaurantTransfers = lazy(() => import('../modules/restaurant/Transfers').then(m => ({ default: m.Transfers })));
const RestaurantStockAdjustments = lazy(() => import('../modules/restaurant/StockAdjustments').then(m => ({ default: m.StockAdjustments })));
const RestaurantReports = lazy(() => import('../modules/restaurant/Reports').then(m => ({ default: m.Reports })));
const RestaurantMultiLocation = lazy(() => import('../modules/restaurant/MultiLocation').then(m => ({ default: m.MultiLocation })));
const RestaurantUserManagement = lazy(() => import('../modules/restaurant/UserManagement').then(m => ({ default: m.UserManagement })));

export default function App() {
  const { currentUser, isLoggedIn, isRestoringSession, login, logout } = useSession();
  const { currentView, navigateToView } = useViewNavigation();
  const hasRestaurantModule = currentUser?.modules?.includes('RESTAURANT') ?? false;
  const hasRetailModule = currentUser?.modules?.includes('RETAIL') ?? false;
  const hasBothModules = hasRestaurantModule && hasRetailModule;
  const [activeModule, setActiveModule] = useState<'RETAIL' | 'RESTAURANT'>('RETAIL');
  const resolvedActiveModule = hasRestaurantModule && !hasRetailModule ? 'RESTAURANT' : activeModule;

  const { data: navInventory = [] } = useRetailInventoryQuery(isLoggedIn && hasRetailModule);
  const retailNavStats = useMemo(
    () => ({
      totalItems: navInventory.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [navInventory],
  );
  const retailNavStockAlerts = useMemo(
    () =>
      navInventory
        .filter((item) => item.quantity <= 3 && item.condition !== 'Damaged')
        .map((item) => ({
          id: item.id,
          itemName: item.name,
          currentStock: item.quantity,
          threshold: 5,
          severity: item.quantity <= 1 ? 'critical' : 'low',
        })),
    [navInventory],
  );

  // When user logs in and has only RESTAURANT module, switch to it automatically.
  useEffect(() => {
    if (hasRestaurantModule && currentView.startsWith('restaurant-')) {
      setActiveModule('RESTAURANT');
    } else if (hasRestaurantModule && !hasRetailModule) {
      setActiveModule('RESTAURANT');
    } else {
      setActiveModule('RETAIL');
    }
  }, [currentView, hasRestaurantModule, hasRetailModule]);

  // Global handler to remove leading zeros from number inputs.
  useEffect(() => {
    const handleNumberInput = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (input.type === 'number' && input.value && input.value !== '0') {
        const cleaned = input.value.replace(/^0+/, '') || '0';
        if (cleaned !== input.value) {
          input.value = cleaned;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    };

    document.addEventListener('blur', handleNumberInput, true);
    return () => document.removeEventListener('blur', handleNumberInput, true);
  }, []);

  const switchModule = (module: 'RETAIL' | 'RESTAURANT') => {
    setActiveModule(module);
    navigateToView(module === 'RESTAURANT' ? 'restaurant-dashboard' : 'dashboard');
  };

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  const handleLogout = async () => {
    await logout();
    navigateToView('dashboard');
    setActiveModule('RETAIL');
  };

  if (isRestoringSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (resolvedActiveModule === 'RESTAURANT' && hasRestaurantModule) {
    const restaurantContent = (() => {
      switch (currentView) {
        case 'restaurant-dashboard':
        case 'restaurant-ingredients':
          return <RestaurantDashboard />;
        case 'restaurant-stock-control':
        case 'restaurant-spoilage':
          return <RestaurantStockControl />;
        case 'restaurant-food-inventory':
        case 'restaurant-menu-items':
          return <RestaurantInventory />;
        case 'restaurant-product-management':
          return <RestaurantProductManagement />;
        case 'restaurant-purchase-orders':
          return <RestaurantPurchaseOrders />;
        case 'restaurant-goods-received':
          return <RestaurantGoodsReceived />;
        case 'restaurant-pos':
        case 'restaurant-kitchen-orders':
          return <RestaurantPOSKitchenOrders />;
        case 'restaurant-recipe-bom':
        case 'restaurant-recipes':
          return <RestaurantRecipeBOM />;
        case 'restaurant-transfers':
          return <RestaurantTransfers />;
        case 'restaurant-stock-adjustments':
          return <RestaurantStockAdjustments />;
        case 'restaurant-multilocation':
          return <RestaurantMultiLocation />;
        case 'restaurant-reports':
          return <RestaurantReports />;
        case 'user-management':
          return <RestaurantUserManagement />;
        default:
          return <RestaurantDashboard />;
      }
    })();

    return (
      <RestaurantLayout
        currentView={currentView}
        user={currentUser}
        hasBothModules={hasBothModules}
        onNavigate={(view) => navigateToView(view as ViewType)}
        onSwitchToRetail={() => switchModule('RETAIL')}
        onLogout={handleLogout}
      >
        <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>}>
          {restaurantContent}
        </Suspense>
      </RestaurantLayout>
    );
  }

  return (
    <div className="bg-[#F8FAFB] h-screen w-screen overflow-hidden flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="h-full w-[256px] flex flex-col" style={{ background: '#003534' }}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-white rounded-full size-[40px] flex items-center justify-center shadow-sm overflow-hidden">
            <img src={logoImage} alt="IMS Logo" className="w-full h-full object-contain p-1" />
          </div>
          <div>
            <p className="text-white text-[20px] leading-[28px]" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
              Bukolabs.io
            </p>
            <p className="text-[#00A7A5] text-[12px] leading-[16px]" style={{ fontFamily: 'Inter, sans-serif' }}>Retail</p>
          </div>
        </div>

        {hasBothModules && (
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => switchModule('RETAIL')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] text-xs font-semibold transition-colors ${resolvedActiveModule === 'RETAIL' ? 'bg-[#007A5E] text-white' : 'bg-[rgba(255,255,255,0.08)] text-[#a0c4bf] hover:bg-[rgba(255,255,255,0.14)]'}`}
            >
              <Store className="size-3.5" />
              Retail
            </button>
            <button
              onClick={() => switchModule('RESTAURANT')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] text-xs font-semibold transition-colors ${resolvedActiveModule === 'RESTAURANT' ? 'bg-[#007A5E] text-white' : 'bg-[rgba(255,255,255,0.08)] text-[#a0c4bf] hover:bg-[rgba(255,255,255,0.14)]'}`}
            >
              <UtensilsCrossed className="size-3.5" />
              Restaurant
            </button>
          </div>
        )}

        <nav className="flex-1 px-6 pb-4 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {resolvedActiveModule === 'RETAIL' && (
            <>
              <NavButton active={currentView === 'dashboard'} onClick={() => navigateToView('dashboard')}>
                <DashboardIcon />
                Dashboard
              </NavButton>
              <NavButton active={currentView === 'stock-alerts'} onClick={() => navigateToView('stock-alerts')}>
                <StockAlertsIcon />
                Stock Alerts
                {retailNavStockAlerts.length > 0 && (
                  <span className="ml-auto bg-[#009BA5] text-white text-xs rounded-full px-2 py-0.5">
                    {retailNavStockAlerts.length}
                  </span>
                )}
              </NavButton>
              <NavButton active={currentView === 'inventory'} onClick={() => navigateToView('inventory')}>
                <InventoryIcon />
                Inventory
                {retailNavStats.totalItems > 0 && (
                  <span className="ml-auto bg-[rgba(255,255,255,0.2)] text-white text-xs rounded-full px-2 py-0.5">
                    {retailNavStats.totalItems}
                  </span>
                )}
              </NavButton>
              <NavButton active={currentView === 'product-management'} onClick={() => navigateToView('product-management')}>
                <ProductManagementIcon />
                Product Management
              </NavButton>
              <NavButton active={currentView === 'purchase-orders'} onClick={() => navigateToView('purchase-orders')}>
                <PurchaseOrdersIcon />
                Purchase Orders
              </NavButton>
              <NavButton active={currentView === 'products-received'} onClick={() => navigateToView('products-received')}>
                <ProductsReceivedIcon />
                Products Received
              </NavButton>
              <NavButton active={currentView === 'item-bundling'} onClick={() => navigateToView('item-bundling')}>
                <ItemBundlingIcon />
                Item Bundling
              </NavButton>
              <NavButton active={currentView === 'sales-history'} onClick={() => navigateToView('sales-history')}>
                <SalesHistoryIcon />
                Sales History
              </NavButton>
              <NavButton active={currentView === 'transfers'} onClick={() => navigateToView('transfers')}>
                <TransfersIcon />
                Transfers
              </NavButton>
              <NavButton active={currentView === 'stock-adjustments'} onClick={() => navigateToView('stock-adjustments')}>
                <StockAdjustmentsIcon />
                Stock Adjustments
              </NavButton>
              <NavButton active={currentView === 'multilocation'} onClick={() => navigateToView('multilocation')}>
                <MultilocationIcon />
                Multilocation
              </NavButton>
              <NavButton active={currentView === 'reports'} onClick={() => navigateToView('reports')}>
                <ReportsIcon />
                Reports
              </NavButton>
            </>
          )}

          {currentUser?.role === 'Admin' && (
            <NavButton active={currentView === 'user-management'} onClick={() => navigateToView('user-management')}>
              <UserManagementIcon />
              User Management
            </NavButton>
          )}
        </nav>

        <div className="bg-[#005656] border-t border-[rgba(255,255,255,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-[#008967] rounded-full size-[40px] flex items-center justify-center">
              <p className="text-white text-[16px]" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
                {currentUser?.email.charAt(0).toUpperCase()}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-white text-[14px] leading-[20px]" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                {currentUser?.email.split('@')[0]}
              </p>
              <p className="text-[#00A7A5] text-[12px] leading-[16px] capitalize" style={{ fontFamily: 'Inter, sans-serif' }}>
                {currentUser?.role.toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-[8px] h-[36px] w-full flex items-center justify-center gap-2 text-white text-[14px] hover:bg-[#007A5E] transition-colors"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 h-full flex flex-col overflow-hidden">
        <div className="bg-[#005656] border-b border-[rgba(255,255,255,0.1)] px-6 py-4 flex items-center">
          <h1 className="text-white text-[20px] leading-[28px] flex-1" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
            {currentView.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>}>
            {currentView === 'dashboard' && (
              <DashboardView />
            )}
            {currentView === 'stock-alerts' && (
              <StockAlertsView />
            )}
            {currentView === 'inventory' && (
              <InventoryView />
            )}
            {currentView === 'product-management' && <ProductManagementView currentUser={currentUser} />}
            {currentView === 'pos' && <POSView currentUser={currentUser} />}
            {currentView === 'sales-history' && <SalesHistoryView currentUser={currentUser} />}
            {currentView === 'purchase-orders' && <PurchaseOrdersView currentUser={currentUser} />}
            {currentView === 'products-received' && <ProductsReceivedView currentUser={currentUser} />}
            {currentView === 'item-bundling' && <ItemBundlingView currentUser={currentUser} />}
            {currentView === 'transfers' && <TransfersView currentUser={currentUser} />}
            {currentView === 'stock-adjustments' && <StockAdjustmentsView currentUser={currentUser} />}
            {currentView === 'multilocation' && <MultilocationView />}
            {currentView === 'reports' && (
              <ReportsView />
            )}
            {currentView === 'user-management' && (
              <UserManagementView
                currentUser={currentUser}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[10px] mt-2 text-[16px] transition-colors ${
        active
          ? 'bg-[#009BA5] text-white font-medium'
          : 'text-[#e5e7eb] hover:bg-[rgba(255,255,255,0.05)] font-normal'
      }`}
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {children}
    </button>
  );
}

const DashboardIcon = () => <LayoutDashboard className="size-5" />;
const StockAlertsIcon = () => <AlertTriangle className="size-5" />;
const InventoryIcon = () => <Package className="size-5" />;
const ProductManagementIcon = () => <Settings2 className="size-5" />;
const PurchaseOrdersIcon = () => <ShoppingCart className="size-5" />;
const ProductsReceivedIcon = () => <PackageCheck className="size-5" />;
const ItemBundlingIcon = () => <Layers className="size-5" />;
const SalesHistoryIcon = () => <Receipt className="size-5" />;
const TransfersIcon = () => <ArrowRightLeft className="size-5" />;
const StockAdjustmentsIcon = () => <SlidersHorizontal className="size-5" />;
const MultilocationIcon = () => <MapPin className="size-5" />;
const ReportsIcon = () => <FileText className="size-5" />;
const UserManagementIcon = () => <Users className="size-5" />;
const LogoutIcon = () => <LogOut className="size-4" />;
