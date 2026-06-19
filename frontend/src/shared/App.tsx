import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../auth/pages/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperadminDashboard } from '../superadmin/pages/SuperadminDashboard';
import { RetailDashboard } from '../retail/pages/RetailDashboard';
import { RetailOrderProvider } from '../retail/context/RetailOrderContext';
import { RetailPOSDashboard } from '../retail/pages/RetailPOSDashboard';
import { RetailCreateOrder } from '../retail/pages/RetailCreateOrder';
import { RetailOrderList } from '../retail/pages/RetailOrderList';
import { RetailReports } from '../retail/pages/RetailReports';
import { POSDashboard } from '../restaurant/pages/POSDashboard';
import { CreateOrder } from '../restaurant/pages/CreateOrder';
import { TableManagement } from '../restaurant/pages/TableManagement';
import { Payment } from '../restaurant/pages/Payment';
import { Receipt } from '../restaurant/pages/Receipt';
import { OrderList } from '../restaurant/pages/OrderList';
import { Reports } from '../restaurant/pages/Reports';
import { StoreInformation } from './components/StoreInformation';
import { StoreSettings } from './components/StoreSettings';
import { InventoryModulePage } from './components/InventoryModulePage';
import { Sidebar } from './components/Sidebar';
import { OrderProvider } from './context/OrderContext';
import { TableProvider } from './context/TableContext';
import { StoreSettingsProvider, useStoreSettings } from './context/StoreSettingsContext';
import { getApiBaseUrl } from '../auth/services/auth';
import type { AuthenticatedUser } from '../auth/types/auth';
import { getDefaultStoreLogo } from './utils/defaultStoreLogo';
import { AppAlertProvider } from './components/AppAlertProvider';
import { appQueryClient } from '../query/appQueryClient';

const SESSION_USER_KEY = 'bukolabs-pos-current-user';
const SESSION_PAGE_KEY = 'bukolabs-pos-current-page';
const INVENTORY_MODULES_ENABLED = import.meta.env.VITE_ENABLE_INVENTORY_MODULES !== 'false';

export type Page =
  | 'login'
  | 'superadmin-dashboard'
  | 'admin-dashboard'
  | 'retail-dashboard'
  | 'retail-pos-dashboard'
  | 'retail-sales'
  | 'retail-transactions'
  | 'retail-reports'
  | 'pos-dashboard'
  | 'create-order'
  | 'table-management'
  | 'payment'
  | 'receipt'
  | 'order-list'
  | 'reports'
  | 'store-information'
  | 'store-settings'
  | 'inventory-dashboard'
  | 'inventory-stock-alerts'
  | 'inventory-items'
  | 'inventory-product-management'
  | 'inventory-purchase-orders'
  | 'inventory-products-received'
  | 'inventory-pos-kitchen'
  | 'inventory-recipe-bom'
  | 'inventory-item-bundling'
  | 'inventory-sales-history'
  | 'inventory-transfers'
  | 'inventory-multilocation'
  | 'inventory-reports'
  | 'inventory-user-management';

export interface StoreBrand {
  name: string | null;
  logo: string | null;
  business_description?: string | null;
  address?: string | null;
  contact_number?: string | null;
  email?: string | null;
  receipt_thank_you_message?: string | null;
  receipt_footer_message?: string | null;
  operating_hours?: string | null;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [storeBrand, setStoreBrand] = useState<StoreBrand>({ name: null, logo: null });

