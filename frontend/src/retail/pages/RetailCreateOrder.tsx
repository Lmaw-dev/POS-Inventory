import { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from '../../shared/components/Sidebar';
import { Page, type StoreBrand } from '../../shared/App';
import type { StaffType, StoreType } from '../../auth/types/auth';
import { Minus, Plus, Search, X, AlertCircle, ShoppingBag, Shirt, Barcode, Receipt, Trash2, Printer } from 'lucide-react';
import { useOrders } from '../context/RetailOrderContext';
import { ThermalReceipt } from './RetailThermalReceipt';
import { useStoreSettings } from '../../shared/context/StoreSettingsContext';
import { DeleteConfirmDialog } from '../../shared/components/DeleteConfirmDialog';
import { getApiBaseUrl } from '../../auth/services/auth';
import type { AuthenticatedUser } from '../../auth/types/auth';
import { getLocalDateKey } from '../../shared/utils/date';
import { useCompletePaymentMutation, usePosMenuQuery } from '../../features/pos/hooks/usePosMenuQuery';

interface RetailCreateOrderProps {
  currentUser: AuthenticatedUser | null;
  onNavigate: (page: Page) => void;
  onOrderCreated: (order: any) => void;
  onLogout: () => void;
  storeBrand?: StoreBrand;
  userName?: string | null;
  storeType?: StoreType;
  staffType?: StaffType;
}

interface CartItem {
  id: number;
  variantId: number;
  code: string;
  name: string;
  category: string;
  size?: string;
  color?: string;
  price: number;
  quantity: number;
  image: string;
  stockQuantity?: number;
}

interface RetailProduct {
  id: number;
  variantId: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  categoryName?: string;
  size?: string;
  color?: string;
  price: number;
  image: string;
  stockQuantity?: number;
}

interface RetailProductGroup extends RetailProduct {
  variants: RetailProduct[];
  totalStockQuantity?: number;
  minPrice: number;
  maxPrice: number;
  sizes: string[];
  colors: string[];
}

export function RetailCreateOrder({ currentUser, onNavigate, onOrderCreated, onLogout, storeBrand, userName, storeType = 'RETAIL_STORE', staffType }: RetailCreateOrderProps) {
  const { addOrder, orders, getCustomerHistory, getRecommendedProducts } = useOrders();
  const { settings, discounts } = useStoreSettings();
  const posMenuQuery = usePosMenuQuery(currentUser?.id);
  const completePaymentMutation = useCompletePaymentMutation();
  const enabledDiscounts = discounts.filter((discount) => discount.is_enabled);
  const transactionNumberRef = useRef(100001);
  const [currentTransactionNumber, setCurrentTransactionNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [hasHistory, setHasHistory] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<RetailProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductGroup, setSelectedProductGroup] = useState<RetailProductGroup | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deletingCartItem, setDeletingCartItem] = useState<{ index: number; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'GCash' | 'PayMaya'>('Cash');
  const [cashAmount, setCashAmount] = useState('');
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [changeAmount, setChangeAmount] = useState(0);
  const [discountType, setDiscountType] = useState<string>('none');
  const [customDiscountPercent, setCustomDiscountPercent] = useState<number>(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Autocomplete for customer
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const customerInputRef = useRef<HTMLDivElement>(null);

  // Scan feedback
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const posProducts = useMemo<RetailProduct[]>(() => {
    return (posMenuQuery.data ?? []).map((product: any) => ({
      id: Number(product.id),
      variantId: Number(product.variant_id),
      code: product.barcode || product.sku || String(product.variant_id || product.id),
      name: product.name,
      description: product.description ?? '',
      category: product.category_name ?? 'Uncategorized',
      categoryName: product.category_name ?? null,
      size: product.size ?? undefined,
      color: product.color ?? undefined,
      price: Number(product.price ?? 0),
      image: product.image_url || storeBrand?.logo || '',
      stockQuantity: Number(product.available_quantity ?? product.stock_quantity ?? 0),
    }));
  }, [posMenuQuery.data, storeBrand?.logo]);
  const dynamicProductCategories = useMemo(
    () => [
      { id: 'all', name: 'All Items' },
      ...Array.from(new Set(posProducts.map((product) => product.category))).map((category) => ({ id: category, name: category })),
    ],
    [posProducts],
  );

  useEffect(() => {
    const highestOrderNumber = orders.reduce((highest, order) => {
      const match = String(order.transactionNumber ?? order.id ?? '').match(/(\d+)$/);
      const numericOrder = match ? Number(match[1]) : 0;
      return Number.isFinite(numericOrder) ? Math.max(highest, numericOrder) : highest;
    }, 100000);

    transactionNumberRef.current = Math.max(transactionNumberRef.current, highestOrderNumber + 1);
  }, [orders]);

  useEffect(() => {
    const loadNextOrderNumber = async () => {
      if (!currentUser?.id) return;

      try {
        const response = await fetch(`${getApiBaseUrl()}/admin/pos/next-order-number?user_id=${currentUser.id}`);
        const data = await response.json();
        const nextOrderNumber = Number(data?.order_number);

        if (response.ok && Number.isFinite(nextOrderNumber)) {
          transactionNumberRef.current = Math.max(transactionNumberRef.current, nextOrderNumber);
        }
      } catch {
        // Existing order history still seeds a reasonable local preview number.
      }
    };

    void loadNextOrderNumber();
  }, [currentUser?.id]);

  // Autocomplete logic
  useEffect(() => {
    if (!customerName.trim()) {
      setShowCustomerSuggestions(false);
      setCustomerSuggestions([]);
      return;
    }

    const uniqueCustomers = Array.from(new Set(
      orders.map(order => order.customer).filter((name): name is string => !!name)
    ));
    const filtered = uniqueCustomers.filter(name =>
      name.toLowerCase().includes(customerName.toLowerCase())
    );
    const exactMatch = filtered.some(name => name.toLowerCase() === customerName.toLowerCase());

    if (filtered.length > 0 && !exactMatch) {
      setCustomerSuggestions(filtered.slice(0, 5));
      setShowCustomerSuggestions(true);
    } else {
      setShowCustomerSuggestions(false);
      setCustomerSuggestions([]);
    }

    setSelectedSuggestionIndex(-1);
  }, [customerName, orders]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (name: string) => {
    setCustomerName(name);
    setShowCustomerSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!showCustomerSuggestions || customerSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < customerSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSelectCustomer(customerSuggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowCustomerSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Customer history and recommendations
  useEffect(() => {
    if (!customerName.trim()) {
      setHasHistory(false);
      setRecommendedProducts([]);
      return;
    }

    const history = getCustomerHistory(customerName);

    if (history) {
      setHasHistory(true);
      const recommendedCategories = getRecommendedProducts(customerName);
      const recommended = posProducts.filter(p =>
        recommendedCategories.includes(p.category)
      ).slice(0, 4);
      setRecommendedProducts(recommended);
    } else {
      setHasHistory(false);
      setRecommendedProducts([]);
    }
  }, [customerName, orders, posProducts]);

  const addToCart = (product: RetailProduct) => {
    const currentQuantity = cart
      .filter((item) => item.variantId === product.variantId)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (product.stockQuantity !== undefined && currentQuantity >= product.stockQuantity) {
      setScanFeedback({ type: 'error', message: `${product.name} is out of stock.` });
      return;
    }

    const existingItemIndex = cart.findIndex(item =>
      item.id === product.id &&
      item.variantId === product.variantId &&
      item.size === product.size &&
      item.color === product.color
    );

    if (existingItemIndex !== -1) {
      setCart(cart.map((item, index) =>
        index === existingItemIndex
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem: CartItem = {
        id: product.id,
        variantId: product.variantId,
        code: product.code,
        name: product.name,
        category: product.category,
        size: product.size,
        color: product.color,
        price: product.price,
        quantity: 1,
        image: product.image,
        stockQuantity: product.stockQuantity,
      };
      setCart([...cart, newItem]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();

      // Check if search query is an exact product code
      const product = posProducts.find(p => p.code.toUpperCase() === searchQuery.toUpperCase());

      if (product) {
        addToCart(product);
        setScanFeedback({ type: 'success', message: `${product.name} added to cart!` });
        setSearchQuery('');

        // Clear feedback after 2 seconds
        setTimeout(() => {
          setScanFeedback(null);
        }, 2000);
      }
    }
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter((_, i) => i !== index));
    } else if (cart[index]?.stockQuantity !== undefined && newQuantity > cart[index].stockQuantity) {
      setScanFeedback({ type: 'error', message: `Only ${cart[index].stockQuantity} ${cart[index].name} available.` });
    } else {
      setCart(cart.map((item, i) =>
        i === index ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    setDeletingCartItem(null);
  };

  const filteredProducts = posProducts.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.color?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedProducts = useMemo<RetailProductGroup[]>(() => {
    const groups = new Map<string, RetailProduct[]>();

    filteredProducts.forEach((product) => {
      const groupKey = `${product.id}-${product.category}-${product.name}`;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), product]);
    });

    return Array.from(groups.values()).map((variants) => {
      const primaryVariant = variants[0];
      const prices = variants.map((variant) => variant.price);
      const stockValues = variants
        .map((variant) => variant.stockQuantity)
        .filter((stock): stock is number => stock !== undefined);

      return {
        ...primaryVariant,
        variants,
        totalStockQuantity: stockValues.length > 0 ? stockValues.reduce((sum, stock) => sum + stock, 0) : undefined,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        sizes: Array.from(new Set(variants.map((variant) => variant.size).filter((size): size is string => !!size))),
        colors: Array.from(new Set(variants.map((variant) => variant.color).filter((color): color is string => !!color))),
      };
    });
  }, [filteredProducts]);

  const handleProductCardClick = (productGroup: RetailProductGroup) => {
    if (productGroup.variants.length === 1) {
      addToCart(productGroup.variants[0]);
      return;
    }

    setSelectedProductGroup(productGroup);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const serviceFee = settings.enable_service_charge ? subtotal * (settings.service_charge_rate / 100) : 0;
  const tax = 0;
  const selectedDiscount = enabledDiscounts.find((item) => String(item.id) === discountType);
  const selectedDiscountName = selectedDiscount?.discount_name ?? '';
  const selectedDiscountRate = selectedDiscount ? Number(selectedDiscount.discount_rate) : 0;

  // Calculate discount
  const discountRate = settings.enable_discount && selectedDiscount ? selectedDiscountRate / 100 : 0;
  const discount = subtotal * discountRate;
  const total = subtotal + serviceFee - discount;

  const validateOrder = (): boolean => {
    if (cart.length === 0) {
      setValidationError('Cart is empty.');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handlePreviewOrder = () => {
    if (validateOrder()) {
      const transNum = String(transactionNumberRef.current).padStart(6, '0');
      setCurrentTransactionNumber(transNum);
      setShowPreview(true);
    }
  };

  const handleConfirmOrder = () => {
    setShowPreview(false);
    setTimeout(() => {
      setShowPayment(true);
    }, 100);
  };

  const handlePaymentSubmit = async () => {
    if (isPaymentSubmitting) return;

    let computedChange = 0;
    if (paymentMethod === 'Cash') {
      const cash = parseFloat(cashAmount);
      if (cash < total) {
        alert('Insufficient amount');
        return;
      }
      computedChange = cash - total;
      setChangeAmount(computedChange);
    } else {
      setChangeAmount(0);
    }

    setIsPaymentSubmitting(true);

    const rawTransactionNumber = currentTransactionNumber || String(transactionNumberRef.current).padStart(6, '0');
    const transactionNumber = String(rawTransactionNumber).match(/(\d+)$/)?.[1] ?? String(transactionNumberRef.current).padStart(6, '0');

    const order = {
      transactionNumber: `RET-${transactionNumber}`,
      customer: customerName.trim() || undefined,
      items: cart.map(item => ({
        name: item.name,
        category: item.category,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      subtotal,
      serviceFee,
      discount,
      discountType: selectedDiscount ? `${selectedDiscountName} (${selectedDiscountRate}%)` : undefined,
      tax,
      amountNumber: total,
      paymentMethod,
      paymentStatus: 'Paid' as const,
      date: getLocalDateKey(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cashReceived: paymentMethod === 'Cash' ? parseFloat(cashAmount) : total,
      changeGiven: paymentMethod === 'Cash' ? computedChange : 0,
      cashier: userName || 'Staff',
    };

    try {
      if (currentUser?.id) {
        const data: any = await completePaymentMutation.mutateAsync({
          user_id: currentUser.id,
          orderNumber: `RET-${transactionNumber}`,
          customerName: order.customer ?? null,
          orderType: 'RETAIL',
          subtotal,
          discount,
          discountType: order.discountType ?? null,
          serviceFee,
          tax,
          total,
          items: cart.map((item) => ({
            productId: item.id,
            variantId: item.variantId,
            name: item.name,
            categoryName: item.category,
            size: item.size ?? null,
            color: item.color ?? null,
            quantity: item.quantity,
            price: item.price,
          })),
          payment: {
            paymentNumber: `PAY-${transactionNumber}`,
            method: paymentMethod,
            amountPaid: paymentMethod === 'Cash' ? parseFloat(cashAmount) : total,
            changeAmount: paymentMethod === 'Cash' ? computedChange : 0,
          },
        });

        order.transactionNumber = data?.order_number ?? order.transactionNumber;
        const savedOrderNumber = Number(String(order.transactionNumber).match(/(\d+)$/)?.[1]);
        if (Number.isFinite(savedOrderNumber)) {
          transactionNumberRef.current = Math.max(transactionNumberRef.current, savedOrderNumber + 1);
        }
        setCurrentTransactionNumber(order.transactionNumber);
      }

      addOrder(order);
      const completedOrderNumber = Number(String(order.transactionNumber).match(/(\d+)$/)?.[1]);
      transactionNumberRef.current = Number.isFinite(completedOrderNumber) ? Math.max(transactionNumberRef.current, completedOrderNumber + 1) : transactionNumberRef.current + 1;
      setCompletedOrder(order);
      setShowPayment(false);

      // Show receipt modal
      setShowReceipt(true);
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleContinueFromReceipt = () => {
    setShowReceipt(false);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setCompletedOrder(null);
    setChangeAmount(0);
    setCart([]);
    setCustomerName('');
    setDiscountType('none');
    setCustomDiscountPercent(0);
    setValidationError('');
    setCurrentTransactionNumber('');
    setCashAmount('');
    setPaymentMethod('Cash');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage="retail-sales" onNavigate={onNavigate} onLogout={onLogout} storeType={storeType} staffType={staffType} storeBrand={storeBrand} userName={userName} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shirt className="w-6 h-6 text-primary" />
            <h2 className="text-lg">Ukay-Ukay Products</h2>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name, color, or scan product code (e.g., UKY001)..."
                className="w-full pl-9 pr-10 py-2.5 border-2 border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                autoComplete="off"
              />
            </div>
            {scanFeedback && (
              <div className={`mt-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                scanFeedback.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {scanFeedback.type === 'success' ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{scanFeedback.message}</span>
              </div>
            )}
          </div>

          {hasHistory && recommendedProducts.length > 0 && (
            <div className="mb-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-4 border-2 border-emerald-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-[#00a7a5] rounded-full animate-pulse"></div>
                <p className="text-sm font-medium text-emerald-900">
                  ⭐ Recommended for {customerName}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendedProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-lg p-3 text-left hover:shadow-lg transition-all border border-emerald-200 hover:border-emerald-400"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 bg-muted ring-2 ring-emerald-300">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-xs text-center mb-1">{product.name}</h3>
                    {product.description && <p className="text-[10px] text-muted-foreground text-center line-clamp-2 mb-1">{product.description}</p>}
                    <p className="text-xs text-center text-primary">₱ {product.price.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-1 mb-4 inline-flex gap-1 flex-wrap">
            {dynamicProductCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {groupedProducts.map(product => (
              <button
                key={`${product.id}-${product.category}-${product.name}`}
                onClick={() => handleProductCardClick(product)}
                disabled={product.totalStockQuantity !== undefined && product.totalStockQuantity <= 0}
                className="bg-white rounded-lg p-2.5 hover:shadow-md transition-shadow text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute bottom-1 right-1 max-w-[78%] truncate rounded border border-gray-200 bg-white/90 px-1 py-0.5 font-mono text-[9px] leading-none text-gray-500"
                    title={product.variants.length === 1 ? `SKU/Barcode: ${product.code}` : `${product.variants.length} variants available`}
                  >
                    {product.variants.length === 1 ? product.code : `${product.variants.length} variants`}
                  </div>
                </div>
                <h3 className="text-xs font-medium mb-0.5 line-clamp-1">{product.name}</h3>
                {product.description && <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1">{product.description}</p>}
                <div className="flex gap-1 mb-1 flex-wrap">
                  {product.sizes.length > 0 && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {product.sizes.length === 1 ? `Size: ${product.sizes[0]}` : `${product.sizes.length} sizes`}
                    </span>
                  )}
                  {product.colors.length > 0 && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {product.colors.length === 1 ? product.colors[0] : `${product.colors.length} colors`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-primary font-medium">
                  {product.minPrice === product.maxPrice
                    ? `₱ ${product.minPrice.toFixed(2)}`
                    : `₱ ${product.minPrice.toFixed(2)} - ₱ ${product.maxPrice.toFixed(2)}`}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar - Cart */}
      <div className="w-80 bg-white border-l border-border p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium">Shopping Cart</h3>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-muted-foreground mb-1.5">Customer Name (Optional):</label>
          <div ref={customerInputRef} className="relative">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={handleCustomerKeyDown}
              placeholder="Enter customer name (optional)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50"
              autoComplete="off"
            />

            {showCustomerSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {customerSuggestions.map((name, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectCustomer(name)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center gap-2 ${
                      index === selectedSuggestionIndex ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-medium text-xs">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">
                        {orders.filter(o => o.customer && o.customer.toLowerCase() === name.toLowerCase()).length} previous purchases
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto mb-4">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, index) => (
                <div key={`cart-${index}`} className="border border-border rounded-lg p-2 bg-gray-50">
                  <div className="flex items-start gap-2">
                    <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="mb-0.5 max-w-full truncate font-mono text-[10px] leading-tight text-gray-500" title={`SKU/Barcode: ${item.code}`}>{item.code}</p>
                      <div className="flex gap-1 mb-1 flex-wrap">
                        {item.size && (
                          <span className="text-xs bg-white px-1 py-0.5 rounded border">{item.size}</span>
                        )}
                        {item.color && (
                          <span className="text-xs bg-white px-1 py-0.5 rounded border">{item.color}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">₱ {item.price.toFixed(2)} each</p>
                      <p className="text-xs text-primary font-medium">₱ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                          className="w-5 h-5 rounded bg-white border hover:bg-gray-100 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                          className="w-5 h-5 rounded bg-white border hover:bg-gray-100 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => setDeletingCartItem({ index, name: item.name })}
                        className="w-5 h-5 rounded bg-white border border-red-200 hover:bg-red-50 flex items-center justify-center text-red-600"
                        title="Remove item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5 mb-4 text-xs border-t border-border pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>₱ {subtotal.toFixed(2)}</span>
          </div>
          {settings.enable_service_charge && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Fee ({settings.service_charge_rate}%):</span>
              <span>PHP {serviceFee.toFixed(2)}</span>
            </div>
          )}
          {settings.enable_discount && (
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">Discount:</span>
              <button
                onClick={() => setShowDiscountModal(true)}
                className="text-xs text-primary hover:underline"
              >
                {discount > 0 ? 'Edit' : 'Add Discount'}
              </button>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-destructive text-xs">
                <span>
                  {selectedDiscountName} ({selectedDiscountRate}%)
                </span>
                <span>- ₱ {discount.toFixed(2)}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No discount applied</p>
            )}
          </div>
          )}

          <div className="flex justify-between pt-2 border-t border-border font-medium">
            <span>TOTAL:</span>
            <span className="text-primary">₱ {total.toFixed(2)}</span>
          </div>
        </div>

        {validationError && (
          <div className="mb-3 bg-destructive/10 border border-destructive/20 rounded-lg p-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{validationError}</p>
          </div>
        )}

        <button
          onClick={handlePreviewOrder}
          className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          Proceed to Checkout
        </button>
      </div>

      {/* Variant Picker Modal */}
      {selectedProductGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-lg text-primary">{selectedProductGroup.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedProductGroup.variants.length} variants available</p>
              </div>
              <button onClick={() => setSelectedProductGroup(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="space-y-2">
                {selectedProductGroup.variants.map((variant) => (
                  <button
                    key={`${variant.id}-${variant.variantId}`}
                    onClick={() => {
                      addToCart(variant);
                      setSelectedProductGroup(null);
                    }}
                    disabled={variant.stockQuantity !== undefined && variant.stockQuantity <= 0}
                    className="w-full border border-border rounded-lg p-3 text-left hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{variant.name}</p>
                            <p className="font-mono text-[10px] text-gray-500 truncate">{variant.code}</p>
                          </div>
                          <p className="text-sm font-medium text-primary flex-shrink-0">PHP {variant.price.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {variant.size && <span className="text-xs bg-white px-1.5 py-0.5 rounded border">Size: {variant.size}</span>}
                          {variant.color && <span className="text-xs bg-white px-1.5 py-0.5 rounded border">{variant.color}</span>}
                          {variant.stockQuantity !== undefined && (
                            <span className="text-xs bg-white px-1.5 py-0.5 rounded border">{variant.stockQuantity} stock</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-8 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border flex-shrink-0">
              <h2 className="text-lg text-primary">Order Preview</h2>
              <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <div className="mb-4 space-y-1">
                <p className="text-sm"><strong>Transaction #:</strong> RET-{currentTransactionNumber}</p>
                <p className="text-sm"><strong>Customer:</strong> {customerName.trim() || 'Walk-in Customer'}</p>
              </div>

              <h3 className="text-sm font-medium mb-2">Items:</h3>
              <div className="space-y-2 mb-4">
                {cart.map((item, index) => (
                  <div key={`preview-${index}`} className="border border-border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-medium">{item.name} x{item.quantity}</p>
                      <p className="text-sm font-medium">₱{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1">
                      {item.size && <span className="text-xs bg-white px-2 py-0.5 rounded">Size: {item.size}</span>}
                      {item.color && <span className="text-xs bg-white px-2 py-0.5 rounded">{item.color}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount:</span>
                    <span>- ₱{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-medium text-primary border-t border-border pt-2">
                  <span>Total Amount:</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={() => setShowPreview(false)} className="flex-1 px-6 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium">
                Back to Edit
              </button>
              <button onClick={handleConfirmOrder} className="flex-1 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all text-sm font-semibold">
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md my-8 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border flex-shrink-0">
              <h2 className="text-lg text-primary">Payment Summary</h2>
              <button onClick={() => setShowPayment(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-sm mb-2"><strong>Order Number:</strong> RET-{currentTransactionNumber}</p>
                <p className="text-sm mb-2"><strong>Customer:</strong> {customerName.trim() || 'Walk-in Customer'}</p>
                <div className="bg-muted rounded-lg p-3 mb-3">
                  <h4 className="text-xs font-medium mb-2">Ordered Items:</h4>
                  <div className="space-y-1">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate">
                          {item.quantity}x {item.name}
                          {(item.size || item.color) && (
                            <span className="text-muted-foreground"> {item.size ? `| ${item.size}` : ''}{item.color ? ` · ${item.color}` : ''}</span>
                          )}
                        </span>
                        <span className="shrink-0">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4 mb-4">
                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>₱{subtotal.toFixed(2)}</span>
                  </div>
                  {settings.enable_service_charge && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Service Fee ({settings.service_charge_rate}%):</span>
                      <span>₱{serviceFee.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-destructive text-xs">
                      <span>Discount:</span>
                      <span>- ₱{discount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Total Amount Due</p>
                  <p className="text-3xl text-primary font-medium">₱ {total.toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'Card', 'GCash', 'PayMaya'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-2 rounded-lg border transition-colors text-sm ${
                        paymentMethod === method
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'Cash' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Cash Received</label>
                    <input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 border border-border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                  </div>

                  {cashAmount && parseFloat(cashAmount) >= total && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-muted-foreground mb-1">Change</p>
                      <p className="text-2xl text-green-600 font-medium">₱ {(parseFloat(cashAmount) - total).toFixed(2)}</p>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPayment(false)}
                  disabled={isPaymentSubmitting}
                  className="flex-1 border border-border py-3 rounded-lg hover:bg-muted transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={isPaymentSubmitting || (paymentMethod === 'Cash' && (!cashAmount || parseFloat(cashAmount) < total))}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPaymentSubmitting ? 'Processing...' : 'Complete Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && completedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="overflow-y-auto flex-1">
              <ThermalReceipt
                orderNumber={completedOrder.transactionNumber || completedOrder.id || 'N/A'}
                customerName={completedOrder.customer || 'Walk-in Customer'}
                items={completedOrder.items || []}
                subtotal={completedOrder.subtotal || 0}
                serviceFee={completedOrder.serviceFee || 0}
                tax={completedOrder.tax || 0}
                discount={completedOrder.discount || 0}
                discountType={completedOrder.discountType}
                total={completedOrder.amountNumber || 0}
                cashReceived={completedOrder.cashReceived}
                changeGiven={completedOrder.changeGiven}
                paymentMethod={completedOrder.paymentMethod}
                date={completedOrder.date}
                time={completedOrder.time}
                receiptId={completedOrder.receiptId}
                paymentId={completedOrder.paymentId}
                cashier={completedOrder.cashier}
                storeBrand={storeBrand}
              />
            </div>
            <div className="p-4 border-t border-border flex gap-3 bg-white">
              <button
                onClick={handleContinueFromReceipt}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                Continue
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && completedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl text-primary mb-2">Payment Successful!</h2>
              <p className="text-sm text-muted-foreground mb-6">Transaction has been completed successfully.</p>

              <button
                onClick={handleSuccessClose}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                New Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg text-primary">Apply Discount</h2>
              <button onClick={() => setShowDiscountModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                <label className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                  <input
                    type="radio"
                    name="discount"
                    value="none"
                    checked={discountType === 'none'}
                    onChange={() => setDiscountType('none')}
                    className="accent-primary"
                  />
                  <span className="text-sm">No Discount</span>
                </label>
                {enabledDiscounts.map((discountSetting) => (
                  <label key={discountSetting.id} className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                    <input
                      type="radio"
                      name="discount"
                      value={discountSetting.id}
                      checked={discountType === String(discountSetting.id)}
                      onChange={() => setDiscountType(String(discountSetting.id))}
                      className="accent-primary"
                    />
                    <span className="text-sm">{discountSetting.discount_name} - {Number(discountSetting.discount_rate).toFixed(2)}%</span>
                  </label>
                ))}

                {false && discountType === 'custom' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-2">Discount Percentage</label>
                    <input
                      type="number"
                      value={customDiscountPercent}
                      onChange={(e) => setCustomDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                      placeholder="0-100"
                      max="100"
                      min="0"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
              <button onClick={() => setShowDiscountModal(false)} className="w-full mt-4 bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      <DeleteConfirmDialog
        isOpen={Boolean(deletingCartItem)}
        title="Confirm Delete"
        description={`Are you sure you want to delete ${deletingCartItem?.name ?? 'this item'} from the order?`}
        onCancel={() => setDeletingCartItem(null)}
        onConfirm={() => {
          if (deletingCartItem) removeItem(deletingCartItem.index);
        }}
      />
    </div>
  );
}



