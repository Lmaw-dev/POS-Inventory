import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';

export type ViewType =
  | 'dashboard'
  | 'stock-alerts'
  | 'inventory'
  | 'product-management'
  | 'pos'
  | 'sales-history'
  | 'purchase-orders'
  | 'products-received'
  | 'item-bundling'
  | 'transfers'
  | 'stock-adjustments'
  | 'multilocation'
  | 'reports'
  | 'user-management'
  | 'restaurant-ingredients'
  | 'restaurant-menu-items'
  | 'restaurant-recipes'
  | 'restaurant-kitchen-orders'
  | 'restaurant-spoilage'
  | 'restaurant-dashboard'
  | 'restaurant-stock-control'
  | 'restaurant-food-inventory'
  | 'restaurant-product-management'
  | 'restaurant-purchase-orders'
  | 'restaurant-goods-received'
  | 'restaurant-pos'
  | 'restaurant-recipe-bom'
  | 'restaurant-transfers'
  | 'restaurant-stock-adjustments'
  | 'restaurant-reports'
  | 'restaurant-multilocation';

export function useViewNavigation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView =
    (searchParams.get('view') as ViewType | null) ?? 'dashboard';

  const navigateToView = useCallback(
    (view: ViewType, replace = false) => {
      const next = new URLSearchParams(searchParams);
      next.set('view', view);
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const handleRestaurantNavigation = (event: Event) => {
      const view = (event as CustomEvent<ViewType>).detail;
      if (view) navigateToView(view);
    };
    window.addEventListener('restaurant-navigate', handleRestaurantNavigation);
    return () =>
      window.removeEventListener(
        'restaurant-navigate',
        handleRestaurantNavigation,
      );
  }, [navigateToView]);

  return {
    currentView,
    setCurrentView: (view: ViewType) => navigateToView(view),
    navigateToView,
  };
}