  useEffect(() => {
    const savedUser = window.localStorage.getItem(SESSION_USER_KEY);
    if (!savedUser) return;

    try {
      const parsedUser = JSON.parse(savedUser) as AuthenticatedUser;
      const savedPage = window.localStorage.getItem(SESSION_PAGE_KEY) as Page | null;
      setCurrentUser(parsedUser);
      setCurrentPage(savedPage && savedPage !== 'login' && canAccessPage(parsedUser, savedPage) ? savedPage : getDefaultPageForUser(parsedUser));
    } catch {
      window.localStorage.removeItem(SESSION_USER_KEY);
      window.localStorage.removeItem(SESSION_PAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const loadStoreBrand = async () => {
      if (!currentUser?.id || currentUser.role === 'SUPERADMIN') {
        setStoreBrand({ name: null, logo: null });
        return;
      }

      const defaultLogo = getDefaultStoreLogo(currentUser.store_type);
      const shouldUseStrictDefaultLogo = currentUser.store_type === 'RESTAURANT' || currentUser.store_type === 'RETAIL_STORE';

      try {
        const response = await fetch(`${getApiBaseUrl()}/admin/store-information?admin_user_id=${currentUser.id}`);
        const data = await response.json();

        if (response.ok) {
          setStoreBrand({
            name: data.business_name ?? currentUser.store_name ?? null,
            logo: shouldUseStrictDefaultLogo ? defaultLogo : data.logo || defaultLogo,
            business_description: data.business_description ?? null,
            address: data.address ?? null,
            contact_number: data.contact_number ?? null,
            email: data.email ?? null,
            receipt_thank_you_message: data.receipt_thank_you_message ?? null,
            receipt_footer_message: data.receipt_footer_message ?? null,
            operating_hours: data.operating_hours ?? null,
          });
        }
      } catch {
        setStoreBrand({ name: currentUser.store_name ?? null, logo: defaultLogo });
      }
    };

    void loadStoreBrand();
  }, [currentUser?.id, currentUser?.role, currentUser?.store_name, currentUser?.store_type]);

  useEffect(() => {
    if (isInventoryPage(currentPage) && !INVENTORY_MODULES_ENABLED) {
      setCurrentPage(currentUser ? getDefaultPageForUser(currentUser) : 'login');
      window.localStorage.removeItem(SESSION_PAGE_KEY);
    }
  }, [currentPage, currentUser]);

  const handleLogin = (user: AuthenticatedUser) => {
    setCurrentUser(user);
    window.localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));

    if (user.role === 'SUPERADMIN') {
      navigateTo('superadmin-dashboard');
      return;
    }

    if (user.role === 'ADMIN' && user.store_type === 'RETAIL_STORE') {
      navigateTo('retail-pos-dashboard');
      return;
    }

    if (user.role === 'ADMIN' && user.store_type === 'RESTAURANT') {
      navigateTo('pos-dashboard');
      return;
    }

    if (user.role === 'STAFF' && user.store_type === 'RETAIL_STORE') {
      navigateTo(getDefaultPageForUser(user));
      return;
    }

    if (user.role === 'STAFF' && user.store_type === 'RESTAURANT') {
      navigateTo(getDefaultPageForUser(user));
      return;
    }

    navigateTo('login');
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_USER_KEY);
    window.localStorage.removeItem(SESSION_PAGE_KEY);
    setCurrentUser(null);
    setCurrentPage('login');
    setCurrentOrder(null);
    setStoreBrand({ name: null, logo: null });
  };

  const navigateTo = (page: Page) => {
    if (page === 'inventory-user-management') {
      page = 'admin-dashboard';
    }

    if (isInventoryPage(page) && !INVENTORY_MODULES_ENABLED) {
      page = currentUser ? getDefaultPageForUser(currentUser) : 'login';
    }

    if (page === 'login') {
      window.localStorage.removeItem(SESSION_PAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_PAGE_KEY, page);
    }
    setCurrentPage(page);
  };

  const updateCurrentUser = (updates: Partial<AuthenticatedUser>) => {
    setCurrentUser((user) => (user ? { ...user, ...updates } : user));
  };

  return (
    <QueryClientProvider client={appQueryClient}>
      <div className="size-full bg-background">
        <StoreSettingsProvider currentUser={currentUser}>
          <AppAlertProvider>
            <OrderProvider currentUser={currentUser}>
              <TableProvider>
          {currentPage === 'login' && (
            <LoginPage onLogin={handleLogin} />
          )}
          {currentPage === 'superadmin-dashboard' && (
            <SuperadminDashboard currentUser={currentUser} onLogout={handleLogout} />
          )}
          {currentPage === 'admin-dashboard' && (
            <AdminDashboard currentUser={currentUser} storeBrand={storeBrand} onLogout={handleLogout} onNavigate={navigateTo} />
          )}
          {currentPage === 'retail-dashboard' && (
            <RetailDashboard currentUser={currentUser} onLogout={handleLogout} onNavigate={navigateTo} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {(currentPage === 'retail-pos-dashboard' || currentPage === 'retail-sales' || currentPage === 'retail-transactions' || currentPage === 'retail-reports') && (
            <RetailOrderProvider currentUser={currentUser}>
              {currentPage === 'retail-pos-dashboard' && (
                <RetailPOSDashboard
                  onLogout={handleLogout}
                  onNavigate={navigateTo}
                  isAdmin={currentUser?.role === 'ADMIN'}
                  storeBrand={storeBrand}
                  userName={currentUser?.full_name}
                  storeType={currentUser?.store_type}
                  staffType={currentUser?.staff_type}
                />
              )}
              {currentPage === 'retail-sales' && (
                <RetailCreateOrder
                  currentUser={currentUser}
                  onNavigate={navigateTo}
                  onOrderCreated={setCurrentOrder}
                  onLogout={handleLogout}
                  storeBrand={storeBrand}
                  userName={currentUser?.full_name}
                  storeType={currentUser?.store_type}
                  staffType={currentUser?.staff_type}
                />
              )}
              {currentPage === 'retail-transactions' && (
                <RetailOrderList
                  onNavigate={navigateTo}
                  onLogout={handleLogout}
                  isAdmin={currentUser?.role === 'ADMIN'}
                  storeBrand={storeBrand}
                  userName={currentUser?.full_name}
                  storeType={currentUser?.store_type}
                  staffType={currentUser?.staff_type}
                />
              )}
              {currentPage === 'retail-reports' && (
                <RetailReports
                  onNavigate={navigateTo}
                  onLogout={handleLogout}
                  isAdmin={currentUser?.role === 'ADMIN'}
                  storeBrand={storeBrand}
                  userName={currentUser?.full_name}
                  storeType={currentUser?.store_type}
                  staffType={currentUser?.staff_type}
                />
              )}
            </RetailOrderProvider>
          )}
          {currentPage === 'pos-dashboard' && (
            <POSDashboard onLogout={handleLogout} onNavigate={navigateTo} isAdmin={currentUser?.role === 'ADMIN'} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {currentPage === 'create-order' && (
            <CreateOrder currentUser={currentUser} onNavigate={navigateTo} onOrderCreated={setCurrentOrder} onLogout={handleLogout} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {currentPage === 'table-management' && (
            <TableManagementRoute
              currentUser={currentUser}
              currentOrder={currentOrder}
              onNavigate={navigateTo}
              onLogout={handleLogout}
              storeBrand={storeBrand}
            />
          )}
          {currentPage === 'payment' && (
            <Payment currentUser={currentUser} onNavigate={navigateTo} currentOrder={currentOrder} onLogout={handleLogout} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {currentPage === 'receipt' && (
            <Receipt onNavigate={navigateTo} currentOrder={currentOrder} onLogout={handleLogout} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {currentPage === 'order-list' && (
            <OrderList onNavigate={navigateTo} onLogout={handleLogout} isAdmin={currentUser?.role === 'ADMIN'} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {currentPage === 'reports' && (
            <Reports onNavigate={navigateTo} onLogout={handleLogout} isAdmin={currentUser?.role === 'ADMIN'} storeBrand={storeBrand} userName={currentUser?.full_name} storeType={currentUser?.store_type} staffType={currentUser?.staff_type} />
          )}
          {currentPage === 'store-information' && (
            <StoreInformation
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigate={navigateTo}
              onUserUpdate={updateCurrentUser}
              onStoreBrandUpdate={setStoreBrand}
              storeBrand={storeBrand}
            />
          )}
          {currentPage === 'store-settings' && (
            <StoreSettings currentUser={currentUser} storeBrand={storeBrand} onLogout={handleLogout} onNavigate={navigateTo} />
          )}
          {isInventoryPage(currentPage) && INVENTORY_MODULES_ENABLED && (
            <div className="flex h-screen">
              <div className="shrink-0">
                <Sidebar
                  currentPage={currentPage}
                  storeBrand={storeBrand}
                  onLogout={handleLogout}
                  onNavigate={navigateTo}
                  isAdmin={currentUser?.role === 'ADMIN'}
                  userName={currentUser?.full_name}
                  storeType={currentUser?.store_type}
                  staffType={currentUser?.staff_type}
                  inventoryEnabled={INVENTORY_MODULES_ENABLED}
                />
              </div>
              <InventoryModulePage currentPage={currentPage} currentUser={currentUser} />
            </div>
          )}
              </TableProvider>
            </OrderProvider>
          </AppAlertProvider>
        </StoreSettingsProvider>
      </div>
    </QueryClientProvider>
  );
}

function getDefaultPageForUser(user: AuthenticatedUser): Page {
  if (user.role === 'SUPERADMIN') return 'superadmin-dashboard';
  if (INVENTORY_MODULES_ENABLED && user.role === 'STAFF' && user.staff_type === 'INVENTORY_STAFF') return 'inventory-dashboard';
  if (INVENTORY_MODULES_ENABLED && user.role === 'STAFF' && user.staff_type === 'MANAGER') return 'inventory-dashboard';
  if (user.store_type === 'RETAIL_STORE') return 'retail-pos-dashboard';
  if (user.store_type === 'RESTAURANT') return 'pos-dashboard';
  return 'login';
}

function isInventoryPage(page: Page) {
  return page.startsWith('inventory-');
}

function canAccessPage(user: AuthenticatedUser, page: Page) {
  if (page === 'inventory-user-management') {
    return false;
  }

  if (isInventoryPage(page) && !INVENTORY_MODULES_ENABLED) {
    return false;
  }

  if (page === 'login') return true;
  if (user.role === 'SUPERADMIN') return page === 'superadmin-dashboard';
  if (user.role === 'ADMIN') return page !== 'superadmin-dashboard';

  if (user.staff_type === 'INVENTORY_STAFF') {
    return isInventoryPage(page);
  }

  if (user.staff_type === 'MANAGER') {
    return isInventoryPage(page) || isPosPage(page);
  }

  return isPosPage(page);
}

function isPosPage(page: Page) {
  return [
    'retail-dashboard',
    'retail-pos-dashboard',
    'retail-sales',
    'retail-transactions',
    'retail-reports',
    'pos-dashboard',
    'create-order',
    'table-management',
    'payment',
    'receipt',
    'order-list',
    'reports',
  ].includes(page);
}

function TableManagementRoute({
  currentUser,
  currentOrder,
  onNavigate,
  onLogout,
  storeBrand,
}: {
  currentUser: AuthenticatedUser | null;
  currentOrder: any;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  storeBrand: StoreBrand;
}) {
  const { settings } = useStoreSettings();

  useEffect(() => {
    if (!settings.enable_table_management) {
      onNavigate('pos-dashboard');
    }
  }, [settings.enable_table_management, onNavigate]);

  if (!settings.enable_table_management) {
    return (
      <POSDashboard
        onLogout={onLogout}
        onNavigate={onNavigate}
        isAdmin={currentUser?.role === 'ADMIN'}
        storeBrand={storeBrand}
        userName={currentUser?.full_name}
        storeType={currentUser?.store_type}
        staffType={currentUser?.staff_type}
      />
    );
  }

  return (
    <TableManagement
      onNavigate={onNavigate}
      currentOrder={currentOrder}
      onLogout={onLogout}
      storeBrand={storeBrand}
      userName={currentUser?.full_name}
      storeType={currentUser?.store_type}
      staffType={currentUser?.staff_type}
    />
  );
}
