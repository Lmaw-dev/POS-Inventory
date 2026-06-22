import { useEffect, useState } from 'react';
import { ChevronDown, Home, ShoppingCart, List, BarChart3, LogOut, Users, UtensilsCrossed, Store, ShoppingBag, Info, SlidersHorizontal, Package, PanelLeftClose, PanelLeftOpen, AlertTriangle, Apple, ArrowRightLeft, ChefHat, ClipboardCheck, FileText, Layers, LayoutDashboard, MapPin, PackageCheck, PackageSearch, Receipt, ReceiptText, Settings2 } from 'lucide-react';
import { Page, type StoreBrand } from '../App';
import type { StaffType } from '../../auth/types/auth';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { getDefaultStoreLogo } from '../utils/defaultStoreLogo';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  isAdmin?: boolean;
  storeBrand?: StoreBrand;
  userName?: string | null;
  storeType?: 'RESTAURANT' | 'RETAIL_STORE' | string | null;
  staffType?: StaffType;
  inventoryEnabled?: boolean;
}

type MenuItem = {
  icon: typeof Home;
  label: string;
  page?: Page;
  children?: Array<{
    icon: typeof Home;
    label: string;
    page: Page;
  }>;
};

export function Sidebar({ currentPage, onNavigate, onLogout, isAdmin = false, storeBrand, userName, storeType = 'RESTAURANT', staffType = 'POS_STAFF', inventoryEnabled = true }: SidebarProps) {
  const SIDEBAR_COLLAPSED_STORAGE_KEY = 'bukolabs-pos-sidebar-collapsed';
  const isRetail = storeType === 'RETAIL_STORE';
  const { settings } = useStoreSettings();

  const storeItems = [
    { icon: Info, label: 'Store Information', page: 'store-information' as Page },
    { icon: SlidersHorizontal, label: 'Store Settings', page: 'store-settings' as Page },
  ];

  const storePages = storeItems.map((item) => item.page);
  const canUsePos = isAdmin || staffType === 'POS_STAFF' || staffType === 'MANAGER';
  const canUseInventory = inventoryEnabled && (isAdmin || staffType === 'INVENTORY_STAFF' || staffType === 'MANAGER');
  const inventoryItems = getInventoryItems(isRetail, isAdmin);
  const inventoryPages = inventoryItems.map((item) => item.page);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Store: storePages.includes(currentPage),
    Inventory: inventoryPages.includes(currentPage),
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const restaurantAdminMenuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', page: 'pos-dashboard' as Page },
    { icon: Users, label: 'Staff Accounts', page: 'admin-dashboard' as Page },
    { icon: List, label: 'Transaction', page: 'order-list' as Page },
    { icon: BarChart3, label: 'Reports', page: 'reports' as Page },
  ];

  const retailAdminMenuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', page: 'retail-pos-dashboard' as Page },
    { icon: Users, label: 'Staff Accounts', page: 'admin-dashboard' as Page },
    { icon: List, label: 'Transactions', page: 'retail-transactions' as Page },
    { icon: BarChart3, label: 'Reports', page: 'retail-reports' as Page },
  ];

  const restaurantStaffMenuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', page: 'pos-dashboard' as Page },
    { icon: ShoppingCart, label: 'Create Order', page: 'create-order' as Page },
    { icon: List, label: 'Transaction', page: 'order-list' as Page },
    { icon: UtensilsCrossed, label: 'Tables', page: 'table-management' as Page },
    { icon: BarChart3, label: 'Reports', page: 'reports' as Page },
  ];

  const retailStaffMenuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', page: 'retail-pos-dashboard' as Page },
    { icon: ShoppingBag, label: 'Create Order', page: 'retail-sales' as Page },
    { icon: List, label: 'Transactions', page: 'retail-transactions' as Page },
    { icon: BarChart3, label: 'Reports', page: 'retail-reports' as Page },
  ];

  const menuItems = isAdmin
    ? (isRetail ? retailAdminMenuItems : restaurantAdminMenuItems)
    : (isRetail ? retailStaffMenuItems : restaurantStaffMenuItems);
  const managementItems: MenuItem[] = isAdmin
    ? [
        { icon: Store, label: 'Store', children: storeItems },
      ]
    : [];
  const visibleMenuItems = canUsePos ? menuItems.filter((item) => item.page !== 'table-management' || settings.enable_table_management) : [];
  const flattenedInventoryItems = canUseInventory ? inventoryItems : [];
  const defaultTitle = isRetail ? 'Retail Store' : 'The Restaurant';
  const headerTitle = storeBrand?.name || defaultTitle;
  const defaultLogo = getDefaultStoreLogo(storeType);
  const userRoleLabel = isAdmin ? 'Admin' : getStaffTypeLabel(staffType);
  const closeManagementGroups = () => {
    setOpenGroups({
      Store: false,
      Inventory: false,
    });
  };
  const getMenuButtonClasses = (active: boolean, isOpen: boolean) =>
    active
      ? 'border-[#00a7a5]/25 text-white'
      : isOpen
        ? 'border-white/15 bg-white/10 text-white'
        : 'border-transparent text-white hover:bg-[#007a5e]/15 hover:text-slate-100';
  const getMenuButtonStyle = (active: boolean, isOpen: boolean) =>
    active
      ? { background: 'linear-gradient(135deg, #008967 0%, #007a5e 100%)', boxShadow: '0 0 18px rgba(0,167,165,0.16)' }
      : isOpen
        ? { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }
        : undefined;

  return (
    <div
      className={`sticky top-0 flex h-screen shrink-0 flex-col text-white transition-[width] duration-300 ease-in-out ${isCollapsed ? 'w-20 overflow-visible' : 'w-80 overflow-hidden'}`}
      style={{ background: 'linear-gradient(180deg, #003534 0%, #007a5e 100%)' }}
    >
      <div className={`relative shrink-0 border-b border-white/10 transition-all duration-300 ease-in-out ${isCollapsed ? 'px-3 py-4' : 'px-6 pb-4 pt-5'}`}>
        <button
          type="button"
          onClick={() => setIsCollapsed((value) => !value)}
          className={`z-10 inline-flex items-center justify-center text-slate-300 transition hover:text-slate-100 ${
            isCollapsed ? 'group relative left-1/2 h-10 w-10 -translate-x-1/2' : 'absolute right-3 top-3 h-9 w-9'
          }`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <>
              <img src={storeBrand?.logo || defaultLogo} alt={headerTitle} className="h-full w-full object-contain transition-opacity duration-150 group-hover:opacity-0" />
              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <PanelLeftOpen className="h-5 w-5" strokeWidth={1.8} />
              </span>
            </>
          ) : (
            <PanelLeftClose className="h-5 w-5" strokeWidth={1.8} />
          )}
        </button>
        <div className="text-center">
          {!isCollapsed && (
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden bg-transparent transition-all duration-300 ease-in-out">
              <img src={storeBrand?.logo || defaultLogo} alt={headerTitle} className="h-full w-full object-contain" />
            </div>
          )}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-14 opacity-100'}`}>
            <h2 className="truncate text-lg font-semibold tracking-tight text-white">{headerTitle}</h2>
            <p className="mt-0.5 text-sm leading-tight text-slate-200">{userRoleLabel}</p>
          </div>
        </div>
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto py-3 transition-all duration-300 ease-in-out [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isCollapsed ? 'px-3' : 'px-5'}`}>
        <ul className="space-y-0.5">
          {visibleMenuItems.map((item) => {
            const childActive = item.children?.some((child) => child.page === currentPage) ?? false;
            const active = currentPage === item.page || childActive;
            const isOpen = item.children ? openGroups[item.label] : false;
            return (
              <li key={item.page ?? item.label}>
                <button
                  onClick={() => {
                    if (item.children) {
                      setOpenGroups((current) => ({
                        Store: item.label === 'Store' ? !current.Store : false,
                        Inventory: item.label === 'Inventory' ? !current.Inventory : false,
                      }));
                      return;
                    }

                    closeManagementGroups();
                    item.page && onNavigate(item.page);
                  }}
                  className={`flex h-[52px] w-full items-center rounded-lg border transition ${
                    isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 text-left'
                  } ${getMenuButtonClasses(active, isOpen)}`}
                  style={getMenuButtonStyle(active, isOpen)}
                >
                  <span className="shrink-0">
                    <item.icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className={`overflow-hidden whitespace-nowrap text-base transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100'} ${active ? 'font-semibold' : 'font-medium'}`}>
                    {!isCollapsed && item.label}
                  </span>
                  {item.children && !isCollapsed && (
                    <ChevronDown className={`h-4 w-4 transition ${openGroups[item.label] ? 'rotate-180' : ''}`} strokeWidth={1.8} />
                  )}
                </button>
                {item.children && openGroups[item.label] && (
                  <ul className={`space-y-0.5 py-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-0' : 'pl-8'}`}>
                    {item.children.map((child) => {
                      const childIsActive = currentPage === child.page;
                      return (
                        <li key={child.page}>
                          <button
                            onClick={() => {
                              onNavigate(child.page);
                            }}
                            className={`flex h-10 w-full items-center rounded-md transition ${
                              isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 text-left'
                            } ${
                              childIsActive ? 'text-white' : 'text-slate-200 hover:text-white'
                            }`}
                          >
                            <child.icon className={`h-4 w-4 shrink-0 ${childIsActive ? 'text-[#b5fff1]' : 'text-slate-300/70'}`} strokeWidth={1.8} />
                            <span className={`truncate text-sm font-medium transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}>{!isCollapsed && child.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {managementItems.length > 0 && (
          <div className="mt-2">
            <ul className="space-y-0.5">
              {managementItems.map((item) => {
                const childActive = item.children?.some((child) => child.page === currentPage) ?? false;
                const active = currentPage === item.page || childActive;
                const isOpen = item.children ? openGroups[item.label] : false;
                return (
                  <li key={item.page ?? item.label}>
                    <button
                      onClick={() => {
                        if (item.children) {
                          setOpenGroups((current) => ({
                            Store: item.label === 'Store' ? !current.Store : false,
                            Inventory: false,
                          }));
                          return;
                        }

                        closeManagementGroups();
                        item.page && onNavigate(item.page);
                      }}
                      className={`flex h-[52px] w-full items-center rounded-lg border transition ${
                        isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 text-left'
                      } ${getMenuButtonClasses(active, isOpen)}`}
                      style={getMenuButtonStyle(active, isOpen)}
                    >
                      <span className="shrink-0">
                        <item.icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className={`overflow-hidden whitespace-nowrap text-base transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100'} ${active ? 'font-semibold' : 'font-medium'}`}>
                        {!isCollapsed && item.label}
                      </span>
                      {item.children && !isCollapsed && (
                        <ChevronDown className={`h-4 w-4 transition ${openGroups[item.label] ? 'rotate-180' : ''}`} strokeWidth={1.8} />
                      )}
                    </button>
                    {item.children && openGroups[item.label] && (
                      <ul className={`space-y-0.5 py-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-0' : 'pl-8'}`}>
                        {item.children.map((child) => {
                          const childIsActive = currentPage === child.page;
                          return (
                            <li key={child.page}>
                              <button
                                onClick={() => {
                                  onNavigate(child.page);
                                }}
                                className={`flex h-10 w-full items-center rounded-md transition ${
                                  isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 text-left'
                                } ${
                                  childIsActive ? 'text-white' : 'text-slate-200 hover:text-white'
                                }`}
                              >
                                <child.icon className={`h-4 w-4 shrink-0 ${childIsActive ? 'text-[#b5fff1]' : 'text-slate-300/70'}`} strokeWidth={1.8} />
                                <span className={`truncate text-sm font-medium transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}>{!isCollapsed && child.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {flattenedInventoryItems.length > 0 && (
          <div className={`${visibleMenuItems.length > 0 ? 'mt-4 border-t border-white/10 pt-3' : ''}`}>
            {!isCollapsed && (
              <div className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#b5fff1]/80">
                Inventory
              </div>
            )}
            <ul className="space-y-0.5">
              {flattenedInventoryItems.map((item) => {
                const active = currentPage === item.page;
                return (
                  <li key={item.page ?? item.label}>
                    <button
                      onClick={() => {
                        closeManagementGroups();
                        item.page && onNavigate(item.page);
                      }}
                      className={`flex h-[52px] w-full items-center rounded-lg border transition ${
                        isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 text-left'
                      } ${getMenuButtonClasses(active, false)}`}
                      style={getMenuButtonStyle(active, false)}
                    >
                      <span className="shrink-0">
                        <item.icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className={`overflow-hidden whitespace-nowrap text-base transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100'} ${active ? 'font-semibold' : 'font-medium'}`}>
                        {!isCollapsed && item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

      </nav>

      <div className={`shrink-0 border-t border-white/10 py-2 text-white transition-all duration-300 ease-in-out ${isCollapsed ? 'px-3' : 'px-5'}`}>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`flex h-[52px] w-full items-center rounded-lg border border-transparent text-white transition hover:bg-red-500/10 hover:text-red-200 ${
            isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 text-left'
          }`}
        >
          <span className="shrink-0">
            <LogOut className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <span className={`overflow-hidden whitespace-nowrap text-base font-medium transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100'}`}>
            {!isCollapsed && 'Logout'}
          </span>
        </button>
      </div>

      <LogoutConfirmDialog
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
      />
    </div>
  );
}

function getStaffTypeLabel(staffType: StaffType) {
  if (staffType === 'INVENTORY_STAFF') return 'Inventory Staff';
  if (staffType === 'MANAGER') return 'Manager';
  return 'POS Staff';
}

function getInventoryItems(isRetail: boolean, canManageUsers: boolean): MenuItem['children'] {
  const retailItems = [
    { icon: LayoutDashboard, label: 'Dashboard', page: 'inventory-dashboard' as Page },
    { icon: AlertTriangle, label: 'Stock Alerts', page: 'inventory-stock-alerts' as Page },
    { icon: Package, label: 'Inventory', page: 'inventory-items' as Page },
    { icon: Settings2, label: 'Product Management', page: 'inventory-product-management' as Page },
    { icon: ShoppingCart, label: 'Purchase Orders', page: 'inventory-purchase-orders' as Page },
    { icon: PackageCheck, label: 'Products Received', page: 'inventory-products-received' as Page },
    { icon: Layers, label: 'Item Bundling', page: 'inventory-item-bundling' as Page },
    { icon: Receipt, label: 'Sales History', page: 'inventory-sales-history' as Page },
    { icon: ArrowRightLeft, label: 'Transfers', page: 'inventory-transfers' as Page },
    { icon: MapPin, label: 'Multilocation', page: 'inventory-multilocation' as Page },
    { icon: FileText, label: 'Reports', page: 'inventory-reports' as Page },
  ];

  const restaurantItems = [
    { icon: LayoutDashboard, label: 'Dashboard', page: 'inventory-dashboard' as Page },
    { icon: Package, label: 'Stock Control & Alerts', page: 'inventory-stock-alerts' as Page },
    { icon: Apple, label: 'Food Inventory', page: 'inventory-items' as Page },
    { icon: ShoppingCart, label: 'Purchase Orders', page: 'inventory-purchase-orders' as Page },
    { icon: ClipboardCheck, label: 'Goods Received', page: 'inventory-products-received' as Page },
    { icon: ReceiptText, label: 'POS / Kitchen Orders', page: 'inventory-pos-kitchen' as Page },
    { icon: ChefHat, label: 'Recipe & BOM', page: 'inventory-recipe-bom' as Page },
    { icon: ArrowRightLeft, label: 'Transfers & Adjustments', page: 'inventory-transfers' as Page },
    { icon: MapPin, label: 'Multi-Location', page: 'inventory-multilocation' as Page },
    { icon: FileText, label: 'Reports', page: 'inventory-reports' as Page },
  ];

  if (isRetail) {
    return retailItems;
  }

  return canManageUsers
    ? [...restaurantItems, { icon: PackageSearch, label: 'Product Management', page: 'inventory-product-management' as Page }]
    : restaurantItems;
}
